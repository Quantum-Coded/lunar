'use client';

import React from 'react';
import { useMissionStore } from '@/lib/scene-state/store';
import { ActiveLayer } from '@/types';
import { Eye, Droplets, Target, Mountain } from 'lucide-react';

export function LayerTogglePanel() {
  const activeLayer = useMissionStore((s) => s.activeLayer);
  const setActiveLayer = useMissionStore((s) => s.setActiveLayer);
  const setStatusMessage = useMissionStore((s) => s.setStatusMessage);

  const layers: Array<{ id: ActiveLayer; label: string; icon: React.ReactNode; color: string; desc: string }> = [
    {
      id: 'none',
      label: 'SURFACE PHOTO',
      icon: <Eye size={15} />,
      color: '#94a3b8',
      desc: 'Raw LRO NAC lunar surface reflectance albedo.'
    },
    {
      id: 'ice',
      label: 'ICE PROSPECTIVITY',
      icon: <Droplets size={15} />,
      color: '#06b6d4',
      desc: 'NASA-IBM LFM polar water-ice dense regression fuzzy overlay.'
    },
    {
      id: 'craters',
      label: 'CRATER DETECTIONS',
      icon: <Target size={15} />,
      color: '#f43f5e',
      desc: 'NASA-IBM LFM crater object detection bounding circles & hazard rings.'
    },
    {
      id: 'terrain',
      label: 'IMP TERRAIN CLASSES',
      icon: <Mountain size={15} />,
      color: '#a855f7',
      desc: 'NASA-IBM LFM semantic segmentation (Regolith, Ridges, Ejecta, Walls).'
    }
  ];

  const handleSelect = (layer: ActiveLayer, desc: string) => {
    setActiveLayer(layer);
    setStatusMessage(`OVERLAY ACTIVE: [${layer.toUpperCase()}]. ${desc}`);
  };

  return (
    <div 
      className="hud-glass-panel reticle-corner"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '10px 12px',
        width: '260px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span className="hud-title" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
          AI MODEL OVERLAYS
        </span>
        <span className="hud-mono" style={{ fontSize: '0.65rem', color: '#64748b' }}>
          NASA/IBM LFM
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {layers.map((l) => {
          const isActive = activeLayer === l.id;
          return (
            <button
              key={l.id}
              onClick={() => handleSelect(l.id, l.desc)}
              className="hud-btn"
              style={{
                justifyContent: 'flex-start',
                padding: '8px 12px',
                fontSize: '0.75rem',
                borderRadius: '6px',
                background: isActive ? `rgba(6, 182, 212, 0.15)` : 'rgba(15, 23, 42, 0.6)',
                borderColor: isActive ? l.color : 'rgba(255, 255, 255, 0.08)',
                color: isActive ? '#f8fafc' : '#94a3b8',
                boxShadow: isActive ? `0 0 15px ${l.color}40` : 'none'
              }}
            >
              <span style={{ color: l.color, display: 'flex' }}>{l.icon}</span>
              <span>{l.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
