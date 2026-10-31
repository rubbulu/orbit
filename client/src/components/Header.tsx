import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  AlertTriangle, 
  RotateCcw,
  RefreshCw,
  Terminal,
  Bell,
  Rocket
} from 'lucide-react';
import { soundEffects } from '../utils/audio';
import { HoldToLaunchButton } from './HoldToLaunchButton';

interface HeaderProps {
  totalDecisions: number;
  totalSatellites: number;
  conflictPairCount: number;
  onResetView: () => void;
  onResetDemo: () => void;
  filter: 'all' | 'conflicts' | 'active';
  onFilterChange: (filter: 'all' | 'conflicts' | 'active') => void;
  onOpenTransmission: () => void;
  fxMode: 'full' | 'low';
  onToggleFxMode: () => void;
  onOpenReminders: () => void;
  onOpenDigest: () => void;
  onDispatchAllPending: () => void;
  pendingActionCount: number;
  overdueActionCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  totalDecisions,
  totalSatellites,
  conflictPairCount,
  onResetView,
  onResetDemo,
  filter,
  onFilterChange,
  onOpenTransmission,
  fxMode,
  onToggleFxMode,
  onOpenReminders,
  onOpenDigest,
  onDispatchAllPending,
  pendingActionCount,
  overdueActionCount
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toISOString().substring(11, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleMuteToggle = () => {
    const state = soundEffects.toggleMute();
    setIsMuted(!state);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-30 px-5 py-3 pointer-events-none flex items-center justify-between">
      {/* Left: Branding & Mission Codename */}
      <div className="pointer-events-auto flex items-center gap-4">
        <div className="flex items-center gap-2.5 px-3 py-1.5 hud-panel rounded-md">
          <div className="relative flex items-center justify-center w-5 h-5">
            <span className="absolute w-full h-full rounded-full bg-sky-500/30 animate-ping"></span>
            <span className="relative w-2.5 h-2.5 rounded-full bg-sky-400 shadow-glow-cyan"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold tracking-widest text-sky-400">ORBIT</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-500/30">
                v1.2-MEMORY
              </span>
            </div>
            <div className="text-[10px] font-mono tracking-wider text-slate-400">
              MEETINGS THAT REMEMBER
            </div>
          </div>
        </div>

        {/* Telemetry Status Strip */}
        <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 hud-panel rounded-md text-xs font-mono">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] tracking-wider uppercase">CORE: NOMINAL</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="text-slate-300">
            <span className="text-sky-400 font-semibold">{totalDecisions}</span> STARS
          </div>
          <span className="text-slate-600">|</span>
          <div className="text-slate-300">
            <span className="text-amber-400 font-semibold">{totalSatellites}</span> SATELLITES
          </div>
          <span className="text-slate-600">|</span>
          {conflictPairCount > 0 ? (
            <div className="flex items-center gap-1 text-rose-400 font-semibold animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{conflictPairCount} {conflictPairCount === 1 ? 'CONFLICT' : 'CONFLICTS'} DETECTED</span>
            </div>
          ) : (
            <div className="text-slate-400">0 CONFLICTS</div>
          )}
        </div>
      </div>

      {/* Center: Mission Clock */}
      <div className="pointer-events-auto hidden md:flex items-center gap-2 px-3.5 py-1.5 hud-panel rounded-md font-mono text-xs text-slate-300">
        <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
        <span className="tracking-widest">{utcTime}</span>
      </div>

      {/* Right: Quick Controls & Filter */}
      <div className="pointer-events-auto flex items-center gap-2">
        {/* Filter Pills */}
        <div className="hidden sm:flex items-center p-0.5 hud-panel rounded-md">
          <button
            onClick={() => { soundEffects.click(); onFilterChange('all'); }}
            className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors ${
              filter === 'all' 
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ALL
          </button>
          <button
            onClick={() => { soundEffects.click(); onFilterChange('conflicts'); }}
            className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors flex items-center gap-1.5 ${
              filter === 'conflicts' 
                ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50' 
                : 'text-slate-400 hover:text-rose-400'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${conflictPairCount > 0 ? 'bg-rose-500 animate-pulse' : 'bg-slate-500'}`}></span>
            CONFLICTS ({conflictPairCount})
          </button>
          <button
            onClick={() => { soundEffects.click(); onFilterChange('active'); }}
            className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors ${
              filter === 'active' 
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ACTIVE
          </button>
        </div>

        {/* Navigation Features: Reminders & Weekly Digest */}
        <div className="flex items-center gap-1.5">
          {/* Reminders Panel Toggle */}
          <button
            onClick={() => { soundEffects.click(); onOpenReminders(); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 hud-panel hover:bg-sky-500/10 hover:border-sky-500/40 text-slate-300 hover:text-sky-300 rounded-md text-xs font-mono transition-all group"
            title="Open Mission Reminders Telemetry"
          >
            <Bell className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
            <span className="hidden md:inline">REMINDERS</span>
            {overdueActionCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500 text-white font-bold animate-pulse">
                {overdueActionCount}
              </span>
            )}
          </button>

          {/* Weekly Digest Panel Toggle */}
          <button
            onClick={() => { soundEffects.click(); onOpenDigest(); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 hud-panel hover:bg-sky-500/10 hover:border-sky-500/40 text-slate-300 hover:text-amber-300 rounded-md text-xs font-mono transition-all group"
            title="Open Weekly Executive Digest"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
            <span className="hidden md:inline">DIGEST</span>
          </button>
        </div>

        {/* Persistent "DISPATCH ALL PENDING" Hold-To-Launch */}
        {pendingActionCount > 0 && (
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 hud-panel rounded-md border-sky-500/40 bg-sky-950/40">
            <HoldToLaunchButton
              size="compact"
              itemCount={pendingActionCount}
              label=""
              onComplete={onDispatchAllPending}
            />
            <div className="flex flex-col text-left pointer-events-none">
              <span className="text-[10px] font-mono font-bold text-sky-300 uppercase leading-none">
                DISPATCH ({pendingActionCount})
              </span>
              <span className="text-[8px] font-mono text-slate-400 uppercase tracking-tight">
                HOLD 1S TO GITHUB
              </span>
            </div>
          </div>
        )}

        {/* Transmission Trigger Button */}
        <button
          onClick={() => { soundEffects.click(); onOpenTransmission(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 hud-panel hover:bg-sky-500/10 hover:border-sky-500/40 text-sky-300 rounded-md text-xs font-mono transition-all group"
          title="Open Transmission Uplink (/)"
        >
          <Terminal className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline">TRANSMIT</span>
          <kbd className="px-1 text-[10px] bg-sky-950/80 border border-sky-500/30 rounded text-sky-400">/</kbd>
        </button>

        {/* Reset Camera View */}
        <button
          onClick={() => { soundEffects.click(); onResetView(); }}
          className="p-1.5 hud-panel hover:bg-slate-800 text-slate-300 hover:text-sky-400 rounded-md transition-colors"
          title="Recenter Constellation View (Press '0')"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* FX FULL / LOW Toggle */}
        <button
          onClick={() => { soundEffects.click(); onToggleFxMode(); }}
          className={`px-2 py-1 text-[11px] font-mono rounded transition-colors border ${
            fxMode === 'full'
              ? 'bg-sky-500/15 text-sky-300 border-sky-500/40 hover:bg-sky-500/25'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
          }`}
          title={`FX Mode: ${fxMode.toUpperCase()} (Click to toggle)`}
        >
          FX: {fxMode.toUpperCase()}
        </button>

        {/* Reset Demo Rehearsal Button */}
        <button
          onClick={() => { soundEffects.click(); onResetDemo(); }}
          className="p-1.5 hud-panel hover:bg-rose-950/60 hover:border-rose-500/40 text-slate-300 hover:text-rose-400 rounded-md transition-colors"
          title="Reset Constellation Demo Seed State"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Audio Mute Toggle */}
        <button
          onClick={handleMuteToggle}
          className="p-1.5 hud-panel hover:bg-slate-800 text-slate-300 hover:text-sky-400 rounded-md transition-colors"
          title={isMuted ? 'Unmute telemetry sound' : 'Mute telemetry sound'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-sky-400" />}
        </button>
      </div>
    </header>
  );
};
