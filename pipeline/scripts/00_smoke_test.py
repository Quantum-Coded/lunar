"""
00_smoke_test.py
Verifies the environment, GPU acceleration, required packages,
and model weight accessibility.
"""

import sys
from pathlib import Path

def run_smoke_test():
    print("=" * 60)
    print("NASA-IBM LUNAR PIPELINE SMOKE TEST")
    print("=" * 60)
    
    # 1. Check Python & environment
    print(f"Python version: {sys.version}")
    
    # 2. Check packages
    packages = [
        "torch", "torchvision", "transformers", "huggingface_hub",
        "PIL", "numpy", "scipy", "astropy", "requests", "yaml"
    ]
    
    for pkg in packages:
        try:
            mod = __import__(pkg)
            ver = getattr(mod, "__version__", "installed")
            print(f"[OK] {pkg}: {ver}")
        except ImportError as e:
            print(f"[FAIL] {pkg}: {e}")
            
    # 3. Check PyTorch & GPU
    try:
        import torch
        cuda_avail = torch.cuda.is_available()
        print(f"\nCUDA Available: {cuda_avail}")
        if cuda_avail:
            print(f"Device: {torch.cuda.get_device_name(0)}")
            print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB")
            # Test simple tensor calculation on GPU
            x = torch.randn(1, 8, 256, 256, device="cuda", dtype=torch.float16)
            conv = torch.nn.Conv2d(8, 64, kernel_size=8, stride=8, device="cuda", dtype=torch.float16)
            out = conv(x)
            print(f"Sample GPU tensor shape: {out.shape} - Compute verified!")
        else:
            print("Running in CPU mode. (CUDA recommended for 6GB RTX 4050)")
    except Exception as e:
        print(f"PyTorch check error: {e}")

    # 4. Check Weights directory
    pipeline_dir = Path(__file__).resolve().parent.parent
    weights_dir = pipeline_dir / "weights"
    print(f"\nWeights directory: {weights_dir}")
    if weights_dir.exists():
        found = list(weights_dir.glob("*/*"))
        print(f"Found {len(found)} files/dirs in weights.")
    else:
        print("Weights directory does not exist yet.")

    print("\nSmoke test complete!")
    print("=" * 60)

if __name__ == "__main__":
    run_smoke_test()
