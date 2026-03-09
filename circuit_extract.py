#!/usr/bin/env python3
"""
enrich_races_with_circuits.py

Reads public/data/f1_calendar.json, fetches each track SVG from the
`track_svg` URL, extracts just the circuit outline, and writes the
resulting inline SVG string back into the same file as `track_svg_extracted`.

Usage:
    python enrich_races_with_circuits.py
    python enrich_races_with_circuits.py --force   # re-fetch even if already extracted
"""

import re
import sys
import json
import time
import argparse
import urllib.request
import urllib.error
from pathlib import Path

# ---------------------------------------------------------------------------
# Config — edit these if your paths ever change
# ---------------------------------------------------------------------------
JSON_PATH = Path(__file__).parent / "public" / "data" / "f1_calendar.json"

# NOTE: Place this script in your project root (SportsAppV2/)
# Expected file location: SportsAppV2/public/data/f1_calendar.json


# ---------------------------------------------------------------------------
# Circuit extraction logic (same approach as extract_circuits.py)
# ---------------------------------------------------------------------------

TRACK_SURFACE_COLORS = [
    '#f1f1f1',  # circuit body fill (e.g. 404.svg)
    '#eaeaea',  # circuit body fill (e.g. 404.svg)
    '#e6e6e6',
    '#ebebeb',
    '#f2f2f2',
    '#e2e2e2',  # used as circuit body fill in some SVGs (e.g. Singapore)
    '#e1e1e1',
    '#dcdddf',
    '#cbccce',
]

EXCLUDE_ID_PATTERNS = [
    r'^[A-Z\u00C0-\u024F]{4,}$',   # ALL-CAPS IDs like MELBOURNE, BAHRAIN, SUZUKA, HERMANOSRODRÍGUEZ (handles accented/unicode caps)
    r'Line-Copy',
    r'SPEEDTRAP',
    r'ELEVATION',
    r'SEALEVEL',
    r'^Path-56\d',                  # Terrain / ground-fill decoration layer (Path-561, Path-562, etc.)
]


def _is_excluded_id(pid: str) -> bool:
    for pat in EXCLUDE_ID_PATTERNS:
        if re.search(pat, pid):
            return True
    return False


def _parse_styles(svg: str) -> dict:
    """Return {class_name: fill_color} from the SVG <style> block."""
    style_map = {}
    m = re.search(r'<style>(.*?)</style>', svg, re.DOTALL)
    if not m:
        return style_map
    for block in re.finditer(r'\.(st\d+)[^{]*\{([^}]+)\}', m.group(1)):
        cls, props = block.group(1), block.group(2)
        fill = re.search(r'fill:\s*([^;}\s]+)', props)
        if fill:
            style_map[cls] = fill.group(1).lower().strip()
    return style_map


def _find_track_classes(style_map: dict) -> set:
    return {cls for cls, fill in style_map.items() if fill in TRACK_SURFACE_COLORS}


def _get_path_bbox(d: str):
    """Return (x0, y0, x1, y1) bounding box by tracing the path, handling relative coords."""
    tokens = re.findall(
        r'[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?',
        d
    )
    if not tokens:
        return None

    x, y = 0.0, 0.0
    x0, y0, x1, y1 = float('inf'), float('inf'), float('-inf'), float('-inf')

    def upd(px, py):
        nonlocal x0, y0, x1, y1
        x0 = min(x0, px); y0 = min(y0, py)
        x1 = max(x1, px); y1 = max(y1, py)

    i, cmd = 0, 'M'
    while i < len(tokens):
        t = tokens[i]
        if re.match(r'^[MmLlHhVvCcSsQqTtAaZz]$', t):
            cmd = t; i += 1; continue

        def n(off=0):
            return float(tokens[i + off])

        try:
            if cmd == 'M':   x, y = n(0), n(1);  upd(x, y); i += 2
            elif cmd == 'm': x += n(0); y += n(1); upd(x, y); i += 2
            elif cmd == 'L': x, y = n(0), n(1);  upd(x, y); i += 2
            elif cmd == 'l': x += n(0); y += n(1); upd(x, y); i += 2
            elif cmd == 'H': x = n(0);             upd(x, y); i += 1
            elif cmd == 'h': x += n(0);            upd(x, y); i += 1
            elif cmd == 'V': y = n(0);             upd(x, y); i += 1
            elif cmd == 'v': y += n(0);            upd(x, y); i += 1
            elif cmd == 'C':
                upd(n(0), n(1)); upd(n(2), n(3))
                x, y = n(4), n(5); upd(x, y); i += 6
            elif cmd == 'c':
                upd(x+n(0), y+n(1)); upd(x+n(2), y+n(3))
                x += n(4); y += n(5); upd(x, y); i += 6
            elif cmd in ('S', 'Q'):
                upd(n(0), n(1)); x, y = n(2), n(3); upd(x, y); i += 4
            elif cmd in ('s', 'q'):
                upd(x+n(0), y+n(1)); x += n(2); y += n(3); upd(x, y); i += 4
            elif cmd in ('T',):  x, y = n(0), n(1); upd(x, y); i += 2
            elif cmd in ('t',):  x += n(0); y += n(1); upd(x, y); i += 2
            elif cmd in ('A',):  x, y = n(5), n(6); upd(x, y); i += 7
            elif cmd in ('a',):  x += n(5); y += n(6); upd(x, y); i += 7
            elif cmd in ('Z', 'z'): break
            else: i += 1
        except (IndexError, ValueError):
            i += 1
            continue

        if cmd == 'M': cmd = 'L'
        elif cmd == 'm': cmd = 'l'

    if x0 == float('inf'):
        return None
    return x0, y0, x1, y1


def _canvas_overlap(bbox, canvas_w: float, canvas_h: float) -> float:
    """Fraction of the bbox area that falls within the canvas."""
    x0, y0, x1, y1 = bbox
    w, h = max(1.0, x1 - x0), max(1.0, y1 - y0)
    ox = max(0.0, min(x1, canvas_w) - max(x0, 0))
    oy = max(0.0, min(y1, canvas_h) - max(y0, 0))
    return (ox * oy) / (w * h)


def _aspect_ratio(bbox) -> float:
    """min/max side ratio — near 0 means a very flat/thin shape (text, lines)."""
    x0, y0, x1, y1 = bbox
    w, h = max(1.0, x1 - x0), max(1.0, y1 - y0)
    return min(w, h) / max(w, h)


def _extract_paths(svg: str, track_classes: set) -> list:
    """Return list of (d_length, class, id, d_value) sorted largest first."""
    results = []
    for cls in track_classes:
        pattern = r'(<path\b(?=[^>]*\bclass="[^"]*\b' + cls + r'\b)[^>]*/?>)'
        for m in re.finditer(pattern, svg, re.DOTALL):
            tag = m.group(1)
            d_m = re.search(r'\bd="([^"]+)"', tag)
            if not d_m:
                continue
            d_val = d_m.group(1)
            id_m = re.search(r'\bid="([^"]+)"', tag)
            pid = id_m.group(1) if id_m else 'no-id'
            results.append((len(d_val), cls, pid, d_val))
    return sorted(results, key=lambda x: x[0], reverse=True)


def _select_track_paths(all_paths: list, canvas_w: float = 876, canvas_h: float = 841) -> list:
    if not all_paths:
        return []

    # Base the length threshold on the longest non-excluded path.
    # Excluded paths (shadows, labels, etc.) can be much longer than the real
    # circuit outline and would otherwise inflate the threshold so high that
    # the actual circuit path gets cut off.
    eligible_lens = [d_len for d_len, cls, pid, d_val in all_paths if not _is_excluded_id(pid)]
    if not eligible_lens:
        return []
    max_len = max(eligible_lens)
    threshold = max_len * 0.40

    # Count how many elements each class appears on
    class_counts = {}
    for _, cls, *_ in all_paths:
        class_counts[cls] = class_counts.get(cls, 0) + 1

    selected = []
    class_seen = {}
    for item in all_paths:
        d_len, cls, pid, d_val = item
        if d_len < threshold:
            break
        if _is_excluded_id(pid):
            continue

        # Geometric filters — reject text labels, edge lines, off-canvas fragments
        bbox = _get_path_bbox(d_val)
        if bbox:
            x0, y0, x1, y1 = bbox
            bb_w = max(1.0, x1 - x0)
            bb_h = max(1.0, y1 - y0)

            if _aspect_ratio(bbox) < 0.15:
                # Flat shape = text label, dashed line, or thin strip.
                # Raised from 0.10 to 0.15 to catch corner-name labels
                # (e.g. "'dunlop corner'") whose text paths sit right at 0.10.
                continue

            if bb_h < canvas_h * 0.08:
                # Absolute height guard: anything shorter than 8% of the canvas
                # height is a text label or decoration, not a circuit outline.
                continue

            if bb_w < canvas_w * 0.30:
                # Width guard: a real circuit outline always spans at least 30% of
                # the canvas width. Narrower paths are elevation profiles, pit-lane
                # detail strips, or other side-panel decorations.
                continue

            if y0 > canvas_h * 0.80:
                # Path sits entirely in the bottom 20% of the canvas:
                # this is the legend / elevation-profile / speed-trap area.
                continue

            if _canvas_overlap(bbox, canvas_w, canvas_h) < 0.40:
                # Mostly off-canvas = stray artifact
                continue
        limit = 1 if class_counts.get(cls, 1) > 5 else 3
        if class_seen.get(cls, 0) < limit:
            selected.append(item)
            class_seen[cls] = class_seen.get(cls, 0) + 1

    return selected


def _get_viewbox(svg: str) -> str:
    m = re.search(r'<svg\b[^>]*\bviewBox="([^"]+)"', svg, re.IGNORECASE)
    if m:
        return m.group(1)
    w = re.search(r'<svg\b[^>]*\bwidth="([^"]+)"', svg)
    h = re.search(r'<svg\b[^>]*\bheight="([^"]+)"', svg)
    if w and h:
        return f"0 0 {w.group(1)} {h.group(1)}"
    return "0 0 876 810"


def _build_svg(selected: list, viewbox: str) -> str:
    layer_fills = ['#e6e6e6', '#ebebeb', '#f2f2f2', '#e8e8e8']
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}">',
    ]
    for i, (d_len, cls, pid, d_val) in enumerate(selected):
        fill = layer_fills[i % len(layer_fills)]
        id_attr = f' id="{pid}"' if pid != 'no-id' else ''
        if i == 0:
            lines.append(
                f'  <path{id_attr} fill="{fill}" stroke="#48494a" '
                f'stroke-width="1.2" d="{d_val}"/>'
            )
        else:
            lines.append(f'  <path{id_attr} fill="{fill}" d="{d_val}"/>')
    lines.append('</svg>')
    return '\n'.join(lines)


def extract_circuit_from_svg(svg_content: str) -> str | None:
    """
    Given raw SVG content, return a minimal circuit-only SVG string,
    or None if extraction fails.
    """
    style_map = _parse_styles(svg_content)
    track_classes = _find_track_classes(style_map)
    if not track_classes:
        return None

    all_paths = _extract_paths(svg_content, track_classes)
    if not all_paths:
        return None

    viewbox = _get_viewbox(svg_content)
    vb_parts = viewbox.split()
    canvas_w = float(vb_parts[2]) if len(vb_parts) >= 4 else 876
    canvas_h = float(vb_parts[3]) if len(vb_parts) >= 4 else 841

    selected = _select_track_paths(all_paths, canvas_w, canvas_h)
    if not selected:
        return None

    return _build_svg(selected, viewbox)


# ---------------------------------------------------------------------------
# Fetching
# ---------------------------------------------------------------------------

def fetch_svg(url: str, timeout: int = 15, retries: int = 2) -> str | None:
    """Fetch a URL and return its text content, or None on failure."""
    headers = {
        'User-Agent': (
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/120.0.0.0 Safari/537.36'
        ),
        'Accept': 'image/svg+xml,*/*',
    }
    req = urllib.request.Request(url, headers=headers)
    for attempt in range(1, retries + 2):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read().decode('utf-8', errors='replace')
        except urllib.error.HTTPError as e:
            print(f"    HTTP {e.code} on attempt {attempt}: {url}")
            if e.code in (403, 404, 410):
                return None  # don't retry permanent errors
        except urllib.error.URLError as e:
            print(f"    URL error on attempt {attempt}: {e.reason}")
        except Exception as e:
            print(f"    Error on attempt {attempt}: {e}")
        if attempt <= retries:
            time.sleep(1.5 * attempt)
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def process(input_path: str, output_path: str, force: bool = False):
    data = json.loads(Path(input_path).read_text(encoding='utf-8'))

    # Support both a bare list and a dict with a list inside
    if isinstance(data, list):
        races = data
    elif isinstance(data, dict):
        # find the first key whose value is a list
        races = next((v for v in data.values() if isinstance(v, list)), None)
        if races is None:
            print("ERROR: Could not find a list of races in the JSON.")
            sys.exit(1)
    else:
        print("ERROR: Unexpected JSON structure.")
        sys.exit(1)

    total = len(races)
    ok = skipped = failed = 0

    for i, race in enumerate(races, 1):
        name = race.get('race_name') or race.get('circuit') or f"Race {i}"
        url = race.get('track_svg') or ''
        url = url.strip() if isinstance(url, str) else ''

        if not url or not url.startswith('http'):
            print(f"[{i}/{total}] SKIP  {name} — no valid track_svg URL")
            skipped += 1
            continue



        print(f"[{i}/{total}] Fetching {name} ... ", end='', flush=True)
        svg_content = fetch_svg(url)

        if svg_content is None:
            print("FETCH FAILED")
            race['track_svg_extracted'] = None
            failed += 1
            continue

        extracted = extract_circuit_from_svg(svg_content)

        if extracted is None:
            print("EXTRACT FAILED")
            race['track_svg_extracted'] = None
            failed += 1
            continue

        race['track_svg_extracted'] = extracted
        path_count = extracted.count('<path')
        print(f"OK ({path_count} path{'s' if path_count != 1 else ''})")
        ok += 1

        # Small delay to be polite to the CDN
        if i < total:
            time.sleep(0.4)

    # Write output
    out = Path(output_path)
    out.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f"\nWrote {out}  —  {ok} extracted, {skipped} skipped, {failed} failed")


def main():
    parser = argparse.ArgumentParser(description='Enrich f1_calendar.json with extracted circuit SVGs')
    parser.add_argument('--force', '-f', action='store_true',
                        help='Re-extract even if track_svg_extracted already exists')
    args = parser.parse_args()

    if not JSON_PATH.exists():
        print(f"ERROR: Could not find {JSON_PATH}")
        print(f"       Make sure you're running this script from your project root.")
        sys.exit(1)

    process(str(JSON_PATH), str(JSON_PATH), force=args.force)


if __name__ == '__main__':
    main()