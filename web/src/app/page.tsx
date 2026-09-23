'use client';

import React from 'react';
import { MissionScene } from '@/components/scene/MissionScene';
import { HUDOverlay } from '@/components/hud/HUDOverlay';

export default function Home() {
  return (
    <main style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <MissionScene />
      <HUDOverlay />
    </main>
  );
}
