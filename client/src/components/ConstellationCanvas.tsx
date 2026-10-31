import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3-force';
import { 
  Meeting, 
  Decision, 
  ActionItem, 
  ConstellationStar, 
  SatelliteNode, 
  ClusterNode,
  ConflictRecord 
} from '../types';
import { soundEffects } from '../utils/audio';
import { ZoomIn, ZoomOut, Maximize2, AlertTriangle, Eye } from 'lucide-react';

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  birthTime: number;
  maxLife: number; // in seconds
  color: string;
  size: number;
}

interface ConstellationCanvasProps {
  meetings: Meeting[];
  decisions: Decision[];
  actionItems: ActionItem[];
  conflicts: ConflictRecord[];
  selectedDecisionId: string | null;
  onSelectDecision: (decision: Decision | null) => void;
  filter: 'all' | 'conflicts' | 'active';
  focusMeetingId?: string | null;
  cinematicConflict?: { sourceId: string; targetId: string; type: string } | null;
  fxMode: 'full' | 'low';
}

interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

interface BackgroundStar {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  twinkleSpeed: number;
  phase: number;
}

const MAX_SPARKS = 300;

export const ConstellationCanvas: React.FC<ConstellationCanvasProps> = ({
  meetings,
  decisions,
  actionItems,
  conflicts,
  selectedDecisionId,
  onSelectDecision,
  filter,
  focusMeetingId,
  cinematicConflict,
  fxMode
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Dynamic props kept in refs to decouple render loop from React state re-triggers
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const selectedDecisionIdRef = useRef(selectedDecisionId);
  selectedDecisionIdRef.current = selectedDecisionId;
  const conflictsRef = useRef(conflicts);
  conflictsRef.current = conflicts;
  const cinematicConflictRef = useRef(cinematicConflict);
  cinematicConflictRef.current = cinematicConflict;
  const fxModeRef = useRef(fxMode);
  fxModeRef.current = fxMode;

  // Nodes & Simulation data stored in refs
  const starsRef = useRef<ConstellationStar[]>([]);
  const clustersRef = useRef<ClusterNode[]>([]);
  const bgStarsRef = useRef<BackgroundStar[]>([]);
  const simulationRef = useRef<d3.Simulation<any, undefined> | null>(null);

  // Particles & ignition trackers
  const sparksRef = useRef<SparkParticle[]>([]);
  const ignitionMapRef = useRef<Map<string, number>>(new Map());
  const rafLoopCountRef = useRef(0);
  const activeTethersCountRef = useRef(0);

  // Camera State (Pan & Zoom)
  const cameraRef = useRef<CameraState>({ x: 0, y: 0, zoom: 1.0 });
  const targetCameraRef = useRef<CameraState | null>(null);

  // Interaction State
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });
  const hoveredStarIdRef = useRef<string | null>(null);
  const [hoveredStar, setHoveredStar] = useState<ConstellationStar | null>(null);

  // Expose diagnostic metrics to window for verification
  useEffect(() => {
    (window as any).__ORBIT_GET_METRICS__ = () => {
      const activeFlashes = starsRef.current.filter(s => {
        if (!s.birthTime) return false;
        return (performance.now() - s.birthTime) < 1200;
      }).length;

      return {
        rafLoops: rafLoopCountRef.current,
        activeParticles: sparksRef.current.length,
        activeSparks: sparksRef.current.length,
        flashEffects: activeFlashes,
        tetherAnimations: activeTethersCountRef.current,
        zoom: Number(cameraRef.current.zoom.toFixed(2)),
        starsCount: starsRef.current.length,
        fxMode: fxModeRef.current
      };
    };
  }, []);

  // 1. Initialize Background Starfield
  useEffect(() => {
    const bgStars: BackgroundStar[] = [];
    const count = 180;
    const spread = 2400;
    for (let i = 0; i < count; i++) {
      bgStars.push({
        x: (Math.random() - 0.5) * spread,
        y: (Math.random() - 0.5) * spread,
        radius: Math.random() * 1.2 + 0.4,
        alpha: Math.random() * 0.6 + 0.2,
        twinkleSpeed: Math.random() * 2 + 1,
        phase: Math.random() * Math.PI * 2
      });
    }
    bgStarsRef.current = bgStars;
  }, []);

  // 2. Setup Meeting Clusters & Star Nodes with D3 Force Simulation
  useEffect(() => {
    const prevStarMap = new Map(starsRef.current.map(s => [s.id, s]));
    const prevClusterIds = new Set(clustersRef.current.map(c => c.id));
    const now = performance.now();

    const clusterPositions: Record<string, { x: number; y: number; code: string; color: string }> = {
      'MTG-01': { x: -380, y: -60, code: 'MTG-01', color: '#38bdf8' },
      'MTG-02': { x: 20, y: -260, code: 'MTG-02', color: '#818cf8' },
      'MTG-03': { x: 380, y: 60, code: 'MTG-03', color: '#f43f5e' },
      'MTG-04': { x: -180, y: 280, code: 'MTG-04', color: '#34d399' },
      'MTG-05': { x: 280, y: -190, code: 'MTG-05', color: '#fbbf24' }
    };

    const clusters: ClusterNode[] = meetings.map((mtg, idx) => {
      let preset = clusterPositions[mtg.id];
      if (!preset) {
        const spiralAngle = (idx - 3) * 1.5;
        const spiralDist = 380 + (idx - 3) * 75;
        preset = {
          x: Math.cos(spiralAngle) * spiralDist,
          y: Math.sin(spiralAngle) * spiralDist,
          code: mtg.id,
          color: idx % 2 === 0 ? '#38bdf8' : '#34d399'
        };
      }
      return {
        id: mtg.id,
        meeting: mtg,
        x: preset.x,
        y: preset.y,
        targetX: preset.x,
        targetY: preset.y,
        radius: 190,
        color: preset.color,
        code: preset.code,
        birthTime: prevClusterIds.has(mtg.id) ? undefined : now
      };
    });
    clustersRef.current = clusters;

    // Detect if a brand new cluster was added (and not currently in cinematic conflict)
    const newCluster = clusters.find(c => !prevClusterIds.has(c.id));
    if (newCluster && prevClusterIds.size > 0 && !cinematicConflict) {
      soundEffects.clusterMaterialize();
      targetCameraRef.current = {
        x: -newCluster.x,
        y: -newCluster.y,
        zoom: 1.15
      };
    }

    // Build Star Nodes
    const stars: ConstellationStar[] = decisions.map((dec, i) => {
      const cluster = clusters.find(c => c.id === dec.meetingId) || clusters[0];
      const items = actionItems.filter(a => a.decisionId === dec.id);
      const isNewStar = !prevStarMap.has(dec.id);
      const existingStar = prevStarMap.get(dec.id);
      
      const importanceRadius = dec.importance === 'critical' ? 14 : dec.importance === 'high' ? 10.5 : 8;
      
      let color = '#38bdf8'; // active
      let glowColor = 'rgba(56, 189, 248, 0.4)';
      if (dec.status === 'conflict') {
        color = '#ef4444';
        glowColor = 'rgba(239, 68, 68, 0.6)';
      } else if (dec.status === 'pending') {
        color = '#f59e0b';
        glowColor = 'rgba(245, 158, 11, 0.45)';
      } else if (dec.status === 'superseded') {
        color = '#64748b';
        glowColor = 'rgba(100, 116, 139, 0.2)';
      }

      const satellites: SatelliteNode[] = items.map((act, satIdx) => ({
        id: act.id,
        actionItem: act,
        orbitRadius: importanceRadius + 22 + satIdx * 12,
        currentAngle: (satIdx / Math.max(1, items.length)) * Math.PI * 2,
        orbitSpeed: (0.4 + (satIdx % 3) * 0.2) * (satIdx % 2 === 0 ? 1 : -1),
        radius: 3.5,
        birthTime: isNewStar ? now + 400 + satIdx * 250 : undefined,
        poppedSound: !isNewStar
      }));

      const angle = (i * 1.8) + (Math.random() * 0.4);
      const dist = 60 + (i % 3) * 45;

      return {
        id: dec.id,
        decision: dec,
        meeting: cluster.meeting,
        actionItems: items,
        x: existingStar ? existingStar.x : cluster.x + Math.cos(angle) * dist,
        y: existingStar ? existingStar.y : cluster.y + Math.sin(angle) * dist,
        targetX: cluster.x,
        targetY: cluster.y,
        vx: existingStar ? existingStar.vx : 0,
        vy: existingStar ? existingStar.vy : 0,
        radius: importanceRadius,
        baseRadius: importanceRadius,
        color,
        glowColor,
        pulsePhase: existingStar ? existingStar.pulsePhase : Math.random() * Math.PI * 2,
        satellites,
        birthTime: isNewStar ? now : undefined
      };
    });

    starsRef.current = stars;

    // D3 Force Simulation setup
    if (simulationRef.current) simulationRef.current.stop();

    const sim = d3.forceSimulation(stars as any)
      .force('charge', d3.forceManyBody().strength(-120))
      .force('collide', d3.forceCollide((d: any) => d.radius + 38).iterations(2))
      .force('clusterX', d3.forceX((d: any) => d.targetX).strength(0.14))
      .force('clusterY', d3.forceY((d: any) => d.targetY).strength(0.14))
      .alphaDecay(0.02);

    simulationRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [meetings, decisions, actionItems]);

  // 3. Cinematic Conflict Sequence Trigger
  useEffect(() => {
    if (!cinematicConflict) return;
    const { sourceId, targetId } = cinematicConflict;
    const starA = starsRef.current.find(s => s.id === sourceId);
    const starB = starsRef.current.find(s => s.id === targetId);

    if (starA && starB) {
      const conflictKey = [sourceId, targetId].sort().join('--');
      ignitionMapRef.current.set(conflictKey, performance.now());

      const midX = (starA.x + starB.x) / 2;
      const midY = (starA.y + starB.y) / 2;
      const dist = Math.hypot(starB.x - starA.x, starB.y - starA.y);
      const clampedZoom = Math.min(2.5, Math.max(0.4, 680 / (dist + 120)));

      targetCameraRef.current = {
        x: -midX,
        y: -midY,
        zoom: clampedZoom
      };
    }
  }, [cinematicConflict]);

  // Smooth Camera Easing towards Selected Decision
  useEffect(() => {
    if (!selectedDecisionId) return;
    const star = starsRef.current.find(s => s.id === selectedDecisionId);
    if (star) {
      targetCameraRef.current = {
        x: -star.x + 140,
        y: -star.y,
        zoom: Math.min(2.5, Math.max(0.4, 1.25))
      };
    }
  }, [selectedDecisionId]);

  // Focus specific meeting cluster (e.g. after transmission)
  useEffect(() => {
    if (!focusMeetingId || cinematicConflict) return;
    const cluster = clustersRef.current.find(c => c.id === focusMeetingId);
    if (cluster) {
      targetCameraRef.current = {
        x: -cluster.x,
        y: -cluster.y,
        zoom: Math.min(2.5, Math.max(0.4, 1.15))
      };
    }
  }, [focusMeetingId, cinematicConflict]);

  // Reset Camera View handler (supports 'orbit:recenter' event and key '0')
  const handleRecenter = useCallback(() => {
    targetCameraRef.current = { x: 0, y: 0, zoom: 1.0 };
  }, []);

  const handleZoom = useCallback((delta: number) => {
    cameraRef.current.zoom = Math.min(2.5, Math.max(0.4, cameraRef.current.zoom + delta));
  }, []);

  // Global Keyboard shortcuts: "0" or "r" resets view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.key === '0' || e.key.toLowerCase() === 'r') {
        e.preventDefault();
        soundEffects.click();
        handleRecenter();
      }
    };
    const handleRecenterEvent = () => handleRecenter();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('orbit:recenter', handleRecenterEvent);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('orbit:recenter', handleRecenterEvent);
    };
  }, [handleRecenter]);

  // 4. MAIN RENDER LOOP — Exactly ONE Loop Initialized on Mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    rafLoopCountRef.current++;
    console.log('[ORBIT RAF] Canvas loop initialized. Active loops:', rafLoopCountRef.current);

    let animId: number;
    let lastFrameTime = performance.now();

    const render = (currentTime: number) => {
      const currentFx = fxModeRef.current;
      const targetFpsInterval = currentFx === 'low' ? 33.3 : 16.0; // 30fps cap in LOW mode
      const elapsedSinceLast = currentTime - lastFrameTime;

      if (elapsedSinceLast < targetFpsInterval) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dt = Math.min(elapsedSinceLast / 1000, 0.1);
      lastFrameTime = currentTime;
      const t = currentTime / 1000;

      // Handle Resize
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      const width = canvas.width;
      const height = canvas.height;

      // Camera smooth easing
      if (targetCameraRef.current) {
        const ease = 0.08;
        cameraRef.current.x += (targetCameraRef.current.x - cameraRef.current.x) * ease;
        cameraRef.current.y += (targetCameraRef.current.y - cameraRef.current.y) * ease;
        cameraRef.current.zoom += (targetCameraRef.current.zoom - cameraRef.current.zoom) * ease;

        // Clamp camera zoom strictly [0.4, 2.5]
        cameraRef.current.zoom = Math.min(2.5, Math.max(0.4, cameraRef.current.zoom));

        const dist = Math.hypot(
          targetCameraRef.current.x - cameraRef.current.x,
          targetCameraRef.current.y - cameraRef.current.y
        );
        if (dist < 0.5 && Math.abs(targetCameraRef.current.zoom - cameraRef.current.zoom) < 0.01) {
          targetCameraRef.current = null;
        }
      }

      // Clamp camera zoom in all conditions
      cameraRef.current.zoom = Math.min(2.5, Math.max(0.4, cameraRef.current.zoom));
      const { x: camX, y: camY, zoom } = cameraRef.current;

      // =========================================================================
      // CRITICAL STEP: RESET TRANSFORM TO IDENTITY, THEN FULL CLEAR
      // =========================================================================
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Paint 100% opaque solid background base (NO semi-transparent fade rectangle!)
      ctx.fillStyle = '#03050c';
      ctx.fillRect(0, 0, width, height);

      // Gradient overlay (only in FULL mode)
      if (currentFx !== 'low') {
        const skyGradient = ctx.createRadialGradient(
          width / 2, height / 2, 50,
          width / 2, height / 2, Math.max(width, height)
        );
        skyGradient.addColorStop(0, '#0a122c');
        skyGradient.addColorStop(0.5, '#050a18');
        skyGradient.addColorStop(1, '#03050c');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, width, height);
      }

      // =========================================================================
      // APPLY CAMERA TRANSFORM FOR WORLD RENDERING
      // =========================================================================
      ctx.save();
      try {
        ctx.translate(width / 2 + camX, height / 2 + camY);
        ctx.scale(zoom, zoom);

        // --- LAYER 1: Background Twinkling Star Dust ---
        for (const bg of bgStarsRef.current) {
          let alpha = bg.alpha;
          if (currentFx !== 'low') {
            const twinkle = Math.sin(t * bg.twinkleSpeed + bg.phase);
            alpha = Math.max(0.1, bg.alpha + twinkle * 0.25);
          }
          ctx.fillStyle = `rgba(186, 230, 253, ${alpha})`;
          ctx.beginPath();
          ctx.arc(bg.x, bg.y, bg.radius, 0, Math.PI * 2);
          ctx.fill();
        }

        // --- LAYER 2: Meeting Clusters & Orbital Boundaries ---
        const currentFilter = filterRef.current;
        for (const cluster of clustersRef.current) {
          const isDimmed = currentFilter === 'conflicts';
          ctx.save();
          ctx.globalAlpha = isDimmed ? 0.25 : 1.0;
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 8]);
          ctx.beginPath();
          ctx.arc(cluster.x, cluster.y, cluster.radius, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          const chSize = 8;
          ctx.beginPath();
          ctx.moveTo(cluster.x - chSize, cluster.y);
          ctx.lineTo(cluster.x + chSize, cluster.y);
          ctx.moveTo(cluster.x, cluster.y - chSize);
          ctx.lineTo(cluster.x, cluster.y + chSize);
          ctx.stroke();

          ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`[ ${cluster.code} // ${cluster.meeting.title.toUpperCase()} ]`, cluster.x, cluster.y - cluster.radius - 8);

          ctx.fillStyle = 'rgba(100, 116, 139, 0.65)';
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.fillText(`${cluster.meeting.date} · ${cluster.meeting.participants.length} PARTICIPANTS`, cluster.x, cluster.y - cluster.radius + 4);
          ctx.restore();
        }

        // --- LAYER 3: Intra-cluster Constellation Mesh Lines ---
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
        ctx.lineWidth = 1;
        if (currentFilter === 'conflicts') ctx.globalAlpha = 0.15;
        for (const cluster of clustersRef.current) {
          const clusterStars = starsRef.current.filter(s => s.decision.meetingId === cluster.id);
          for (let i = 0; i < clusterStars.length; i++) {
            for (let j = i + 1; j < clusterStars.length; j++) {
              ctx.beginPath();
              ctx.moveTo(clusterStars[i].x, clusterStars[i].y);
              ctx.lineTo(clusterStars[j].x, clusterStars[j].y);
              ctx.stroke();
            }
          }
        }
        ctx.restore();

        // --- LAYER 4: Conflict Tethers (Electric Crackling Pulsing Red Tether) ---
        const drawnConflicts = new Set<string>();
        const currentConflicts = conflictsRef.current;
        const activeConflictsList = currentConflicts.filter(c => !c.resolved);
        activeTethersCountRef.current = activeConflictsList.length;

        for (const conflictRec of activeConflictsList) {
          const starA = starsRef.current.find(s => s.id === conflictRec.existingDecisionId);
          const starB = starsRef.current.find(s => s.id === conflictRec.newDecisionId);
          if (!starA || !starB) continue;

          const conflictKey = [starA.id, starB.id].sort().join('--');
          if (drawnConflicts.has(conflictKey)) continue;
          drawnConflicts.add(conflictKey);

          const x1 = starA.x;
          const y1 = starA.y;
          const x2 = starB.x;
          const y2 = starB.y;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const dist = Math.hypot(dx, dy);

          let drawProgress = 1.0;
          const ignitionStart = ignitionMapRef.current.get(conflictKey);
          if (ignitionStart) {
            const elapsed = (currentTime - ignitionStart) / 1000;
            drawProgress = Math.min(1.0, Math.max(0.05, elapsed / 0.85));
            // Expire ignition tracking once fully drawn
            if (drawProgress >= 1.0 && elapsed > 1.5) {
              ignitionMapRef.current.delete(conflictKey);
            }
          }

          const currentX2 = x1 + dx * drawProgress;
          const currentY2 = y1 + dy * drawProgress;

          ctx.save();
          ctx.strokeStyle = '#ef4444';
          if (currentFx !== 'low') {
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 14;
          }
          ctx.lineWidth = 2.0;

          const segments = 16;
          const perpX = -dy / dist;
          const perpY = dx / dist;

          ctx.beginPath();
          ctx.moveTo(x1, y1);

          const activeSegments = Math.max(2, Math.floor(segments * drawProgress));
          for (let seg = 1; seg < activeSegments; seg++) {
            const segT = (seg / segments);
            const baseX = x1 + dx * segT;
            const baseY = y1 + dy * segT;
            const vibration = Math.sin(t * 24 + seg * 2.8) * 3.5 * Math.sin((seg / activeSegments) * Math.PI);
            ctx.lineTo(baseX + perpX * vibration, baseY + perpY * vibration);
          }
          ctx.lineTo(currentX2, currentY2);
          ctx.stroke();

          // Animated dashes
          if (currentFx !== 'low') {
            ctx.setLineDash([8, 8]);
            ctx.lineDashOffset = -t * 38;
            ctx.strokeStyle = '#fca5a5';
            ctx.lineWidth = 1.3;
            ctx.stroke();
          }

          // Spawn tip sparks during active ignition (strictly capped)
          if (currentFx !== 'low' && drawProgress < 1.0 && sparksRef.current.length < MAX_SPARKS) {
            for (let i = 0; i < 2; i++) {
              sparksRef.current.push({
                x: currentX2,
                y: currentY2,
                vx: (Math.random() - 0.5) * 60,
                vy: (Math.random() - 0.5) * 60,
                birthTime: currentTime,
                maxLife: 0.45,
                color: '#fca5a5',
                size: Math.random() * 2 + 1.5
              });
            }
          }

          // Traveling energy sparks on the tether
          if (currentFx !== 'low') {
            const sparkCount = 2;
            for (let s = 0; s < sparkCount; s++) {
              const sparkProgress = ((t * 0.4 + s / sparkCount) % 1) * drawProgress;
              const sx = x1 + dx * sparkProgress;
              const sy = y1 + dy * sparkProgress;
              ctx.fillStyle = '#ffffff';
              ctx.shadowColor = '#f43f5e';
              ctx.shadowBlur = 8;
              ctx.beginPath();
              ctx.arc(sx, sy, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Conflict Midpoint Badge (only once partially drawn)
          if (drawProgress >= 0.6) {
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(25, 7, 12, 0.94)';
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1;
            if (currentFx !== 'low') {
              ctx.shadowColor = '#ef4444';
              ctx.shadowBlur = 10;
            }

            const conflictTypeLabel = conflictRec.type ? conflictRec.type.replace('_', ' ').toUpperCase() : 'CONFLICT DETECTED';
            const badgeText = `⚡ ${conflictTypeLabel}`;
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            const textW = ctx.measureText(badgeText).width;
            const badgeW = textW + 20;
            const badgeH = 22;

            ctx.beginPath();
            ctx.roundRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH, 3);
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fca5a5';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeText, midX, midY);
          }

          ctx.restore();
        }

        // --- LAYER 4.5: Active Capped Sparks Rendering ---
        if (currentFx !== 'low' && sparksRef.current.length > 0) {
          // Filter expired particles
          sparksRef.current = sparksRef.current.filter(p => (currentTime - p.birthTime) / 1000 < p.maxLife);
          // Clamp particle array
          if (sparksRef.current.length > MAX_SPARKS) {
            sparksRef.current = sparksRef.current.slice(-MAX_SPARKS);
          }

          ctx.save();
          for (const spark of sparksRef.current) {
            const age = (currentTime - spark.birthTime) / 1000;
            const lifeRatio = Math.max(0, 1 - age / spark.maxLife);
            spark.x += spark.vx * dt;
            spark.y += spark.vy * dt;

            ctx.fillStyle = spark.color;
            ctx.globalAlpha = lifeRatio;
            ctx.beginPath();
            ctx.arc(spark.x, spark.y, spark.size * lifeRatio, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } else {
          sparksRef.current = [];
        }

        // --- LAYER 5: Action Item Satellites Orbiting Decision Stars ---
        for (const star of starsRef.current) {
          const isConflictStar = star.decision.status === 'conflict';
          const isDimmed = currentFilter === 'conflicts' && !isConflictStar;

          if (currentFilter === 'active' && star.decision.status !== 'active') continue;

          for (const sat of star.satellites) {
            let satScale = 1.0;
            if (sat.birthTime) {
              const satAge = (currentTime - sat.birthTime) / 1000;
              if (satAge < 0) continue;
              if (satAge >= 0 && !sat.poppedSound) {
                sat.poppedSound = true;
                soundEffects.satellitePop();
              }
              if (satAge < 0.4 && currentFx !== 'low') {
                const popProgress = satAge / 0.4;
                satScale = Math.sin(popProgress * Math.PI) * 1.5 + popProgress;
              }
            }

            // Determine deadline urgency (overdue or due in 24h)
            let isOverdue = false;
            let isDueSoon = false;
            if (sat.actionItem.deadline && sat.actionItem.deadline !== 'Pending' && sat.actionItem.status !== 'completed') {
              const dl = new Date(sat.actionItem.deadline).getTime();
              if (!isNaN(dl)) {
                const diffHours = (dl - Date.now()) / (1000 * 60 * 60);
                if (diffHours < 0) isOverdue = true;
                else if (diffHours <= 24) isDueSoon = true;
              }
            }

            // Satellites of overdue or soon-due tasks orbit noticeably faster
            const speedMult = (isOverdue || isDueSoon) ? 2.2 : 1.0;
            sat.currentAngle += sat.orbitSpeed * speedMult * dt;
            const satX = star.x + Math.cos(sat.currentAngle) * sat.orbitRadius;
            const satY = star.y + Math.sin(sat.currentAngle) * sat.orbitRadius;

            // Faster energetic pulse for overdue or soon-due tasks
            const pulseRate = isOverdue ? 14 : isDueSoon ? 8 : 2.5;
            const urgencyPulse = (isOverdue || isDueSoon) ? Math.sin(t * pulseRate) * 1.5 : Math.sin(t * pulseRate) * 0.4;
            const satDisplayRadius = Math.max(2.5, (sat.radius + urgencyPulse) * satScale);

            const beaconColor = isOverdue ? '#f43f5e' : isDueSoon ? '#fbbf24' : '#38bdf8';
            const shadowColor = isOverdue ? '#ef4444' : isDueSoon ? '#f59e0b' : '#0284c7';

            ctx.save();
            if (isDimmed) ctx.globalAlpha = 0.15;

            // Orbit guide track
            ctx.strokeStyle = isOverdue ? 'rgba(239, 68, 68, 0.15)' : isDueSoon ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.arc(star.x, star.y, sat.orbitRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Urgent alert halo ring for overdue tasks
            if (isOverdue && currentFx !== 'low') {
              const ripple = (t * 4) % 1;
              ctx.strokeStyle = `rgba(239, 68, 68, ${0.7 * (1 - ripple)})`;
              ctx.lineWidth = 1;
              ctx.setLineDash([]);
              ctx.beginPath();
              ctx.arc(satX, satY, satDisplayRadius + ripple * 10, 0, Math.PI * 2);
              ctx.stroke();
            }

            // Satellite Body beacon module
            ctx.fillStyle = beaconColor;
            if (currentFx !== 'low') {
              ctx.shadowColor = shadowColor;
              ctx.shadowBlur = (isOverdue || isDueSoon ? 12 : 6) * satScale;
            }
            ctx.beginPath();
            ctx.arc(satX, satY, satDisplayRadius, 0, Math.PI * 2);
            ctx.fill();

            // Initials tag beside satellite
            ctx.shadowBlur = 0;
            ctx.fillStyle = isOverdue ? 'rgba(254, 202, 202, 0.95)' : isDueSoon ? 'rgba(253, 230, 138, 0.9)' : 'rgba(186, 230, 253, 0.85)';
            ctx.font = '7px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const initials = sat.actionItem.ownerInitials || sat.actionItem.owner.split(' ').map(n => n[0]).join('');
            ctx.fillText(initials, satX + 6, satY);
            ctx.restore();
          }
        }

        // --- LAYER 6: Decision Stars (Core, Blooms, Cross-Spikes, Labels) ---
        const currentSelectedId = selectedDecisionIdRef.current;
        for (const star of starsRef.current) {
          const isHovered = hoveredStarIdRef.current === star.id;
          const isSelected = currentSelectedId === star.id;
          const isConflict = star.decision.status === 'conflict';
          const isDimmed = currentFilter === 'conflicts' && !isConflict;

          if (currentFilter === 'active' && star.decision.status !== 'active') continue;

          let starScale = 1.0;
          let pointFlash = 0;
          if (star.birthTime) {
            const age = (currentTime - star.birthTime) / 1000;
            if (age < 1.2) {
              const growth = Math.min(1, age / 1.0);
              starScale = 1 - Math.pow(1 - growth, 3);
              pointFlash = Math.max(0, 1 - age / 0.5);
            }
          }

          const pulse = Math.sin(t * 2.8 + star.pulsePhase) * (isConflict ? 2.4 : 1.1);
          const currentRadius = (star.baseRadius + (isHovered || isSelected ? 3 : 0) + pulse) * starScale;

          ctx.save();
          if (isDimmed) ctx.globalAlpha = 0.18;

          // Point-of-light supernova birth flash
          if (pointFlash > 0 && currentFx !== 'low') {
            ctx.fillStyle = `rgba(255, 255, 255, ${pointFlash * 0.8})`;
            ctx.shadowColor = star.color;
            ctx.shadowBlur = 30;
            ctx.beginPath();
            ctx.arc(star.x, star.y, pointFlash * 35, 0, Math.PI * 2);
            ctx.fill();
          }

          // 1. Outer Bloom Disc
          if (currentFx !== 'low') {
            const bloom = ctx.createRadialGradient(
              star.x, star.y, 0,
              star.x, star.y, currentRadius * 3.4
            );
            bloom.addColorStop(0, star.glowColor);
            bloom.addColorStop(0.5, star.glowColor.replace(/[\d\.]+\)$/, '0.15)'));
            bloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = bloom;
            ctx.beginPath();
            ctx.arc(star.x, star.y, currentRadius * 3.4, 0, Math.PI * 2);
            ctx.fill();
          }

          // 2. Optical Diffraction Cross-Spikes
          if (currentFx !== 'low' && (star.decision.importance === 'critical' || isConflict || isSelected || star.birthTime)) {
            ctx.strokeStyle = isConflict ? 'rgba(239, 68, 68, 0.7)' : 'rgba(186, 230, 253, 0.6)';
            ctx.lineWidth = 1;
            const spikeLen = currentRadius * 2.4;
            ctx.beginPath();
            ctx.moveTo(star.x - spikeLen, star.y);
            ctx.lineTo(star.x + spikeLen, star.y);
            ctx.moveTo(star.x, star.y - spikeLen);
            ctx.lineTo(star.x, star.y + spikeLen);
            ctx.stroke();
          }

          // 3. Dense Star Core
          const coreGradient = ctx.createRadialGradient(
            star.x, star.y, 0,
            star.x, star.y, currentRadius
          );
          coreGradient.addColorStop(0, '#ffffff');
          coreGradient.addColorStop(0.4, star.color);
          coreGradient.addColorStop(1, star.color);

          ctx.fillStyle = coreGradient;
          if (currentFx !== 'low') {
            ctx.shadowColor = star.color;
            ctx.shadowBlur = isConflict ? 20 : 12;
          }
          ctx.beginPath();
          ctx.arc(star.x, star.y, currentRadius, 0, Math.PI * 2);
          ctx.fill();

          // 4. Selection Reticle Brackets
          if (isSelected || isHovered) {
            ctx.shadowBlur = 0;
            ctx.strokeStyle = isConflict ? '#f43f5e' : '#38bdf8';
            ctx.lineWidth = 1.5;
            const reticleSize = currentRadius + 10;
            const bLen = 5;

            ctx.beginPath();
            ctx.moveTo(star.x - reticleSize, star.y - reticleSize + bLen);
            ctx.lineTo(star.x - reticleSize, star.y - reticleSize);
            ctx.lineTo(star.x - reticleSize + bLen, star.y - reticleSize);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(star.x + reticleSize - bLen, star.y - reticleSize);
            ctx.lineTo(star.x + reticleSize, star.y - reticleSize);
            ctx.lineTo(star.x + reticleSize, star.y - reticleSize + bLen);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(star.x - reticleSize, star.y + reticleSize - bLen);
            ctx.lineTo(star.x - reticleSize, star.y + reticleSize);
            ctx.lineTo(star.x - reticleSize + bLen, star.y + reticleSize);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(star.x + reticleSize - bLen, star.y + reticleSize);
            ctx.lineTo(star.x + reticleSize, star.y + reticleSize);
            ctx.lineTo(star.x + reticleSize, star.y + reticleSize - bLen);
            ctx.stroke();
          }

          // 5. Star Code Badge Label
          ctx.shadowBlur = 0;
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          const labelText = star.id;
          const textMetrics = ctx.measureText(labelText);
          const pillW = textMetrics.width + 10;
          const pillH = 14;
          const pillY = star.y + currentRadius + 8;

          ctx.fillStyle = 'rgba(7, 12, 30, 0.9)';
          ctx.strokeStyle = isConflict ? 'rgba(239, 68, 68, 0.45)' : 'rgba(56, 189, 248, 0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(star.x - pillW / 2, pillY, pillW, pillH, 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isConflict ? '#fca5a5' : isSelected ? '#38bdf8' : '#e2e8f0';
          ctx.fillText(labelText, star.x, pillY + 2.5);

          ctx.restore();
        }

      } finally {
        // ALWAYS RESTORE AND RESET TRANSFORM TO PREVENT GHOST SMEARS
        ctx.restore();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      rafLoopCountRef.current = Math.max(0, rafLoopCountRef.current - 1);
      console.log('[ORBIT RAF] Canvas loop unmounted. Remaining loops:', rafLoopCountRef.current);
    };
  }, []); // Run ONCE on mount! Guaranteed single loop!

  // 5. Accurate Screen-Space Hit-Testing (Accounts for current camera pan, zoom, and canvas rect)
  const findStarAtScreenCoords = useCallback((clientX: number, clientY: number): ConstellationStar | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    const { x: camX, y: camY, zoom } = cameraRef.current;
    const currentFilter = filterRef.current;

    let closestStar: ConstellationStar | null = null;
    let minDistance = Infinity;

    for (const star of starsRef.current) {
      if (currentFilter === 'active' && star.decision.status !== 'active') continue;

      // Project star coordinates into exact screen client space
      const screenX = rect.left + (canvas.width / 2 + camX + star.x * zoom) * scaleX;
      const screenY = rect.top + (canvas.height / 2 + camY + star.y * zoom) * scaleY;

      // Generous hit radius: drawn radius in screen pixels + at least 18 screen pixels (minimum 24px)
      const drawnRadius = (star.radius || star.baseRadius || 10) * zoom * scaleX;
      const hitRadius = Math.max(24, drawnRadius + 18);

      const dist = Math.hypot(clientX - screenX, clientY - screenY);
      if (dist <= hitRadius && dist < minDistance) {
        minDistance = dist;
        closestStar = star;
      }
    }

    return closestStar;
  }, []);

  // 6. Pointer Events for Interaction (distinguishes clicks < 5px from drag-to-pan)
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastPointerPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPointerPanning, setIsPointerPanning] = useState(false);
  const isPointerPanningRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
    isPointerPanningRef.current = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };

    if (pointerDownPosRef.current) {
      const moveDist = Math.hypot(
        e.clientX - pointerDownPosRef.current.x,
        e.clientY - pointerDownPosRef.current.y
      );

      // Require at least 5 pixels of movement to initiate a pan
      if (moveDist >= 5) {
        if (!isPointerPanningRef.current) {
          isPointerPanningRef.current = true;
          setIsPointerPanning(true);
        }

        const canvas = canvasRef.current;
        const rect = canvas?.getBoundingClientRect();
        const scaleX = rect && canvas ? rect.width / canvas.width : 1;
        const scaleY = rect && canvas ? rect.height / canvas.height : 1;

        const dx = (e.clientX - lastPointerPosRef.current.x) / scaleX;
        const dy = (e.clientY - lastPointerPosRef.current.y) / scaleY;

        cameraRef.current.x += dx;
        cameraRef.current.y += dy;
        lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
        targetCameraRef.current = null;
      }
      return;
    }

    // Hover hit-testing on every mouse move in screen space
    const foundStar = findStarAtScreenCoords(e.clientX, e.clientY);
    if (foundStar?.id !== hoveredStarIdRef.current) {
      hoveredStarIdRef.current = foundStar?.id || null;
      setHoveredStar(foundStar);
      if (foundStar) {
        soundEffects.click();
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (pointerDownPosRef.current) {
      const moveDist = Math.hypot(
        e.clientX - pointerDownPosRef.current.x,
        e.clientY - pointerDownPosRef.current.y
      );

      // If pointer moved less than 5 pixels, treat as a direct single click!
      if (!isPointerPanningRef.current && moveDist < 5) {
        const clickX = pointerDownPosRef.current.x;
        const clickY = pointerDownPosRef.current.y;
        const clickedStar = findStarAtScreenCoords(clickX, clickY) || findStarAtScreenCoords(e.clientX, e.clientY);
        if (clickedStar) {
          soundEffects.selectStar(clickedStar.decision.status === 'conflict');
          onSelectDecision(clickedStar.decision);
        } else {
          onSelectDecision(null);
        }
      }
    }

    pointerDownPosRef.current = null;
    isPointerPanningRef.current = false;
    setIsPointerPanning(false);
  };

  // 7. Non-Passive Wheel & Touch Event Listeners (Pinch-to-zoom, two-finger pan, mouse wheel around cursor)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const scaleX = rect.width / canvas.width;
      const scaleY = rect.height / canvas.height;
      const { x: camX, y: camY, zoom: oldZoom } = cameraRef.current;

      // Trackpad pinch (ctrlKey) OR standard physical mouse wheel notch
      const isPinch = e.ctrlKey;
      const isMouseWheelStep = e.deltaMode !== 0 || (Math.abs(e.deltaX) === 0 && Math.abs(e.deltaY) >= 40);

      if (isPinch || isMouseWheelStep) {
        let zoomFactor: number;
        if (isPinch) {
          // Touchpad pinch (smooth exponential)
          zoomFactor = Math.exp(-e.deltaY * 0.015);
        } else {
          // Regular mouse wheel notch
          zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
        }

        const newZoom = Math.min(2.5, Math.max(0.4, oldZoom * zoomFactor));
        if (Math.abs(newZoom - oldZoom) > 0.0001) {
          // Zoom around cursor position:
          const worldX = (mouseX / scaleX - canvas.width / 2 - camX) / oldZoom;
          const worldY = (mouseY / scaleY - canvas.height / 2 - camY) / oldZoom;

          cameraRef.current.zoom = newZoom;
          cameraRef.current.x = (mouseX / scaleX - canvas.width / 2) - worldX * newZoom;
          cameraRef.current.y = (mouseY / scaleY - canvas.height / 2) - worldY * newZoom;
          targetCameraRef.current = null;
        }
      } else {
        // Two-finger trackpad panning (deltaX and deltaY without ctrlKey)
        cameraRef.current.x -= e.deltaX / scaleX;
        cameraRef.current.y -= e.deltaY / scaleY;
        targetCameraRef.current = null;
      }
    };

    // Touch handlers for touchscreen pinch & pan
    let touchStartDist: number | null = null;
    let touchStartCenter: { x: number; y: number } | null = null;
    let touchStartPos: { x: number; y: number } | null = null;
    let isTouchDrag = false;

    const handleTouchStartNative = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        touchStartCenter = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        touchStartDist = null;
        isTouchDrag = false;
      } else if (e.touches.length === 2) {
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        touchStartDist = Math.hypot(dx, dy);
        touchStartCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };
        isTouchDrag = true;
      }
    };

    const handleTouchMoveNative = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / canvas.width;
      const scaleY = rect.height / canvas.height;

      if (e.touches.length === 1 && touchStartCenter) {
        const moved = touchStartPos 
          ? Math.hypot(e.touches[0].clientX - touchStartPos.x, e.touches[0].clientY - touchStartPos.y)
          : 0;
        if (moved >= 5) isTouchDrag = true;

        if (isTouchDrag) {
          const dx = (e.touches[0].clientX - touchStartCenter.x) / scaleX;
          const dy = (e.touches[0].clientY - touchStartCenter.y) / scaleY;
          cameraRef.current.x += dx;
          cameraRef.current.y += dy;
          touchStartCenter = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          targetCameraRef.current = null;
        }
      } else if (e.touches.length === 2 && touchStartDist !== null && touchStartCenter) {
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.hypot(dx, dy);
        const center = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };

        if (dist > 0 && touchStartDist > 0) {
          const factor = dist / touchStartDist;
          const oldZoom = cameraRef.current.zoom;
          const newZoom = Math.min(2.5, Math.max(0.4, oldZoom * factor));

          const mouseX = center.x - rect.left;
          const mouseY = center.y - rect.top;
          const worldX = (mouseX / scaleX - canvas.width / 2 - cameraRef.current.x) / oldZoom;
          const worldY = (mouseY / scaleY - canvas.height / 2 - cameraRef.current.y) / oldZoom;

          cameraRef.current.zoom = newZoom;
          cameraRef.current.x = (mouseX / scaleX - canvas.width / 2) - worldX * newZoom;
          cameraRef.current.y = (mouseY / scaleY - canvas.height / 2) - worldY * newZoom;
          targetCameraRef.current = null;
        }

        touchStartDist = dist;
        touchStartCenter = center;
      }
    };

    const handleTouchEndNative = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        if (!isTouchDrag && touchStartPos) {
          const star = findStarAtScreenCoords(touchStartPos.x, touchStartPos.y);
          if (star) {
            soundEffects.selectStar(star.decision.status === 'conflict');
            onSelectDecision(star.decision);
          } else {
            onSelectDecision(null);
          }
        }
        touchStartPos = null;
        touchStartCenter = null;
        touchStartDist = null;
        isTouchDrag = false;
      } else if (e.touches.length === 1) {
        touchStartCenter = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        touchStartDist = null;
      }
    };

    canvas.addEventListener('wheel', handleWheelNative, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStartNative, { passive: true });
    canvas.addEventListener('touchmove', handleTouchMoveNative, { passive: false });
    canvas.addEventListener('touchend', handleTouchEndNative, { passive: true });

    return () => {
      canvas.removeEventListener('wheel', handleWheelNative);
      canvas.removeEventListener('touchstart', handleTouchStartNative);
      canvas.removeEventListener('touchmove', handleTouchMoveNative);
      canvas.removeEventListener('touchend', handleTouchEndNative);
    };
  }, [findStarAtScreenCoords, onSelectDecision]);

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full h-full overflow-hidden select-none touch-none ${
        isPointerPanning ? 'cursor-grabbing' : hoveredStar ? 'cursor-pointer' : 'cursor-grab'
      }`}
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-full block touch-none"
        style={{ touchAction: 'none' }}
      />

      {/* Floating Hover Tooltip Card */}
      {hoveredStar && !selectedDecisionId && (
        <div 
          className="pointer-events-none fixed z-50 hud-panel p-2.5 rounded text-xs font-mono max-w-xs shadow-2xl transition-opacity duration-150"
          style={{
            left: `${mousePosRef.current.x + 16}px`,
            top: `${mousePosRef.current.y - 12}px`
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1 mb-1.5">
            <span className="font-bold text-sky-400">{hoveredStar.id}</span>
            <span className={`text-[10px] font-semibold uppercase ${
              hoveredStar.decision.status === 'conflict' ? 'text-rose-400 font-bold animate-pulse' : 'text-slate-400'
            }`}>
              [{hoveredStar.decision.status}]
            </span>
          </div>
          <div className="text-slate-200 font-sans text-xs line-clamp-2">
            {hoveredStar.decision.text}
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-1 border-t border-slate-800/60">
            <span>By {hoveredStar.decision.madeBy}</span>
            <span className="text-amber-400">{hoveredStar.satellites.length} Satellites</span>
          </div>
        </div>
      )}

      {/* On-Canvas Camera Navigation HUD Controls */}
      <div className="absolute right-4 bottom-4 z-20 flex flex-col gap-1.5 hud-panel p-1 rounded-md">
        <button
          onClick={() => { soundEffects.click(); handleZoom(0.18); }}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-sky-400 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => { soundEffects.click(); handleZoom(-0.18); }}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-sky-400 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => { soundEffects.click(); handleRecenter(); }}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-sky-400 transition-colors"
          title="Recenter Constellation View (Press '0')"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
