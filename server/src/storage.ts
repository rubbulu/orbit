import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  OrbitState, 
  Meeting, 
  Decision, 
  ActionItem, 
  ActionItemStatus,
  ConflictRecord, 
  ConflictResolution,
  ConflictType,
  ConflictSeverity 
} from '../../shared/types.js';
import { INITIAL_ORBIT_STATE } from '../../shared/seedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getCanonicalDataDir = () => {
  const cwd = process.cwd();
  // 1. If running from repo root
  if (fsSync.existsSync(path.join(cwd, 'server', 'data')) || fsSync.existsSync(path.join(cwd, 'server', 'src'))) {
    return path.join(cwd, 'server', 'data');
  }
  // 2. If running from server folder
  if (fsSync.existsSync(path.join(cwd, 'data')) || fsSync.existsSync(path.join(cwd, 'src'))) {
    return path.join(cwd, 'data');
  }
  // 3. Fallback based on __dirname
  return __dirname.includes('dist')
    ? path.resolve(__dirname, '../../../data')
    : path.resolve(__dirname, '../data');
};

const DATA_DIR = getCanonicalDataDir();
const STORE_PATH = path.join(DATA_DIR, 'store.json');

export class StorageManager {
  private initialized = false;

  async init(): Promise<void> {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      try {
        await fs.access(STORE_PATH);
        const stat = await fs.stat(STORE_PATH);
        if (stat.size === 0) {
          console.log('[STORAGE] Empty store.json detected. Initializing with seed state...');
          await this.writeState(INITIAL_ORBIT_STATE);
        }
      } catch {
        // If file doesn't exist, initialize with seed state
        console.log('[STORAGE] store.json does not exist. Initializing from seed state for fresh deployment...');
        await this.writeState(INITIAL_ORBIT_STATE);
      }
      this.initialized = true;
    } catch (err) {
      console.error('[STORAGE] Initialization error:', err);
    }
  }

  async getState(): Promise<OrbitState> {
    if (!this.initialized) await this.init();
    try {
      const raw = await fs.readFile(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as OrbitState;
      if (!parsed.conflicts) {
        parsed.conflicts = INITIAL_ORBIT_STATE.conflicts || [];
      }
      return parsed;
    } catch (err) {
      console.warn('[STORAGE] Failed to read store, falling back to seed data:', err);
      try {
        await this.writeState(INITIAL_ORBIT_STATE);
      } catch {}
      return INITIAL_ORBIT_STATE;
    }
  }

  async writeState(state: OrbitState): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  }

  async reset(): Promise<OrbitState> {
    await this.writeState(INITIAL_ORBIT_STATE);
    return INITIAL_ORBIT_STATE;
  }

  /**
   * Generates next sequential IDs and appends new meeting, decisions, and action items atomically
   */
  async appendExtractedMeeting(params: {
    title: string;
    date: string;
    participants: string[];
    transcript: string;
    rawDecisions: Array<{
      text: string;
      madeBy: string;
      rationale: string;
      sourceQuote: string;
      importance?: 'critical' | 'high' | 'medium';
      category?: string;
    }>;
    rawActionItems: Array<{
      task: string;
      owner: string | null;
      deadline: string | null;
      relatedDecisionIndex: number;
    }>;
  }): Promise<{
    meeting: Meeting;
    decisions: Decision[];
    actionItems: ActionItem[];
    updatedState: OrbitState;
  }> {
    const state = await this.getState();

    // 1. Next Meeting ID (MTG-01 -> MTG-04)
    let maxMtgNum = 0;
    for (const m of state.meetings) {
      const match = m.id.match(/^MTG-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxMtgNum) maxMtgNum = num;
      }
    }
    const nextMtgId = `MTG-${String(maxMtgNum + 1).padStart(2, '0')}`;

    // 2. Next Decision ID (DEC-001 -> DEC-010)
    let maxDecNum = 0;
    for (const d of state.decisions) {
      const match = d.id.match(/^DEC-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxDecNum) maxDecNum = num;
      }
    }

    // 3. Next ActionItem ID (ACT-001 -> ACT-009)
    let maxActNum = 0;
    for (const a of state.actionItems) {
      const match = a.id.match(/^ACT-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxActNum) maxActNum = num;
      }
    }

    // Construct new Meeting
    const newMeeting: Meeting = {
      id: nextMtgId,
      title: params.title || `Meeting ${nextMtgId}`,
      date: params.date || new Date().toISOString().split('T')[0],
      participants: params.participants.length > 0 ? params.participants : ['Team Member'],
      transcript: params.transcript
    };

    // Construct new Decisions
    const newDecisions: Decision[] = params.rawDecisions.map((raw, idx) => {
      const decId = `DEC-${String(maxDecNum + idx + 1).padStart(3, '0')}`;
      return {
        id: decId,
        meetingId: nextMtgId,
        text: raw.text,
        madeBy: raw.madeBy || 'Team Consensus',
        rationale: raw.rationale || 'Agreed in meeting',
        sourceQuote: raw.sourceQuote || raw.text,
        status: 'active',
        conflictsWith: [],
        importance: raw.importance || 'high',
        category: raw.category || 'general',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      };
    });

    // Construct new Action Items
    const newActionItems: ActionItem[] = params.rawActionItems.map((raw, idx) => {
      const actId = `ACT-${String(maxActNum + idx + 1).padStart(3, '0')}`;
      const targetDecision = newDecisions[raw.relatedDecisionIndex] || newDecisions[0] || null;
      const owner = raw.owner || 'Unassigned';
      const initials = owner
        .split(' ')
        .map(w => w[0])
        .filter(Boolean)
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'UN';

      return {
        id: actId,
        decisionId: targetDecision ? targetDecision.id : (newDecisions[0]?.id || 'DEC-001'),
        task: raw.task,
        owner,
        ownerInitials: initials,
        deadline: raw.deadline || 'Pending',
        status: 'pending' as ActionItemStatus
      };
    });

    // Update state
    state.meetings.push(newMeeting);
    state.decisions.push(...newDecisions);
    state.actionItems.push(...newActionItems);

    await this.writeState(state);

    return {
      meeting: newMeeting,
      decisions: newDecisions,
      actionItems: newActionItems,
      updatedState: state
    };
  }

  /**
   * Appends detected conflicts, links the conflicting decisions, and sets status to 'conflict'
   */
  async appendConflicts(newConflicts: Array<{
    newDecisionId: string;
    existingDecisionId: string;
    type: ConflictType;
    severity: ConflictSeverity;
    confidence: number;
    explanation: string;
  }>): Promise<{ conflicts: ConflictRecord[]; updatedState: OrbitState }> {
    const state = await this.getState();
    if (!state.conflicts) state.conflicts = [];

    // Next Conflict ID (CONF-001 -> CONF-002)
    let maxConfNum = 0;
    for (const c of state.conflicts) {
      const match = c.id.match(/^CONF-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxConfNum) maxConfNum = num;
      }
    }

    const createdRecords: ConflictRecord[] = [];

    for (const raw of newConflicts) {
      // Check if this pair is already tracked
      const exists = state.conflicts.some(
        c => !c.resolved && (
          (c.newDecisionId === raw.newDecisionId && c.existingDecisionId === raw.existingDecisionId) ||
          (c.newDecisionId === raw.existingDecisionId && c.existingDecisionId === raw.newDecisionId)
        )
      );
      if (exists) continue;

      const confId = `CONF-${String(++maxConfNum).padStart(3, '0')}`;
      const record: ConflictRecord = {
        id: confId,
        newDecisionId: raw.newDecisionId,
        existingDecisionId: raw.existingDecisionId,
        type: raw.type,
        severity: raw.severity,
        confidence: raw.confidence,
        explanation: raw.explanation,
        createdAt: new Date().toISOString(),
        resolved: false
      };

      state.conflicts.push(record);
      createdRecords.push(record);

      // Link and update status of both decisions
      const decNew = state.decisions.find(d => d.id === raw.newDecisionId);
      const decExist = state.decisions.find(d => d.id === raw.existingDecisionId);

      if (decNew) {
        decNew.status = 'conflict';
        if (!decNew.conflictsWith.includes(raw.existingDecisionId)) {
          decNew.conflictsWith.push(raw.existingDecisionId);
        }
      }
      if (decExist) {
        decExist.status = 'conflict';
        if (!decExist.conflictsWith.includes(raw.newDecisionId)) {
          decExist.conflictsWith.push(raw.newDecisionId);
        }
      }
    }

    await this.writeState(state);
    return { conflicts: createdRecords, updatedState: state };
  }

  /**
   * Resolves a conflict and recomputes star statuses
   */
  async resolveConflict(
    conflictId: string, 
    resolution: ConflictResolution, 
    note?: string
  ): Promise<{ resolvedConflict: ConflictRecord; state: OrbitState }> {
    const state = await this.getState();
    const conflict = state.conflicts.find(c => c.id === conflictId);

    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    conflict.resolved = true;
    conflict.resolution = resolution;
    if (note) conflict.note = note;

    const decNew = state.decisions.find(d => d.id === conflict.newDecisionId);
    const decExist = state.decisions.find(d => d.id === conflict.existingDecisionId);

    // Apply resolution intent
    if (resolution === 'keep_existing') {
      if (decNew) decNew.status = 'superseded';
    } else if (resolution === 'keep_new') {
      if (decExist) decExist.status = 'superseded';
    } else if (resolution === 'keep_both') {
      // Both return to active unless still part of another unresolved conflict
    }

    // Recompute conflict statuses for all decisions based on remaining UNRESOLVED conflicts
    const unresolvedConflicts = state.conflicts.filter(c => !c.resolved);

    for (const d of state.decisions) {
      // If superseded, it remains superseded
      if (d.status === 'superseded') {
        d.conflictsWith = d.conflictsWith.filter(partnerId => 
          unresolvedConflicts.some(c => 
            (c.newDecisionId === d.id && c.existingDecisionId === partnerId) ||
            (c.existingDecisionId === d.id && c.newDecisionId === partnerId)
          )
        );
        continue;
      }

      // Find active unresolved partners
      const activePartners = unresolvedConflicts
        .filter(c => c.newDecisionId === d.id || c.existingDecisionId === d.id)
        .map(c => c.newDecisionId === d.id ? c.existingDecisionId : c.newDecisionId);

      d.conflictsWith = activePartners;

      if (activePartners.length > 0) {
        d.status = 'conflict';
      } else if (d.status === 'conflict') {
        d.status = 'active';
      }
    }

    await this.writeState(state);
    return { resolvedConflict: conflict, state };
  }

  /**
   * Updates multiple action items (e.g. marking as dispatched with trackerUrl)
   */
  async updateActionItems(
    updates: Array<{ id: string; status?: ActionItemStatus; trackerUrl?: string }>
  ): Promise<OrbitState> {
    const state = await this.getState();
    for (const u of updates) {
      const item = state.actionItems.find(a => a.id === u.id);
      if (item) {
        if (u.status) item.status = u.status;
        if (u.trackerUrl !== undefined) item.trackerUrl = u.trackerUrl;
      }
    }
    await this.writeState(state);
    return state;
  }

  /**
   * Finds an action item along with its corresponding decision and meeting
   */
  async getActionWithContext(actionId: string): Promise<{
    actionItem: ActionItem;
    decision: Decision;
    meeting: Meeting;
  } | null> {
    const state = await this.getState();
    const actionItem = state.actionItems.find(a => a.id === actionId);
    if (!actionItem) return null;

    const decision = state.decisions.find(d => d.id === actionItem.decisionId) || {
      id: actionItem.decisionId,
      meetingId: 'MTG-01',
      text: 'Synchronized commitment',
      madeBy: 'Team',
      rationale: '',
      sourceQuote: '',
      status: 'active',
      conflictsWith: []
    } as Decision;

    const meeting = state.meetings.find(m => m.id === decision.meetingId) || {
      id: decision.meetingId,
      title: 'Synchronized Sync',
      date: new Date().toISOString().split('T')[0],
      participants: [],
      transcript: ''
    } as Meeting;

    return { actionItem, decision, meeting };
  }
}

export const storage = new StorageManager();
