"""Run the whole pipeline:  python build.py [--download] [--skip-tiles]

Raw NASA/USGS products (data-pipeline/raw) -> data/processed (the contract the backend serves).
"""
import argparse
import json
import shutil
import time

from lunarpipe.config import Settings
from lunarpipe.download import download_all
from lunarpipe.export import write_nav_grids, write_overview_images, write_region
from lunarpipe.layers import load_layers
from lunarpipe.pois.build import build_pois
from lunarpipe.tiles import build_tile_pyramid


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true", help="fetch missing raw datasets first")
    parser.add_argument("--skip-tiles", action="store_true", help="reuse the existing tile pyramid")
    args = parser.parse_args()
    settings = Settings()
    t0 = time.time()

    if args.download:
        download_all(settings)

    out = settings.output_dir
    out.mkdir(parents=True, exist_ok=True)

    print("Loading and aligning layers...")
    layers = load_layers(settings)
    print(f"  grid {layers.shape}, {layers.cell_m:.0f} m/px, covered {layers.coverage.mean():.1%} of the square")

    print("Extracting points of interest...")
    pois = build_pois(layers, settings)
    with open(out / "pois.json", "w", encoding="utf8") as f:
        json.dump(pois, f)
    print(f"  {len(pois['pois'])} POIs")

    print("Writing navigation grids and overview maps...")
    nav = write_nav_grids(layers, out)
    overview = write_overview_images(layers, settings, out)

    if args.skip_tiles:
        tiles = json.load(open(out / "region.json", encoding="utf8"))["tiles"]
    else:
        print("Building terrain tiles...")
        shutil.rmtree(out / "tiles", ignore_errors=True)
        tiles = build_tile_pyramid(layers, settings, out)

    write_region(layers, settings, out, tiles, nav, overview, len(pois["pois"]))
    print(f"Done in {time.time() - t0:.0f}s -> {out}")


if __name__ == "__main__":
    main()
