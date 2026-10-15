"""Generate depth maps for the home page project holograms with Depth Anything V2.

    python3 scripts/depth-maps.py ~/Git/learning/Depth-Anything-V2

Reads every image in public/portals/ and public/portals/wide/ and writes a grayscale
depth map (near = bright) as a PNG with the same name into a `depth/` folder beside it.

The screenshots are flat UI, so the raw prediction (soft, rounded blobs) is flattened: the
screenshot is split into regions along its edges, each region takes its median depth, and
the result is quantized into a few levels, so each panel reads as a flat, raised layer.
"""
import argparse
import sys
from pathlib import Path

import cv2
import numpy as np
import torch

ROOT = Path(__file__).resolve().parent.parent
FOLDERS = [ROOT / "public/portals", ROOT / "public/portals/wide"]
CONFIGS = {
    "vits": {"encoder": "vits", "features": 64, "out_channels": [48, 96, 192, 384]},
    "vitb": {"encoder": "vitb", "features": 128, "out_channels": [96, 192, 384, 768]},
    "vitl": {"encoder": "vitl", "features": 256, "out_channels": [256, 512, 1024, 1024]},
}


def normalize(depth: np.ndarray) -> np.ndarray:
    # Depth Anything predicts relative inverse depth, so larger already means nearer
    lo, hi = np.percentile(depth, [1, 99])
    return np.clip((depth - lo) / max(hi - lo, 1e-6), 0, 1)


def flatten(image: np.ndarray, depth: np.ndarray, levels: int, min_area: int) -> np.ndarray:
    """Give each UI region (an area bounded by edges in the screenshot) one flat depth."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (3, 3), 0), 20, 60)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8))
    count, labels, stats, _ = cv2.connectedComponentsWithStats((edges == 0).astype(np.uint8), connectivity=4)

    # Drop the broad trend (the model sees screenshots as a bowl or a tunnel) to keep what
    # stands out from its surroundings
    local = depth - cv2.GaussianBlur(depth, (0, 0), depth.shape[1] / 8)

    out = np.zeros_like(depth)
    known = np.zeros(depth.shape, np.uint8)
    for i in range(1, count):
        if stats[i, cv2.CC_STAT_AREA] < min_area:
            continue  # text, icons and specks take the depth of the panel around them
        region = labels == i
        out[region] = np.median(local[region])
        known[region] = 1

    # The largest region is the page background: everything else stands on it, none sinks behind
    background = np.argmax(stats[1:, cv2.CC_STAT_AREA]) + 1
    out = np.clip(out - np.median(local[labels == background]), 0, None)
    out = np.clip(out / max(np.percentile(out[known == 1], 99), 1e-6), 0, 1)

    # Fill edges and small regions from the nearest flat region
    _, nearest = cv2.distanceTransformWithLabels(1 - known, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.nonzero(known == 0)
    zeros = np.argwhere(known == 1)  # DIST_LABEL_PIXEL numbers the zero pixels of the input in scan order
    src = zeros[nearest[known == 0] - 1]
    out[ys, xs] = out[src[:, 0], src[:, 1]]

    out = np.round(out * (levels - 1)) / (levels - 1)
    return cv2.medianBlur((out * 255).astype(np.uint8), 5)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("repo", type=Path, help="path to a Depth-Anything-V2 checkout")
    parser.add_argument("--encoder", default="vitl", choices=CONFIGS)
    parser.add_argument("--input-size", type=int, default=770)
    parser.add_argument("--levels", type=int, default=6, help="number of flat depth levels")
    args = parser.parse_args()

    sys.path.insert(0, str(args.repo))
    from depth_anything_v2.dpt import DepthAnythingV2

    device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    model = DepthAnythingV2(**CONFIGS[args.encoder])
    model.load_state_dict(torch.load(args.repo / f"checkpoints/depth_anything_v2_{args.encoder}.pth", map_location="cpu"))
    model = model.to(device).eval()

    for folder in FOLDERS:
        out = folder / "depth"
        out.mkdir(exist_ok=True)
        for old in out.glob("*.jpg"):
            old.unlink()
        for path in sorted(folder.glob("*.jpg")):
            image = cv2.imread(str(path), cv2.IMREAD_COLOR)
            d = flatten(image, normalize(model.infer_image(image, args.input_size)), args.levels, image.size // 3 // 400)
            dest = out / f"{path.stem}.png"
            cv2.imwrite(str(dest), d, [cv2.IMWRITE_PNG_COMPRESSION, 9])
            print(dest)


if __name__ == "__main__":
    main()
