"""Fetch the raw NASA/USGS products listed in sources.yaml (skips files already present)."""
import zipfile
from pathlib import Path

import httpx

from .config import Settings, load_sources


def _stream_to(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    with httpx.stream("GET", url, follow_redirects=True, timeout=120) as r:
        r.raise_for_status()
        with open(tmp, "wb") as f:
            for chunk in r.iter_bytes(1 << 20):
                f.write(chunk)
    tmp.replace(dest)


def download_all(settings: Settings) -> None:
    for key, src in load_sources(settings).items():
        target = settings.raw_dir / src["file"]
        if target.exists():
            print(f"[skip] {key}: {target.name} already present")
            continue
        print(f"[get ] {key}: {src['url']}")
        if "archive_name" in src:
            archive = settings.raw_dir / src["archive_name"]
            _stream_to(src["url"], archive)
            # Archives either contain their own top-level folder (Robbins) or loose files (IAU).
            dest = settings.raw_dir / src["archive"]
            with zipfile.ZipFile(archive) as z:
                top = z.namelist()[0].split("/")[0]
                z.extractall(settings.raw_dir if top == src["archive"] else dest)
            archive.unlink()
        else:
            _stream_to(src["url"], target)
