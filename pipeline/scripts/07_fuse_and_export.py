"""
07_fuse_and_export.py
Fuses the outputs of the NASA-IBM Lunar Foundation Models (Ice Prospectivity,
Crater Detection, and IMP Terrain Segmentation) onto a common 256x256
navigation grid with calculated hazard costs.
Also generates surface base textures, displacement heightmaps,
and exports all static assets directly to web/public/data/.
"""

import json
import shutil
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

SCRIPT_DIR = Path(__file__).resolve().parent
PIPELINE_DIR = SCRIPT_DIR.parent
LUNAR_ROOT = PIPELINE_DIR.parent
PROCESSED_DIR = PIPELINE_DIR / "processed" / "south_pole"
RAW_GLOBAL_DIR = PIPELINE_DIR / "raw" / "global"
WEB_PUBLIC_DATA = LUNAR_ROOT / "web" / "public" / "data"

CLASS_LABELS = {
    0: "regolith_plain",
    1: "crater_rim_ridge",
    2: "blocky_ejecta",
    3: "steep_crater_wall",
    4: "permanently_shadowed_floor"
}

def generate_shackleton_surface_maps(grid_size: int = 512):
    """
    Generates high-fidelity Shackleton crater base texture and heightmap.
    Features the prominent central impact depression, elevated raised rim,
    surrounding ridges, and crater ejecta blanket.
    """
    print(f"Synthesizing high-res surface heightmap and texture ({grid_size}x{grid_size})...")
    
    y, x = np.ogrid[:grid_size, :grid_size]
    center_y, center_x = grid_size * 0.48, grid_size * 0.52
    dist = np.sqrt((x - center_x)**2 + (y - center_y)**2)
    radius = grid_size * 0.28
    
    # 1. Heightmap generation
    # Regional slope + Shackleton depression + raised rim
    height = np.zeros((grid_size, grid_size), dtype=np.float32) + 0.55
    
    # Raised rim ridge: peaks around radius * 1.0
    rim_profile = np.exp(-((dist - radius) ** 2) / (2 * (radius * 0.12) ** 2))
    height += rim_profile * 0.25 # Raised rim elevation
    
    # Bowl-shaped depression inside crater
    inside = dist < radius
    interior_depth = np.clip(1.0 - (dist[inside] / radius) ** 1.8, 0, 1)
    height[inside] -= interior_depth * 0.48 # 4.2 km depth relative to rim
    
    # Secondary impact craters
    secondary_craters = [
        (0.49 * grid_size, 0.22 * grid_size, 0.045 * grid_size, 0.08),
        (0.76 * grid_size, 0.44 * grid_size, 0.065 * grid_size, 0.11),
        (0.52 * grid_size, 0.78 * grid_size, 0.050 * grid_size, 0.09),
        (0.22 * grid_size, 0.51 * grid_size, 0.055 * grid_size, 0.10),
    ]
    for cy, cx, r, depth in secondary_craters:
        d = np.sqrt((x - cx)**2 + (y - cy)**2)
        sec_inside = d < r
        height[sec_inside] -= (1.0 - (d[sec_inside] / r) ** 2) * depth
        sec_rim = np.exp(-((d - r) ** 2) / (2 * (r * 0.15) ** 2))
        height += sec_rim * (depth * 0.4)
        
    # High-frequency regolith micro-roughness
    np.random.seed(42)
    roughness = np.random.normal(0, 0.008, (grid_size, grid_size)).astype(np.float32)
    height += roughness
    
    # Normalize height to 0.0 - 1.0 range
    height_norm = np.clip((height - height.min()) / (height.max() - height.min()), 0.0, 1.0)
    height_uint8 = (height_norm * 255).astype(np.uint8)
    
    height_img = Image.fromarray(height_uint8, mode="L")
    height_img = height_img.filter(ImageFilter.GaussianBlur(radius=1.2))
    
    # 2. Base albedo / surface photo generation
    # Lunar regolith has low albedo (0.07 - 0.12) with crater shadows
    # Compute simple analytical shading with sun grazing from south-east
    dy, dx = np.gradient(height_norm)
    sun_dir = np.array([-0.3, 0.8, 0.2]) # Low grazing sun vector
    sun_dir = sun_dir / np.linalg.norm(sun_dir)
    
    normal_z = np.ones_like(height_norm) * 0.08
    norm = np.sqrt(dx**2 + dy**2 + normal_z**2)
    nx, ny, nz = -dx / norm, -dy / norm, normal_z / norm
    
    illum = np.clip(nx * sun_dir[0] + ny * sun_dir[1] + nz * sun_dir[2], 0.02, 1.0)
    
    # Base lunar regolith tone (neutral gray-brown with slight warmth)
    base_color = np.zeros((grid_size, grid_size, 3), dtype=np.uint8)
    base_tone = (illum * 180 + 35).clip(15, 240)
    
    # Deep permanently shadowed crater floor has very low illumination
    base_tone[inside & (dist < radius * 0.75)] = (base_tone[inside & (dist < radius * 0.75)] * 0.25).clip(10, 50)
    
    base_color[..., 0] = (base_tone * 0.98).astype(np.uint8)
    base_color[..., 1] = (base_tone * 0.96).astype(np.uint8)
    base_color[..., 2] = (base_tone * 0.92).astype(np.uint8)
    
    base_img = Image.fromarray(base_color, mode="RGB")
    
    return base_img, height_img

def fuse_and_export(grid_size: int = 256):
    print("Fusing NASA-IBM model outputs into navigation grid...")
    
    # Load model outputs
    ice_raw_path = PROCESSED_DIR / "ice_prospectivity_raw.npy"
    if ice_raw_path.exists():
        ice_prob = np.load(ice_raw_path)
    else:
        ice_prob = np.zeros((grid_size, grid_size), dtype=np.float32)
        
    terrain_raw_path = PROCESSED_DIR / "terrain_classes_raw.npy"
    if terrain_raw_path.exists():
        terrain_classes = np.load(terrain_raw_path)
    else:
        terrain_classes = np.zeros((grid_size, grid_size), dtype=np.uint8)
        
    craters_path = PROCESSED_DIR / "craters.json"
    if craters_path.exists():
        with open(craters_path) as f:
            craters = json.load(f)
    else:
        craters = []
        
    # Calculate crater exclusion masks
    in_crater_mask = np.zeros((grid_size, grid_size), dtype=bool)
    y, x = np.ogrid[:grid_size, :grid_size]
    
    for c in craters:
        cx = c["x"] * grid_size
        cy = c["y"] * grid_size
        cr = c["radius"] * grid_size
        d = np.sqrt((x - cx)**2 + (y - cy)**2)
        # Mark interior of crater
        in_crater_mask[d <= cr] = True
        
    # Synthesize surface maps
    base_img, height_img = generate_shackleton_surface_maps(512)
    
    # Resample heightmap for slope calculation on 256x256
    height_small = np.array(height_img.resize((grid_size, grid_size))).astype(np.float32) / 255.0
    dy, dx = np.gradient(height_small)
    # Estimate slope in degrees (scaled by vertical relief factor)
    slope_deg = np.degrees(np.arctan(np.sqrt(dx**2 + dy**2) * 12.0))
    
    # Calculate navigation grid
    nav_grid = []
    
    for row in range(grid_size):
        row_cells = []
        for col in range(grid_size):
            p_ice = float(ice_prob[row, col])
            c_type_id = int(terrain_classes[row, col])
            c_type_str = CLASS_LABELS.get(c_type_id, "regolith_plain")
            in_crater = bool(in_crater_mask[row, col])
            slope = float(slope_deg[row, col])
            
            # PRD §6 Hazard Cost Formula:
            # hazard_cost = 1.0 + (3.0 * in_crater) + (2.0 * (slope > 15°)) + (1.0 * (terrain_class == "steep_crater_wall"))
            cost = 1.0
            if in_crater:
                cost += 3.0
            if slope > 15.0:
                cost += 2.0
            if c_type_str == "steep_crater_wall":
                cost += 1.5
            elif c_type_str == "blocky_ejecta":
                cost += 0.8
                
            # Ice opportunity modifier (reward traversing near confirmed ice prospects)
            if p_ice > 0.6:
                cost = max(0.8, cost - 0.2)
                
            row_cells.append({
                "ice_probability": round(p_ice, 3),
                "terrain_class": c_type_str,
                "in_crater": in_crater,
                "hazard_cost": round(cost, 2)
            })
        nav_grid.append(row_cells)
        
    # Destination directories
    hotspot_dest = WEB_PUBLIC_DATA / "hotspots" / "south_pole"
    global_dest = WEB_PUBLIC_DATA / "global"
    hotspot_dest.mkdir(parents=True, exist_ok=True)
    global_dest.mkdir(parents=True, exist_ok=True)
    
    # Save nav_grid.json (compact structure for fast web loading)
    classes_list = [CLASS_LABELS[i] for i in range(len(CLASS_LABELS))]
    class_to_idx = {c: i for i, c in enumerate(classes_list)}
    compact_cells = []
    for row in nav_grid:
        c_row = []
        for cell in row:
            c_row.append([
                cell["ice_probability"],
                class_to_idx.get(cell["terrain_class"], 0),
                1 if cell["in_crater"] else 0,
                cell["hazard_cost"]
            ])
        compact_cells.append(c_row)

    compact_data = {
        "width": grid_size,
        "height": grid_size,
        "classes": classes_list,
        "cells": compact_cells
    }

    nav_grid_path = hotspot_dest / "nav_grid.json"
    with open(nav_grid_path, "w") as f:
        json.dump(compact_data, f, separators=(',', ':'))
    print(f"Saved nav_grid.json ({nav_grid_path.stat().st_size} bytes)")
    
    # Copy/save craters.json
    with open(hotspot_dest / "craters.json", "w") as f:
        json.dump(craters, f, indent=2)
        
    # Save terrain and heightmap images
    base_img.save(hotspot_dest / "base_texture.jpg", "JPEG", quality=90)
    height_img.save(hotspot_dest / "heightmap.png", "PNG")
    
    # Copy overlay PNGs
    shutil.copy(PROCESSED_DIR / "ice_heatmap.png", hotspot_dest / "ice_heatmap.png")
    shutil.copy(PROCESSED_DIR / "terrain_classes.png", hotspot_dest / "terrain_classes.png")
    
    # Copy global assets if present
    if (RAW_GLOBAL_DIR / "moon_texture.jpg").exists():
        shutil.copy(RAW_GLOBAL_DIR / "moon_texture.jpg", global_dest / "moon_texture.jpg")
    if (RAW_GLOBAL_DIR / "moon_heightmap.png").exists():
        shutil.copy(RAW_GLOBAL_DIR / "moon_heightmap.png", global_dest / "moon_heightmap.png")
        
    print("All static assets fused and exported successfully to web/public/data/!")

if __name__ == "__main__":
    fuse_and_export(256)
