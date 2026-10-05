"use client";

import type { Fact, PoiDetail } from "@/lib/api/types";
import { formatLat, formatLon } from "@/lib/world/coords";

/** How each measured property is labelled. Unknown keys are simply not shown. */
const STATS: { key: string; label: string; format: (v: number | string | boolean) => string }[] = [
  { key: "diameter_km", label: "Diameter", format: (v) => `${Number(v).toFixed(1)} km` },
  { key: "depth_m", label: "Depth", format: (v) => `${(Number(v) / 1000).toFixed(1)} km` },
  { key: "area_km2", label: "Area", format: (v) => `${Number(v).toFixed(0)} km²` },
  { key: "floor_shadow_pct", label: "Floor in shadow", format: (v) => `${Number(v).toFixed(0)}%` },
  { key: "rim_sun_pct", label: "Rim sunlight", format: (v) => `${Number(v).toFixed(0)}%` },
  { key: "sun_visibility_pct", label: "Sunlight", format: (v) => `${Number(v).toFixed(0)}%` },
  { key: "ice_status", label: "Ice", format: (v) => (v === "confirmed" ? "Confirmed" : "Candidate (unconfirmed)") },
];

interface Props {
  poi: PoiDetail;
  extraFacts?: Fact[];
  compact?: boolean;
}

export function PoiFacts({ poi, extraFacts = [], compact = false }: Props) {
  const stats = STATS.filter((s) => poi.props[s.key] !== undefined);
  const facts = [...poi.facts, ...extraFacts];
  return (
    <div className="facts">
      <div className="stat-grid">
        <div><span>Location</span><b>{formatLat(poi.lat)} {formatLon(poi.lon)}</b></div>
        <div><span>Elevation</span><b>{(poi.elevation_m / 1000).toFixed(2)} km</b></div>
        {stats.map((s) => (
          <div key={s.key}><span>{s.label}</span><b>{s.format(poi.props[s.key])}</b></div>
        ))}
      </div>
      {poi.namesake && (
        <div className="fact namesake"><span className="fact-tag">Named for</span> {poi.namesake}</div>
      )}
      {(compact ? facts.slice(0, 3) : facts).map((f, i) => (
        <div className="fact" key={i}>
          <span className="fact-tag">Did you know</span> {f.text}
          <em>{f.source}</em>
        </div>
      ))}
      {poi.link && !compact && <a className="fact-link" href={poi.link.replace("http://", "https://")} target="_blank" rel="noreferrer">IAU gazetteer entry ↗</a>}
    </div>
  );
}
