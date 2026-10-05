"""Assemble a ready-to-push Hugging Face Space folder (backend code + processed data + Dockerfile).

    python deploy/make_space_bundle.py            # writes deploy/space/
    python deploy/make_space_bundle.py --dry-run  # only prints what would be copied

The bundle contains no secrets. Large binary files are tracked with Git LFS (see .gitattributes it writes).
"""
import argparse
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "deploy" / "space"
SPACE_README = """---
title: Lunar Rover API
emoji: 🌕
colorFrom: gray
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

Backend for the Lunar Rover game: serves real NASA lunar south-pole terrain tiles, place search and route planning.
Data: NASA LRO/LOLA, USGS Robbins crater database, IAU nomenclature - see the project's About page for full credits.
"""
LFS_RULES = "*.npy filter=lfs diff=lfs merge=lfs -text\n*.png filter=lfs diff=lfs merge=lfs -text\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    processed = REPO / "data" / "processed"
    if not (processed / "region.json").exists():
        print("data/processed is missing - run the data pipeline first (see README).", file=sys.stderr)
        return 1

    plan = [
        (REPO / "backend" / "app", OUT / "backend" / "app"),
        (processed, OUT / "data" / "processed"),
    ]
    for src, dst in plan:
        size = sum(f.stat().st_size for f in src.rglob("*") if f.is_file()) / 1e6
        print(f"{src.relative_to(REPO)}  ->  {dst.relative_to(REPO)}  ({size:,.0f} MB)")
    if args.dry_run:
        return 0

    if OUT.exists():
        sys.exit(f"{OUT} already exists. Delete it yourself first so nothing is overwritten by accident.")
    ignore = shutil.ignore_patterns("__pycache__", "*.pyc")
    for src, dst in plan:
        shutil.copytree(src, dst, ignore=ignore)
    shutil.copy2(REPO / "backend" / "requirements.txt", OUT / "backend" / "requirements.txt")
    shutil.copy2(REPO / "deploy" / "Dockerfile", OUT / "Dockerfile")
    (OUT / "README.md").write_text(SPACE_README, encoding="utf8")
    (OUT / ".gitattributes").write_text(LFS_RULES, encoding="utf8")
    (OUT / ".dockerignore").write_text("**/__pycache__\n.git\n", encoding="utf8")
    print(f"\nBundle ready in {OUT}\nNext: follow docs/DEPLOYMENT.md, step 2.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
