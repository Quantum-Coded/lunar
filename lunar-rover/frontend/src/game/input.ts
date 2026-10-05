import { useEffect } from "react";
import { useGame } from "@/state/store";

/** Currently held drive inputs (keyboard or on-screen buttons); read every frame by the simulation. */
export const drive = { throttle: 0, steer: 0, brake: false };

const DRIVE_KEYS = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "];
const held = new Set<string>();

function refresh() {
  drive.throttle = (held.has("w") || held.has("arrowup") ? 1 : 0) - (held.has("s") || held.has("arrowdown") ? 1 : 0);
  drive.steer = (held.has("d") || held.has("arrowright") ? 1 : 0) - (held.has("a") || held.has("arrowleft") ? 1 : 0);
  drive.brake = held.has(" ");
}

/** Start holding a drive input. Any manual input hands control back from the autopilot. */
export function press(key: string) {
  held.add(key);
  refresh();
  if (key !== " " && useGame.getState().autopilot) useGame.getState().setAutopilot(false);
}

export function release(key: string) {
  held.delete(key);
  refresh();
}

/** Keyboard shortcuts: WASD / arrow keys / Space to drive, Q / E (or - / +) for top speed, Escape to close an info card. */
export function useKeyboardControls() {
  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => (e.target as HTMLElement)?.tagName === "INPUT";
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const key = e.key.toLowerCase();
      if (DRIVE_KEYS.includes(key)) {
        e.preventDefault();
        press(key);
        return;
      }
      const state = useGame.getState();
      if (key === "e" || key === "+" || key === "=") state.changeSpeedLevel(1);
      if (key === "q" || key === "-" || key === "_") state.changeSpeedLevel(-1);
      if (key === "escape" && state.nearbyPole) state.dismissPole(state.nearbyPole.id);
    };
    const up = (e: KeyboardEvent) => release(e.key.toLowerCase());
    const blur = () => {
      held.clear();
      refresh();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
}
