"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { formatDistance } from "@/lib/world/coords";
import { routeProgress } from "@/lib/world/routeProgress";
import { SPEED_LEVELS_MPS, useGame } from "@/state/store";
import { roverPose } from "@/state/roverPose";
import { toRegionX, toRegionY } from "@/lib/world/coords";
import { PoiFacts } from "./PoiFacts";

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds)) return "-";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s`;
  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

/** Detail view for the selected place with route planning and auto-drive controls. */
export function PoiSheet() {
  const poi = useGame((s) => s.selected);
  const select = useGame((s) => s.select);
  const route = useGame((s) => s.activeRoute);
  const setActiveRoute = useGame((s) => s.setActiveRoute);
  const autopilot = useGame((s) => s.autopilot);
  const setAutopilot = useGame((s) => s.setAutopilot);
  const categories = useGame((s) => s.categories);
  const rover = useGame((s) => s.telemetry);
  const speedLevel = useGame((s) => s.speedLevel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const poiId = poi?.id;

  // Like a car GPS: choosing a place immediately draws the path to it on the map.
  useEffect(() => {
    const target = useGame.getState().selected;
    if (!target || useGame.getState().activeRoute?.goal.id === target.id) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    api.route([toRegionX(roverPose.x), toRegionY(roverPose.z)], [target.x, target.y])
      .then((planned) => { if (!cancelled) useGame.getState().setActiveRoute({ goal: target, route: planned }); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [poiId]);

  if (!poi) return null;

  const color = categories.find((c) => c.id === poi.category)?.color ?? "#fff";
  const here = (): [number, number] => [toRegionX(roverPose.x), toRegionY(roverPose.z)];
  const straight = Math.hypot(poi.x - here()[0], poi.y - here()[1]);
  const routeToThis = route && route.goal.id === poi.id ? route.route : null;

  const progress = routeToThis ? routeProgress(routeToThis.waypoints, rover.x, rover.y) : null;
  const etaSeconds = progress ? progress.remainingM / SPEED_LEVELS_MPS[speedLevel] : null;
  const arrived = progress !== null && progress.remainingM < 60;

  async function plan() {
    setBusy(true);
    setError(null);
    try {
      const planned = await api.route(here(), [poi!.x, poi!.y]);
      setActiveRoute({ goal: poi!, route: planned });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet">
      <button className="back" onClick={() => select(null)}>‹ Back</button>
      <div className="info-kind" style={{ color }}>{poi.kind}</div>
      <h3>{poi.name}</h3>
      <p className="summary">{poi.summary}</p>

      <div className="route-box">
        {routeToThis ? (
          <>
            <div className="route-live">
              <div className="route-bar"><div style={{ width: `${Math.min(100, (progress!.travelledM / Math.max(1, routeToThis.distance_m)) * 100)}%` }} /></div>
              <div className="route-stats">
                <div><span>{arrived ? "Status" : "To go"}</span><b>{arrived ? "You have arrived" : formatDistance(progress!.remainingM)}</b></div>
                {!arrived && <div><span>Arrive in</span><b>{formatEta(etaSeconds!)}</b></div>}
                <div><span>Path length</span><b>{formatDistance(routeToThis.distance_m)}</b></div>
              </div>
              {progress!.offRouteM > 150 && <div className="warn">You are off the path. Re-plan to get a fresh route from here.</div>}
            </div>
            {routeToThis.crosses_steep_terrain && <div className="warn">Route crosses slopes steeper than the rover's limit - drive carefully.</div>}
            <div className="btn-row">
              <button className="primary" onClick={() => setAutopilot(!autopilot)}>{autopilot ? "Stop auto-drive" : "Start auto-drive"}</button>
              {progress!.offRouteM > 150 && <button onClick={() => { setActiveRoute(null); plan(); }}>Re-plan</button>}
              <button onClick={() => { setAutopilot(false); setActiveRoute(null); }}>Clear</button>
            </div>
          </>
        ) : (
          <>
            <div className="route-stats"><div><span>Straight line</span><b>{formatDistance(straight)}</b></div></div>
            <button className="primary wide" disabled={busy} onClick={plan}>{busy ? "Drawing the path…" : "Try again"}</button>
          </>
        )}
        {error && <div className="warn">{error}</div>}
      </div>

      <PoiFacts poi={poi} />
    </div>
  );
}
