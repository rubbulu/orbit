import { 
  Meeting, 
  Decision, 
  ActionItem, 
  OrbitState, 
  DecisionStatus, 
  DecisionImportance, 
  ActionItemStatus,
  ConflictRecord, 
  ConflictType, 
  ConflictSeverity, 
  ConflictResolution,
  DigestPerson,
  DigestResponse,
  DispatchResponse,
  DispatchItemResult,
  ReminderItem,
  ReminderCategory
} from '../../shared/types.js';

export type { 
  Meeting, 
  Decision, 
  ActionItem, 
  OrbitState, 
  DecisionStatus, 
  DecisionImportance, 
  ActionItemStatus,
  ConflictRecord, 
  ConflictType, 
  ConflictSeverity, 
  ConflictResolution,
  DigestPerson,
  DigestResponse,
  DispatchResponse,
  DispatchItemResult,
  ReminderItem,
  ReminderCategory
};

export interface SatelliteNode {
  id: string;
  actionItem: ActionItem;
  orbitRadius: number;
  currentAngle: number;
  orbitSpeed: number;
  radius: number;
  birthTime?: number;
  poppedSound?: boolean;
}

export interface ConstellationStar {
  id: string;
  decision: Decision;
  meeting: Meeting;
  actionItems: ActionItem[];
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  color: string;
  glowColor: string;
  pulsePhase: number;
  satellites: SatelliteNode[];
  isHovered?: boolean;
  isSelected?: boolean;
  birthTime?: number;
}

export interface ClusterNode {
  id: string;
  meeting: Meeting;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  radius: number;
  color: string;
  code: string;
  birthTime?: number;
}
