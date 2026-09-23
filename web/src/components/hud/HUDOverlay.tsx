'use client';

import React, { useState } from 'react';
import { useMissionStore } from '@/lib/scene-state/store';
import { MissionStatus } from './MissionStatus';
import { DropAgainButton } from './DropAgainButton';
import { LayerTogglePanel } from './LayerTogglePanel';
import { InfoPanel } from './InfoPanel';
import { MiniMap } from './MiniMap';
import { DriveControlsBar } from './DriveControlsBar';
import { Sparkles, Info, Shield, Layers, HelpCircle } from 'lucide-react';

export function HUDOverlay() {
  const phase = useMissionStore((s) => s.phase);
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px',
        zIndex: 20
      }}
    >
      {/* Top Header Bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          width: '100%'
        }}
      >
        {/* Title & Scientific Crediting */}
        <div className="hud-glass-panel" style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>🌕</span>
            <div>
              <h1 className="hud-title" style={{ fontSize: '1.15rem', color: '#f8fafc', margin: 0, lineHeight: 1.1 }}>
                DROP THE ROVER
              </h1>
              <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>
                Powered by NASA-IBM Lunar Foundation Models (AI4Science)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'rgba(6, 182, 212, 0.15)',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                fontSize: '0.65rem',
                color: '#22d3ee',
                fontWeight: 600
              }}
            >
              <span className="pulse-indicator" />
              <span>SURVEYED ZONE: SHACKLETON CRATER (-89.9°S)</span>
            </div>

            <span
              className="hud-mono"
              style={{
                fontSize: '0.65rem',
                color: '#64748b',
                padding: '2px 6px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px'
              }}
            >
              OFFLINE INFERENCE • PRECOMPUTED
            </span>
          </div>
        </div>

        {/* Top Right Controls & Mini-Map */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            {phase === 'surface' && <LayerTogglePanel />}
            
            <button
              className="hud-btn"
              onClick={() => setShowHelp(!showHelp)}
              style={{ padding: '10px', borderRadius: '50%' }}
              title="Scientific Context & Mission Brief"
            >
              <HelpCircle size={18} color="#06b6d4" />
            </button>
          </div>

          {/* Fixed Side-Panel Mini-Map Radar Widget */}
          {phase === 'surface' && <MiniMap />}
        </div>
      </header>

      {/* Surface Interaction Controls Bar */}
      {phase === 'surface' && (
        <div style={{ alignSelf: 'center', marginBottom: '8px' }}>
          <DriveControlsBar />
        </div>
      )}

      {/* Center Landing Hero Drop Button (Globe Mode) */}
      {phase === 'globe' && (
        <div style={{ alignSelf: 'center', marginBottom: '40px' }}>
          <DropAgainButton />
        </div>
      )}

      {/* Bottom Footer Telemetry & Actions */}
      <footer
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          width: '100%'
        }}
      >
        <MissionStatus />

        {phase === 'surface' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
            <DropAgainButton />
            <InfoPanel />
          </div>
        )}
      </footer>

      {/* Help & Science Disclosure Modal */}
      {showHelp && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 7, 18, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            zIndex: 100
          }}
          onClick={() => setShowHelp(false)}
        >
          <div
            className="hud-glass-panel reticle-corner"
            style={{
              maxWidth: '560px',
              padding: '24px',
              margin: '20px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="hud-title" style={{ fontSize: '1.1rem', color: '#06b6d4', marginBottom: '8px' }}>
              ABOUT THIS MISSION SIMULATION
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '12px' }}>
              <strong>Drop the Rover</strong> demonstrates real-world application of the <strong>NASA-IBM Lunar Foundation Model</strong> (published by NASA Marshall Space Flight Center and IBM Research).
            </p>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <strong style={{ color: '#f8fafc' }}>1. Polar Ice Prospectivity:</strong> Dense regression model estimating water-ice probability in upper regolith cold-traps.
              </div>
              <div>
                <strong style={{ color: '#f8fafc' }}>2. Crater Detection:</strong> Object detection calibrated on the Robbins lunar catalog to establish hazard exclusion zones.
              </div>
              <div>
                <strong style={{ color: '#f8fafc' }}>3. IMP Segmentation:</strong> Semantic terrain classification into regolith plains, raised ridges, and steep crater walls.
              </div>
              <div>
                <strong style={{ color: '#f8fafc' }}>4. Scientific Honesty:</strong> Outputs are precomputed offline fuzzy overlays for exploration targeting, not mission-critical landing instruments.
              </div>
            </div>
            <button
              className="hud-btn hud-btn-primary"
              style={{ marginTop: '18px', width: '100%' }}
              onClick={() => setShowHelp(false)}
            >
              CLOSE MISSION BRIEF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
