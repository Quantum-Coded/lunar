# Drop the Rover — Research & Data Reference

> Auto-generated research document. Updated: 2026-09-19.

---

## 1. NASA-IBM Lunar Foundation Model — Overview

**Model family:** `nasa-ibm-ai4science` org on Hugging Face  
**Architecture:** ViT-B (Vision Transformer) encoder-decoder, trained from scratch on "SomBench" — ~2 million co-registered lunar tile bundles combining 9 instruments across 4 missions  
**Tech report:** `NI_LFM_Technical_Report.pdf` in the GitHub repo  
**GitHub:** https://github.com/NASA-IMPACT/NASA-IBM-Lunar-Foundation-Model  
**Primary tooling:** TerraTorch (IBM geospatial foundation model toolkit)

### Modalities supported (11 total)
- Dense imagery: **LROC NAC** (~1 m/px) and **LROC WAC** (~100 m/px)
- Auxiliary bands: elevation, illumination angles, solar-frame anchors, tile footprint tokens

### Key architectural facts
- **Input tile size:** 256×256 pixels (ViT patches of 16×16 or 8×8)
- **Illumination geometry is a first-class input** — sun position/angles fed as explicit encoder tokens
- **Late fusion:** each modality tokenized independently, concatenated along sequence axis
- **FlexiViT:** adaptable to different patch sizes or modality subsets

---

## 2. Downstream Task Models

### 2.1 Ice-Prospectivity Model
**HF Repo:** `nasa-ibm-ai4science/Ice-Prospectivity-NASA-IBM-Lunar-Foundation-Model`  
**Task type:** Image-to-Image (dense regression)  
**Output:** Per-pixel prospectivity map — probability water ice exists in upper ~1 m of regolith  
**Output nature:** "Knowledge-driven fuzzy-overlay" — NOT calibrated measurements; suitable for visualization  
**Input:** LROC NAC/WAC tiles (256×256) + illumination geometry tokens  
**Pipeline:** Tile hotspot imagery → run model → mosaic outputs back into a single raster  

### 2.2 Crater-Detection Model
**HF Repo:** `nasa-ibm-ai4science/Crater-Detection-NASA-IBM-Lunar-Foundation-Model`  
**Task type:** Object detection  
**Output:** Bounding boxes with confidence scores in tile-local pixel coordinates  
**Config files provided:** `NAC_config.yaml`, `WAC_config.yaml`  
**Post-processing:** Convert tile-local pixel coords → hotspot-global coords (add tile offset)  

### 2.3 IMP-Segmentation Model
**HF Repo:** `nasa-ibm-ai4science/IMP-Segmentation-NASA-IBM-Lunar-Foundation-Model`  
**Task type:** Image segmentation (per-pixel class labels)  
**Output:** Per-pixel terrain class map (Irregular Mare Patches, regolith types, volcanic features)  
**Use in project:** Terrain class per grid cell → feeds hazard cost calculation for A* pathfinding  

### 2.4 Base Feature Extractor
**HF Repo:** `nasa-ibm-ai4science/NASA-IBM-Lunar-Foundation-Model`  
**Role:** Backbone encoder — check each task model card to see if base is a separate dependency or bundled in the fine-tuned checkpoint  

---

## 3. Inference Pipeline (Offline, RTX 4050 / 6GB VRAM)

### Environment setup
```bash
pip install terratorch transformers huggingface_hub
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
pip install rasterio Pillow numpy scipy
```

### TerraTorch CLI inference pattern
```bash
terratorch predict \
  --config configs/NAC_config.yaml \
  --ckpt_path weights/crater_detection.ckpt \
  --predict_output_dir output/
```

### Step-by-step pipeline
1. `snapshot_download()` each task model from HF
2. Export hotspot imagery + elevation from Moon Trek (see §4)
3. Tile the export into 256×256 patches, apply normalization + illumination geometry tokens
4. Run Ice-Prospectivity → per-tile output images → mosaic into one raster
5. Run Crater-Detection → bounding boxes → convert to global coords → export JSON
6. Run IMP-Segmentation → per-tile class maps → mosaic into one raster
7. Fuse onto common 256×256 (or 512×512) navigation grid
8. Export web assets: ice heatmap PNG, crater JSON, terrain PNG, nav_grid JSON

### Navigation grid cell schema
```json
{
  "ice_probability": 0.73,
  "terrain_class": "regolith",
  "in_crater": false,
  "hazard_cost": 1.2
}
```

### Hazard cost formula
```
hazard_cost = 1.0
  + (3.0 × in_crater)
  + (2.0 × (slope > 15°))
  + (1.0 × (terrain_class == "steep_wall"))
# Ice = opportunity not hazard; low ice_probability adds a small bonus
```

### Memory tips for 6GB VRAM
- Use `torch.float16` (half precision) — halves memory usage
- Process tiles in batches of 4–8
- Clear CUDA cache between model runs: `torch.cuda.empty_cache()`

---

## 4. Data Sources

### 4.1 Global Moon Shell — Tier 1

| Asset | Source | Format | Notes |
|-------|--------|--------|-------|
| Color texture | NASA SVS — LRO WAC Global Mosaic | JPG | 4K–8K resolution for web |
| Heightmap (DEM) | NASA PGDA / PDS Geosciences LOLA GDR | GeoTIFF → PNG | Convert via GDAL |

**Download URLs:**
- SVS basemap: https://svs.gsfc.nasa.gov (search "LRO WAC Global Mosaic")
- LOLA data: https://pgda.gsfc.nasa.gov or https://pds-geosciences.wustl.edu/missions/lro/lola.htm
- Moon Trek (GUI): https://trek.nasa.gov/moon

### 4.2 Hotspot Zone — South Pole / Shackleton — Tier 2

**Bounding box:** ~89–90°S, focused area around Shackleton Crater  
**Source:** Moon Trek export — draw bounding box, export GeoTIFF  
**What to export:**
- High-res LRO NAC imagery (model input)
- Elevation/DEM (terrain heightmap for frontend)
- Illumination metadata: sun elevation angle (required for model input)

**Alternative:** Check HF Datasets for the SomBench dataset — pre-tiled matching-format tiles skip custom preprocessing

### 4.3 GDAL Conversion Commands
```bash
# Convert LOLA GeoTIFF (16/32-bit) to 8-bit PNG for Three.js displacement map
gdal_translate -of PNG -ot Byte -scale input.tif moon_heightmap.png

# Reproject to equirectangular (EPSG:4326) if needed
gdalwarp -t_srs EPSG:4326 input.tif reprojected.tif
```

---

## 5. Frontend Architecture

### Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) + TypeScript |
| 3D rendering | Three.js + @react-three/fiber + @react-three/drei |
| Post-processing FX | @react-three/postprocessing (bloom, vignette) |
| State management | Zustand (lightweight global store for scene state) |
| UI animations | Framer Motion (HUD panels, transitions) |
| Pathfinding | Plain TypeScript A* (client-side, over nav_grid.json) |
| Hosting | Vercel (Next.js native) |
| Large asset CDN | Vercel Blob or Cloudflare R2 |

### Key npm packages
```json
{
  "three": "^0.170",
  "@react-three/fiber": "^8",
  "@react-three/drei": "^9",
  "@react-three/postprocessing": "^2",
  "zustand": "^5",
  "framer-motion": "^11"
}
```

### Monorepo folder structure
```
lunar/
├── pipeline/
│   ├── scripts/
│   │   ├── 01_download_models.py
│   │   ├── 02_download_data.py
│   │   ├── 03_tile_and_preprocess.py
│   │   ├── 04_run_ice_model.py
│   │   ├── 05_run_crater_model.py
│   │   ├── 06_run_terrain_model.py
│   │   └── 07_fuse_and_export.py
│   ├── configs/                   ← TerraTorch YAML configs
│   ├── requirements.txt
│   └── README.md
│
└── web/
    ├── public/
    │   └── data/
    │       ├── global/
    │       │   ├── moon_texture.jpg        (4K–8K)
    │       │   └── moon_heightmap.png      (1K–2K)
    │       └── hotspots/
    │           └── south_pole/
    │               ├── base_texture.jpg
    │               ├── heightmap.png
    │               ├── ice_heatmap.png
    │               ├── terrain_classes.png
    │               ├── craters.json
    │               └── nav_grid.json
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   └── page.tsx            ← Entry: renders <MissionScene />
    │   ├── components/
    │   │   ├── scene/
    │   │   │   ├── MissionScene.tsx         ← Root R3F Canvas
    │   │   │   ├── GlobalMoon.tsx           ← Tier 1 sphere + orbit controls
    │   │   │   ├── DropSequence.tsx         ← Rover free-fall animation
    │   │   │   ├── RedirectSequence.tsx     ← Case B: redirect animation
    │   │   │   ├── HotspotTerrain.tsx       ← Tier 2 terrain patch + overlays
    │   │   │   ├── Rover.tsx                ← glTF rover model + path animation
    │   │   │   └── PathTrail.tsx            ← Rover path visualization
    │   │   └── hud/
    │   │       ├── HUDOverlay.tsx           ← Root HUD wrapper
    │   │       ├── LayerTogglePanel.tsx     ← Ice/Craters/Terrain layer buttons
    │   │       ├── InfoPanel.tsx            ← Distance, hazard, confidence readouts
    │   │       ├── MissionStatus.tsx        ← Status messages / log
    │   │       └── DropAgainButton.tsx
    │   ├── lib/
    │   │   ├── pathfinding/
    │   │   │   └── astar.ts                ← A* implementation
    │   │   ├── scene-state/
    │   │   │   └── store.ts                ← Zustand store
    │   │   ├── data-loaders/
    │   │   │   └── hotspot.ts              ← Load nav_grid, craters, heatmaps
    │   │   └── utils/
    │   │       ├── coordinates.ts          ← lat/lon ↔ 3D sphere coords
    │   │       └── hotspot-registry.ts     ← Hotspot bounding boxes
    │   └── types/
    │       └── index.ts
    └── package.json
```

---

## 6. Rover 3D Model

**Source options (in priority order):**
1. **NASA 3D Resources** — https://science.nasa.gov/get-involved/3d-resources/ — free, accurate, glTF/USDZ
   - Look for: VIPER rover, Lunar Roving Vehicle (Apollo), Volatiles Investigating Polar Exploration Rover
2. **Sketchfab** — filter: downloadable + glTF + CC license
3. **Custom low-poly** — fallback if no suitable license found

**Required animation clips:** `idle`, `driving`, `turning`  
If purchased model lacks clips: drive wheel rotation and suspension via Three.js morph targets or manual rotation in the Rover component.

---

## 7. Risks & Open Questions

| # | Risk | Mitigation |
|---|------|-----------|
| 1 | Model preprocessing complexity (illumination tokens) | Check SomBench dataset on HF for pre-formatted tiles; read model card example notebook carefully |
| 2 | TerraTorch breaking changes | Pin version in requirements.txt; test inference immediately after env setup |
| 3 | Large asset file sizes (>100MB) | Compress to WebP/JPEG ~75%, host on Vercel Blob or Cloudflare R2, lazy-load |
| 4 | Rover model license | Verify before using; NASA 3D Resources assets are generally free |
| 5 | VRAM limits on RTX 4050 (6GB) | Use float16, batch size 4–8, clear cache between models |
| 6 | Moon Trek export resolution limits | Test export at max available resolution; fallback to PDS direct download |

---

## 8. Attribution & Honesty Requirements (from PRD §11)

- Label hotspot boundary as **"Surveyed Zone"** badge on map
- Caption overlays: *"Precomputed from NASA-IBM Lunar Foundation Model"*
- Do NOT claim real-time inference
- LinkedIn post credit: NASA Marshall Space Flight Center + IBM Research
- Model outputs = "knowledge-driven fuzzy overlays," not mission-grade measurements

---

*Research pass completed: 2026-09-19 | Sources: HF model cards, GitHub README, TerraTorch docs, Moon Trek portal, NASA PDS*
