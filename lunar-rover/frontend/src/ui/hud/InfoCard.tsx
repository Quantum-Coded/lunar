"use client";

import { capitalise, plainWhat, plainWhy } from "@/lib/plainLanguage";
import { PoiFacts } from "@/ui/gps/PoiFacts";
import { useGame } from "@/state/store";

/** Pops up when the rover reaches a place: what it is in plain words, then the official name and the facts. */
export function InfoCard() {
  const poi = useGame((s) => s.nearbyPole);
  const categories = useGame((s) => s.categories);
  const dismiss = useGame((s) => s.dismissPole);
  const zoneFacts = useGame((s) => s.zoneFacts);
  if (!poi) return null;
  const color = categories.find((c) => c.id === poi.category)?.color ?? "#fff";
  const why = plainWhy(poi.kind);

  return (
    <div className="info-card" style={{ borderColor: color }}>
      <button className="info-close" onClick={() => dismiss(poi.id)} aria-label="Close">×</button>
      <div className="info-kind" style={{ color }}>{capitalise(plainWhat(poi.kind))}</div>
      <h2>{poi.name}</h2>
      {why && <p className="plain-why">{why}</p>}
      <p>{poi.summary}</p>
      <PoiFacts poi={poi} extraFacts={zoneFacts.slice(0, 1)} compact />
    </div>
  );
}
