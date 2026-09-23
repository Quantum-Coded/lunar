# Lunar Pipeline — NASA-IBM Foundation Model Integration

This directory houses the offline data preprocessing, model inference, and fusion pipeline for the **Drop the Rover** lunar simulation.

## Verified Model Specifications

### 1. Polar Ice Prospectivity (`nasa-ibm-ai4science/Ice-Prospectivity-NASA-IBM-Lunar-Foundation-Model`)
- **Architecture:** ViT-B (patch size 8) with dense regression head (`ni_lfm_ps8_all_modalities_s42.ckpt`)
- **Input Modalities:** 8-band polar map stack (LROC NAC/WAC reflectance, LOLA elevation/slope/roughness, Diviner temperature maximums/averages, illumination fraction)
- **Tile Dimension:** 256×256 pixels
- **Output:** Continuous float [0.0 - 1.0] representing regolith water-ice prospectivity index in upper ~1 meter
- **Scientific Framing:** Knowledge-driven fuzzy overlay exploration target aid (NASA/IBM AI4Science)

### 2. Crater Detection (`nasa-ibm-ai4science/Crater-Detection-NASA-IBM-Lunar-Foundation-Model`)
- **Architecture:** ViT-B + LoRA adaptation with Faster R-CNN detection head (`NAC_ni_lfm_ps8_s44.ckpt` / `WAC_ni_lfm_ps8_lora_s46.ckpt`)
- **Input Modalities:** LROC NAC / WAC tiles (256×256)
- **Output:** Bounding circles `{x, y, radius, confidence, depth_m}` normalized to [0.0 - 1.0] range
- **Catalog Ground Truth:** Calibrated to Robbins Lunar Crater Catalog benchmark

### 3. IMP Terrain Segmentation (`nasa-ibm-ai4science/IMP-Segmentation-NASA-IBM-Lunar-Foundation-Model`)
- **Architecture:** ViT-B frozen backbone + semantic segmentation decoder (`ni_lfm_ps8_frozen_s44.ckpt`)
- **Input:** 256×256 reflectance + topographic slope patches
- **Class Labels:**
  - `0`: Regolith plain (`regolith_plain`) — safe traverse
  - `1`: Crater rim ridge (`crater_rim_ridge`) — moderate incline
  - `2`: Blocky ejecta / boulder fields (`blocky_ejecta`) — obstacle risk
  - `3`: Steep crater walls (`steep_crater_wall`) — high hazard
  - `4`: Permanently shadowed cold-traps (`permanently_shadowed_floor`) — volatile target

---

## Execution Pipeline

Run the pipeline sequentially:
```bash
cd pipeline
.\.venv\Scripts\python scripts\00_smoke_test.py          # 1. Environment & GPU smoke test
.\.venv\Scripts\python scripts\02_download_data.py         # 2. Acquire NASA SVS & LOLA basemaps
.\.venv\Scripts\python scripts\03_tile_and_preprocess.py  # 3. Compute solar angles & slice tiles
.\.venv\Scripts\python scripts\04_run_ice_model.py        # 4. Generate ice prospectivity heatmap
.\.venv\Scripts\python scripts\05_run_crater_model.py     # 5. Extract crater detections
.\.venv\Scripts\python scripts\06_run_terrain_model.py    # 6. Compute semantic terrain classes
.\.venv\Scripts\python scripts\07_fuse_and_export.py      # 7. Synthesize 256x256 nav_grid.json and copy assets to web/public/data/
```

## Navigation Grid & Hazard Formulation

The fusion step produces `nav_grid.json` (256×256 array):
```python
hazard_cost = 1.0 + (3.0 * in_crater) + (2.0 * (slope > 15°)) + (1.0 * (terrain_class == "steep_crater_wall"))
```
When `ice_probability > 0.6`, a bonus discount is applied to guide the autonomous rover toward high-yield volatile deposits.
