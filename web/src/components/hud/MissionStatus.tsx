'use client';

import React, { useState, useEffect } from 'react';
import { useMissionStore } from '@/lib/scene-state/store';
import { Radio, Terminal } from 'lucide-react';

export function MissionStatus() {
  const statusMessage = useMissionStore((s) => s.statusMessage);
  const phase = useMissionStore((s) => s.phase);
  const [logs, setLogs] = useState<Array<{ id: number; time: string; msg: string }>>([]);

  useEffect(() => {
    const now = new Date();
    const timeStr = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')} UTC`;
    
    setLogs((prev) => [
      { id: Date.now(), time: timeStr, msg: statusMessage },
      ...prev.slice(0, 3)
    ]);
  }, [statusMessage]);

  return (
    <div 
      className="hud-glass-panel reticle-corner"
      style={{
        width: '380px',
        maxWidth: '90vw',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={14} color="#06b6d4" />
          <span className="hud-title" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            TELEMETRY & MISSION LOG
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div className="pulse-indicator" />
          <span className="hud-mono" style={{ fontSize: '0.68rem', color: '#06b6d4', textTransform: 'uppercase' }}>
            {phase.toUpperCase()}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '90px', overflowY: 'hidden' }}>
        {logs.map((log, idx) => (
          <div key={log.id} style={{ display: 'flex', gap: '8px', fontSize: '0.74rem', opacity: idx === 0 ? 1 : 0.6 }}>
            <span className="hud-mono" style={{ color: '#64748b', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
              [{log.time}]
            </span>
            <span style={{ color: idx === 0 ? '#f8fafc' : '#94a3b8', lineHeight: 1.3 }}>
              {log.msg}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
