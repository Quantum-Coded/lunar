'use client';

import React from 'react';
import { useMissionStore } from '@/lib/scene-state/store';
import { findNearestIceDeposit } from '@/lib/pathfinding/astar';
import { Droplets, Navigation, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

export function InfoPanel() {
  const telemetry = useMissionStore((s) => s.telemetry);
  const navGrid = useMissionStore((s) => s.navGrid);
  const roverGridPos = useMissionStore((s) => s.roverGridPos);
  const activePath = useMissionStore((s) => s.activePath);
  const pathProgress = useMissionStore((s) => s.pathProgress);
  const setActivePath = useMissionStore((s) => s.setActivePath);
  const setRoverMovementState = useMissionStore((s) => s.setRoverMovementState);
  const setIsAutoNavigating = useMissionStore((s) => s.setIsAutoNavigating);
  const isAutoNavigating = useMissionStore((s) => s.isAutoNavigating);
  const setStatusMessage = useMissionStore((s) => s.setStatusMessage);

  const handleFindNearestIce = () => {
    if (!navGrid) return;

    setIsAutoNavigating(true);
    setStatusMessage('SEARCHING POLAR ICE PROSPECTIVITY MAP FOR OPTIMAL HARVEST DEPOSIT...');

    const result = findNearestIceDeposit(navGrid, roverGridPos);
    if (result && result.path.length > 0) {
      setActivePath(result.path);
      setRoverMovementState('turning');
      setStatusMessage(
        `OPTIMAL TRAVERSE COMPUTED: ${result.path.length} WAYPOINTS -> ICE TARGET (${(result.iceProb * 100).toFixed(0)}% PROBABILITY, ${result.distanceMeters.toFixed(0)}M AWAY).`
      );
    } else {
      setStatusMessage('NO NAVIGABLE PATH FOUND TO TARGET ICE DEPOSIT.');
      setIsAutoNavigating(false);
    }
  };

  const getHazardBadge = (cost: number) => {
    if (cost <= 1.2) {
      return { label: 'LOW HAZARD', color: '#10b981', icon: <ShieldCheck size={13} /> };
    }
    if (cost <= 2.5) {
      return { label: 'MODERATE RISK', color: '#f59e0b', icon: <AlertTriangle size={13} /> };
    }
    return { label: 'SEVERE OBSTACLE', color: '#f43f5e', icon: <AlertTriangle size={13} /> };
  };

  const hazardInfo = getHazardBadge(telemetry.currentHazardCost);

  return (
    <div
      className="hud-glass-panel reticle-corner"
      style={{
        width: '320px',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Navigation size={15} color="#06b6d4" />
          <span className="hud-title" style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
            ROVER NAVIGATION & TELEMETRY
          </span>
        </div>
        <span 
          className="hud-mono"
          style={{ 
            fontSize: '0.68rem', 
            color: telemetry.navState === 'driving' ? '#06b6d4' : '#94a3b8',
            fontWeight: 600
          }}
        >
          {telemetry.navState.toUpperCase()}
        </span>
      </div>

      {/* Grid Coordinates & Terrain */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <span style={{ fontSize: '0.66rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>
            Grid Position
          </span>
          <span className="hud-mono" style={{ fontSize: '0.85rem', color: '#f8fafc' }}>
            [{roverGridPos[0]}, {roverGridPos[1]}]
          </span>
        </div>

        <div>
          <span style={{ fontSize: '0.66rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>
            Surface Type
          </span>
          <span style={{ fontSize: '0.82rem', color: '#cbd5e1', textTransform: 'capitalize' }}>
            {telemetry.currentTerrainClass.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Hazard Status Readout */}
      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
            Traverse Cost Multiplier:
          </span>
          <span className="hud-mono" style={{ fontSize: '0.85rem', fontWeight: 600, color: hazardInfo.color }}>
            {telemetry.currentHazardCost.toFixed(2)}x
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
          <span style={{ color: hazardInfo.color }}>{hazardInfo.icon}</span>
          <span className="hud-mono" style={{ fontSize: '0.7rem', color: hazardInfo.color }}>
            {hazardInfo.label}
          </span>
        </div>
      </div>

      {/* Nearest Water-Ice Prospect */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Droplets size={14} color="#06b6d4" />
            <span style={{ fontSize: '0.72rem', color: '#06b6d4', fontWeight: 600 }}>
              NEAREST WATER-ICE
            </span>
          </div>
          <span className="hud-mono" style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 600 }}>
            {telemetry.nearestIceDistanceMeters !== null ? `${telemetry.nearestIceDistanceMeters.toFixed(0)} m` : 'Scanning...'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8' }}>
          <span>AI Prospectivity Index:</span>
          <span className="hud-mono" style={{ color: '#22d3ee', fontWeight: 600 }}>
            {telemetry.nearestIceProbability !== null ? `${(telemetry.nearestIceProbability * 100).toFixed(0)}%` : '--'}
          </span>
        </div>
      </div>

      {/* Autonomous Route Traversal Progress Bar */}
      {activePath.length > 0 && (
        <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.66rem', color: '#94a3b8' }}>A* TRAVERSE PROGRESS</span>
            <span className="hud-mono" style={{ fontSize: '0.74rem', color: '#22d3ee', fontWeight: 700 }}>
              {(pathProgress * 100).toFixed(0)}%
            </span>
          </div>
          <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.max(4, Math.round(pathProgress * 100))}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #06b6d4, #22d3ee)',
                borderRadius: '2px',
                transition: 'width 0.15s ease-out',
                boxShadow: '0 0 8px #06b6d4',
              }}
            />
          </div>
        </div>
      )}

      {/* Find Nearest Ice Action CTA */}
      <button
        onClick={handleFindNearestIce}
        disabled={isAutoNavigating && telemetry.navState === 'driving'}
        className="hud-btn hud-btn-primary"
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '0.8rem',
          borderRadius: '8px',
          marginTop: '2px',
          cursor: (isAutoNavigating && telemetry.navState === 'driving') ? 'not-allowed' : 'pointer',
          opacity: (isAutoNavigating && telemetry.navState === 'driving') ? 0.7 : 1
        }}
      >
        <Zap size={15} />
        <span>{telemetry.navState === 'driving' ? 'ROVER EN ROUTE...' : 'FIND NEAREST ICE (AUTO-ROUTE)'}</span>
      </button>
    </div>
  );
}
