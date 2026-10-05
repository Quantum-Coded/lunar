"use client";

import { useState } from "react";
import { describe, plainWhy } from "@/lib/plainLanguage";
import { useGame } from "@/state/store";
import { coverageSentence } from "./Coverage";

const SEEN_KEY = "lunar-rover:welcome-seen";

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false; // storage blocked (private mode): fall back to showing it each visit
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** First thing a visitor sees: where they start (in plain words) and how little of the Moon this covers. */
export function WelcomeModal() {
  const region = useGame((s) => s.region);
  const poles = useGame((s) => s.poles);
  const [open, setOpen] = useState(() => !alreadySeen());
  if (!open || !region) return null;
  const start = new URLSearchParams(window.location.search).get("poi");
  const spawn = poles.find((p) => p.id === start) ?? poles.find((p) => p.category === "sunlit") ?? poles[0];
  return (
    <div className="welcome">
      <div className="welcome-card">
        <h2>Welcome to the Moon&apos;s south pole</h2>
        {spawn && (
          <p>
            You are starting on <b>{describe(spawn)}</b>. {plainWhy(spawn.kind)}
          </p>
        )}
        <p>Drive with <b>W A S D</b> (or the on-screen pad on a touch screen). The phone GPS helps you find water-ice sites, craters and sunny ridges.</p>
        <p className="welcome-warning">
          <b>Coverage disclaimer:</b> this game covers only {coverageSentence(region)}. Everything outside the area south of
          roughly 80°S is not included. Terrain shape is real NASA data; ground colour, stars and the Sun&apos;s motion are
          generated. See the <b>About</b> page (top right) for details.
        </p>
        <p className="rotate-tip">Tip: on a phone, turning it sideways (landscape) gives a much bigger view.</p>
        <button onClick={() => { markSeen(); setOpen(false); }}>Start driving</button>
      </div>
    </div>
  );
}
