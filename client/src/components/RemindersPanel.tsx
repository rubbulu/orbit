import React, { useState } from 'react';
import { 
  ActionItem, 
  Decision, 
  Meeting, 
  ConflictRecord 
} from '../types';
import { 
  Bell, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  Send, 
  X,
  Filter,
  Check
} from 'lucide-react';
import { soundEffects } from '../utils/audio';

interface RemindersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  actionItems: ActionItem[];
  decisions: Decision[];
  meetings: Meeting[];
  conflicts: ConflictRecord[];
  onSelectDecisionById: (id: string) => void;
  onSendReminder: (actionId: string, owner: string) => Promise<boolean>;
}

export type ReminderCategory = 'all' | 'overdue' | 'due_24h' | 'upcoming' | 'no_deadline';

export const RemindersPanel: React.FC<RemindersPanelProps> = ({
  isOpen,
  onClose,
  actionItems,
  decisions,
  meetings,
  conflicts,
  onSelectDecisionById,
  onSendReminder
}) => {
  const [activeFilter, setActiveFilter] = useState<ReminderCategory>('all');
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [remindedIds, setRemindedIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  // Unresolved conflict decision IDs
  const conflictDecisionIds = new Set(
    conflicts.filter(c => !c.resolved).flatMap(c => [c.newDecisionId, c.existingDecisionId])
  );

  // Compute status and remaining time for each action item
  // Benchmark date: Oct 31, 2026 (or today's date)
  const now = new Date();
  
  const categorizedItems = actionItems.map(item => {
    const dec = decisions.find(d => d.id === item.decisionId);
    const mtg = dec ? meetings.find(m => m.id === dec.meetingId) : undefined;
    const isConflictGated = dec ? (dec.status === 'conflict' || conflictDecisionIds.has(dec.id)) : false;

    let category: 'overdue' | 'due_24h' | 'upcoming' | 'no_deadline' = 'no_deadline';
    let daysRemaining: number | null = null;
    let hoursRemaining: number | null = null;

    if (item.deadline && item.deadline !== 'Pending' && item.deadline !== 'null') {
      const deadlineDate = new Date(item.deadline);
      if (!isNaN(deadlineDate.getTime())) {
        const diffMs = deadlineDate.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        daysRemaining = diffDays;
        hoursRemaining = Math.round(diffHours);

        if (diffHours < 0) {
          category = 'overdue';
        } else if (diffHours <= 24) {
          category = 'due_24h';
        } else {
          category = 'upcoming';
        }
      }
    }

    return {
      item,
      decision: dec,
      meeting: mtg,
      category,
      daysRemaining,
      hoursRemaining,
      isConflictGated
    };
  });

  // Sort items: overdue first, then due in 24h, then upcoming by nearest deadline, then no deadline
  const categoryOrder = { overdue: 0, due_24h: 1, upcoming: 2, no_deadline: 3 };
  categorizedItems.sort((a, b) => {
    if (categoryOrder[a.category] !== categoryOrder[b.category]) {
      return categoryOrder[a.category] - categoryOrder[b.category];
    }
    if (a.daysRemaining !== null && b.daysRemaining !== null) {
      return a.daysRemaining - b.daysRemaining;
    }
    return 0;
  });

  const overdueCount = categorizedItems.filter(i => i.category === 'overdue').length;
  const due24hCount = categorizedItems.filter(i => i.category === 'due_24h').length;
  const upcomingCount = categorizedItems.filter(i => i.category === 'upcoming').length;

  const filteredItems = categorizedItems.filter(i => {
    if (activeFilter === 'all') return true;
    return i.category === activeFilter;
  });

  const handleRemindClick = async (actionId: string, owner: string) => {
    setRemindingId(actionId);
    soundEffects.click();
    const ok = await onSendReminder(actionId, owner);
    setRemindingId(null);
    if (ok) {
      setRemindedIds(prev => new Set(prev).add(actionId));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col hud-panel rounded-xl overflow-hidden border border-sky-500/30 shadow-2xl">
        
        {/* Header Strip */}
        <div className="px-5 py-4 border-b border-sky-500/20 bg-space-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-950/80 border border-sky-500/30 text-sky-400">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-sm font-bold tracking-widest text-slate-100 uppercase">
                  MISSION REMINDERS & DEADLINE TELEMETRY
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-500/30">
                  {categorizedItems.length} TASKS
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                Real-time tracking of operational deadlines, dispatch sync, and owner alerts
              </p>
            </div>
          </div>

          <button
            onClick={() => { soundEffects.click(); onClose(); }}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="px-5 py-2.5 bg-space-950/60 border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeFilter === 'all' 
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ALL ({categorizedItems.length})
            </button>
            <button
              onClick={() => setActiveFilter('overdue')}
              className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
                activeFilter === 'overdue' 
                  ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50' 
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${overdueCount > 0 ? 'bg-rose-500 animate-ping' : 'bg-slate-600'}`}></span>
              OVERDUE ({overdueCount})
            </button>
            <button
              onClick={() => setActiveFilter('due_24h')}
              className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
                activeFilter === 'due_24h' 
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50' 
                  : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${due24hCount > 0 ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`}></span>
              DUE IN 24H ({due24hCount})
            </button>
            <button
              onClick={() => setActiveFilter('upcoming')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeFilter === 'upcoming' 
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' 
                  : 'text-slate-400 hover:text-sky-400'
              }`}
            >
              UPCOMING ({upcomingCount})
            </button>
          </div>
        </div>

        {/* Task Cards List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-mono text-xs">
              NO ACTION ITEMS IN THIS CATEGORY
            </div>
          ) : (
            filteredItems.map(({ item, decision, meeting, category, daysRemaining, hoursRemaining, isConflictGated }) => {
              const isReminded = remindedIds.has(item.id);
              const isPendingThis = remindingId === item.id;

              return (
                <div 
                  key={item.id}
                  className={`p-3.5 rounded-lg border transition-all ${
                    category === 'overdue'
                      ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/60'
                      : category === 'due_24h'
                      ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/60'
                      : category === 'upcoming'
                      ? 'bg-sky-950/15 border-sky-500/20 hover:border-sky-500/40'
                      : 'bg-space-900/40 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Task description & Context */}
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Status Category Badge */}
                        {category === 'overdue' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 border border-rose-500/50 text-rose-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-400 animate-pulse" />
                            OVERDUE ({Math.abs(daysRemaining || 0)}D)
                          </span>
                        )}
                        {category === 'due_24h' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 border border-amber-500/50 text-amber-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                            DUE IN {Math.max(1, hoursRemaining || 0)}H
                          </span>
                        )}
                        {category === 'upcoming' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/15 border border-sky-500/30 text-sky-300 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-sky-400" />
                            IN {daysRemaining} DAYS
                          </span>
                        )}
                        {category === 'no_deadline' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                            NO DEADLINE
                          </span>
                        )}

                        {/* Associated Decision Pill */}
                        {decision && (
                          <button
                            onClick={() => {
                              onSelectDecisionById(decision.id);
                              onClose();
                            }}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-space-950 border border-sky-500/30 text-sky-400 hover:bg-sky-950 transition-colors"
                            title="View Decision Star"
                          >
                            ⭐ {decision.id}
                          </button>
                        )}

                        {/* Tracker status pill */}
                        {item.trackerUrl ? (
                          <a
                            href={item.trackerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/70 border border-purple-500/40 text-purple-300 flex items-center gap-1 hover:text-purple-200"
                          >
                            <span>GITHUB</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                            UNTRACKED
                          </span>
                        )}

                        {/* Conflict warning badge */}
                        {isConflictGated && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950 border border-amber-500/50 text-amber-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            CONFLICT GATED
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-sans text-slate-100 font-medium leading-relaxed">
                        {item.task}
                      </p>

                      <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 pt-1">
                        <span>Assignee: <strong className="text-slate-200">{item.owner}</strong></span>
                        <span>Deadline: <strong className="text-slate-200">{item.deadline || 'Pending'}</strong></span>
                        {meeting && (
                          <span className="hidden sm:inline text-slate-500">Mtg: {meeting.title}</span>
                        )}
                      </div>
                    </div>

                    {/* Right: Send Reminder Button */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleRemindClick(item.id, item.owner)}
                        disabled={isPendingThis || isReminded}
                        className={`px-3 py-1.5 rounded-md text-xs font-mono flex items-center gap-1.5 transition-all ${
                          isReminded
                            ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
                            : 'bg-sky-500/15 border border-sky-500/30 hover:bg-sky-500/25 text-sky-300 shadow-glow-cyan'
                        }`}
                        title="Send notification and post GitHub issue reminder comment"
                      >
                        {isReminded ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>SENT</span>
                          </>
                        ) : isPendingThis ? (
                          <span>TRANSMITTING...</span>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5 text-sky-400" />
                            <span>REMIND</span>
                          </>
                        )}
                      </button>
                      {item.trackerUrl && (
                        <span className="text-[9px] font-mono text-slate-500">
                          Posts to GitHub
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info strip */}
        <div className="px-5 py-3 border-t border-slate-800 bg-space-900/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div>
            ⚡ Satellites for overdue and 24h-due tasks pulse faster on the constellation canvas.
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            DISMISS
          </button>
        </div>

      </div>
    </div>
  );
};
