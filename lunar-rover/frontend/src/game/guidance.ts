import { api } from "@/lib/api/client";
import { toRegionX, toRegionY } from "@/lib/world/coords";
import { roverPose } from "@/state/roverPose";
import { useGame } from "@/state/store";

/** Plans a route from the rover to a place and starts the auto-driver. Rejects with a readable message. */
export async function guideTo(poiId: string): Promise<void> {
  const goal = await api.poi(poiId);
  const route = await api.route([toRegionX(roverPose.x), toRegionY(roverPose.z)], [goal.x, goal.y]);
  const state = useGame.getState();
  state.setActiveRoute({ goal, route });
  state.setAutopilot(true);
}
