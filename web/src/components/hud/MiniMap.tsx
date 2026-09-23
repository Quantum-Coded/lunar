'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useMissionStore } from '@/lib/scene-state/store';
import { findAStarPath } from '@/lib/pathfinding/astar';
import { Compass, Navigation, Radar } from 'lucide-react';

export function MiniMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const radarAngleRef = useRef(0);

  // Store subscriptions
  const activeLayer = useMissionStore((s) => s.activeLayer);
  const craters = useMissionStore((s) => s.craters);
  const roverGridPos = useMissionStore((s) => s.roverGridPos);
  const roverHeading = useMissionStore((s) => s.roverHeading);
  const activePath = useMissionStore((s) => s.activePath);
  const targetGridPos = useMissionStore((s) => s.targetGridPos);
  const navGrid = useMissionStore((s) => s.navGrid);
  const setActivePath = useMissionStore((s) => s.setActivePath);
  const setTargetGridPos = useMissionStore((s) => s.setTargetGridPos);
  const setRoverMovementState = useMissionStore((s) => s.setRoverMovementState);
  const setStatusMessage = useMissionStore((s) => s.setStatusMessage);

  // Pre-load background textures
  const [images, setImages] = useState<{
    base: HTMLImageElement | null;
    ice: HTMLImageElement | null;
    terrain: HTMLImageElement | null;
  }>({ base: null, ice: null, terrain: null });

  useEffect(() => {
    let mounted = true;

    const loadImg = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    };

    Promise.all([
      loadImg('/data/hotspots/south_pole/base_texture.jpg'),
      loadImg('/data/hotspots/south_pole/ice_heatmap.png'),
      loadImg('/data/hotspots/south_pole/terrain_classes.png'),
    ])
      .then(([base, ice, terrain]) => {
        if (mounted) {
          setImages({ base, ice, terrain });
        }
      })
      .catch((err) => console.error('Failed to load minimap textures:', err));

    return () => {
      mounted = false;
    };
  }, []);

  // Mini-map click to navigate
  const handleMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !navGrid) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.round((x / rect.width) * 255);
    const row = Math.round((y / rect.height) * 255);
    const targetCell: [number, number] = [
      Math.max(0, Math.min(255, row)),
      Math.max(0, Math.min(255, col)),
    ];

    setTargetGridPos(targetCell);
    const targetInfo = navGrid[targetCell[0]][targetCell[1]];

    setStatusMessage(
      `RADAR TARGET SET: [${targetCell[0]}, ${targetCell[1]}] (${targetInfo.terrain_class}, HAZARD: ${targetInfo.hazard_cost.toFixed(1)}x)...`
    );

    const path = findAStarPath(navGrid, roverGridPos, targetCell);
    if (path.length > 0) {
      setActivePath(path);
      setRoverMovementState('turning');
      setStatusMessage(
        `A* TRAVERSE COMPUTED FROM RADAR CLICK (${path.length} WAYPOINTS). ADVANCING...`
      );
    } else {
      setStatusMessage('RADAR TARGET UNREACHABLE: HAZARD EXCLUSION ZONE.');
    }
  };

  // Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;

      // Clear
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, w, h);

      // 1. Draw Active Overlay / Background Image
      let bgImg = images.base;
      if (activeLayer === 'ice' && images.ice) {
        bgImg = images.ice;
      } else if (activeLayer === 'terrain' && images.terrain) {
        bgImg = images.terrain;
      }

      if (bgImg) {
        ctx.globalAlpha = 0.85;
        ctx.drawImage(bgImg, 0, 0, w, h);
        ctx.globalAlpha = 1.0;
      }

      // 2. Tactical Coordinate Grid Lines
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.18)';
      ctx.lineWidth = 1;
      const gridSteps = 4;
      for (let i = 1; i < gridSteps; i++) {
        const pos = (i / gridSteps) * w;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, h);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(w, pos);
        ctx.stroke();
      }

      // 3. Render Crater Detections from Model
      craters.forEach((c) => {
        const cx = c.x * w;
        const cy = c.y * h;
        const cr = c.radius * w;

        // Crater boundary
        ctx.strokeStyle = activeLayer === 'craters' ? '#f43f5e' : 'rgba(244, 63, 94, 0.4)';
        ctx.lineWidth = activeLayer === 'craters' ? 2 : 1;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.stroke();

        // Crater center crosshair
        if (activeLayer === 'craters' || c.radius > 0.1) {
          ctx.fillStyle = '#fb7185';
          ctx.beginPath();
          ctx.arc(cx, cy, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Label main Shackleton crater
        if (c.id === 'shackleton_main') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
          ctx.font = '9px Chakra Petch, sans-serif';
          ctx.fillText('SHACKLETON', cx - 28, cy - cr - 3);
        }
      });

      // 4. Render Active A* Path Trajectory
      if (activePath.length > 1) {
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 8;
        ctx.beginPath();

        activePath.forEach(([r, c], i) => {
          const px = (c / 255) * w;
          const py = (r / 255) * h;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });

        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      }

      // 5. Render Target Destination Marker
      if (targetGridPos) {
        const tx = (targetGridPos[1] / 255) * w;
        const ty = (targetGridPos[0] / 255) * h;

        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tx, ty, 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(tx, ty, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 6. Rotating Radar Sweep Effect
      radarAngleRef.current += 0.025;
      const rx = (roverGridPos[1] / 255) * w;
      const ry = (roverGridPos[0] / 255) * h;

      const sweepLen = 40;
      const sweepX = rx + Math.cos(radarAngleRef.current) * sweepLen;
      const sweepY = ry + Math.sin(radarAngleRef.current) * sweepLen;

      const grad = ctx.createLinearGradient(rx, ry, sweepX, sweepY);
      grad.addColorStop(0, 'rgba(6, 182, 212, 0.4)');
      grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(sweepX, sweepY);
      ctx.stroke();

      // 7. Render Rover Location & Heading Arrow
      ctx.save();
      ctx.translate(rx, ry);

      // Rotate arrow to match 3D heading:
      // In 3D: dx = sin(heading), dz = cos(heading) (+Z is down on canvas)
      const canvasHeading = Math.atan2(Math.sin(roverHeading), -Math.cos(roverHeading));
      ctx.rotate(canvasHeading);

      // Outer rover pulse halo
      ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();

      // Directional Chevron Arrow (pointing UP in local rotated space)
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -9);     // Tip
      ctx.lineTo(6, 7);      // Right wing
      ctx.lineTo(0, 3);      // Inset notch
      ctx.lineTo(-6, 7);     // Left wing
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [images, activeLayer, craters, roverGridPos, roverHeading, activePath, targetGridPos]);

  return (
    <div
      className="hud-glass-panel reticle-corner"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '10px 12px',
        width: '240px',
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Radar size={14} color="#06b6d4" />
          <span className="hud-title" style={{ fontSize: '0.72rem', color: '#f8fafc' }}>
            SURFACE TACTICAL RADAR
          </span>
        </div>
        <span
          className="hud-mono"
          style={{
            fontSize: '0.62rem',
            color: '#22d3ee',
            padding: '2px 5px',
            background: 'rgba(6, 182, 212, 0.12)',
            borderRadius: '3px',
          }}
        >
          256×256
        </span>
      </div>

      {/* 2D Canvas Display */}
      <div
        style={{
          position: 'relative',
          width: '216px',
          height: '216px',
          borderRadius: '6px',
          overflow: 'hidden',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          cursor: 'crosshair',
        }}
      >
        <canvas
          ref={canvasRef}
          width={216}
          height={216}
          onClick={handleMapClick}
          style={{ display: 'block', width: '100%', height: '100%' }}
          title="Click to plot autonomous A* route"
        />

        {/* Compass Cardinal Marks */}
        <span style={{ position: 'absolute', top: '3px', left: '50%', transform: 'translateX(-50%)', fontSize: '8px', color: '#94a3b8', pointerEvents: 'none', fontWeight: 700 }}>
          N
        </span>
        <span style={{ position: 'absolute', bottom: '3px', left: '50%', transform: 'translateX(-50%)', fontSize: '8px', color: '#94a3b8', pointerEvents: 'none', fontWeight: 700 }}>
          S
        </span>
        <span style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '8px', color: '#94a3b8', pointerEvents: 'none', fontWeight: 700 }}>
          W
        </span>
        <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '8px', color: '#94a3b8', pointerEvents: 'none', fontWeight: 700 }}>
          E
        </span>
      </div>

      {/* Footer Readout */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.66rem', color: '#94a3b8' }}>
        <span className="hud-mono">
          POS: [{roverGridPos[0]}, {roverGridPos[1]}]
        </span>
        <span className="hud-mono" style={{ color: '#22d3ee' }}>
          HDG: {Math.round((((roverHeading % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2)) * (180 / Math.PI))}°
        </span>
      </div>
    </div>
  );
}
