# PRD: "Drop the Rover" — An Interactive Lunar Navigation Simulation
### Powered by the NASA-IBM Lunar Foundation Model

---

## 1. Purpose & Vision

**One-liner:** A "Google Maps for the Moon" experience where a user drops a rover from orbit onto a real, textured 3D Moon. If it lands in a scientifically-analyzed zone, the rover autonomously plans a path toward the nearest ice deposit using real NASA/IBM AI model outputs (ice heatmaps, crater detection, terrain segmentation) — avoiding hazards via classical pathfinding. If it lands outside an analyzed zone, mission control "redirects" it with a dramatic recalculating-trajectory animation to the nearest real zone.

**Why this project works:**
- Visually impressive (3D Moon, orbital drop, glowing heatmaps, animated rover) — built for a LinkedIn demo video
- Scientifically honest — every navigable decision is backed by real, citable model output, not fabricated data
- Logically complete — it's not just eye candy; there's a real algorithm (pathfinding over AI-derived hazard/opportunity maps) doing the work
- Buildable solo, on a laptop with an RTX 4050, in inference-only mode (no training required), deployable free-tier

**Target audience for the demo:** LinkedIn technical audience — recruiters, researchers, fellow builders. The post should read as "I understood a real foundation model well enough to build a product on it," not "I called an API."

---

## 2. Scope Definition (Read This First)

The NASA-IBM Lunar Foundation Model family has near-global underlying data, but processing the **entire** Moon at usable resolution with all three task models is not feasible solo in a short timeframe (compute + storage). This PRD deliberately uses a **two-tier map strategy**:

| Tier | Coverage | Fidelity | Purpose |
|---|---|---|---|
| **Tier 1 — Global Shell** | Full Moon | Low-res but real (public LRO/LOLA mosaics) | The sphere the rover falls toward; gives geographic legitimacy |
| **Tier 2 — Hotspot Zone(s)** | 1–2 regions (e.g. Shackleton crater / south pole, + one mare region) | High-res, fully processed by all 3 models | Where actual AI-driven navigation happens |

**Landing logic:** random drop point on Tier 1 → if inside a Tier 2 hotspot polygon, zoom in and navigate normally → if outside, play a "no scientific survey data at this location — recalculating trajectory" animation and redirect to the nearest hotspot. This keeps 100% of visible outputs scientifically real.

---

## 3. Core User Flow

1. **Landing page / hero**: 3D Moon rendered in space, stars, subtle rotation. Single CTA: "Drop Rover."
2. **Drop sequence**: rover model free-falls from off-screen toward a randomized point on the globe (camera follows).
3. **Landing resolution**:
   - **Case A (in hotspot):** impact animation (dust puff, camera zooms to surface level) → HUD fades in.
   - **Case B (outside hotspot):** short "signal lost / recalculating" sequence → rover animates a hop/redirect arc to nearest hotspot → then proceeds as Case A.
4. **Surface mode**: user sees the rover on a heightmapped terrain patch with togglable overlay layers (Ice Probability / Craters / Terrain Type). A HUD shows: nearest ice distance + confidence %, terrain hazard, current layer.
5. **Interaction**: user clicks anywhere on the visible terrain → pathfinding algorithm computes a route from rover's current position to that point (or to a "Find Nearest Ice" button target) avoiding high-hazard cells → rover animates along the path, wheels/tracks turning, leaving a trail.
6. **Replay/reset**: "Drop Again" button resets to step 1 for a new random landing — good for a demo loop in a recorded video.

---

## 4. Feature List

### Must-have (v1, weekend-scoped)
- 3D global Moon (Tier 1) with real texture/heightmap, rotatable/zoomable camera (orbit controls)
- Orbital drop animation with physics-lite free-fall (simple eased trajectory, not full physics sim)
- One fully-processed hotspot zone (south pole / Shackleton) with:
  - Ice-probability heatmap overlay (from Ice-Prospectivity model)
  - Crater markers/outlines (from Crater-Detection model)
  - Terrain classification overlay (from IMP-Segmentation model)
- Grid-based hazard/opportunity map combining the three outputs
- A* pathfinding: rover-to-clicked-point and rover-to-nearest-ice "auto" button
- Rover 3D model with idle/drive/turn animation states, moving along computed path
- Redirect animation for off-hotspot landings
- Layer toggle UI (Ice / Craters / Terrain / None)
- HUD: nearest ice distance + confidence, current terrain hazard class
- Fully static frontend, deployed on Vercel

### Nice-to-have (v1.5, if time allows)
- Second hotspot (equatorial mare region) to show terrain diversity
- Click-to-inspect: hover any cell → tooltip with raw ice-probability %, terrain class, crater proximity
- Simple day/night terminator shading on the global shell for atmosphere
- Sound design (thruster hum, landing thud, UI blips) for the demo video

### Explicitly out of scope for v1
- Full-Moon high-res processing
- Real-time/live model inference in the browser (everything is precomputed offline)
- User-uploaded custom coordinates outside hotspots being "really" analyzed (they get the honest redirect instead)
- Multiplayer / persistence / accounts

---

## 5. Data Sources (How to Actually Get the Data)

### 5.1 Tier 1 — Global Moon shell (texture + heightmap)
- **NASA SVS (Scientific Visualization Studio) — "Moon Global Image Mosaic"**: search `svs.gsfc.nasa.gov` for "LRO WAC Global Mosaic" — provides a global color/greyscale basemap (typically available at multiple resolutions, pick a ~4K–8K texture to keep file size reasonable for web).
- **NASA LOLA (Lunar Orbiter Laser Altimeter) Global Elevation Model**: available via the **PDS Geosciences Node** (`pds-geosciences.wustl.edu`) or USGS Astrogeology's **Lunaserv / Moon Trek** portal (`trek.nasa.gov/moon`) — download the global DEM (digital elevation model) at a moderate resolution (e.g., 512px or 1k equirectangular) for use as a displacement map.
- **Moon Trek (trek.nasa.gov/moon)** is the single most convenient source: it lets you export both imagery and elevation layers for custom bounding boxes and resolutions directly as GeoTIFF/PNG — use this as your primary tool for both Tier 1 (global, low-res export) and Tier 2 (hotspot, high-res export).

### 5.2 Tier 2 — Hotspot zone raw imagery (input to the models)
- Same **Moon Trek** tool: draw a bounding box around the south pole (Shackleton crater, ~89–90°S) and export the highest-resolution LRO NAC/WAC imagery available for that box, plus corresponding elevation data.
- Cross-check against the **model cards** on Hugging Face for each of the three fine-tuned models — they specify the exact expected input modalities, resolution, and preprocessing (tile size, normalization, number of channels/bands). Follow those specs exactly; mismatched input format is the most common source of garbage output.
- If the model cards reference the original NASA-IBM training dataset (mentioned as "first open-source lunar dataset," combining 9 instruments across 4 missions), check if that curated dataset is also published on Hugging Face Datasets — if so, prefer pulling matching-format tiles from there over hand-exporting your own, since it guarantees correct preprocessing.

### 5.3 Model repositories (Hugging Face)
- `nasa-ibm-ai4science/Ice-Prospectivity-NASA-IBM-Lunar-Foundation-Model` (Image-to-Image)
- `nasa-ibm-ai4science/Crater-Detection-NASA-IBM-Lunar-Foundation-Model` (Object Detection)
- `nasa-ibm-ai4science/IMP-Segmentation-NASA-IBM-Lunar-Foundation-Model` (Image Segmentation)
- `nasa-ibm-ai4science/NASA-IBM-Lunar-Foundation-Model` (base feature extractor — only needed if a task head requires you to run the base encoder first and feed embeddings into it; check each task repo's model card / example inference script to see if it's a standalone pipeline or requires the base model as a separate step)

**Action item before building anything:** open each of the four Hugging Face pages and read the model card + any provided `inference.py` / example notebook. These will tell you definitively: required input format, whether the base model is a separate dependency, output tensor shape/meaning, and any preprocessing utilities provided. Do this first — it determines your exact pipeline code.

---

## 6. Model Integration Plan (Offline, on your laptop)

This is inference-only. No training. Your RTX 4050 (laptop, likely 6GB VRAM) is sufficient for running these models on a bounded tile set.

### Step-by-step pipeline
1. **Environment setup**: Python venv, install `transformers`/`huggingface_hub`, `torch` (CUDA build matching your driver), `rasterio` or `Pillow` for geospatial image handling, `numpy`.
2. **Download models**: use `huggingface_hub.snapshot_download` for each of the three task repos (skip the base model unless a task repo's code requires it directly).
3. **Prepare hotspot input tiles**: take your Moon Trek export for the south pole region, tile it into the patch size each model expects (from its model card/config), and apply any required normalization.
4. **Run Ice-Prospectivity model** over every tile → collect output images → assemble back into one large ice-probability raster for the hotspot (mosaic the tiles back into their original grid positions).
5. **Run Crater-Detection model** over the same tiles → collect bounding boxes with confidence scores → convert tile-local pixel coordinates back into hotspot-global coordinates (offset by each tile's position).
6. **Run IMP-Segmentation model** over the same tiles → collect per-pixel class maps → mosaic into one terrain-class raster.
7. **Fuse into a navigation grid**: downsample all three outputs onto a common grid (e.g. 256×256 or 512×512 cells covering the hotspot). For each cell store: `ice_probability (0-1)`, `terrain_class (enum)`, `in_crater (bool)`, and a derived `hazard_cost` used by pathfinding (e.g., high inside craters/steep terrain, low on flat regolith).
8. **Export as static web assets**:
   - Ice heatmap → PNG (or compressed float array in a binary/JSON format) for GPU texture overlay
   - Crater list → small JSON array of {x, y, radius, confidence}
   - Terrain classes → PNG (color-coded) or compact JSON grid
   - Navigation grid (hazard costs) → a single compact JSON/binary array the frontend loads once and runs A* over entirely client-side
9. **Repeat for a second hotspot** if doing the nice-to-have.

**Key principle:** all heavy computation happens once, offline, before deployment. The deployed site never calls a model — it only serves precomputed static data. This is what makes free static hosting viable.

---

## 7. Frontend Architecture

### Stack
- **Framework**: Next.js (React) — plays well with Vercel, good static asset handling
- **3D rendering**: `three.js` via `@react-three/fiber` + `@react-three/drei` for camera controls, loaders, helpers
- **State management**: lightweight — React state/context is enough; no need for Redux at this scope
- **Pathfinding**: plain JS/TS implementation of A* running client-side over the precomputed navigation grid (fast enough at 256–512 cell resolution to run instantly in-browser)

### Scene composition
- **GlobalMoon component**: sphere geometry, real texture map + displacement map from Tier 1 data, slow idle rotation, orbit controls enabled
- **DropSequence component**: manages rover free-fall animation (simple eased curve from a fixed "orbit" position down to the randomized landing lat/long, converted to 3D coordinates on the sphere)
- **HotspotTerrain component**: once landed, swap to a detailed plane/patch mesh using the hotspot heightmap, with the fused heatmap/crater/terrain textures as togglable overlay materials (shader `mix()` between overlay and base texture, or simple opacity-blended texture layers)
- **Rover component**: loaded glTF model (a free rover/rocker-bogie asset, or a simple custom low-poly build matching the reference image — six wheels, solar panel, stereo camera mast), with position/rotation driven by the current path animation state
- **PathfindingController**: on terrain click → raycast to get grid cell → run A* from rover's current cell to target cell → produce a list of waypoints → animate rover along them (position lerp/spline + rotate-to-face-direction)
- **HUD/UI overlay**: standard React/HTML overlay (not in the 3D scene) showing layer toggles, distance-to-ice readout, hazard info, "Drop Again" button

### Redirect (Case B) animation
- Short scripted sequence: rover shown "stuck" or a radar-ping visual, text overlay "No survey data at this location — recalculating trajectory," then camera arcs from the random landing point to the nearest hotspot's coordinates, rover re-enters a brief hop/thruster animation, and Case A logic proceeds normally.

---

## 8. Backend / Hosting

**You do not need a traditional backend.** Rationale: all AI inference is precomputed offline; the deployed app only reads static files.

- **Frontend + static assets**: deploy directly on **Vercel** (Next.js first-class support)
- **Large asset storage** (if heatmap/terrain PNGs or global textures exceed comfortable repo size): use **Cloudflare R2** or **Vercel Blob** (both have generous free tiers) and fetch via public URLs at runtime; keep small JSON grids in the repo directly
- **No database needed** — there is no user data, no persistence, no auth for v1
- **No server-side compute needed** — pathfinding runs client-side in the browser

If in the future you want "drop anywhere with real analysis," that would require either pre-processing far more of the Moon (storage-heavy) or a real inference backend (e.g., a small FastAPI service on a GPU-backed host) — explicitly deferred as a v2/roadmap item, not needed for the LinkedIn demo.

---

## 9. "Training Process" — Clarification

No model training is required for this project. You are doing **inference only** using the three pretrained, fine-tuned task models IBM/NASA already published. The only "training-adjacent" work is:
- Correctly preprocessing your input tiles to match each model's expected format (per its model card)
- Optionally, light postprocessing/calibration (e.g., thresholding ice-probability values into discrete "high/medium/low" bands for cleaner visualization) — this is data engineering, not model training.

If you ever wanted to go further (e.g., fine-tune a custom head yourself on top of the base feature-extraction model), that would be a genuine v2 research extension, not necessary for this product/demo.

---

## 10. Final Compilation & Demo Checklist

1. Offline pipeline run → export all static assets (global textures, hotspot heatmap/crater/terrain data, navigation grid) into `/public/data/`
2. Build and test the full user flow locally: drop → land (both Case A and Case B paths) → navigate → reach ice → reset
3. Deploy to Vercel, verify all static assets load correctly from production (check load times — compress/tile large textures if needed)
4. Record the demo video: capture a full loop (drop → redirect case → landing → click-to-navigate → "find nearest ice" auto-path → reaching the target), plus a couple of layer-toggle moments showing the different heatmaps
5. Write the LinkedIn post: lead with the "Google Maps for the Moon" hook, briefly explain the three real NASA/IBM models powering it, link the live Vercel demo, embed the video, credit IBM Research / NASA in the post
6. Optional: publish the offline processing pipeline code as a public repo, linked in the post, so technical viewers can verify it's real model output, not staged data

---

## 11. Risks & Honesty Notes (keep these in mind while building)

- Always label which parts of the map are real model output (hotspot) vs. illustrative global shell — a small "Surveyed Zone" badge/boundary on the map keeps this transparent to viewers
- Do not claim real-time or live inference if everything is precomputed — say "precomputed from NASA/IBM's open-source model" in the post, which is still impressive and is accurate
- IBM's own materials describe this as a research tool, not a validated product — keep the same framing rather than implying operational/mission-grade accuracy