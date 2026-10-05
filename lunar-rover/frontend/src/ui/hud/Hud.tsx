"use client";

import Link from "next/link";
import { useState } from "react";
import { guideTo } from "@/game/guidance";
import { capitalise, describe } from "@/lib/plainLanguage";
import { compassLabel, formatDistance, formatLat, formatLon } from "@/lib/world/coords";
import { SPEED_LEVELS_MPS, useGame } from "@/state/store";

/** A spot counts as "reached" inside this distance, so the guide button gives way to "You are here". */
const HERE_RADIUS_M = 80;

/**
 * Read-out over the 3D view. "(real)" values are sampled from NASA LRO data at the rover's location;
 * "(game)" values come from the game simulation.
 */
export function Hud() {
  const t = useGame((s) => s.telemetry);
  const locate = useGame((s) => s.locate);
  const autopilot = useGame((s) => s.autopilot);
  const activeRoute = useGame((s) => s.activeRoute);
  const arrivedAt = useGame((s) => s.arrivedAt);
  const setAutopilot = useGame((s) => s.setAutopilot);
  const speedLevel = useGame((s) => s.speedLevel);
  const changeSpeedLevel = useGame((s) => s.changeSpeedLevel);
  const [guiding, setGuiding] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const remaining = activeRoute ? Math.hypot(activeRoute.goal.x - t.x, activeRoute.goal.y - t.y) : null;
  const nearest = locate?.nearest_poi;
  const guidingToNearest = autopilot && activeRoute?.goal.id === nearest?.id;

  async function guide() {
    if (!nearest) return;
    setGuiding(true);
    setGuideError(null);
    try {
      await guideTo(nearest.id);
    } catch (e) {
      setGuideError((e as Error).message);
    } finally {
      setGuiding(false);
    }
  }

  return (
    <>
      <div className="hud hud-left-stack">
        <div className="glass hud-telemetry">
          <div className="hud-title">ROVER TELEMETRY</div>
          <div className="hud-grid">
            {locate && <><span>Latitude (real)</span><b>{formatLat(locate.lat)}</b><span>Longitude (real)</span><b>{formatLon(locate.lon)}</b></>}
            <span>Elevation (real)</span><b>{t.elevation.toFixed(0)} m</b>
            {locate?.sun_visibility_pct !== undefined && <><span>Avg. sunlight (real)</span><b>{locate.sun_visibility_pct.toFixed(0)}%</b></>}
            <span>Heading (game)</span><b>{t.headingDeg.toFixed(0)}° {compassLabel(t.headingDeg)}</b>
            <span>Speed (game)</span><b>{Math.abs(t.speed).toFixed(0)} m/s</b>
            <span>Tilt (game)</span><b>{t.slopeDeg.toFixed(1)}°</b>
          </div>
          {locate?.in_shadow_region && <div className="badge badge-shadow">In a permanently dark area - headlamps on</div>}
        </div>

        {nearest && (
          <div className="glass hud-nearby">
            <div className="hud-title">NEAREST KNOWN PLACE</div>
            <p><b>{capitalise(describe(nearest))}</b></p>
            <small>{nearest.distance_m < HERE_RADIUS_M ? "You are here" : `${formatDistance(nearest.distance_m)} away`}</small>
            {nearest.distance_m >= HERE_RADIUS_M && (
              <button className="cta" disabled={guiding || guidingToNearest} onClick={guide}>
                {guiding ? "Planning path…" : guidingToNearest ? "Guiding you there" : "Guide me there"}
              </button>
            )}
            {guideError && <small className="warn">{guideError}</small>}
          </div>
        )}
      </div>

      <div className="hud hud-top-right">
        <Link className="about-btn" href="/about" target="_blank">ABOUT</Link>
      </div>

      {(activeRoute || arrivedAt) && (
        <div className="hud glass route-banner">
          {arrivedAt ? (
            <>Arrived: <b>{arrivedAt.name}</b></>
          ) : activeRoute && (
            <>
              <span>{autopilot ? "Guiding you to" : "Route to"} <b>{activeRoute.goal.name}</b></span>
              <span>{remaining !== null && formatDistance(remaining)} to go</span>
              {autopilot && <button className="chip" onClick={() => setAutopilot(false)}>Take control</button>}
            </>
          )}
        </div>
      )}

      <div className="hud glass hud-bottom-left help">
        <span><b>W A S D</b> drive · <b>Space</b> brake</span>
        <span className="speed-set">
          Top speed
          <button aria-label="Slower" disabled={speedLevel === 0} onClick={() => changeSpeedLevel(-1)}>−</button>
          <b>{SPEED_LEVELS_MPS[speedLevel]} m/s</b>
          <button aria-label="Faster" disabled={speedLevel === SPEED_LEVELS_MPS.length - 1} onClick={() => changeSpeedLevel(1)}>+</button>
          <small>(Q / E)</small>
        </span>
      </div>
    </>
  );
}
