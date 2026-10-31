export type DecisionStatus = 'active' | 'pending' | 'superseded' | 'conflict';
export type DecisionImportance = 'critical' | 'high' | 'medium';
export type ActionItemStatus = 'pending' | 'in-progress' | 'completed' | 'dispatched';
export type ConflictType = 'direct_contradiction' | 'resource_conflict' | 'timeline_conflict' | 'scope_change';
export type ConflictSeverity = 'critical' | 'high' | 'medium';
export type ConflictResolution = 'keep_existing' | 'keep_new' | 'keep_both';

export interface Meeting {
  id: string;
  title: string;
  date: string;
  participants: string[];
  transcript: string;
}

export interface Decision {
  id: string;
  meetingId: string;
  text: string;
  madeBy: string;
  rationale: string;
  sourceQuote: string;
  status: DecisionStatus;
  conflictsWith: string[];
  importance?: DecisionImportance;
  category?: string;
  timestamp?: string;
}

export interface ActionItem {
  id: string;
  decisionId: string;
  task: string;
  owner: string;
  deadline: string;
  status: ActionItemStatus;
  trackerUrl?: string;
  ownerInitials?: string;
}

export interface ConflictRecord {
  id: string;
  newDecisionId: string;
  existingDecisionId: string;
  type: ConflictType;
  severity: ConflictSeverity;
  confidence: number;
  explanation: string;
  createdAt: string;
  resolved: boolean;
  resolution?: ConflictResolution;
  note?: string;
}

export interface OrbitState {
  meetings: Meeting[];
  decisions: Decision[];
  actionItems: ActionItem[];
  conflicts: ConflictRecord[];
}

export interface DispatchItemResult {
  actionId: string;
  task: string;
  owner: string;
  success: boolean;
  trackerUrl?: string;
  issueNumber?: number;
  error?: string;
}

export interface DispatchResponse {
  success: boolean;
  dispatchedCount: number;
  results: DispatchItemResult[];
  mode: 'github' | 'local';
  tracker: string;
  state?: OrbitState;
}

export interface DigestPerson {
  name: string;
  initials: string;
  decisions: Array<{ id: string; text: string; status: DecisionStatus; meetingTitle: string }>;
  openTasks: Array<{ id: string; task: string; deadline: string; status: ActionItemStatus; trackerUrl?: string }>;
  conflicts: Array<{ id: string; description: string; partnerId: string }>;
  aiSummary: string;
}

export interface DigestResponse {
  people: DigestPerson[];
  generatedAt: string;
  cached: boolean;
}

export type ReminderCategory = 'overdue' | 'due_24h' | 'upcoming' | 'no_deadline';

export interface ReminderItem {
  actionItem: ActionItem;
  decision: Decision;
  meeting: Meeting;
  category: ReminderCategory;
  daysRemaining: number | null;
  hoursRemaining?: number;
  isConflictGated: boolean;
}
