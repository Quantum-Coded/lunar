import type { Region } from "@/lib/api/types";

/** Plain-language sentence describing how much of the Moon is real, interactive terrain. */
export function coverageSentence(region: Region): string {
  const { area_km2, moon_surface_km2, fraction_of_moon } = region.coverage;
  const pct = (fraction_of_moon * 100).toFixed(1);
  const moonMillions = (moon_surface_km2 / 1e6).toFixed(1);
  return `${Math.round(area_km2).toLocaleString("en-US")} km² of the Moon's ${moonMillions} million km² surface - about ${pct}%`;
}
