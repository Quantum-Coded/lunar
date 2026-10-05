import type { PoiSummary } from "@/lib/api/types";

/** Everyday wording for the technical feature kinds the data uses: what it is and why it matters. */
const PLAIN: Record<string, { what: string; why: string }> = {
  "Sunlit site": { what: "a very sunny hilltop", why: "The Sun shines on it more than almost anywhere else here, so a rover could recharge its solar panels." },
  "Permanently shadowed region": { what: "a dark pit where sunlight never reaches", why: "It is so cold that water ice could survive there for ages - exactly what future astronauts would want to find." },
  "Confirmed water": { what: "a spot where NASA found water", why: "A rocket crashed here in 2009 and the cloud it threw up contained water ice." },
  Crater: { what: "a bowl-shaped dent left by a space rock", why: "Craters expose old layers of the Moon, and their floors can hide in permanent shadow." },
  Mons: { what: "a mountain", why: "High ground like this can see far, and some peaks stay sunlit for long periods." },
  "Highest point": { what: "the highest ground in the surveyed area", why: "A natural lookout." },
  "Lowest point": { what: "the deepest spot in the surveyed area", why: "Deep basins are often cold and shadowed." },
};

/** "a very sunny hilltop" for a kind, falling back to the technical kind if we have no plain wording. */
export function plainWhat(kind: string): string {
  return PLAIN[kind]?.what ?? kind.toLowerCase();
}

export function plainWhy(kind: string): string | null {
  return PLAIN[kind]?.why ?? null;
}

/** "a very sunny hilltop (Sunlit ridge near Spudis)" - meaning first, official name second. */
export function describe(poi: Pick<PoiSummary, "kind" | "name">): string {
  return `${plainWhat(poi.kind)} (${poi.name})`;
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
