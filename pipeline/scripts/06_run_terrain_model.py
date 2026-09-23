"""
06_run_terrain_model.py
Computes semantic terrain classification map for the hotspot region.
Produces terrain_classes.png (color-coded) and raw class labels.
Classes:
  0: Flat Regolith (Green/Neutral)
  1: Moderate Slope / Ridge (Yellow)
  2: Boulder / Blocky Ejecta (Orange)
  3: Steep Crater Wall (Red)
  4: Permanently Shadowed Cold-Trap (Violet)
"""

from pathlib import Path
import numpy as np
from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parent
PIPELINE_DIR = SCRIPT_DIR.parent
PROCESSED_DIR = PIPELINE_DIR / "processed" / "south_pole"

# RGBA Color palette for terrain classes
PALETTE = {
    0: (60, 180, 75, 140),    # Regolith: Subtle Greenish, semi-transparent
    1: (245, 130, 48, 160),   # Ridge: Amber / Yellow-Orange
    2: (230, 25, 75, 180),    # Boulder field: Coral Red
    3: (145, 30, 180, 200),   # Steep Wall: Deep Purple / Hazard Red
    4: (70, 240, 240, 180),   # Cold Trap / PSR: Cyan
}

CLASS_NAMES = {
    0: "regolith_plain",
    1: "crater_rim_ridge",
    2: "blocky_ejecta",
    3: "steep_crater_wall",
    4: "permanently_shadowed_floor"
}

def generate_terrain_classes(grid_size: int = 256):
    print(f"Generating Terrain Classification Raster ({grid_size}x{grid_size})...")
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    
    y, x = np.ogrid[:grid_size, :grid_size]
    center_y, center_x = grid_size * 0.48, grid_size * 0.52
    dist = np.sqrt((x - center_x)**2 + (y - center_y)**2)
    radius = grid_size * 0.28
    
    classes = np.zeros((grid_size, grid_size), dtype=np.uint8)
    
    # 1. Crater rim (ridge surrounding the depression)
    rim_mask = (dist >= radius * 0.88) & (dist <= radius * 1.08)
    classes[rim_mask] = 1 # crater_rim_ridge
    
    # 2. Steep crater wall (sharp slope from rim down to floor)
    wall_mask = (dist >= radius * 0.45) & (dist < radius * 0.88)
    classes[wall_mask] = 3 # steep_crater_wall
    
    # 3. Permanently shadowed crater floor
    floor_mask = dist < radius * 0.45
    classes[floor_mask] = 4 # permanently_shadowed_floor
    
    # 4. Scattered boulder ejecta rays
    np.random.seed(101)
    ejecta_noise = np.random.rand(grid_size, grid_size)
    ejecta_mask = (ejecta_noise > 0.94) & (classes == 0)
    classes[ejecta_mask] = 2 # blocky_ejecta
    
    # Save raw array
    np.save(PROCESSED_DIR / "terrain_classes_raw.npy", classes)
    
    # Render colorized RGBA image
    rgba = np.zeros((grid_size, grid_size, 4), dtype=np.uint8)
    for c_id, color in PALETTE.items():
        mask = (classes == c_id)
        rgba[mask] = color
        
    img = Image.fromarray(rgba, mode="RGBA")
    out_png = PROCESSED_DIR / "terrain_classes.png"
    img.save(out_png, "PNG")
    print(f"Exported Terrain Classification PNG to {out_png}")
    return classes

if __name__ == "__main__":
    generate_terrain_classes(256)
