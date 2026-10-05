"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { PoiSummary } from "@/lib/api/types";
import { useGame } from "@/state/store";
import { roverPose } from "@/state/roverPose";
import { capitalise, plainWhat } from "@/lib/plainLanguage";
import { formatDistance, toRegionX, toRegionY } from "@/lib/world/coords";
import { routeProgress } from "@/lib/world/routeProgress";

const MIN_MPP = 25; // metres per pixel when fully zoomed in
const PIN_HIT_PX = 14;

export type MapLayer = "shadow" | "sunlight";

interface Props {
  visibleCategories: Set<string>;
  layers: Set<MapLayer>;
  onPick: (poi: PoiSummary) => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function niceScale(metres: number): number {
  const pow = 10 ** Math.floor(Math.log10(metres));
  const lead = metres / pow;
  return (lead >= 5 ? 5 : lead >= 2 ? 2 : 1) * pow;
}

/** Top-down GPS map: shaded relief of the surveyed zone, POI pins, the planned route and the rover. */
export function GpsMap({ visibleCategories, layers, onPick }: Props) {
  const region = useGame((s) => s.region)!;
  const allPois = useGame((s) => s.allPois);
  const categories = useGame((s) => s.categories);
  const selected = useGame((s) => s.selected);
  const route = useGame((s) => s.activeRoute);
  const rover = useGame((s) => s.telemetry);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const images = useRef<Partial<Record<string, HTMLImageElement>>>({});
  // mode: "follow" keeps the rover centred, "fit" frames the rover and the destination, "free" is user-panned.
  const view = useRef({ cx: 0, cy: 0, mpp: (region.extent.xmax - region.extent.xmin) / 340, mode: "follow" as "follow" | "fit" | "free" });
  const [mode, setMode] = useState<"follow" | "fit" | "free">("follow");
  const setViewMode = (m: "follow" | "fit" | "free") => { view.current.mode = m; setMode(m); };
  const zoomRef = useRef<(factor: number) => void>(() => {});
  const [hover, setHover] = useState<{ poi: PoiSummary; x: number; y: number } | null>(null);
  // The draw loop reads props through a ref so it never needs restarting.
  const live = useRef({ visibleCategories, layers, allPois, selected, route });
  live.current = { visibleCategories, layers, allPois, selected, route };
  const colors = useRef(new Map<string, string>());
  colors.current = new Map(categories.map((c) => [c.id, c.color]));

  const routeGoalId = route?.goal.id;
  useEffect(() => {
    setViewMode(routeGoalId ? "fit" : "follow");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeGoalId]);

  useEffect(() => {
    for (const layer of ["relief", "shadow", "sunlight"]) {
      loadImage(api.overviewUrl(layer)).then((img) => { images.current[layer] = img; }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const { xmin, ymax, xmax } = region.extent;
    const extent = xmax - xmin;

    const toCanvas = (x: number, y: number, w: number, h: number): [number, number] => [
      (x - view.current.cx) / view.current.mpp + w / 2,
      (view.current.cy - y) / view.current.mpp + h / 2,
    ];

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const v = view.current;
      const rx = toRegionX(roverPose.x), ry = toRegionY(roverPose.z);
      const activeRoute = live.current.route;
      if (v.mode === "fit" && activeRoute) {
        // Frame the rover and the destination together, easing toward the target view.
        const goal = activeRoute.goal;
        const separationM = Math.hypot(goal.x - rx, goal.y - ry);
        const targetMpp = Math.min(extent / 120, Math.max(MIN_MPP, (separationM * 1.5 + 300) / Math.min(w, h)));
        const ease = 0.12;
        v.cx += ((rx + goal.x) / 2 - v.cx) * ease;
        v.cy += ((ry + goal.y) / 2 - v.cy) * ease;
        v.mpp += (targetMpp - v.mpp) * ease;
      } else if (v.mode !== "free") { v.cx = rx; v.cy = ry; }

      ctx.fillStyle = "#04060b";
      ctx.fillRect(0, 0, w, h);

      const [ix, iy] = toCanvas(xmin, ymax, w, h);
      const size = extent / v.mpp;
      ctx.imageSmoothingEnabled = true;
      const drawLayer = (name: string, alpha: number) => {
        const img = images.current[name];
        if (img) { ctx.globalAlpha = alpha; ctx.drawImage(img, ix, iy, size, size); ctx.globalAlpha = 1; }
      };
      drawLayer("relief", 1);
      if (live.current.layers.has("sunlight")) drawLayer("sunlight", 0.75);
      if (live.current.layers.has("shadow")) drawLayer("shadow", 1);

      // Route: faint full path, grey where already driven, bright where still to go, a flag at the destination.
      const r = live.current.route;
      if (r) {
        const wps = r.route.waypoints;
        const prog = routeProgress(wps, rx, ry);
        const trace = (points: [number, number][]) => {
          ctx.beginPath();
          points.forEach(([x, y], i) => {
            const [px, py] = toCanvas(x, y, w, h);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          });
        };
        ctx.lineJoin = "round"; ctx.lineCap = "round";
        const done: [number, number][] = [...wps.slice(0, prog.nextIndex), prog.snapped];
        const ahead: [number, number][] = [prog.snapped, ...wps.slice(prog.nextIndex)];
        trace(done);
        ctx.lineWidth = 5; ctx.strokeStyle = "rgba(160,170,190,0.55)"; ctx.stroke();
        trace(ahead);
        ctx.lineWidth = 8; ctx.strokeStyle = "rgba(4,6,11,0.85)"; ctx.stroke();
        ctx.lineWidth = 5; ctx.strokeStyle = "#4da3ff"; ctx.stroke();
        // link from the rover to the path when it has drifted off
        if (prog.offRouteM > 5 * v.mpp) {
          const [sx, sy] = toCanvas(prog.snapped[0], prog.snapped[1], w, h);
          const [qx, qy] = toCanvas(rx, ry, w, h);
          ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(sx, sy);
          ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.strokeStyle = "#4da3ff"; ctx.stroke(); ctx.setLineDash([]);
        }
        // destination flag
        const [gx, gy] = toCanvas(r.goal.x, r.goal.y, w, h);
        ctx.beginPath(); ctx.arc(gx, gy, 9, 0, Math.PI * 2);
        ctx.fillStyle = "#ff4d5e"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.stroke();
        ctx.beginPath(); ctx.arc(gx, gy, 3, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
      }

      // Pins
      const t = performance.now() / 1000;
      for (const p of live.current.allPois) {
        if (!live.current.visibleCategories.has(p.category) && live.current.selected?.id !== p.id) continue;
        const [px, py] = toCanvas(p.x, p.y, w, h);
        if (px < -20 || py < -20 || px > w + 20 || py > h + 20) continue;
        const radiusPx = p.radius_m / v.mpp;
        const color = colors.current.get(p.category) ?? "#fff";
        if (radiusPx > 5) {
          ctx.beginPath();
          ctx.arc(px, py, radiusPx, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        ctx.arc(px, py, p.pole ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        if (p.pole) { ctx.lineWidth = 1.5; ctx.strokeStyle = "#05070d"; ctx.stroke(); }
        if (live.current.selected?.id === p.id) {
          ctx.beginPath();
          ctx.arc(px, py, 9 + Math.sin(t * 4) * 2, 0, Math.PI * 2);
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Rover marker
      const [rpx, rpy] = toCanvas(rx, ry, w, h);
      ctx.save();
      ctx.translate(rpx, rpy);
      ctx.rotate((roverPose.headingDeg * Math.PI) / 180);
      ctx.beginPath();
      ctx.moveTo(0, -11); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath();
      ctx.fillStyle = "#3df2a7";
      ctx.strokeStyle = "#04170f";
      ctx.lineWidth = 2;
      ctx.fill(); ctx.stroke();
      ctx.restore();

      // Scale bar
      const barM = niceScale(v.mpp * 90);
      ctx.fillStyle = "rgba(4,6,11,0.7)";
      ctx.fillRect(10, h - 28, barM / v.mpp + 16, 20);
      ctx.fillStyle = "#e8ecf8";
      ctx.fillRect(18, h - 14, barM / v.mpp, 2);
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText(barM >= 1000 ? `${barM / 1000} km` : `${barM} m`, 18, h - 18);

      // Compass (map north is up)
      ctx.beginPath();
      ctx.arc(w - 24, 24, 15, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(4,6,11,0.7)";
      ctx.fill();
      ctx.fillStyle = "#ff6b6b";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("N", w - 24, 29);
      ctx.textAlign = "start";
    };
    raf = requestAnimationFrame(draw);

    // --- interaction: drag to pan, wheel / buttons to zoom, tap a pin to open it ---
    let dragging = false, moved = 0, lastX = 0, lastY = 0;
    const clampMpp = (m: number) => Math.min(extent / 120, Math.max(MIN_MPP, m));
    const down = (e: PointerEvent) => { dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); };
    /** The pin under the pointer, with its position in the map's own (unscaled) pixels. The phone is CSS-scaled. */
    const pinAt = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scale = rect.width / canvas.clientWidth;
      const px = (e.clientX - rect.left) / scale, py = (e.clientY - rect.top) / scale;
      let best: { poi: PoiSummary; x: number; y: number } | null = null, bestD = PIN_HIT_PX;
      for (const p of live.current.allPois) {
        if (!live.current.visibleCategories.has(p.category)) continue;
        const [cx, cy] = toCanvas(p.x, p.y, canvas.clientWidth, canvas.clientHeight);
        const d = Math.hypot(cx - px, cy - py);
        if (d < bestD) { best = { poi: p, x: cx, y: cy }; bestD = d; }
      }
      return best;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) {
        const hit = pinAt(e);
        setHover((prev) => (prev?.poi.id === hit?.poi.id ? prev : hit));
        return;
      }
      setHover(null);
      const rect = canvas.getBoundingClientRect();
      const scale = rect.width / canvas.clientWidth;
      const dx = (e.clientX - lastX) / scale, dy = (e.clientY - lastY) / scale;
      moved += Math.abs(dx) + Math.abs(dy);
      lastX = e.clientX; lastY = e.clientY;
      if (moved > 4) {
        setViewMode("free");
        view.current.cx -= dx * view.current.mpp;
        view.current.cy += dy * view.current.mpp;
      }
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      if (moved > 4) return;
      const hit = pinAt(e);
      if (hit) onPick(hit.poi);
    };
    const leave = () => setHover(null);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      view.current.mpp = clampMpp(view.current.mpp * (1 + Math.sign(e.deltaY) * 0.18));
      if (view.current.mode === "fit") setViewMode("free");
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("wheel", wheel, { passive: false });
    zoomRef.current = (factor) => { view.current.mpp = clampMpp(view.current.mpp * factor); if (view.current.mode === "fit") setViewMode("free"); };
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("wheel", wheel);
    };
  }, [region, onPick]);

  const zoom = (factor: number) => zoomRef.current(factor);

  return (
    <div className="gps-map">
      <canvas ref={canvasRef} style={{ cursor: hover ? "pointer" : undefined }} />
      {hover && (
        <div className="map-tooltip" style={{ left: Math.min(hover.x + 12, 230), top: Math.max(hover.y - 14, 4) }}>
          <b>{hover.poi.name}</b>
          <span>{capitalise(plainWhat(hover.poi.kind))}</span>
          {rover && <small>{formatDistance(Math.hypot(hover.poi.x - rover.x, hover.poi.y - rover.y))} from you</small>}
        </div>
      )}
      <div className="map-buttons">
        <button onClick={() => zoom(0.6)} aria-label="Zoom in">+</button>
        <button onClick={() => zoom(1 / 0.6)} aria-label="Zoom out">−</button>
        {mode === "free" && (
          <button onClick={() => setViewMode(route ? "fit" : "follow")} aria-label="Recentre">◎</button>
        )}
      </div>
    </div>
  );
}
