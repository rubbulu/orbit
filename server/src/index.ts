import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storage } from './storage.js';
import { extractMeetingTelemetry } from './extractor.js';
import { detectCrossMeetingConflicts } from './conflictDetector.js';
import { cleanErrorMessage } from './models.js';
import { getGitHubConfig, createGitHubIssue, postGitHubComment } from './github.js';
import { generateWeeklyDigest } from './digest.js';
import { DispatchResponse, DispatchItemResult, ActionItemStatus } from '../../shared/types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Express Rate Limit: 20 requests per minute per IP on sensitive operations
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute per IP
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    error: 'Rate limit exceeded: maximum 20 requests per minute per telemetry node.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// Initialize persistent storage
await storage.init();

// Health check endpoint
app.get('/api/health', (req, res) => {
  const geminiConfigured = Boolean(
    process.env.GEMINI_API_KEY && 
    process.env.GEMINI_API_KEY.trim() !== '' && 
    process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'
  );
  const githubConfigured = Boolean(
    process.env.GITHUB_TOKEN && 
    process.env.GITHUB_TOKEN.trim() !== '' && 
    process.env.GITHUB_TOKEN !== 'your_github_personal_access_token_here' &&
    process.env.GITHUB_TOKEN !== 'your_github_token_here'
  );

  res.json({
    status: 'ok',
    geminiConfigured,
    githubConfigured
  });
});

// Retrieve full orbit constellation state
app.get('/api/state', async (req, res) => {
  try {
    const state = await storage.getState();
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve state' });
  }
});

// Reset storage to pristine hackathon seed state
app.post('/api/reset', async (req, res) => {
  try {
    const state = await storage.reset();
    res.json({ success: true, message: 'ORBIT constellation reset to seed state', state });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset state' });
  }
});

// Transmit, ingest transcript, and run semantic conflict detection (Rate Limited)
app.post('/api/transmit', apiLimiter, async (req, res) => {
  const { title, date, transcript } = req.body;

  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return res.status(400).json({
      error: 'Transcript is required to transmit signal.',
      code: 'INVALID_TRANSCRIPT'
    });
  }

  try {
    console.log(`[ORBIT_CORE] Ingesting transmission (${transcript.length} chars)...`);
    
    // Read state before appending to know who the historical decisions were
    const preState = await storage.getState();
    const existingHistoricalDecisions = [...preState.decisions];

    // 1. Extract telemetry via Gemini with structured output
    const extracted = await extractMeetingTelemetry({
      transcript,
      meetingDate: date,
      titleHint: title
    });

    console.log(
      `[ORBIT_CORE] Extracted ${extracted.decisions.length} decisions and ${extracted.actionItems.length} action items.`
    );

    // 2. Persist to storage with sequential IDs
    const appendResult = await storage.appendExtractedMeeting({
      title: extracted.meetingTitle || title || 'Synchronized Meeting',
      date: date || new Date().toISOString().split('T')[0],
      participants: extracted.participants,
      transcript,
      rawDecisions: extracted.decisions,
      rawActionItems: extracted.actionItems
    });

    // 3. Run Semantic Cross-Meeting Conflict Detection against prior memory
    let detectedConflicts: any[] = [];
    let finalState = appendResult.updatedState;

    try {
      console.log(`[ORBIT_CORE] Running cross-meeting conflict detection against ${existingHistoricalDecisions.length} historical decisions...`);
      const rawConflicts = await detectCrossMeetingConflicts({
        newDecisions: appendResult.decisions,
        existingDecisions: existingHistoricalDecisions
      });

      if (rawConflicts.length > 0) {
        console.log(`[ORBIT_CORE] Registering ${rawConflicts.length} new conflict record(s)...`);
        const conflictRes = await storage.appendConflicts(rawConflicts);
        detectedConflicts = conflictRes.conflicts;
        finalState = conflictRes.updatedState;
      }
    } catch (confErr: any) {
      console.warn('[ORBIT_CORE] Conflict detection had a warning, proceeding safely:', confErr?.message || confErr);
    }

    // 4. Return newly created records + updated state
    return res.json({
      success: true,
      meeting: appendResult.meeting,
      decisions: appendResult.decisions,
      actionItems: appendResult.actionItems,
      conflicts: detectedConflicts,
      state: finalState
    });

  } catch (err: any) {
    console.error('[ORBIT_CORE] Transmission processing failed:', err?.message || err);

    if (err.code === 'KEY_MISSING') {
      return res.status(400).json({
        error: 'GEMINI_API_KEY is not configured in server/.env. Please add your Google Gemini API key to server/.env to extract decisions from transcripts.',
        code: 'KEY_MISSING'
      });
    }

    if (err.code === 'TIMEOUT') {
      return res.status(504).json({
        error: 'Telemetry analysis timed out after 30 seconds. Please try again with a shorter excerpt.',
        code: 'TIMEOUT'
      });
    }

    const sanitizedError = cleanErrorMessage(err);
    return res.status(500).json({
      error: sanitizedError,
      code: err.code || 'EXTRACTION_FAILED'
    });
  }
});

// Resolve a detected conflict (keep_existing | keep_new | keep_both)
app.post('/api/conflicts/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const { resolution, note } = req.body;

  if (!['keep_existing', 'keep_new', 'keep_both'].includes(resolution)) {
    return res.status(400).json({
      error: 'Invalid resolution. Must be "keep_existing", "keep_new", or "keep_both".'
    });
  }

  try {
    const result = await storage.resolveConflict(id, resolution, note);
    console.log(`[ORBIT_CORE] Conflict ${id} resolved with ${resolution}`);
    res.json({
      success: true,
      resolvedConflict: result.resolvedConflict,
      state: result.state
    });
  } catch (err: any) {
    console.error(`[ORBIT_CORE] Failed to resolve conflict ${id}:`, err?.message || err);
    res.status(500).json({ error: err.message || 'Failed to resolve conflict' });
  }
});

// Status of task tracker (GitHub or Local fallback)
app.get('/api/tracker/status', (req, res) => {
  const gh = getGitHubConfig();
  res.json({
    configured: gh.isConfigured,
    repo: gh.repo,
    mode: gh.isConfigured ? 'github' : 'local',
    label: gh.isConfigured 
      ? `GitHub Issues (${gh.repo})`
      : 'LOCAL TRACKER (add GITHUB_TOKEN to sync)'
  });
});

// Real Tracker Dispatch (GitHub Issues with local fallback, Rate Limited)
app.post('/api/actions/dispatch', apiLimiter, async (req, res) => {
  const { actionIds } = req.body;
  if (!Array.isArray(actionIds) || actionIds.length === 0) {
    return res.status(400).json({ error: 'No action IDs specified for dispatch' });
  }

  const state = await storage.getState();
  const gh = getGitHubConfig();
  const results: DispatchItemResult[] = [];
  const updates: Array<{ id: string; status?: ActionItemStatus; trackerUrl?: string }> = [];

  const unresolvedConflictDecisions = new Set<string>();
  for (const c of (state.conflicts || [])) {
    if (!c.resolved) {
      unresolvedConflictDecisions.add(c.newDecisionId);
      unresolvedConflictDecisions.add(c.existingDecisionId);
    }
  }

  for (const actId of actionIds) {
    const context = await storage.getActionWithContext(actId);
    if (!context) {
      results.push({
        actionId: actId,
        task: 'Unknown task',
        owner: 'Unknown',
        success: false,
        error: `Action item ${actId} not found in memory`
      });
      continue;
    }

    const { actionItem, decision, meeting } = context;

    // Never create duplicates: skip items that already have a trackerUrl
    if (actionItem.trackerUrl && actionItem.status === 'dispatched') {
      results.push({
        actionId: actId,
        task: actionItem.task,
        owner: actionItem.owner,
        success: true,
        trackerUrl: actionItem.trackerUrl,
        error: 'Already dispatched to tracker'
      });
      continue;
    }

    // Exclude tasks tied to unresolved conflicts
    if (decision.status === 'conflict' || unresolvedConflictDecisions.has(decision.id)) {
      results.push({
        actionId: actId,
        task: actionItem.task,
        owner: actionItem.owner,
        success: false,
        error: `Tied to unresolved conflict (${decision.id}). Resolve conflict first.`
      });
      continue;
    }

    // Real GitHub dispatch if configured
    if (gh.isConfigured) {
      console.log(`[TRACKER] Creating real GitHub issue in ${gh.repo} for [${actId}]...`);
      const ghResult = await createGitHubIssue({
        task: actionItem.task,
        decisionText: decision.text,
        sourceQuote: decision.sourceQuote || 'Commitment recorded in meeting',
        meetingTitle: meeting.title,
        meetingDate: meeting.date,
        owner: actionItem.owner,
        deadline: actionItem.deadline
      });

      if (ghResult.success && ghResult.issueUrl) {
        updates.push({
          id: actId,
          status: 'dispatched',
          trackerUrl: ghResult.issueUrl
        });
        results.push({
          actionId: actId,
          task: actionItem.task,
          owner: actionItem.owner,
          success: true,
          trackerUrl: ghResult.issueUrl,
          issueNumber: ghResult.issueNumber
        });
      } else {
        // Continue with others on failure as per rules
        results.push({
          actionId: actId,
          task: actionItem.task,
          owner: actionItem.owner,
          success: false,
          error: ghResult.error || 'Failed to create GitHub issue'
        });
      }
    } else {
      // Local-only mode fallback
      const localUrl = `local://tasks/${actId}`;
      updates.push({
        id: actId,
        status: 'dispatched',
        trackerUrl: localUrl
      });
      results.push({
        actionId: actId,
        task: actionItem.task,
        owner: actionItem.owner,
        success: true,
        trackerUrl: localUrl
      });
    }
  }

  let updatedState = state;
  if (updates.length > 0) {
    updatedState = await storage.updateActionItems(updates);
  }

  const dispatchedCount = results.filter(r => r.success && !r.error?.includes('Already')).length;

  const response: DispatchResponse = {
    success: true,
    dispatchedCount,
    results,
    mode: gh.isConfigured ? 'github' : 'local',
    tracker: gh.isConfigured ? `GitHub Issues (${gh.repo})` : 'LOCAL TRACKER (add GITHUB_TOKEN to sync)',
    state: updatedState
  };

  return res.json(response);
});

// Send Reminder Endpoint
app.post('/api/actions/:id/remind', async (req, res) => {
  const { id } = req.params;
  const context = await storage.getActionWithContext(id);

  if (!context) {
    return res.status(404).json({ error: `Action item ${id} not found` });
  }

  const { actionItem, decision } = context;
  const gh = getGitHubConfig();
  let commentPosted = false;

  // If item has a trackerUrl from GitHub, post a comment
  if (gh.isConfigured && actionItem.trackerUrl && actionItem.trackerUrl.includes('github.com')) {
    const match = actionItem.trackerUrl.match(/\/issues\/(\d+)/);
    if (match) {
      const issueNumber = parseInt(match[1], 10);
      const commentBody = `🔔 **Reminder**: Action item due **${actionItem.deadline || 'soon'}**.\n\n*Dispatched via ORBIT for decision ${decision.id}*`;
      const commentRes = await postGitHubComment(issueNumber, commentBody);
      commentPosted = commentRes.success;
    }
  }

  return res.json({
    success: true,
    message: `Reminder sent to ${actionItem.owner}`,
    owner: actionItem.owner,
    commentPosted,
    deadline: actionItem.deadline
  });
});

// Weekly Digest Endpoint (Rate Limited)
app.post('/api/digest', apiLimiter, async (req, res) => {
  try {
    const state = await storage.getState();
    const digest = await generateWeeklyDigest(state);
    res.json(digest);
  } catch (err: any) {
    console.error('[ORBIT_CORE] Failed to generate digest:', err);
    res.status(500).json({ error: 'Failed to generate weekly digest' });
  }
});

// Production Static Client Serving & SPA Fallback (Render Single-Service Deployment)
const getClientDistPath = () => {
  const candidates = [
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(process.cwd(), 'client', 'dist'),
    path.resolve(__dirname, '../../../../client/dist'),
    path.resolve(__dirname, '../../../client/dist'),
    path.resolve(__dirname, '../../client/dist')
  ];
  return candidates.find(c => fs.existsSync(c)) || candidates[0];
};

const clientDistPath = getClientDistPath();

if (fs.existsSync(clientDistPath)) {
  console.log(`[ORBIT_SERVER] Production static asset server active for: ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  // SPA fallback for all non-API paths
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  console.warn(`[ORBIT_SERVER] client/dist not found at ${clientDistPath}. API server running in headless mode.`);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ORBIT_SERVER] Core online at http://localhost:${PORT}`);
});
