"""
02_download_data.py
Downloads high-fidelity global lunar basemaps and displacement maps
from NASA's Scientific Visualization Studio (SVS CGI Moon Kit / LRO LOLA).
"""

import os
from pathlib import Path
import urllib.request
from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parent
PIPELINE_DIR = SCRIPT_DIR.parent
RAW_GLOBAL_DIR = PIPELINE_DIR / "raw" / "global"
RAW_SOUTH_POLE_DIR = PIPELINE_DIR / "raw" / "south_pole"

# NASA Scientific Visualization Studio (SVS) CGI Moon Kit URLs
GLOBAL_TEXTURE_URL = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg"
GLOBAL_DISPLACEMENT_URL = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_3_8bit.jpg"

def download_file(url: str, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 1000:
        print(f"File already exists: {dest} ({dest.stat().st_size} bytes)")
        return
    print(f"Downloading {url} -> {dest}...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp, open(dest, "wb") as f:
        f.write(resp.read())
    print(f"Downloaded: {dest} ({dest.stat().st_size} bytes)")

def run_download():
    RAW_GLOBAL_DIR.mkdir(parents=True, exist_ok=True)
    RAW_SOUTH_POLE_DIR.mkdir(parents=True, exist_ok=True)
    
    # 1. Download global texture
    global_tex_dest = RAW_GLOBAL_DIR / "moon_texture.jpg"
    download_file(GLOBAL_TEXTURE_URL, global_tex_dest)
    
    # 2. Download global displacement map
    global_disp_dest = RAW_GLOBAL_DIR / "moon_heightmap.jpg"
    download_file(GLOBAL_DISPLACEMENT_URL, global_disp_dest)
    
    # Convert heightmap to 8-bit grayscale PNG for WebGL displacement
    if global_disp_dest.exists():
        png_dest = RAW_GLOBAL_DIR / "moon_heightmap.png"
        img = Image.open(global_disp_dest).convert("L")
        img.save(png_dest, "PNG")
        print(f"Converted heightmap to PNG: {png_dest} ({png_dest.stat().st_size} bytes)")

if __name__ == "__main__":
    run_download()
