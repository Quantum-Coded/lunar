'use client';

import React from 'react';
import { useMissionStore } from '@/lib/scene-state/store';
import { getRandomPointOnMoon, HOTSPOTS } from '@/lib/utils/hotspot-registry';
import { Rocket, RotateCcw, Compass } from 'lucide-react';

export function DropAgainButton() {
  const phase = useMissionStore((s) => s.phase);
  const setPhase = useMissionStore((s) => s.setPhase);
  const setDropTarget = useMissionStore((s) => s.setDropTarget);
  const setStatusMessage = useMissionStore((s) => s.setStatusMessage);
  const resetToOrbit = useMissionStore((s) => s.resetToOrbit);

  const handleShackletonDrop = () => {
    setDropTarget({
      lat: HOTSPOTS.south_pole.centerLat,
      lon: HOTSPOTS.south_pole.centerLon,
      isHotspot: true
    });
    setStatusMessage('TARGET LOCKED: SHACKLETON CRATER (SOUTH POLE). INITIATING DE-ORBIT BURN...');
    setPhase('dropping');
  };

  const handleRandomDrop = () => {
    // Pick an equatorial / non-polar point to ensure off-hotspot redirect (Case B)
    const randomPt = {
      lat: (Math.random() - 0.5) * 60, // between -30 and +30 latitude
      lon: (Math.random() - 0.5) * 360
    };
    setDropTarget({
      lat: randomPt.lat,
      lon: randomPt.lon,
      isHotspot: false
    });
    setStatusMessage(`DE-ORBIT COMMENCED AT BLIND COORDINATES [${randomPt.lat.toFixed(1)}°, ${randomPt.lon.toFixed(1)}°]...`);
    setPhase('dropping');
  };

  if (phase === 'globe') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
        <button
          className="hud-btn hud-btn-primary"
          onClick={handleShackletonDrop}
          style={{
            padding: '14px 28px',
            fontSize: '0.95rem',
            borderRadius: '9999px',
            cursor: 'pointer'
          }}
        >
          <Rocket size={18} />
          <span>DROP ROVER — SHACKLETON CRATER</span>
        </button>

        <button
          className="hud-btn"
          onClick={handleRandomDrop}
          style={{
            fontSize: '0.78rem',
            padding: '8px 16px',
            borderRadius: '9999px',
            opacity: 0.85
          }}
        >
          <Compass size={14} color="#f59e0b" />
          <span>RANDOM DROP (TEST REDIRECT)</span>
        </button>
      </div>
    );
  }

  if (phase === 'surface') {
    return (
      <button
        className="hud-btn"
        onClick={resetToOrbit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 18px',
          fontSize: '0.82rem',
          background: 'rgba(15, 23, 42, 0.85)',
          borderColor: 'rgba(255, 255, 255, 0.15)'
        }}
      >
        <RotateCcw size={15} color="#06b6d4" />
        <span>ORBITAL RESET / DROP AGAIN</span>
      </button>
    );
  }

  return null;
}
