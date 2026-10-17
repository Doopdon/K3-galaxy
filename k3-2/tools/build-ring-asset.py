"""Package the supplied root ring.stl for normal script tags under file://."""
import base64
from pathlib import Path

root = Path(__file__).resolve().parents[2]
data = base64.b64encode((root / "ring.stl").read_bytes()).decode("ascii")
(root / "k3-2/assets/ring-stl.js").write_text(
    '// Generated from ../../ring.stl; regenerate with python k3-2/tools/build-ring-asset.py\n'
    'const K3_RING_STL_BASE64 = "' + data + '";\n', encoding="utf-8")
