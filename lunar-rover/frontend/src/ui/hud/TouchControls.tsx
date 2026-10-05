"use client";

import { press, release } from "@/game/input";

const BUTTONS: { key: string; label: string; area: string }[] = [
  { key: "w", label: "▲", area: "up" },
  { key: "a", label: "◀", area: "left" },
  { key: "s", label: "▼", area: "down" },
  { key: "d", label: "▶", area: "right" },
];

/** On-screen drive pad, shown only on touch devices (see .touch-controls in the stylesheet). */
export function TouchControls() {
  return (
    <div className="touch-controls">
      {BUTTONS.map((b) => (
        <button
          key={b.key}
          style={{ gridArea: b.area }}
          aria-label={`Drive ${b.area}`}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); press(b.key); }}
          onPointerUp={() => release(b.key)}
          onPointerCancel={() => release(b.key)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
