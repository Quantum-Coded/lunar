"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { PoiSummary } from "@/lib/api/types";
import { formatDistance } from "@/lib/world/coords";
import { useGame } from "@/state/store";
import { roverPose } from "@/state/roverPose";
import { toRegionX, toRegionY } from "@/lib/world/coords";

const REFRESH_MS = 2500;

interface Props {
  category: string | null;
  query: string;
  onPick: (poi: PoiSummary) => void;
}

/** Nearest points of interest to the rover, ranked by the backend. */
export function PoiList({ category, query, onPick }: Props) {
  const categories = useGame((s) => s.categories);
  const heading = useGame((s) => s.telemetry.headingDeg);
  const [rows, setRows] = useState<PoiSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const last = useRef({ x: NaN, y: NaN });

  useEffect(() => {
    let cancelled = false;
    const refresh = (force: boolean) => {
      if (!roverPose.placed) return;
      const near = { x: toRegionX(roverPose.x), y: toRegionY(roverPose.z) };
      if (!force && Math.hypot(near.x - last.current.x, near.y - last.current.y) < 250) return;
      last.current = near;
      api.pois({ category: category ?? undefined, q: query || undefined, near, limit: 40 })
        .then((r) => { if (!cancelled) { setRows(r); setError(null); } })
        .catch((e) => !cancelled && setError(e.message));
    };
    refresh(true);
    const timer = setInterval(() => refresh(false), REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [category, query]);

  const color = (id: string) => categories.find((c) => c.id === id)?.color ?? "#fff";

  return (
    <ul className="poi-list">
      {error && <li className="empty">{error}</li>}
      {!error && rows.length === 0 && <li className="empty">Nothing found</li>}
      {rows.map((p) => (
        <li key={p.id}>
          <button onClick={() => onPick(p)}>
            <span className="dot" style={{ background: color(p.category) }} />
            <span className="poi-name">
              <b>{p.name}</b>
              <small>{p.kind}{p.pole ? " · info pole" : ""}</small>
            </span>
            <span className="poi-dist">
              <b>{formatDistance(p.distance_m ?? 0)}</b>
              <span className="arrow" style={{ transform: `rotate(${(p.bearing_deg ?? 0) - heading}deg)` }}>▲</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
