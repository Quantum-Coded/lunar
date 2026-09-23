'use client';

import React from 'react';
import { useMissionStore } from '@/lib/scene-state/store';
import { Camera, Eye, Video, Compass, Navigation } from 'lucide-react';

export function DriveControlsBar() {
  const cameraMode = useMissionStore((s) => s.cameraMode);
  const driveMode = useMissionStore((s) => s.driveMode);
  const setCameraMode = useMissionStore((s) => s.setCameraMode);

  const toggleCamera = () => {
    const nextMode = cameraMode === 'chase' ? 'fpv' : 'chase';
    setCameraMode(nextMode);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 16px',
        background: 'rgba(7, 13, 26, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(6, 182, 212, 0.35)',
        borderRadius: '9999px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5), 0 0 15px rgba(6, 182, 212, 0.15)',
        pointerEvents: 'auto',
      }}
    >
      {/* Drive Mode Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          className="pulse-indicator"
          style={{
            backgroundColor: driveMode === 'manual' ? '#10b981' : '#06b6d4',
            filter: `drop-shadow(0 0 4px ${driveMode === 'manual' ? '#10b981' : '#06b6d4'})`,
          }}
        />
        <span
          className="hud-mono"
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: driveMode === 'manual' ? '#34d399' : '#22d3ee',
          }}
        >
          {driveMode === 'manual' ? 'MANUAL DRIVE' : 'AUTO-NAV (A*)'}
        </span>
      </div>

      <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.12)' }} />

      {/* Camera Mode Toggle Button */}
      <button
        onClick={toggleCamera}
        className="hud-btn"
        style={{
          padding: '5px 12px',
          fontSize: '0.72rem',
          borderRadius: '9999px',
          background: cameraMode === 'fpv' ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.05)',
          borderColor: cameraMode === 'fpv' ? '#06b6d4' : 'rgba(255, 255, 255, 0.12)',
          color: cameraMode === 'fpv' ? '#22d3ee' : '#e2e8f0',
        }}
        title="Toggle between Chase Camera and FPV Mast Camera (Hotkey: V)"
      >
        {cameraMode === 'chase' ? <Video size={13} /> : <Eye size={13} />}
        <span>{cameraMode === 'chase' ? 'CHASE CAM' : 'FPV MAST CAM'}</span>
        <span
          className="hud-mono"
          style={{
            fontSize: '0.62rem',
            padding: '1px 5px',
            borderRadius: '3px',
            background: 'rgba(255, 255, 255, 0.1)',
            color: '#94a3b8',
          }}
        >
          V
        </span>
      </button>

      <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.12)' }} />

      {/* Quick Keybind Guide */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.68rem', color: '#94a3b8' }}>
        <div style={{ display: 'flex', gap: '3px' }}>
          {['W', 'A', 'S', 'D'].map((k) => (
            <span
              key={k}
              className="hud-mono"
              style={{
                display: 'inline-block',
                padding: '2px 5px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '3px',
                fontSize: '0.62rem',
                color: '#f8fafc',
                fontWeight: 600,
              }}
            >
              {k}
            </span>
          ))}
        </div>
        <span>TO DRIVE</span>
        <span style={{ color: '#475569' }}>•</span>
        <span>DRAG TO ORBIT</span>
      </div>
    </div>
  );
}
