"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PoiSummary } from "@/lib/api/types";
import { toWorldX, toWorldZ } from "@/lib/world/coords";
import { useGame } from "@/state/store";

const PIN_SCALE = 0.042;
const PIN_VISIBLE_M = 150_000;
const LABEL_VISIBLE_M = 35_000;
const MAX_LABELS = 8;

function pinTexture(color: string): THREE.Texture {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(6,10,20,0.85)";
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "bold 54px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("i", size / 2, size / 2 + 3);
  return new THREE.CanvasTexture(canvas);
}

function labelTexture(text: string, sub: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 112;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(6,10,20,0.78)";
  ctx.beginPath();
  ctx.roundRect(4, 4, 504, 104, 18);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#f4f7ff";
  ctx.font = "600 40px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(text.length > 24 ? `${text.slice(0, 23)}…` : text, 24, 44);
  ctx.fillStyle = color;
  ctx.font = "28px system-ui, sans-serif";
  ctx.fillText(sub, 24, 84);
  return new THREE.CanvasTexture(canvas);
}

/** Height of the pole: tall enough to be spotted from far away (craters get a taller one). */
function poleHeight(p: PoiSummary): number {
  const depth = typeof p.props.depth_m === "number" ? p.props.depth_m : 0;
  return Math.min(Math.max(250, depth * 0.5 + 250), 2500);
}

interface PoleObjects {
  poi: PoiSummary;
  pin: THREE.Sprite;
  line: THREE.Line;
  label?: THREE.Sprite;
  top: THREE.Vector3;
}

/** "Information poles": a pin on a mast above every notable feature; the nearest ones also show a name tag. */
export function InfoPoles() {
  const poles = useGame((s) => s.poles);
  const categories = useGame((s) => s.categories);
  const root = useRef<THREE.Group>(null);
  const built = useRef<PoleObjects[]>([]);

  const textures = useMemo(() => {
    const map = new Map<string, THREE.Texture>();
    categories.forEach((c) => map.set(c.id, pinTexture(c.color)));
    return map;
  }, [categories]);
  const colorOf = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories]);

  useEffect(() => {
    const group = root.current;
    if (!group) return;
    const objs: PoleObjects[] = poles.map((poi) => {
      const base = new THREE.Vector3(toWorldX(poi.x), poi.elevation_m, toWorldZ(poi.y));
      const top = base.clone().add(new THREE.Vector3(0, poleHeight(poi), 0));
      const color = colorOf.get(poi.category) ?? "#ffffff";
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([base, top]),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }),
      );
      const pin = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.get(poi.category), sizeAttenuation: false, transparent: true, depthWrite: false }));
      pin.scale.setScalar(PIN_SCALE);
      pin.position.copy(top);
      group.add(line, pin);
      return { poi, pin, line, top };
    });
    built.current = objs;
    return () => {
      objs.forEach(({ pin, line, label }) => {
        group.remove(pin, line);
        pin.material.dispose();
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
        if (label) { group.remove(label); label.material.map?.dispose(); label.material.dispose(); }
      });
      built.current = [];
    };
  }, [poles, textures, colorOf]);

  useFrame(({ camera }) => {
    const group = root.current;
    if (!group) return;
    const withDistance = built.current.map((o) => ({ o, d: o.top.distanceTo(camera.position) }));
    const labelled = new Set(
      withDistance.filter((e) => e.d < LABEL_VISIBLE_M).sort((a, b) => a.d - b.d).slice(0, MAX_LABELS).map((e) => e.o),
    );
    for (const { o, d } of withDistance) {
      const visible = d < PIN_VISIBLE_M;
      o.pin.visible = o.line.visible = visible;
      // Pins grow slightly when the rover is on top of them so they read as "you are here".
      o.pin.material.opacity = visible ? Math.min(1, 1.6 - d / PIN_VISIBLE_M) : 0;
      if (labelled.has(o)) {
        if (!o.label) {
          o.label = new THREE.Sprite(new THREE.SpriteMaterial({
            map: labelTexture(o.poi.name, o.poi.kind, colorOf.get(o.poi.category) ?? "#fff"),
            sizeAttenuation: false, transparent: true, depthWrite: false,
          }));
          o.label.scale.set(0.2, 0.2 * (112 / 512), 1);
          o.label.center.set(0.5, -0.45);
          o.label.position.copy(o.top);
          group.add(o.label);
        }
        o.label.visible = true;
      } else if (o.label) {
        o.label.visible = false;
      }
    }
  });

  return <group ref={root} />;
}
