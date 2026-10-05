import * as THREE from "three";

const vertexShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec2 vUv;
  varying float vViewDist;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalW = normal;
    vUv = uv;
    vec4 view = viewMatrix * world;
    vViewDist = length(view.xyz);
    gl_Position = projectionMatrix * view;
    #include <logdepthbuf_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uData;
  uniform vec3 uSunDir;
  uniform vec3 uLampPos;
  uniform vec3 uLampDir;
  uniform float uLampOn;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec2 vUv;
  varying float vViewDist;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    #include <logdepthbuf_fragment>
    vec4 data = texture2D(uData, vUv);
    if (data.a < 0.5) discard;
    float shadow = data.g;

    // Visual-only relief detail layered on the real terrain (physics uses the DEM only). Each octave fades out
    // before it would alias: fine grain close to the rover, broader undulation further away.
    float fine = 1.0 - smoothstep(10.0, 90.0, vViewDist);
    float broad = 1.0 - smoothstep(80.0, 2500.0, vViewDist);
    vec2 p = vWorld.xz;
    float e = 0.3;
    float f0 = fbm(p * 0.9);
    vec2 fineGrad = vec2(fbm((p + vec2(e, 0.0)) * 0.9) - f0, fbm((p + vec2(0.0, e)) * 0.9) - f0) / e;
    float e2 = 6.0;
    float b0 = fbm(p * 0.07);
    vec2 broadGrad = vec2(fbm((p + vec2(e2, 0.0)) * 0.07) - b0, fbm((p + vec2(0.0, e2)) * 0.07) - b0) / e2;
    vec3 N = normalize(vNormalW + fine * 0.25 * vec3(-fineGrad.x, 0.0, -fineGrad.y) + broad * 0.45 * vec3(-broadGrad.x, 0.0, -broadGrad.y));

    float mottling = 0.88 + 0.24 * fbm(p * 0.02) + 0.10 * (f0 - 0.5) * fine;
    vec3 albedo = vec3(0.55, 0.53, 0.50) * 0.48 * mottling;

    float direct = max(dot(N, uSunDir), 0.0) * (1.0 - shadow);
    vec3 light = vec3(1.0, 0.97, 0.92) * direct * 2.1 + vec3(0.30, 0.34, 0.42) * 0.035;
    // Rover headlamp: a soft cone that makes permanently shadowed ground drivable.
    vec3 toFrag = vWorld - uLampPos;
    float lampDist = length(toFrag);
    float cone = smoothstep(0.78, 0.93, dot(toFrag / max(lampDist, 0.001), uLampDir));
    float lampNeed = 0.2 + 0.8 * shadow;
    float lamp = uLampOn * lampNeed * cone * max(dot(N, -toFrag / max(lampDist, 0.001)), 0.0) * 14.0 / (1.0 + lampDist * lampDist / 900.0);
    light += vec3(1.0, 0.95, 0.85) * lamp;
    vec3 col = albedo * light;
    col = mix(col, col * vec3(0.7, 0.88, 1.2), shadow * 0.55);


    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Uniforms shared by every tile material, so changing the sun or overlay updates all tiles at once. */
export interface SharedTerrainUniforms {
  uSunDir: THREE.IUniform<THREE.Vector3>;
  uLampPos: THREE.IUniform<THREE.Vector3>;
  uLampDir: THREE.IUniform<THREE.Vector3>;
  uLampOn: THREE.IUniform<number>;
}

export function createSharedUniforms(): SharedTerrainUniforms {
  return {
    uSunDir: { value: new THREE.Vector3(0.7, 0.07, 0.7).normalize() },
    uLampPos: { value: new THREE.Vector3() },
    uLampDir: { value: new THREE.Vector3(0, 0, -1) },
    uLampOn: { value: 1 },
  };
}

export function createTerrainMaterial(shared: SharedTerrainUniforms, data: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
    uniforms: { uData: { value: data }, ...shared },
  });
}
