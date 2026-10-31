import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Meeting, 
  Decision, 
  ActionItem, 
  OrbitState, 
  ConflictRecord, 
  ConflictResolution 
} from './types';
import { INITIAL_ORBIT_STATE } from '../../shared/seedData';
import { Header } from './components/Header';
import { ConstellationCanvas } from './components/ConstellationCanvas';
import { InspectorPanel } from './components/InspectorPanel';
import { TransmissionBar } from './components/TransmissionBar';
import { StarLegend } from './components/StarLegend';
import { RemindersPanel } from './components/RemindersPanel';
import { DigestPanel } from './components/DigestPanel';
import { soundEffects } from './utils/audio';
import { Bell, CheckCircle2, AlertTriangle, Sparkles, X, ShieldAlert } from 'lucide-react';

const PROCESSING_STEPS = [
  'ACQUIRING SIGNAL…',
  'DECODING SPEAKERS…',
  'EXTRACTING DECISIONS…',
  'MAPPING ORBITS…'
];

export const App: React.FC = () => {
  const [state, setState] = useState<OrbitState>(INITIAL_ORBIT_STATE);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [filter, setFilter] = useState<'all' | 'conflicts' | 'active'>('all');
  const [isTransmissionOpen, setIsTransmissionOpen] = useState(false);
  const [focusMeetingId, setFocusMeetingId] = useState<string | null>(null);
  const [fxMode, setFxMode] = useState<'full' | 'low'>('full');
  const [isRemindersOpen, setIsRemindersOpen] = useState(false);
  const [isDigestOpen, setIsDigestOpen] = useState(false);

  // Cinematic Conflict Moment state
  const [cinematicConflict, setCinematicConflict] = useState<{ sourceId: string; targetId: string; type: string } | null>(null);
  const [showRedFlash, setShowRedFlash] = useState(false);
  const [conflictBanner, setConflictBanner] = useState<string | null>(null);

  // Transmission Processing & Status Rotation
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStepIndex, setProcessingStepIndex] = useState(0);
  const [transmissionError, setTransmissionError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'alert' | 'info' } | null>(null);

  // Fetch initial state from server API with seamless fallback to embedded seed state
  useEffect(() => {
    const fetchServerState = async () => {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = await res.json();
          if (data && data.meetings && data.decisions) {
            setState(data);
          }
        }
      } catch {
        // Running cleanly on offline seed state
      }
    };
    fetchServerState();
  }, []);

  // Cycle rotating status text while processing
  useEffect(() => {
    if (!isProcessing) {
      setProcessingStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setProcessingStepIndex(prev => (prev + 1) % PROCESSING_STEPS.length);
    }, 900);
    return () => clearInterval(interval);
  }, [isProcessing]);

  const showNotification = (message: string, type: 'success' | 'alert' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 5500);
  };

  const selectedMeeting = selectedDecision
    ? state.meetings.find(m => m.id === selectedDecision.meetingId) || null
    : null;

  const selectedActionItems = selectedDecision
    ? state.actionItems.filter(a => a.decisionId === selectedDecision.id)
    : [];

  const handleSelectDecisionById = useCallback((id: string) => {
    const target = state.decisions.find(d => d.id === id);
    if (target) {
      setSelectedDecision(target);
    }
  }, [state.decisions]);

  // Hold-to-launch handler (Dispatches real GitHub issues or local tracker)
  const handleLaunchActions = async (actionIds: string[]) => {
    try {
      const res = await fetch('/api/actions/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionIds })
      });

      if (!res.ok) {
        throw new Error('Failed to dispatch tasks');
      }

      const data = await res.json();
      if (data.state) {
        setState(data.state);
      }

      const successCount = (data.results || []).filter((r: any) => r.success).length;
      const failCount = (data.results || []).filter((r: any) => !r.success).length;

      if (data.mode === 'github') {
        showNotification(
          `DISPATCHED ${successCount} TASKS TO GITHUB (${data.tracker})${failCount > 0 ? ` · ${failCount} failed` : ''}`,
          failCount > 0 ? 'alert' : 'success'
        );
      } else {
        showNotification(
          `DISPATCHED ${successCount} TASKS TO LOCAL TRACKER (add GITHUB_TOKEN to sync)`,
          'info'
        );
      }
    } catch (err: any) {
      showNotification(`Dispatch failed: ${err.message}`, 'alert');
    }
  };

  // Send Reminder Handler
  const handleSendReminder = async (actionId: string, owner: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/actions/${actionId}/remind`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        const commentNote = data.commentPosted ? ' (posted comment to GitHub issue)' : '';
        showNotification(`Reminder sent to ${owner}${commentNote}`, 'success');
        return true;
      } else {
        throw new Error(data.error || 'Failed to send reminder');
      }
    } catch (err: any) {
      showNotification(`Reminder failed: ${err.message}`, 'alert');
      return false;
    }
  };

  // Transmission Bar: Live End-to-End Ingestion via Gemini & Semantic Conflict Trigger
  const handleTransmit = async (transcript: string, title?: string, date?: string): Promise<boolean> => {
    setIsProcessing(true);
    setTransmissionError(null);
    setConflictBanner(null);
    setCinematicConflict(null);

    try {
      const response = await fetch('/api/transmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, title, date })
      });

      const data = await response.json();

      if (!response.ok) {
        let rawError = data.error || 'Failed to analyze transcript.';
        let cleanMsg = typeof rawError === 'string' ? rawError : JSON.stringify(rawError);
        try {
          const parsed = JSON.parse(cleanMsg);
          if (parsed.error?.message) cleanMsg = parsed.error.message;
          else if (parsed.message) cleanMsg = parsed.message;
        } catch {
          const match = cleanMsg.match(/\{[\s\S]*"error"[\s\S]*\}/);
          if (match) {
            try {
              const parsed = JSON.parse(match[0]);
              if (parsed.error?.message) cleanMsg = parsed.error.message;
            } catch {
              cleanMsg = cleanMsg.replace(/[{}\[\]"]/g, '').trim();
            }
          }
        }
        cleanMsg = cleanMsg.replace(/[{}\[\]"]/g, '').replace(/^Error:\s*/i, '').trim();
        setTransmissionError(cleanMsg);
        showNotification(cleanMsg, 'alert');
        setIsProcessing(false);
        return false;
      }

      // Transmission succeeded! Update orbit state
      if (data.state) {
        setState(data.state);
      }

      // Step 1: Materialize new cluster
      if (data.meeting?.id) {
        setFocusMeetingId(data.meeting.id);
      }

      const decCount = data.decisions?.length || 0;
      const actCount = data.actionItems?.length || 0;
      const newConflicts: ConflictRecord[] = data.conflicts || [];

      showNotification(
        `CONSTELLATION EXPANDED // ${decCount} DECISIONS · ${actCount} ACTIONS CAPTURED`,
        'success'
      );

      // Step 2: "THE MOMENT" - If a conflict was detected, play the dramatic cinematic ignition sequence
      if (newConflicts.length > 0) {
        const primary = newConflicts[0];

        // Diagnostic log: BEFORE conflict ignition
        if (typeof (window as any).__ORBIT_GET_METRICS__ === 'function') {
          console.log('[ORBIT DIAGNOSTICS] BEFORE CONFLICT IGNITION:', (window as any).__ORBIT_GET_METRICS__());
        }

        setTimeout(() => {
          // Play high-voltage alarm tone
          soundEffects.selectStar(true);

          // Red screen-edge flash
          setShowRedFlash(true);
          setTimeout(() => setShowRedFlash(false), 1200);

          // Frame both conflicting stars and ignite the tether
          setCinematicConflict({
            sourceId: primary.existingDecisionId,
            targetId: primary.newDecisionId,
            type: primary.type
          });

          // Display prominent conflict alert banner
          setConflictBanner(
            `⚠ CONFLICT DETECTED // ${primary.type.replace('_', ' ').toUpperCase()}: ${primary.explanation}`
          );

          // Diagnostic log: 5 seconds after conflict ignition
          setTimeout(() => {
            if (typeof (window as any).__ORBIT_GET_METRICS__ === 'function') {
              console.log('[ORBIT DIAGNOSTICS] 5s AFTER CONFLICT IGNITION:', (window as any).__ORBIT_GET_METRICS__());
            }
          }, 5000);

          // Automatically select the new conflicting star to open the deep-dive inspector
          const conflictingStar = data.state?.decisions?.find((d: any) => d.id === primary.newDecisionId);
          if (conflictingStar) {
            setSelectedDecision(conflictingStar);
          }
        }, 1100);
      }

      setIsProcessing(false);
      return true;

    } catch (err: any) {
      let message = err.message || 'Network error communicating with core server.';
      if (typeof message === 'string' && (message.trim().startsWith('{') || message.includes('"error":'))) {
        try {
          const parsed = JSON.parse(message);
          message = parsed.error?.message || parsed.message || 'Network communication failure.';
        } catch {
          message = message.replace(/[{}\[\]"]/g, '').trim();
        }
      }
      setTransmissionError(message);
      showNotification(message, 'alert');
      setIsProcessing(false);
      return false;
    }
  };

  // Resolve conflict arbitration handler
  const handleResolveConflict = async (conflictId: string, resolution: ConflictResolution) => {
    try {
      const response = await fetch(`/api/conflicts/${conflictId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution })
      });

      if (!response.ok) {
        throw new Error('Failed to resolve conflict on server');
      }

      const data = await response.json();
      if (data.state) {
        setState(data.state);
        // Refresh selected decision in inspector
        if (selectedDecision) {
          const updated = data.state.decisions.find((d: any) => d.id === selectedDecision.id);
          if (updated) setSelectedDecision(updated);
        }
      }

      setCinematicConflict(null);
      setConflictBanner(null);
      soundEffects.launchSuccess();

      const label = {
        keep_existing: 'ORIGINAL PRESERVED · NEW SUPERSEDED',
        keep_new: 'NEW ACCEPTED · EARLIER SUPERSEDED',
        keep_both: 'COEXISTENCE RATIFIED · BOTH ACTIVE'
      }[resolution];

      showNotification(`ARBITRATION APPLIED // ${label}`, 'success');

    } catch (err: any) {
      showNotification(`Arbitration failed: ${err.message}`, 'alert');
    }
  };

  // Reset Demo Rehearsal handler
  const handleResetDemo = async () => {
    try {
      const response = await fetch('/api/reset', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        if (data.state) {
          setState(data.state);
        }
        setSelectedDecision(null);
        setCinematicConflict(null);
        setConflictBanner(null);
        setFocusMeetingId(null);
        window.dispatchEvent(new CustomEvent('orbit:recenter'));
        soundEffects.clusterMaterialize();
        showNotification('DEMO RESTORED // CONSTELLATION REVERTED TO PRISTINE SEED STATE', 'info');
      }
    } catch {
      showNotification('Failed to reset demo state', 'alert');
    }
  };

  // Number of UNRESOLVED conflict pairs
  const unresolvedConflictPairs = (state.conflicts || []).filter(c => !c.resolved).length;

  // Unresolved conflict decision IDs
  const unresolvedConflictDecisionIds = new Set(
    (state.conflicts || []).filter(c => !c.resolved).flatMap(c => [c.newDecisionId, c.existingDecisionId])
  );

  // Eligible pending actions for global Hold-To-Launch (excludes conflict-gated)
  const eligiblePendingActions = state.actionItems.filter(a => {
    if (a.status === 'completed' || a.trackerUrl) return false;
    const parentDec = state.decisions.find(d => d.id === a.decisionId);
    if (parentDec && (parentDec.status === 'conflict' || unresolvedConflictDecisionIds.has(parentDec.id))) {
      return false;
    }
    return true;
  });

  // Overdue actions count
  const nowTime = Date.now();
  const overdueActionCount = state.actionItems.filter(a => {
    if (a.status === 'completed') return false;
    if (!a.deadline || a.deadline === 'Pending') return false;
    const dl = new Date(a.deadline).getTime();
    return !isNaN(dl) && (dl - nowTime) < 0;
  }).length;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-space-950 text-slate-100 font-sans">
      
      {/* Background Subtle Radar Grid Overlay */}
      <div className="absolute inset-0 bg-radar-grid pointer-events-none z-0" />
      
      {/* CRT Scanline Texture Overlay */}
      <div className="absolute inset-0 scanline-overlay z-10 pointer-events-none opacity-40" />

      {/* Screen-Edge Dramatic Red Flash Vignette on Conflict Ignition */}
      {showRedFlash && fxMode !== 'low' && (
        <div className="red-flash-overlay" />
      )}

      {/* Top Telemetry Header Bar */}
      <Header
        totalDecisions={state.decisions.length}
        totalSatellites={state.actionItems.length}
        conflictPairCount={unresolvedConflictPairs}
        filter={filter}
        onFilterChange={setFilter}
        onResetView={() => {
          setSelectedDecision(null);
          setFocusMeetingId(null);
          setCinematicConflict(null);
          window.dispatchEvent(new CustomEvent('orbit:recenter'));
        }}
        onResetDemo={handleResetDemo}
        onOpenTransmission={() => setIsTransmissionOpen(true)}
        fxMode={fxMode}
        onToggleFxMode={() => setFxMode(prev => prev === 'full' ? 'low' : 'full')}
        onOpenReminders={() => setIsRemindersOpen(true)}
        onOpenDigest={() => setIsDigestOpen(true)}
        onDispatchAllPending={() => handleLaunchActions(eligiblePendingActions.map(a => a.id))}
        pendingActionCount={eligiblePendingActions.length}
        overdueActionCount={overdueActionCount}
      />

      {/* Prominent Floating Conflict Alert Banner ("THE MOMENT") */}
      {conflictBanner && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 max-w-xl w-full px-4 pointer-events-auto animate-bounce">
          <div className="p-3 rounded-lg bg-rose-950/95 border-2 border-rose-500 shadow-glow-red flex items-center justify-between text-xs font-mono text-rose-200">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 animate-ping" />
              <span className="leading-tight font-semibold">{conflictBanner}</span>
            </div>
            <button
              onClick={() => setConflictBanner(null)}
              className="p-1 hover:bg-rose-900 rounded text-rose-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Full-Screen Constellation Canvas View */}
      <main className="absolute inset-0 z-0 pointer-events-auto">
        <ConstellationCanvas
          meetings={state.meetings}
          decisions={state.decisions}
          actionItems={state.actionItems}
          conflicts={state.conflicts || []}
          selectedDecisionId={selectedDecision?.id || null}
          onSelectDecision={setSelectedDecision}
          filter={filter}
          focusMeetingId={focusMeetingId}
          cinematicConflict={cinematicConflict}
          fxMode={fxMode}
        />
      </main>

      {/* Side Inspector Telemetry Panel */}
      <InspectorPanel
        decision={selectedDecision}
        meeting={selectedMeeting}
        actionItems={selectedActionItems}
        allDecisions={state.decisions}
        allMeetings={state.meetings}
        conflicts={state.conflicts || []}
        onClose={() => setSelectedDecision(null)}
        onSelectDecisionById={handleSelectDecisionById}
        onLaunchActions={handleLaunchActions}
        onResolveConflict={handleResolveConflict}
        onSendReminder={handleSendReminder}
      />

      {/* Reminders Telemetry Panel */}
      <RemindersPanel
        isOpen={isRemindersOpen}
        onClose={() => setIsRemindersOpen(false)}
        actionItems={state.actionItems}
        decisions={state.decisions}
        meetings={state.meetings}
        conflicts={state.conflicts || []}
        onSelectDecisionById={handleSelectDecisionById}
        onSendReminder={handleSendReminder}
      />

      {/* Weekly Executive Digest Panel */}
      <DigestPanel
        isOpen={isDigestOpen}
        onClose={() => setIsDigestOpen(false)}
        state={state}
        onSelectDecisionById={handleSelectDecisionById}
      />

      {/* Bottom Transmission Uplink Console */}
      <TransmissionBar
        isOpen={isTransmissionOpen}
        onToggle={() => setIsTransmissionOpen(!isTransmissionOpen)}
        onClose={() => setIsTransmissionOpen(false)}
        onSubmit={handleTransmit}
        isProcessing={isProcessing}
        processingStep={PROCESSING_STEPS[processingStepIndex]}
        errorMessage={transmissionError}
        onDismissError={() => setTransmissionError(null)}
      />

      {/* Bottom-Left Visual Status Legend */}
      <StarLegend />

      {/* Toast Notification Alert */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-bounce">
          <div className={`px-4 py-2.5 rounded-md font-mono text-xs flex items-center gap-2.5 shadow-2xl border max-w-lg ${
            notification.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-300 shadow-emerald-500/20'
              : notification.type === 'alert'
              ? 'bg-rose-950/95 border-rose-500/50 text-rose-300 shadow-rose-500/20'
              : 'bg-sky-950/95 border-sky-500/50 text-sky-300 shadow-sky-500/20'
          }`}>
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : notification.type === 'alert' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            ) : (
              <Bell className="w-4 h-4 text-sky-400 flex-shrink-0" />
            )}
            <span className="leading-snug">{notification.message}</span>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
