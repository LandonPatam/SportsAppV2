"""Keep public/data/nba_predictions.json current by running the NBA Forecaster.

The forecaster is a separate project with its own Python environment and data. Its
`auto` command decides what is due (morning refresh of finished games, forecasts at
10 AM ET, after the 5 PM ET injury report and shortly before tip) and re-exports the
JSON only when something changed, so this is safe to run every few minutes.

Forecaster location: env var NBA_FORECASTER_DIR, else ../NBA-Forecaster next to this
site, else D:/NBA-Forecaster.
"""
import os
import subprocess
import sys
from pathlib import Path

SITE_ROOT = Path(__file__).resolve().parents[1]
OUTPUT = SITE_ROOT / "public" / "data" / "nba_predictions.json"
TIMEOUT_SECONDS = 20 * 60


def forecaster_dir() -> Path | None:
    candidates = [os.environ.get("NBA_FORECASTER_DIR"), SITE_ROOT.parent / "NBA-Forecaster", "D:/NBA-Forecaster"]
    for candidate in candidates:
        if candidate and (Path(candidate) / "src" / "nba_forecaster").is_dir():
            return Path(candidate)
    return None


def forecaster_python(root: Path) -> Path | None:
    for relative in (".venv/Scripts/python.exe", ".venv/bin/python"):
        if (root / relative).exists():
            return root / relative
    return None


def main() -> int:
    root = forecaster_dir()
    python = forecaster_python(root) if root else None
    if root is None or python is None:
        print("[nba_predictions] NBA Forecaster not found; set NBA_FORECASTER_DIR", flush=True)
        return 1
    try:
        result = subprocess.run([str(python), "-m", "nba_forecaster", "auto", "--export", str(OUTPUT)],
                                cwd=root, timeout=TIMEOUT_SECONDS, capture_output=True, text=True)
    except subprocess.TimeoutExpired:
        print("[nba_predictions] forecaster timed out", flush=True)
        return 1
    for line in (result.stdout + result.stderr).splitlines():
        if line.strip():
            print(f"[nba_predictions] {line}", flush=True)
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
