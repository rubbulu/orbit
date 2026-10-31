import { Meeting, Decision, ActionItem, ConflictRecord, OrbitState } from './types.js';

export const SEED_MEETINGS: Meeting[] = [
  {
    id: 'MTG-01',
    title: 'Q4 Roadmap & Launch Commitment',
    date: '2026-10-12',
    participants: ['Marcus Vance (VP Eng)', 'Elena Rostova (CPO)', 'Sarah Jenkins (PMM)', 'David Chen (Tech Lead)'],
    transcript: `Marcus Vance: Welcome everyone. Main agenda today is locking our Q4 schedule. We need a hard commitment on GA.
Elena Rostova: Product and marketing need at least 3 weeks of runway after feature freeze for collateral.
Marcus Vance: Understood. Let's lock in Nov 15 for GA. If we delay past Thanksgiving, enterprise procurement is lost for the year.
Sarah Jenkins: What about the pricing tier structure?
Elena Rostova: Let's stick to $29 per user for self-serve Starter with a 14-day trial. At $49 the drop-off in our prototype tests was over 40%.
David Chen: From the infra side, we cannot scale past 500 concurrent meeting ingestions without dedicated infra engineers.
Marcus Vance: Agreed. Open requisitions for 2 senior distributed systems engineers immediately.`
  },
  {
    id: 'MTG-02',
    title: 'Core Architecture & Data Privacy Review',
    date: '2026-10-19',
    participants: ['David Chen (Tech Lead)', 'Marcus Vance (VP Eng)', 'Aisha Morales (Security Lead)'],
    transcript: `Aisha Morales: Security and compliance review for enterprise pilots. Once speaker diarization and transcript text are extracted, raw audio buffer must be wiped from memory immediately.
Marcus Vance: Does that meet our SOC2 Type II requirements?
Aisha Morales: Yes, eliminating raw audio eliminates biometric privacy risk under GDPR.
David Chen: For the LLM layer, we enforce structured output directly at the model provider level rather than regex parsing to eliminate hallucinated JSON fields.
Marcus Vance: Start with a local file storage adapter. Keep it behind a clean interface so Postgres takes one hour later.`
  },
  {
    id: 'MTG-03',
    title: 'Launch Readiness & Infrastructure Sync',
    date: '2026-10-27',
    participants: ['Marcus Vance (VP Eng)', 'Elena Rostova (CPO)', 'David Chen (Tech Lead)', 'Sarah Jenkins (PMM)'],
    transcript: `David Chen: We hit a major bottleneck in our database sharding load test. At 10,000 connections we observed query latency spikes up to 4.2 seconds.
Marcus Vance: Can we patch this before Nov 15?
David Chen: We cannot guarantee zero-downtime DB migration before Thanksgiving. We must push hard launch to Dec 1.
Elena Rostova: That impacts the sales pipeline, but shipping a broken platform is worse. We agree to Dec 1.
Sarah Jenkins: Can we add Okta SAML support for enterprise buyers?
Elena Rostova: Every pilot asking for Okta SAML is willing to pay the annual security add-on. Add Enterprise custom SSO as an add-on at $1,200/year.
Sarah Jenkins: HR confirmed we can match the equity package if we issue the revised offer letter today for the lead infra architect.`
  }
];

export const SEED_DECISIONS: Decision[] = [
  {
    id: 'DEC-001',
    meetingId: 'MTG-01',
    text: 'General Availability hard release date locked for Nov 15, 2026',
    madeBy: 'Marcus Vance',
    rationale: 'Allows 3-week soak test period after feature freeze while beating Q4 enterprise budget freeze.',
    sourceQuote: "Marcus: 'Let's lock in Nov 15 for GA. If we delay past Thanksgiving, enterprise procurement is lost for the year.'",
    status: 'conflict',
    conflictsWith: ['DEC-007'],
    importance: 'critical',
    category: 'timeline',
    timestamp: '10:14 AM'
  },
  {
    id: 'DEC-002',
    meetingId: 'MTG-01',
    text: 'Self-serve Starter tier priced at $29/seat/month with 14-day trial',
    madeBy: 'Elena Rostova',
    rationale: 'Optimizes product-led growth velocity against competing tools in mid-market tier.',
    sourceQuote: "Elena: 'Let's stick to $29 per user. At $49 the drop-off in our prototype tests was over 40%.'",
    status: 'active',
    conflictsWith: [],
    importance: 'high',
    category: 'pricing',
    timestamp: '10:28 AM'
  },
  {
    id: 'DEC-003',
    meetingId: 'MTG-01',
    text: 'Hiring requisition opened for 2 Senior Distributed Systems Engineers',
    madeBy: 'David Chen',
    rationale: 'Required to scale websocket streaming telemetry infrastructure for real-time constellation rendering.',
    sourceQuote: "David: 'We cannot scale past 500 concurrent meeting ingestions without dedicated infra engineers.'",
    status: 'active',
    conflictsWith: [],
    importance: 'medium',
    category: 'hiring',
    timestamp: '10:42 AM'
  },
  {
    id: 'DEC-004',
    meetingId: 'MTG-02',
    text: 'Zero raw audio retention: discard raw wav streams immediately post-transcription',
    madeBy: 'Aisha Morales',
    rationale: 'Eliminates GDPR/HIPAA biometric liability and accelerates SOC2 Type II audit readiness.',
    sourceQuote: "Aisha: 'Once speaker diarization and transcript text are extracted, raw audio buffer must be wiped from memory.'",
    status: 'active',
    conflictsWith: [],
    importance: 'critical',
    category: 'architecture',
    timestamp: '02:18 PM'
  },
  {
    id: 'DEC-005',
    meetingId: 'MTG-02',
    text: 'Direct LLM API integration with structured JSON schema enforcement',
    madeBy: 'David Chen',
    rationale: 'Guarantees strictly typed schema compatibility with Orbit graph without hallucinated keys.',
    sourceQuote: "David: 'We enforce structured output directly at the model provider level rather than regex parsing.'",
    status: 'active',
    conflictsWith: [],
    importance: 'high',
    category: 'architecture',
    timestamp: '02:35 PM'
  },
  {
    id: 'DEC-006',
    meetingId: 'MTG-02',
    text: 'Hybrid local storage architecture with SQLite/JSON persistence layer',
    madeBy: 'Marcus Vance',
    rationale: 'Enables reliable zero-latency offline demo capability before cloud DB sync is wired.',
    sourceQuote: "Marcus: 'Start with a local file storage adapter. Keep it behind a clean interface so Postgres takes one hour later.'",
    status: 'pending',
    conflictsWith: [],
    importance: 'medium',
    category: 'architecture',
    timestamp: '02:51 PM'
  },
  {
    id: 'DEC-007',
    meetingId: 'MTG-03',
    text: 'GA launch date postponed from Nov 15 to Dec 01, 2026',
    madeBy: 'David Chen',
    rationale: 'Database sharding migration failed load test at 10k connections. Need 14 additional days for stability.',
    sourceQuote: "David: 'We cannot guarantee zero-downtime DB migration before Thanksgiving. We must push hard launch to Dec 1.'",
    status: 'conflict',
    conflictsWith: ['DEC-001'],
    importance: 'critical',
    category: 'timeline',
    timestamp: '11:15 AM'
  },
  {
    id: 'DEC-008',
    meetingId: 'MTG-03',
    text: 'Add Enterprise custom SSO as an add-on at $1,200/year',
    madeBy: 'Elena Rostova',
    rationale: 'Protects starter margins while capturing willingness-to-pay from late-stage enterprise pilot prospects.',
    sourceQuote: "Elena: 'Every pilot asking for Okta SAML is willing to pay the annual security add-on.'",
    status: 'active',
    conflictsWith: [],
    importance: 'high',
    category: 'pricing',
    timestamp: '11:34 AM'
  },
  {
    id: 'DEC-009',
    meetingId: 'MTG-03',
    text: 'Accelerate contract offer for Lead Infrastructure Architect candidate',
    madeBy: 'Sarah Jenkins',
    rationale: 'Candidate received competing offer; board approved signing bonus exception to secure talent.',
    sourceQuote: "Sarah: 'HR confirmed we can match the equity package if we issue the revised offer letter today.'",
    status: 'superseded',
    conflictsWith: [],
    importance: 'medium',
    category: 'hiring',
    timestamp: '11:48 AM'
  }
];

export const SEED_ACTION_ITEMS: ActionItem[] = [
  {
    id: 'ACT-001',
    decisionId: 'DEC-001',
    task: 'Draft release candidate deployment checklist and freeze gate criteria',
    owner: 'Marcus Vance',
    ownerInitials: 'MV',
    deadline: '2026-11-05',
    status: 'pending'
  },
  {
    id: 'ACT-002',
    decisionId: 'DEC-002',
    task: 'Configure Stripe billing webhooks for $29 starter tier and trial lifecycle',
    owner: 'Sarah Jenkins',
    ownerInitials: 'SJ',
    deadline: '2026-11-01', // Due within 24 hours of Oct 31
    status: 'pending'
  },
  {
    id: 'ACT-003',
    decisionId: 'DEC-003',
    task: 'Post Job Descriptions on HackerNews and WorkAtAStartup for infra leads',
    owner: 'David Chen',
    ownerInitials: 'DC',
    deadline: '2026-10-25', // Overdue relative to Oct 31
    status: 'pending'
  },
  {
    id: 'ACT-004',
    decisionId: 'DEC-004',
    task: 'Implement zero-byte memory scrub in audio ingestion worker post-transcription',
    owner: 'Aisha Morales',
    ownerInitials: 'AM',
    deadline: '2026-11-03',
    status: 'pending'
  },
  {
    id: 'ACT-005',
    decisionId: 'DEC-005',
    task: 'Define JSON schema validation suite for Gemini structured decision extraction',
    owner: 'David Chen',
    ownerInitials: 'DC',
    deadline: '2026-11-02',
    status: 'pending'
  },
  {
    id: 'ACT-006',
    decisionId: 'DEC-006',
    task: 'Build storage adapter interface with local JSON file implementation',
    owner: 'Marcus Vance',
    ownerInitials: 'MV',
    deadline: '2026-11-06',
    status: 'pending'
  },
  {
    id: 'ACT-007',
    decisionId: 'DEC-007',
    task: 'Update marketing launch countdown and notify alpha customers of Dec 1 date',
    owner: 'Sarah Jenkins',
    ownerInitials: 'SJ',
    deadline: '2026-11-10',
    status: 'pending' // Tied to DEC-007 (unresolved conflict with DEC-001)
  },
  {
    id: 'ACT-008',
    decisionId: 'DEC-008',
    task: 'Create SAML / Okta documentation page in knowledge base for Enterprise tier',
    owner: 'Sarah Jenkins',
    ownerInitials: 'SJ',
    deadline: '2026-11-12',
    status: 'pending' // Eligible for dispatch!
  }
];

export const SEED_CONFLICTS: ConflictRecord[] = [
  {
    id: 'CONF-001',
    newDecisionId: 'DEC-007',
    existingDecisionId: 'DEC-001',
    type: 'timeline_conflict',
    severity: 'critical',
    confidence: 0.98,
    explanation: 'Meeting 3 postpones General Availability launch from Nov 15 to Dec 01 due to database sharding failure, directly contradicting Meeting 1 hard commitment.',
    createdAt: '2026-10-27T11:16:00Z',
    resolved: false
  }
];

export const INITIAL_ORBIT_STATE: OrbitState = {
  meetings: SEED_MEETINGS,
  decisions: SEED_DECISIONS,
  actionItems: SEED_ACTION_ITEMS,
  conflicts: SEED_CONFLICTS
};
