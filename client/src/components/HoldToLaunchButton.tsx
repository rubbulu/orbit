import React, { useState, useRef, useEffect } from 'react';
import { Rocket, Check, AlertCircle } from 'lucide-react';
import { soundEffects } from '../utils/audio';

interface HoldToLaunchButtonProps {
  onComplete: () => void;
  disabled?: boolean;
  disabledReason?: string;
  itemCount?: number;
  label?: string;
  size?: 'normal' | 'large' | 'compact';
  className?: string;
}

export const HoldToLaunchButton: React.FC<HoldToLaunchButtonProps> = ({
  onComplete,
  disabled = false,
  disabledReason,
  itemCount,
  label = 'HOLD TO LAUNCH',
  size = 'normal',
  className = ''
}) => {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const holdStartRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const HOLD_DURATION = 1000; // 1 second required hold

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || isSuccess) return;
    e.preventDefault();
    setIsHolding(true);
    holdStartRef.current = performance.now();
    soundEffects.click();

    const updateHold = () => {
      if (!holdStartRef.current) return;
      const elapsed = performance.now() - holdStartRef.current;
      const currentProgress = Math.min(100, (elapsed / HOLD_DURATION) * 100);
      setProgress(currentProgress);

      if (elapsed >= HOLD_DURATION) {
        setIsHolding(false);
        setIsSuccess(true);
        holdStartRef.current = null;
        soundEffects.launchSuccess();
        onComplete();
        setTimeout(() => {
          setIsSuccess(false);
          setProgress(0);
        }, 1800);
      } else {
        animFrameRef.current = requestAnimationFrame(updateHold);
      }
    };

    animFrameRef.current = requestAnimationFrame(updateHold);
  };

  const handleEnd = () => {
    if (isSuccess) return;
    setIsHolding(false);
    holdStartRef.current = null;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    // Smooth reset
    setProgress(0);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Visual parameters
  const dimension = size === 'large' ? 84 : size === 'compact' ? 44 : 64;
  const strokeWidth = size === 'large' ? 4.5 : size === 'compact' ? 3 : 3.5;
  const radius = (dimension - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  if (disabled) {
    return (
      <div className={`relative flex flex-col items-center opacity-60 cursor-not-allowed ${className}`} title={disabledReason}>
        <div 
          className="relative rounded-full flex items-center justify-center border border-slate-700 bg-space-900/60"
          style={{ width: dimension, height: dimension }}
        >
          <Rocket className="w-5 h-5 text-slate-500" />
        </div>
        {disabledReason && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-mono text-amber-400">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span>{disabledReason}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      <button
        type="button"
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
        className={`relative rounded-full flex items-center justify-center transition-transform active:scale-95 focus:outline-none group ${
          isSuccess 
            ? 'bg-emerald-950/80 shadow-glow-cyan' 
            : isHolding 
            ? 'bg-sky-950/90 shadow-[0_0_24px_rgba(56,189,248,0.5)]' 
            : 'bg-space-900/90 hover:bg-space-850 hover:shadow-glow-cyan'
        }`}
        style={{ width: dimension, height: dimension }}
        title="Press and hold 1s to dispatch"
      >
        {/* Background track circle */}
        <svg
          className="absolute inset-0 -rotate-90 pointer-events-none"
          width={dimension}
          height={dimension}
        >
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke="rgba(56, 189, 248, 0.15)"
            strokeWidth={strokeWidth}
          />
          {/* Active progress ring */}
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke={isSuccess ? '#34d399' : '#38bdf8'}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-75"
          />
        </svg>

        {/* Center Icon & feedback */}
        <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none">
          {isSuccess ? (
            <Check className="w-6 h-6 text-emerald-400 animate-scale-in" />
          ) : (
            <Rocket className={`w-5 h-5 text-sky-400 transition-transform ${isHolding ? 'scale-125 rotate-12 animate-pulse text-white' : 'group-hover:scale-110'}`} />
          )}
          {size === 'large' && !isSuccess && (
            <span className="text-[9px] font-mono font-bold text-sky-300 mt-0.5">
              {progress > 0 ? `${Math.round(progress)}%` : itemCount !== undefined ? `${itemCount}` : 'HOLD'}
            </span>
          )}
        </div>
      </button>

      {/* Button Sub-Label */}
      {label && size !== 'compact' && (
        <div className="mt-2 text-center pointer-events-none">
          <span className="font-mono text-[10px] tracking-wider text-sky-300 uppercase font-semibold">
            {isSuccess ? 'DISPATCHED!' : isHolding ? 'HOLDING...' : label}
          </span>
          {itemCount !== undefined && !isSuccess && (
            <span className="text-[9px] font-mono text-slate-400 block">
              {itemCount} {itemCount === 1 ? 'task' : 'tasks'} queued
            </span>
          )}
        </div>
      )}
    </div>
  );
};
