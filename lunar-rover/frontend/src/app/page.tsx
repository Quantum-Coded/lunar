"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { TerrainStreamer } from "@/lib/terrain/streamer";
import { useGame } from "@/state/store";
import { Hud } from "@/ui/hud/Hud";
import { InfoCard } from "@/ui/hud/InfoCard";
import { LoadingScreen } from "@/ui/hud/LoadingScreen";
import { TouchControls } from "@/ui/hud/TouchControls";
import { PhoneGps } from "@/ui/gps/PhoneGps";
import { WelcomeModal } from "@/ui/about/WelcomeModal";

// WebGL only exists in the browser.
/** True when the browser can create a WebGL context (some locked-down or very old browsers cannot). */
function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const GameCanvas = dynamic(() => import("@/game/GameCanvas"), { ssr: false });

export default function Page() {
  const ready = useGame((s) => s.streamer !== null);
  const [gpsOpen, setGpsOpen] = useState(false);
  const [webgl, setWebgl] = useState(true);
  useEffect(() => setWebgl(hasWebGL()), []);

  useEffect(() => {
    const { setBootData, setStreamer, setLoadError } = useGame.getState();
    let cancelled = false;
    (async () => {
      const [region, categories, zoneFacts, allPois] = await Promise.all([
        api.region(), api.categories(), api.zoneFacts(), api.pois({ limit: 2000 }),
      ]);
      if (cancelled) return;
      setBootData({ region, categories, zoneFacts, allPois, poles: allPois.filter((p) => p.pole) });
      const streamer = new TerrainStreamer(region);
      streamer.preload(2);
      setStreamer(streamer);
    })().catch((e) => setLoadError(`Could not reach the lunar data server (${e.message}). Is the backend running?`));
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="layout">
      <section className="viewport">
        {ready && webgl && <div className="world"><GameCanvas /></div>}
        {!webgl && <div className="loading"><div className="loading-card"><div className="loading-title">LUNAR ROVER</div><p className="loading-error">This game needs WebGL, which your browser does not support or has disabled. Try a recent Chrome, Edge, Firefox or Safari.</p></div></div>}
        {ready && <Hud />}
        {ready && <InfoCard />}
        {ready && <TouchControls />}
        {ready && <button className="gps-toggle" onClick={() => setGpsOpen((o) => !o)}>{gpsOpen ? "Close GPS" : "GPS"}</button>}
        {ready && <WelcomeModal />}
        <LoadingScreen />
      </section>
      <aside className={`sidebar${gpsOpen ? " open" : ""}`}>
        <PhoneGps />
      </aside>
    </main>
  );
}
