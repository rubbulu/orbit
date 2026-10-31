import { GoogleGenAI, Type } from '@google/genai';
import { OrbitState, DigestPerson, DigestResponse } from '../../shared/types.js';
import { executeWithModelFallback } from './models.js';

interface CachedDigest {
  key: string;
  response: DigestResponse;
}

let digestCache: CachedDigest | null = null;

function computeStateKey(state: OrbitState): string {
  const unresolvedConflicts = (state.conflicts || []).filter(c => !c.resolved).map(c => c.id).join(',');
  const decIds = state.decisions.map(d => `${d.id}:${d.status}`).join(',');
  const actIds = state.actionItems.map(a => `${a.id}:${a.status}`).join(',');
  return `${state.meetings.length}_${decIds}_${actIds}_${unresolvedConflicts}`;
}

const digestSummarySchema = {
  type: Type.OBJECT,
  properties: {
    summaries: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "The name of the team member exactly as provided",
          },
          summary: {
            type: Type.STRING,
            description: "A sharp, executive one-line summary (under 20 words) capturing their key operational focus, current obligations, or active conflicts.",
          },
        },
        required: ["name", "summary"],
      },
    },
  },
  required: ["summaries"],
};

export async function generateWeeklyDigest(state: OrbitState): Promise<DigestResponse> {
  const currentKey = computeStateKey(state);

  // Return cached result if data has not changed
  if (digestCache && digestCache.key === currentKey) {
    console.log('[DIGEST] Serving cached weekly digest.');
    return {
      ...digestCache.response,
      cached: true
    };
  }

  // 1. Collect all distinct people
  const peopleMap = new Map<string, {
    name: string;
    initials: string;
    decisions: Array<{ id: string; text: string; status: any; meetingTitle: string }>;
    openTasks: Array<{ id: string; task: string; deadline: string; status: any; trackerUrl?: string }>;
    conflicts: Array<{ id: string; description: string; partnerId: string }>;
  }>();

  const getOrCreate = (name: string) => {
    const trimmed = name.trim();
    if (!peopleMap.has(trimmed)) {
      const parts = trimmed.split(/\s+/);
      const initials = parts.length > 1 
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : trimmed.substring(0, 2).toUpperCase();

      peopleMap.set(trimmed, {
        name: trimmed,
        initials,
        decisions: [],
        openTasks: [],
        conflicts: []
      });
    }
    return peopleMap.get(trimmed)!;
  };

  // Seed with meeting participants
  for (const m of state.meetings) {
    for (const p of m.participants) {
      getOrCreate(p);
    }
  }

  // Map Decisions
  const unresolvedConflicts = (state.conflicts || []).filter(c => !c.resolved);

  for (const d of state.decisions) {
    const person = getOrCreate(d.madeBy);
    const meeting = state.meetings.find(m => m.id === d.meetingId);
    person.decisions.push({
      id: d.id,
      text: d.text,
      status: d.status,
      meetingTitle: meeting?.title || d.meetingId
    });

    // Check if this decision is in active conflict
    const activeConf = unresolvedConflicts.find(c => c.newDecisionId === d.id || c.existingDecisionId === d.id);
    if (activeConf) {
      const partnerId = activeConf.newDecisionId === d.id ? activeConf.existingDecisionId : activeConf.newDecisionId;
      person.conflicts.push({
        id: activeConf.id,
        description: activeConf.explanation,
        partnerId
      });
    }
  }

  // Map Action Items
  for (const a of state.actionItems) {
    if (a.owner) {
      const person = getOrCreate(a.owner);
      if (a.status !== 'completed') {
        person.openTasks.push({
          id: a.id,
          task: a.task,
          deadline: a.deadline,
          status: a.status,
          trackerUrl: a.trackerUrl
        });
      }
    }
  }

  const peopleList = Array.from(peopleMap.values()).filter(p => 
    p.decisions.length > 0 || p.openTasks.length > 0 || p.conflicts.length > 0
  );

  // 2. Generate One-Line AI Summary in single batched call
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const summariesMap = new Map<string, string>();

  if (apiKey && apiKey !== 'your_gemini_api_key_here' && peopleList.length > 0) {
    try {
      const promptData = peopleList.map(p => ({
        name: p.name,
        decisionsCount: p.decisions.length,
        keyDecisions: p.decisions.slice(0, 3).map(d => d.text),
        openTasksCount: p.openTasks.length,
        tasks: p.openTasks.slice(0, 3).map(t => `${t.task} (due: ${t.deadline})`),
        conflictsCount: p.conflicts.length,
        conflicts: p.conflicts.map(c => c.description)
      }));

      const prompt = `Generate a sharp, objective one-line executive summary (maximum 20 words) for each person in the team based on their active commitments and tasks:\n\n${JSON.stringify(promptData, null, 2)}`;

      const ai = new GoogleGenAI({ apiKey });

      const batchResult = await executeWithModelFallback<{ summaries: Array<{ name: string; summary: string }> }>(
        'WEEKLY DIGEST',
        async (modelName: string) => {
          const timeoutPromise = new Promise<never>((_, reject) => {
            const id = setTimeout(() => {
              clearTimeout(id);
              reject(new Error('Digest generation timed out after 25s'));
            }, 25000);
          });

          const apiPromise = ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: 'You are an executive chief of staff for ORBIT. For each person provided, generate a punchy, objective one-line summary (max 20 words) capturing their key operational focus, current obligations, and critical blockers.',
              responseMimeType: 'application/json',
              responseSchema: digestSummarySchema,
              temperature: 0.2,
            },
          });

          const res = await Promise.race([apiPromise, timeoutPromise]);
          const text = res.text?.trim() || '';
          return JSON.parse(text);
        }
      );

      if (batchResult?.summaries && Array.isArray(batchResult.summaries)) {
        for (const item of batchResult.summaries) {
          summariesMap.set(item.name.toLowerCase(), item.summary);
        }
      }
    } catch (err: any) {
      console.warn('[DIGEST] Batch AI summary failed, using deterministic fallbacks:', err?.message || err);
    }
  }

  // 3. Assemble final DigestPerson records
  const digestPeople: DigestPerson[] = peopleList.map(p => {
    let aiSummary = summariesMap.get(p.name.toLowerCase());
    if (!aiSummary) {
      if (p.conflicts.length > 0) {
        aiSummary = `Navigating ${p.conflicts.length} active decision contradiction while managing ${p.openTasks.length} open deliverables.`;
      } else if (p.openTasks.length > 0) {
        aiSummary = `Driving execution on ${p.openTasks.length} open deliverables across ${p.decisions.length} institutional commitments.`;
      } else {
        aiSummary = `Authored ${p.decisions.length} key institutional decisions with all personal deliverables on track.`;
      }
    }

    return {
      name: p.name,
      initials: p.initials,
      decisions: p.decisions,
      openTasks: p.openTasks,
      conflicts: p.conflicts,
      aiSummary
    };
  });

  const response: DigestResponse = {
    people: digestPeople,
    generatedAt: new Date().toISOString(),
    cached: false
  };

  digestCache = {
    key: currentKey,
    response
  };

  return response;
}
