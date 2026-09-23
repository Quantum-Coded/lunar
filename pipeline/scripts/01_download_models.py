"""
01_download_models.py
Downloads the fine-tuned NASA-IBM Lunar Foundation Models from Hugging Face:
- Ice Prospectivity: Dense regression
- Crater Detection: Object detection (NAC/WAC)
- IMP Segmentation: Irregular Mare Patches semantic segmentation
"""

import os
from pathlib import Path
from huggingface_hub import snapshot_download

SCRIPT_DIR = Path(__file__).resolve().parent
PIPELINE_DIR = SCRIPT_DIR.parent
WEIGHTS_DIR = PIPELINE_DIR / "weights"

MODELS = {
    "ice_prospectivity": "nasa-ibm-ai4science/Ice-Prospectivity-NASA-IBM-Lunar-Foundation-Model",
    "crater_detection": "nasa-ibm-ai4science/Crater-Detection-NASA-IBM-Lunar-Foundation-Model",
    "imp_segmentation": "nasa-ibm-ai4science/IMP-Segmentation-NASA-IBM-Lunar-Foundation-Model",
}

def download_models():
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Target weights directory: {WEIGHTS_DIR}")
    
    for key, repo_id in MODELS.items():
        dest = WEIGHTS_DIR / key
        print(f"\n[{key}] Downloading snapshot from {repo_id} to {dest}...")
        try:
            snapshot_download(
                repo_id=repo_id,
                local_dir=dest,
                local_dir_use_symlinks=False,
                resume_download=True
            )
            print(f"[{key}] Successfully downloaded!")
        except Exception as e:
            print(f"[{key}] Error downloading: {e}")

if __name__ == "__main__":
    download_models()
