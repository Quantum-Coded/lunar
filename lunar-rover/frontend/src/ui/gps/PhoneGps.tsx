"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "devices.css/dist/devices.min.css";
import { api } from "@/lib/api/client";
import type { PoiSummary } from "@/lib/api/types";
import { useGame } from "@/state/store";
import { GpsMap, type MapLayer } from "./GpsMap";
import { PoiList } from "./PoiList";
import { PoiSheet } from "./PoiSheet";

// Outer size of the iPhone 14 Pro frame drawn by devices.css.
const DEVICE_W = 428;
const DEVICE_H = 868;

/** Scales the fixed-size phone frame down so it always fits its container. */
function useFitScale() {
  const holder = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 8) / DEVICE_W, (el.clientHeight - 8) / DEVICE_H));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { holder, scale };
}

/** The companion phone: GPS map, category filters, nearest places and place details, inside a real iPhone frame. */
export function PhoneGps() {
  const categories = useGame((s) => s.categories);
  const region = useGame((s) => s.region);
  const selected = useGame((s) => s.selected);
  const select = useGame((s) => s.select);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [layers, setLayers] = useState<Set<MapLayer>>(new Set(["shadow"]));
  const { holder, scale } = useFitScale();

  const open = useCallback((poi: PoiSummary) => {
    api.poi(poi.id).then(select).catch(() => {});
  }, [select]);

  const toggleLayer = (layer: MapLayer) => setLayers((prev) => {
    const next = new Set(prev);
    next.has(layer) ? next.delete(layer) : next.add(layer);
    return next;
  });

  const visible = new Set(category ? [category] : categories.map((c) => c.id));

  return (
    <div className="phone-holder" ref={holder}>
      <div style={{ width: DEVICE_W * scale, height: DEVICE_H * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: DEVICE_W, height: DEVICE_H }}>
          {/* The real-device frame comes from devices.css. Our UI sits over its screen area instead of inside it,
              because devices.css forces every descendant of .device to display:block. */}
          <div className="phone-shell">
            <div className="device device-iphone-14-pro">
              <div className="device-frame"><div className="device-screen" /></div>
              <div className="device-stripe" />
              <div className="device-header" />
              <div className="device-sensors" />
              <div className="device-btns" />
              <div className="device-power" />
              <div className="device-home" />
            </div>
            <div className="phone-screen phone-ui">
              <div className="island" />
              <header className="gps-header">
                <div>
                  <div className="gps-title">Lunar GPS</div>
                </div>
                <div className="layer-toggles">
                  <button className={layers.has("shadow") ? "on" : ""} title="Blue = places the Sun never reaches" onClick={() => toggleLayer("shadow")}>Shadow</button>
                  <button className={layers.has("sunlight") ? "on" : ""} title="Brighter = more hours of sunshine" onClick={() => toggleLayer("sunlight")}>Sun</button>
                </div>
              </header>

              {region && <GpsMap visibleCategories={visible} layers={layers} onPick={open} />}
              {selected ? (
                <PoiSheet />
              ) : (
                <>
                  <div className="chips">
                    <button className={category === null ? "on" : ""} onClick={() => setCategory(null)}>All</button>
                    {categories.map((c) => (
                      <button key={c.id} className={category === c.id ? "on" : ""} style={{ ["--chip" as string]: c.color }} onClick={() => setCategory(c.id)} title={c.description}>
                        {c.label} <small>{c.count}</small>
                      </button>
                    ))}
                  </div>
                  <input className="search" placeholder="Search places…" value={query} onChange={(e) => setQuery(e.target.value)} />
                  <PoiList category={category} query={query} onPick={open} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
