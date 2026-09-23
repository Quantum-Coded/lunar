'use client';

import { useEffect, useRef } from 'react';
import { useMissionStore } from '@/lib/scene-state/store';

export interface RoverInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

export function useRoverControls() {
  const setCameraMode = useMissionStore((s) => s.setCameraMode);

  const controlsRef = useRef<RoverInputState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if focused on input / textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const key = e.key.toLowerCase();

      if (key === 'w' || key === 'arrowup') {
        controlsRef.current.forward = true;
      } else if (key === 's' || key === 'arrowdown') {
        controlsRef.current.backward = true;
      } else if (key === 'a' || key === 'arrowleft') {
        controlsRef.current.left = true;
      } else if (key === 'd' || key === 'arrowright') {
        controlsRef.current.right = true;
      } else if (key === 'v') {
        // Toggle camera between chase and fpv
        const currentMode = useMissionStore.getState().cameraMode;
        const nextMode = currentMode === 'chase' ? 'fpv' : 'chase';
        setCameraMode(nextMode);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (key === 'w' || key === 'arrowup') {
        controlsRef.current.forward = false;
      } else if (key === 's' || key === 'arrowdown') {
        controlsRef.current.backward = false;
      } else if (key === 'a' || key === 'arrowleft') {
        controlsRef.current.left = false;
      } else if (key === 'd' || key === 'arrowright') {
        controlsRef.current.right = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setCameraMode]);

  return controlsRef;
}
