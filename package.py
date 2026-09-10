"""Builds the Chrome Web Store upload zip from extension/.

Ships only what the extension needs at runtime -- build scripts and caches stay out,
since anything in the zip is something a reviewer can ask about.
"""
import json, pathlib, zipfile

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "extension"
DIST = ROOT / "dist"

INCLUDE = [
    "manifest.json",
    "background.js",
    "offscreen.html",
    "offscreen.js",
    "popup.html",
    "popup.js",
    "report.html",
    "report.js",
    "icon128.png",
]

version = json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))["version"]
DIST.mkdir(exist_ok=True)
out = DIST / f"amazon-return-reminder-v{version}.zip"

missing = [f for f in INCLUDE if not (SRC / f).exists()]
if missing:
    raise SystemExit(f"missing files, refusing to package: {missing}")

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for f in INCLUDE:
        z.write(SRC / f, f)

print(f"wrote {out}  ({out.stat().st_size:,} bytes)")
print(f"contains {len(INCLUDE)} files, version {version}")
