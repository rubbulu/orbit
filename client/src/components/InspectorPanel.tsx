import React, { useEffect, useState } from 'react';
import { 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Sparkles, 
  User, 
  Quote, 
  Calendar, 
  ArrowRight,
  ShieldAlert,
  Satellite,
  Check,
  Zap,
  GitCompare
} from 'lucide-react';
import { 
  Decision, 
  Meeting, 
  ActionItem, 
  ConflictRecord, 
  ConflictResolution 
} from '../types';
import { HoldToLaunchButton } from './HoldToLaunchButton';
import { soundEffects } from '../utils/audio';

interface InspectorPanelProps {
  decision: Decision | null;
  meeting: Meeting | null;
  actionItems: ActionItem[];
  allDecisions: Decision[];
  allMeetings: Meeting[];
  conflicts: ConflictRecord[];
  onClose: () => void;
  onSelectDecisionById: (id: string) => void;
  onLaunchActions: (actionIds: string[]) => void;
  onResolveConflict: (conflictId: string, resolution: ConflictResolution) => Promise<void>;
  onSendReminder: (actionId: string, owner: string) => Promise<boolean>;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  decision,
  meeting,
  actionItems,
  allDecisions,
  allMeetings,
  conflicts,
  onClose,
  onSelectDecisionById,
  onLaunchActions,
  onResolveConflict,
  onSendReminder
}) => {
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [remindedItemIds, setRemindedItemIds] = useState<Set<string>>(new Set());
  const [remindingId, setRemindingId] = useState<string | null>(null);

  // Global Esc key closes inspector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && decision) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [decision, onClose]);

  if (!decision) return null;

  // Find active unresolved conflict(s) involving this decision
  const activeConflict = conflicts.find(
    c => !c.resolved && (c.newDecisionId === decision.id || c.existingDecisionId === decision.id)
  );

  const isConflict = Boolean(activeConflict || decision.status === 'conflict');
  const conflictingPartnerId = activeConflict
    ? (activeConflict.newDecisionId === decision.id ? activeConflict.existingDecisionId : activeConflict.newDecisionId)
    : decision.conflictsWith[0];

  const conflictingDecision = allDecisions.find(d => d.id === conflictingPartnerId);
  const conflictingMeeting = conflictingDecision 
    ? allMeetings.find(m => m.id === conflictingDecision.meetingId) 
    : null;

  // Determine which is existing vs new
  const isThisNewer = activeConflict ? activeConflict.newDecisionId === decision.id : true;

  // Status visual configurations
  const statusConfig = {
    active: {
      label: 'ACTIVE COMMITMENT',
      bg: 'bg-sky-950/80',
      border: 'border-sky-500/40',
      text: 'text-sky-300',
      dot: 'bg-sky-400'
    },
    pending: {
      label: 'PENDING RATIFICATION',
      bg: 'bg-amber-950/80',
      border: 'border-amber-500/40',
      text: 'text-amber-300',
      dot: 'bg-amber-400'
    },
    superseded: {
      label: 'SUPERSEDED / ARCHIVED',
      bg: 'bg-slate-900/80',
      border: 'border-slate-700/60',
      text: 'text-slate-400',
      dot: 'bg-slate-500'
    },
    conflict: {
      label: 'CRITICAL CONFLICT',
      bg: 'bg-rose-950/90',
      border: 'border-rose-500/60',
      text: 'text-rose-300',
      dot: 'bg-rose-500 animate-ping'
    }
  }[decision.status];

  const handleResolutionClick = async (resolution: ConflictResolution) => {
    if (!activeConflict) return;
    soundEffects.click();
    setResolvingId(activeConflict.id);
    try {
      await onResolveConflict(activeConflict.id, resolution);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <aside 
      className="fixed top-14 right-4 bottom-20 z-30 w-full max-w-lg pointer-events-auto transition-transform duration-300 ease-out"
    >
      <div className={`h-full rounded-lg overflow-hidden flex flex-col ${isConflict ? 'hud-panel-red' : 'hud-panel'}`}>
        
        {/* Header telemetry strip */}
        <div className="px-4 py-3 bg-space-900/90 border-b border-slate-800/80 flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-sky-400 tracking-wider">
              NODE // {decision.id}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-[10px] text-slate-400 uppercase">
              {meeting?.id || 'UNKNOWN'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`}></span>
              <span>{statusConfig.label}</span>
            </div>

            <button
              onClick={() => { soundEffects.click(); onClose(); }}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Inspector (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Decision Headline Statement */}
          <div>
            <div className="text-[10px] font-mono text-slate-400 tracking-wider uppercase mb-1">
              DECISION STATEMENT
            </div>
            <h2 className="text-sm font-semibold text-slate-100 font-sans leading-snug">
              {decision.text}
            </h2>
          </div>

          {/* Conflict Deep-Dive Audit & Resolution Hub (if in conflict) */}
          {isConflict && activeConflict && (
            <div className="p-3.5 rounded-md bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs font-mono space-y-3">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-rose-300">
                      CROSS-MEETING CONTRADICTION
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-900/60 border border-rose-500/40 text-rose-300 uppercase">
                      {activeConflict.type.replace('_', ' ')}
                    </span>
                  </div>
                  
                  {/* AI Explanation */}
                  <p className="mt-1.5 text-xs text-rose-100 font-sans leading-relaxed">
                    {activeConflict.explanation}
                  </p>

                  <div className="flex items-center gap-3 mt-2 text-[10px] text-rose-300/80">
                    <span>SEVERITY: <strong className="text-rose-200 uppercase">{activeConflict.severity}</strong></span>
                    <span>CONFIDENCE: <strong className="text-rose-200">{Math.round(activeConflict.confidence * 100)}%</strong></span>
                  </div>
                </div>
              </div>

              {/* Side-by-side Decision Comparison */}
              {conflictingDecision && (
                <div className="pt-2 border-t border-rose-500/30 space-y-2">
                  <div className="text-[10px] text-rose-300 uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1 font-bold">
                      <GitCompare className="w-3 h-3" />
                      <span>CONTRADICTING COMMITMENT</span>
                    </span>
                    <button
                      onClick={() => {
                        soundEffects.selectStar(true);
                        onSelectDecisionById(conflictingDecision.id);
                      }}
                      className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-0.5 hover:underline"
                    >
                      <span>VIEW {conflictingDecision.id}</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  <div className="p-2.5 rounded bg-space-950/80 border border-rose-500/30 font-sans space-y-1">
                    <div className="text-xs text-slate-100 font-medium">
                      "{conflictingDecision.text}"
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between pt-1">
                      <span>By {conflictingDecision.madeBy} ({conflictingMeeting?.title || conflictingDecision.meetingId})</span>
                      <span>{conflictingMeeting?.date || ''}</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 italic bg-space-900 p-1.5 rounded border border-slate-800">
                      "{conflictingDecision.sourceQuote}"
                    </div>
                  </div>
                </div>
              )}

              {/* 3 Resolution Action Buttons */}
              <div className="pt-2.5 border-t border-rose-500/30">
                <div className="text-[10px] text-slate-300 tracking-wider uppercase mb-2">
                  CHOOSE ARBITRATION RESOLUTION:
                </div>
                <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                  <button
                    type="button"
                    disabled={Boolean(resolvingId)}
                    onClick={() => handleResolutionClick('keep_existing')}
                    className="py-2 px-1.5 rounded bg-space-900 hover:bg-space-850 border border-slate-700 hover:border-sky-400 text-slate-200 hover:text-sky-300 text-center transition-all group disabled:opacity-50"
                  >
                    <div className="font-bold uppercase tracking-wider text-sky-400 group-hover:scale-105 transition-transform">
                      KEEP ORIGINAL
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5 font-sans leading-tight">
                      Supersede newer
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(resolvingId)}
                    onClick={() => handleResolutionClick('keep_new')}
                    className="py-2 px-1.5 rounded bg-space-900 hover:bg-space-850 border border-slate-700 hover:border-amber-400 text-slate-200 hover:text-amber-300 text-center transition-all group disabled:opacity-50"
                  >
                    <div className="font-bold uppercase tracking-wider text-amber-400 group-hover:scale-105 transition-transform">
                      ACCEPT NEW
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5 font-sans leading-tight">
                      Supersede earlier
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(resolvingId)}
                    onClick={() => handleResolutionClick('keep_both')}
                    className="py-2 px-1.5 rounded bg-space-900 hover:bg-space-850 border border-slate-700 hover:border-emerald-400 text-slate-200 hover:text-emerald-300 text-center transition-all group disabled:opacity-50"
                  >
                    <div className="font-bold uppercase tracking-wider text-emerald-400 group-hover:scale-105 transition-transform">
                      KEEP BOTH
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5 font-sans leading-tight">
                      Ratify coexistence
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded bg-space-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <User className="w-3 h-3 text-sky-400" />
                <span>DECISION OWNER</span>
              </div>
              <div className="text-slate-200 font-medium mt-0.5 truncate">
                {decision.madeBy}
              </div>
            </div>

            <div className="p-2 rounded bg-space-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-sky-400" />
                <span>MEETING DATE</span>
              </div>
              <div className="text-slate-200 font-medium mt-0.5 truncate">
                {meeting?.date || 'N/A'} {decision.timestamp ? `· ${decision.timestamp}` : ''}
              </div>
            </div>
          </div>

          {/* Source Quote */}
          <div>
            <div className="text-[10px] font-mono text-slate-400 tracking-wider uppercase mb-1 flex items-center gap-1">
              <Quote className="w-3 h-3 text-sky-400" />
              <span>SOURCE TRANSCRIPT QUOTE</span>
            </div>
            <div className="p-2.5 rounded bg-space-900/80 border-l-2 border-sky-400 border-y border-r border-slate-800 font-mono text-xs text-slate-300 italic leading-relaxed">
              "{decision.sourceQuote}"
            </div>
          </div>

          {/* Rationale */}
          <div>
            <div className="text-[10px] font-mono text-slate-400 tracking-wider uppercase mb-1">
              RECORDED RATIONALE
            </div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed p-2.5 rounded bg-space-900/50 border border-slate-800/80">
              {decision.rationale}
            </p>
          </div>

          {/* Orbit Satellites (Action Items) */}
          <div>
            <div className="text-[10px] font-mono text-slate-400 tracking-wider uppercase mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Satellite className="w-3 h-3 text-amber-400" />
                <span>ORBITING SATELLITES (ACTION ITEMS)</span>
              </span>
              <span className="text-amber-400 font-semibold">{actionItems.length}</span>
            </div>

            {actionItems.length > 0 ? (
              <div className="space-y-2">
                {actionItems.map((item) => {
                  const isReminded = remindedItemIds.has(item.id);
                  const isReminding = remindingId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="p-2.5 rounded bg-space-900/90 border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px] font-mono font-bold text-amber-300">
                            {item.ownerInitials || item.owner.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="text-xs font-mono text-slate-300 font-medium">
                            {item.owner}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-slate-400">Due {item.deadline}</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-200 font-sans mt-1.5">
                        {item.task}
                      </p>

                      <div className="mt-2 flex items-center justify-between text-[10px] font-mono pt-1.5 border-t border-slate-800/60">
                        <span className={`uppercase font-semibold ${
                          item.status === 'completed' 
                            ? 'text-emerald-400' 
                            : item.status === 'dispatched'
                            ? 'text-purple-400'
                            : 'text-amber-400'
                        }`}>
                          [{item.status}]
                        </span>

                        <div className="flex items-center gap-2">
                          {/* Send Reminder button */}
                          <button
                            type="button"
                            onClick={async () => {
                              setRemindingId(item.id);
                              const ok = await onSendReminder(item.id, item.owner);
                              setRemindingId(null);
                              if (ok) setRemindedItemIds(prev => new Set(prev).add(item.id));
                            }}
                            disabled={isReminding || isReminded}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                              isReminded 
                                ? 'text-emerald-400 bg-emerald-950/60' 
                                : 'text-slate-400 hover:text-sky-300 hover:bg-space-950'
                            }`}
                            title="Send reminder to assignee"
                          >
                            {isReminded ? '✓ REMINDED' : isReminding ? 'SENDING...' : 'REMIND'}
                          </button>

                          {/* Clickable Open Issue link */}
                          {item.trackerUrl && (
                            <a
                              href={item.trackerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-bold transition-colors"
                              title="Open GitHub Issue"
                            >
                              <span>OPEN ISSUE</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 text-center text-xs font-mono text-slate-500 border border-dashed border-slate-800 rounded">
                NO SATELLITES ORBITING THIS DECISION
              </div>
            )}
          </div>
        </div>

        {/* Footer: Hold-to-Launch Action Button */}
        <div className="p-4 bg-space-900/95 border-t border-slate-800">
          {(() => {
            const pendingActions = actionItems.filter(a => a.status === 'pending' || !a.trackerUrl);
            const isConflictGated = isConflict || decision.status === 'conflict';

            if (isConflictGated) {
              return (
                <div className="p-3 rounded-lg bg-amber-950/50 border border-amber-500/50 flex items-start gap-2.5 text-xs font-mono text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <div className="font-bold tracking-wider uppercase">Resolve conflict first</div>
                    <div className="text-[11px] font-sans text-amber-200/80 mt-0.5 leading-snug">
                      Tasks tied to an active contradiction are excluded from tracker dispatch until arbitrated.
                    </div>
                  </div>
                </div>
              );
            }

            if (pendingActions.length === 0) {
              return (
                <div className="p-3 text-center font-mono text-xs text-slate-400 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>ALL SATELLITES DISPATCHED TO GITHUB</span>
                </div>
              );
            }

            return (
              <div className="flex flex-col items-center">
                {/* Preview list before dispatching */}
                <div className="w-full mb-3 p-2.5 rounded bg-space-950/80 border border-sky-500/30 text-xs font-mono">
                  <div className="text-[10px] text-sky-400 font-bold uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>DISPATCH PREVIEW ({pendingActions.length} PENDING)</span>
                    <span className="text-[9px] text-slate-500">GITHUB ISSUES</span>
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {pendingActions.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-[11px] text-slate-300 py-0.5 border-b border-slate-800/40 last:border-0">
                        <span className="truncate pr-2">• {p.task}</span>
                        <span className="text-amber-400 flex-shrink-0 font-medium">{p.owner} ({p.deadline || 'Pending'})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Large Circular Hold-To-Launch Button */}
                <HoldToLaunchButton
                  size="large"
                  itemCount={pendingActions.length}
                  label="HOLD TO LAUNCH TO GITHUB"
                  onComplete={() => onLaunchActions(pendingActions.map(a => a.id))}
                />
              </div>
            );
          })()}
        </div>

      </div>
    </aside>
  );
};
