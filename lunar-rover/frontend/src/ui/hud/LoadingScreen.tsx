"use client";

import { useEffect, useState } from "react";
import { useGame } from "@/state/store";
import { roverPose } from "@/state/roverPose";

/** Covers the viewport until the backend data is in and the rover is sitting on real terrain. */
export function LoadingScreen() {
  const error = useGame((s) => s.loadError);
  const region = useGame((s) => s.region);
  const streamer = useGame((s) => s.streamer);
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    if (!streamer) return;
    const timer = setInterval(() => {
      if (roverPose.placed && streamer.finestLevelAt(roverPose.x, roverPose.z) === streamer.info.max_level) {
        setPlaced(true);
        clearInterval(timer);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [streamer]);

  if (placed && !error) return null;
  return (
    <div className="loading">
      <div className="loading-card">
        <div className="loading-title">LUNAR ROVER</div>
        {error ? (
          <p className="loading-error">{error}</p>
        ) : (
          <>
            <p>{region ? `Streaming ${region.name} terrain from NASA LOLA data…` : "Contacting the lunar data server…"}</p>
            <div className="loading-bar"><div /></div>
          </>
        )}
      </div>
    </div>
  );
}
