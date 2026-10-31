import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Mic, 
  MicOff, 
  Sparkles, 
  Terminal, 
  FileText, 
  ChevronUp, 
  ChevronDown, 
  Radio, 
  AlertCircle, 
  X,
  Clock,
  Layers
} from 'lucide-react';
import { soundEffects } from '../utils/audio';

interface TransmissionBarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSubmit: (transcript: string, title?: string, date?: string) => Promise<boolean>;
  isProcessing: boolean;
  processingStep: string;
  errorMessage: string | null;
  onDismissError: () => void;
}

export const SAMPLE_TRANSCRIPTS = [
  {
    code: 'MTG-04',
    title: 'Enterprise Pilot Review & Expansion',
    date: '2026-10-29',
    summary: 'Pilot feedback review with FinScale and Acme Health. Consistent with existing decisions.',
    text: `Maya: Good afternoon team. We just wrapped our bi-weekly review with our three enterprise pilot partners: FinScale, Acme Health, and Apex Global. Overall the response to our real-time telemetry constellation has been overwhelmingly positive.
Sam: That is great to hear Maya. How did they react to the self-serve pricing and the compliance safeguards we agreed upon in our previous architecture sessions?
Maya: FinScale confirmed that our zero raw-audio retention policy directly addressed their chief infosec concern, which saved us months of security paperwork. They were also comfortable with the $1,200 annual Okta SAML add-on we established last week. However, both FinScale and Acme Health ran into a critical friction point regarding evaluation timing. Our current standard 14-day trial window is simply too compressed for corporate procurement and legal approval workflows.
Elena: What do they need to get the contracts through their legal departments?
Maya: They requested a minimum of 30 days. Let's formally commit to extending the evaluation window to 30 days for all enterprise-tier pilot accounts undergoing compliance review.
David: From an infrastructure perspective, maintaining tenant clusters for 30 days is manageable. But Acme Health also made one mandatory technical demand before they can greenlight pilot graduation. They need an automated audit log export feature that provides downloadable CSV records and a real-time webhook stream of every recorded decision and user modification.
Elena: Can we fit that into our current roadmap before General Availability?
David: Yes, if we scope it strictly to CSV export and webhook streaming. We agree to prioritize the audit log export endpoints into Sprint 14 so it ships alongside the core constellation engine.
Sam: Perfect. What are our concrete next steps coming out of this?
Maya: Sam, please draft the revised 30-day enterprise pilot agreement template and update the DocuSign workflow templates by November 8.
David: I will take the engineering task. I will implement the CSV export endpoint and webhook streaming architecture in our telemetry service by November 12.
Elena: Excellent. Let's reconvene on Thursday to verify the DocuSign rollout.`
  },
  {
    code: 'MTG-05',
    title: 'Q4 Emergency Budget & Runway Alignment',
    date: '2026-10-31',
    summary: 'Executive runway sync. Secretly institutes a hiring freeze that contradicts MTG-01 engineering headcount.',
    text: `Marcus: Thank you all for joining on short notice. We received the finalized cloud compute invoice and AWS vector database telemetry metrics for October, and our monthly burn has accelerated significantly past our operating plan.
Elena: How much higher are we tracking against our forecast?
Marcus: Compute expenditures came in $14,500 over budget due to unoptimized vector embedding clusters and continuous websocket streaming during our extended database sharding tests. In addition, because we delayed our General Availability launch date from November 15 to December 01 in our last sync, our projected Q4 subscription revenue will be delayed into the next fiscal quarter.
David: What does this mean for our cash runway if we maintain our current hiring and compute spending trajectory?
Elena: If we do not make immediate adjustments to our operational expenditures today, our cash buffer shrinks to less than 4 months by year-end, which puts the company in jeopardy before our Series A milestone.
Marcus: Exactly. We need to take decisive corrective measures right now. First, regarding headcount: in MTG-01 we opened requisitions for 2 Senior Distributed Systems Engineers. Given our tightened burn rate, we can no longer support adding headcount this quarter. Effective immediately, we are instituting a total hiring freeze across all engineering roles until Q1 2027. We must pause active recruiting for those two backend infrastructure positions.
David: That will definitely constrain our ability to scale ingest throughput past 500 concurrent meetings, but from a survival standpoint I understand the necessity.
Elena: What about our runaway AWS GPU and vector database bills?
David: Right now we keep Kubernetes worker nodes provisioned around the clock even when meeting ingestion traffic drops during off-peak hours.
Elena: Let's lock in a strict cloud infrastructure spending ceiling. We decide to cap total monthly cloud compute spend at $18,000 per month by enforcing automatic downscaling of idle Kubernetes worker pods after 15 minutes of inactivity.
Marcus: Agreed. For action items: I will personally inform our external recruiters and pause active interview pipelines for the backend positions by tomorrow afternoon.
David: I will configure the Kubernetes horizontal pod auto-scaler rules and downscaling triggers in production by November 5.
Elena: Thank you everyone. Meeting adjourned.`
  }
];

export const TransmissionBar: React.FC<TransmissionBarProps> = ({
  isOpen,
  onToggle,
  onClose,
  onSubmit,
  isProcessing,
  processingStep,
  errorMessage,
  onDismissError
}) => {
  const [transcript, setTranscript] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'samples'>('editor');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Global '/' shortcut focuses the transmission bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'INPUT'
      ) {
        e.preventDefault();
        soundEffects.click();
        if (!isOpen) onToggle();
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onToggle, onClose]);

  const handleTransmit = async () => {
    if (!transcript.trim() || isProcessing) return;
    soundEffects.click();
    const success = await onSubmit(
      transcript,
      meetingTitle.trim() || undefined,
      meetingDate.trim() || undefined
    );
    if (success) {
      setTranscript('');
      setMeetingTitle('');
      setMeetingDate('');
      onClose();
    }
  };

  const handleLoadSample = (sample: typeof SAMPLE_TRANSCRIPTS[0]) => {
    soundEffects.click();
    setTranscript(sample.text);
    setMeetingTitle(sample.title);
    setMeetingDate(sample.date);
    setActiveTab('editor');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4 pointer-events-auto">
      <div className="hud-panel rounded-lg overflow-hidden border border-sky-500/30 shadow-2xl relative">
        
        {/* Scanning Line Animation & Telemetry Overlay during processing */}
        {isProcessing && (
          <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden bg-space-950/85 backdrop-blur-sm flex flex-col items-center justify-center">
            {/* Animated Scanning Laser Line */}
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_18px_#38bdf8] animate-scanline" />
            
            <div className="flex flex-col items-center gap-2 px-6 text-center">
              <div className="flex items-center gap-2.5 font-mono text-sm text-sky-300 font-bold tracking-widest animate-pulse">
                <Radio className="w-4 h-4 animate-spin text-sky-400" />
                <span>{processingStep}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 max-w-md">
                GEMINI AI TELEMETRY CORE · RESOLVING COMMITMENTS & TIMELINES
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping delay-100"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping delay-200"></span>
              </div>
            </div>
          </div>
        )}

        {/* Transmission Bar Top Header */}
        <div className="px-3.5 py-2 bg-space-900/90 border-b border-sky-500/20 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-sky-400">
              <Terminal className="w-3.5 h-3.5" />
              <span className="font-bold tracking-wider text-[11px]">TRANSMISSION UPLINK</span>
            </div>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              GEMINI AI · STRUCTURED MEMORY
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded bg-space-950/80 p-0.5 border border-slate-700/60 text-[10px]">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  activeTab === 'editor' ? 'bg-sky-500/20 text-sky-300 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                INPUT SIGNAL
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('samples')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  activeTab === 'samples' ? 'bg-sky-500/20 text-sky-300 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                PRESET SIGNALS ({SAMPLE_TRANSCRIPTS.length})
              </button>
            </div>

            <button
              onClick={onToggle}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-sky-300 rounded transition-colors"
              title={isOpen ? 'Minimize bar' : 'Expand bar'}
            >
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Error Alert Strip (e.g. Missing Gemini API key) */}
        {errorMessage && (
          <div className="px-3.5 py-2 bg-rose-950/90 border-b border-rose-500/40 flex items-center justify-between text-xs font-mono text-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 animate-pulse" />
              <span className="text-[11px] leading-tight">
                {typeof errorMessage === 'string' && (errorMessage.trim().startsWith('{') || errorMessage.includes('"error":'))
                  ? 'Telemetry analysis error. Please verify your connection or API key.'
                  : errorMessage}
              </span>
            </div>
            <button
              onClick={onDismissError}
              className="p-0.5 hover:bg-rose-900/60 rounded text-rose-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Collapsible Body */}
        {isOpen ? (
          <div className="p-3 bg-space-950/90 space-y-2.5">
            {activeTab === 'editor' ? (
              <div>
                {/* Optional Title & Date Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 font-mono text-xs">
                  <div>
                    <input
                      type="text"
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      placeholder="Meeting Title (optional, e.g. 'Pilot Review')"
                      className="w-full bg-space-900/90 border border-slate-800 focus:border-sky-500/60 rounded px-2.5 py-1 text-slate-200 placeholder-slate-500 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="w-full bg-space-900/90 border border-slate-800 focus:border-sky-500/60 rounded px-2.5 py-1 text-slate-300 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <textarea
                  ref={textareaRef}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Paste meeting transcript with speaker names (e.g. 'Maya: We commit to 30-day enterprise trials. Sam: I will update the DocuSign workflow by Nov 8.')..."
                  rows={5}
                  className="w-full bg-space-900/90 border border-slate-800 focus:border-sky-500/60 rounded p-2.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40 resize-none leading-relaxed"
                />

                <div className="mt-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Simulated Voice Dictation Button */}
                    <button
                      type="button"
                      onClick={() => {
                        soundEffects.click();
                        setIsRecording(!isRecording);
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono border transition-colors ${
                        isRecording 
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                          : 'bg-space-900 text-slate-400 hover:text-slate-200 border-slate-700/60'
                      }`}
                    >
                      {isRecording ? <Mic className="w-3.5 h-3.5 text-rose-400" /> : <MicOff className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{isRecording ? 'LISTENING...' : 'DICTATE'}</span>
                    </button>

                    <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                      Press <kbd className="px-1 py-0.5 rounded bg-space-900 border border-slate-700 text-slate-400">/</kbd> to focus
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setTranscript(''); setMeetingTitle(''); setMeetingDate(''); }}
                      disabled={!transcript && !meetingTitle}
                      className="px-2.5 py-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400"
                    >
                      CLEAR
                    </button>
                    <button
                      type="button"
                      onClick={handleTransmit}
                      disabled={!transcript.trim() || isProcessing}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-sky-500 hover:bg-sky-400 text-space-950 font-mono font-bold text-xs shadow-glow-cyan disabled:opacity-40 disabled:hover:bg-sky-500 disabled:shadow-none transition-all active:scale-95"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>TRANSMIT SIGNAL</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Preset Signals Tab for 1-Click Realistic Hackathon Testing */
              <div className="space-y-2 py-1">
                <div className="text-[11px] font-mono text-slate-400 mb-2 flex items-center justify-between">
                  <span>SELECT REALISTIC HACKATHON SAMPLE (300+ WORDS):</span>
                  <span className="text-[10px] text-sky-400">CLICK TO LOAD</span>
                </div>
                {SAMPLE_TRANSCRIPTS.map((sample) => (
                  <div
                    key={sample.code}
                    onClick={() => handleLoadSample(sample)}
                    className="p-3 rounded bg-space-900 hover:bg-space-850 border border-slate-800 hover:border-sky-500/40 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 font-bold border border-sky-500/30">
                          {sample.code}
                        </span>
                        <span className="text-slate-200 font-semibold group-hover:text-sky-300 transition-colors">
                          {sample.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 group-hover:text-sky-400 font-mono">
                        {sample.date} →
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-sans">
                      {sample.summary}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Minimized Bar Preview */
          <div
            onClick={onToggle}
            className="px-4 py-2 bg-space-950/80 flex items-center justify-between cursor-pointer hover:bg-space-900/80 transition-colors"
          >
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
              <span>Click to open transmission uplink or press</span>
              <kbd className="px-1.5 py-0.5 rounded bg-space-900 border border-slate-700 text-sky-400 text-[10px]">/</kbd>
            </div>
            <span className="text-[11px] font-mono text-sky-400 flex items-center gap-1">
              EXPAND CONSOLE <ChevronUp className="w-3.5 h-3.5" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
