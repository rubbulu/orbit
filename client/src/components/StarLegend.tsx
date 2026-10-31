import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp, Sparkles, AlertCircle } from 'lucide-react';
import { soundEffects } from '../utils/audio';

export const StarLegend: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="fixed bottom-4 left-4 z-30 pointer-events-auto">
      <div className="hud-panel rounded-lg overflow-hidden text-xs font-mono w-64">
        {/* Toggle Bar */}
        <div 
          onClick={() => { soundEffects.click(); setIsOpen(!isOpen); }}
          className="px-3 py-2 bg-space-900/90 flex items-center justify-between cursor-pointer border-b border-slate-800 hover:bg-space-850 transition-colors"
        >
          <div className="flex items-center gap-1.5 text-sky-400">
            <Info className="w-3.5 h-3.5" />
            <span className="font-bold tracking-wider text-[11px]">CONSTELLATION TELEMETRY</span>
          </div>
          <button className="text-slate-400 hover:text-white">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Legend Body */}
        {isOpen && (
          <div className="p-3 bg-space-950/80 space-y-2.5">
            {/* Statuses */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]"></span>
                  <span className="text-slate-300">ACTIVE COMMITMENT</span>
                </div>
                <span className="text-[10px] text-sky-400">STAR</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]"></span>
                  <span className="text-slate-300">PENDING APPROVAL</span>
                </div>
                <span className="text-[10px] text-amber-400">STAR</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_#ef4444] animate-pulse"></span>
                  <span className="text-rose-300 font-semibold">CONTRADICTION</span>
                </div>
                <span className="text-[10px] text-rose-400">STAR</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                  <span className="text-slate-400">SUPERSEDED</span>
                </div>
                <span className="text-[10px] text-slate-500">STAR</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm bg-amber-300 rotate-45 shadow-[0_0_5px_#fde68a]"></span>
                  <span className="text-slate-300">ACTION SATELLITE</span>
                </div>
                <span className="text-[10px] text-amber-300">ORBIT</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-rose-500 border-t border-dotted border-rose-300"></span>
                  <span className="text-rose-400">CONFLICT TETHER</span>
                </div>
                <span className="text-[10px] text-rose-400">LINE</span>
              </div>
            </div>

            {/* Quick keys */}
            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>Focus Transmission:</span>
                <kbd className="px-1 py-0.5 rounded bg-space-900 border border-slate-700 text-sky-400">/</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Dismiss Inspector:</span>
                <kbd className="px-1 py-0.5 rounded bg-space-900 border border-slate-700 text-slate-300">Esc</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Navigate & Inspect:</span>
                <span className="text-slate-300">Click & Drag</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
