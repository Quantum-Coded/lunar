/**
 * Live rover pose, mutated every frame by the simulation and read by renderers (3D rover, GPS canvas).
 * Kept outside React state so 60 Hz updates cause no re-renders; the store holds a throttled copy for text UI.
 */
export interface RoverPose {
  /** World position in metres (Y-up scene, north = -Z). */
  x: number;
  y: number;
  z: number;
  /** Map bearing in degrees: 0 = north, 90 = east. */
  headingDeg: number;
  pitchRad: number;
  rollRad: number;
  speed: number;
  wheelAngle: number;
  /** Set once the simulation has placed the rover on real terrain. */
  placed: boolean;
}

export const roverPose: RoverPose = {
  x: 0, y: 0, z: 0, headingDeg: 0, pitchRad: 0, rollRad: 0, speed: 0, wheelAngle: 0, placed: false,
};
