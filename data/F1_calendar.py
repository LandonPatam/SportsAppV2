import requests
import json
import re
import os
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

url_schedule = "https://www.espn.com/f1/schedule"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/',
    'Cookie': 'OptanonConsent=isGpcEnabled=0...', # use your full string
    'Connection': 'keep-alive'
}

CALENDAR_PATH = "public/data/f1_calendar.json"
PST_OFFSET = timedelta(hours=-7)  # UTC-7 (PDT) — change to -8 during PST (Nov-Mar)

MONTH_MAP = {
    "january": 1, "february": 2, "march": 3,    "april": 4,
    "may": 5,     "june": 6,     "july": 7,      "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

# ==========================================================
# 🏁 CIRCUIT EXTRACTION
# ==========================================================

TRACK_SURFACE_COLORS = [
    '#f1f1f1', '#eaeaea', '#e6e6e6', '#ebebeb',
    '#f2f2f2', '#e2e2e2', '#e1e1e1', '#dcdddf', '#cbccce',
]

EXCLUDE_ID_PATTERNS = [
    r'^[A-Z\u00C0-\u024F]{4,}$',
    r'Line-Copy',
    r'SPEEDTRAP',
    r'ELEVATION',
    r'SEALEVEL',
    r'^Path-56\d',
]

def _is_excluded_id(pid: str) -> bool:
    for pat in EXCLUDE_ID_PATTERNS:
        if re.search(pat, pid):
            return True
    return False

def _parse_styles(svg: str) -> dict:
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
    tokens = re.findall(
        r'[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?', d
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
        def n(off=0): return float(tokens[i + off])
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
                upd(n(0), n(1)); upd(n(2), n(3)); x, y = n(4), n(5); upd(x, y); i += 6
            elif cmd == 'c':
                upd(x+n(0), y+n(1)); upd(x+n(2), y+n(3)); x += n(4); y += n(5); upd(x, y); i += 6
            elif cmd in ('S', 'Q'): upd(n(0), n(1)); x, y = n(2), n(3); upd(x, y); i += 4
            elif cmd in ('s', 'q'): upd(x+n(0), y+n(1)); x += n(2); y += n(3); upd(x, y); i += 4
            elif cmd in ('T',): x, y = n(0), n(1); upd(x, y); i += 2
            elif cmd in ('t',): x += n(0); y += n(1); upd(x, y); i += 2
            elif cmd in ('A',): x, y = n(5), n(6); upd(x, y); i += 7
            elif cmd in ('a',): x += n(5); y += n(6); upd(x, y); i += 7
            elif cmd in ('Z', 'z'): break
            else: i += 1
        except (IndexError, ValueError):
            i += 1; continue
        if cmd == 'M': cmd = 'L'
        elif cmd == 'm': cmd = 'l'

    if x0 == float('inf'):
        return None
    return x0, y0, x1, y1

def _canvas_overlap(bbox, canvas_w: float, canvas_h: float) -> float:
    x0, y0, x1, y1 = bbox
    w, h = max(1.0, x1 - x0), max(1.0, y1 - y0)
    ox = max(0.0, min(x1, canvas_w) - max(x0, 0))
    oy = max(0.0, min(y1, canvas_h) - max(y0, 0))
    return (ox * oy) / (w * h)

def _aspect_ratio(bbox) -> float:
    x0, y0, x1, y1 = bbox
    w, h = max(1.0, x1 - x0), max(1.0, y1 - y0)
    return min(w, h) / max(w, h)

def _extract_paths(svg: str, track_classes: set) -> list:
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
    eligible_lens = [d_len for d_len, cls, pid, d_val in all_paths if not _is_excluded_id(pid)]
    if not eligible_lens:
        return []
    max_len = max(eligible_lens)
    threshold = max_len * 0.40
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
        bbox = _get_path_bbox(d_val)
        if bbox:
            x0, y0, x1, y1 = bbox
            bb_w = max(1.0, x1 - x0)
            bb_h = max(1.0, y1 - y0)
            if _aspect_ratio(bbox) < 0.15: continue
            if bb_h < canvas_h * 0.08: continue
            if bb_w < canvas_w * 0.30: continue
            if y0 > canvas_h * 0.80: continue
            if _canvas_overlap(bbox, canvas_w, canvas_h) < 0.40: continue
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
    lines = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}">']
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

def extract_circuit_from_url(url: str) -> str | None:
    """Fetch a track SVG URL and return a minimal circuit-only SVG string, or None."""
    if not url or not url.startswith('http'):
        return None
    fetch_headers = {
        'User-Agent': (
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/120.0.0.0 Safari/537.36'
        ),
        'Accept': 'image/svg+xml,*/*',
    }
    req = urllib.request.Request(url, headers=fetch_headers)
    svg_content = None
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                svg_content = resp.read().decode('utf-8', errors='replace')
            break
        except urllib.error.HTTPError as e:
            print(f"    HTTP {e.code} on attempt {attempt}: {url}")
            if e.code in (403, 404, 410):
                return None
        except Exception as e:
            print(f"    Error on attempt {attempt}: {e}")
        if attempt < 3:
            time.sleep(1.5 * attempt)

    if not svg_content:
        return None

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


# ==========================================================
# 🧠 CALENDAR HELPERS
# ==========================================================

def parse_race_end_date(date_str: str) -> datetime | None:
    """Parse 'March 5 - 7' -> race day datetime (end of that day)."""
    try:
        parts = date_str.strip().split()
        month = MONTH_MAP.get(parts[0].lower())
        if not month:
            return None
        end_day = int(parts[-1])
        return datetime(datetime.now().year, month, end_day, 23, 59)
    except:
        return None

def weekend_has_started(date_str: str) -> bool:
    """Returns True if the race weekend has already begun (within 3 days before race day)."""
    race_end = parse_race_end_date(date_str)
    if race_end is None:
        return False
    return datetime.now() >= (race_end - timedelta(days=3))

def utc_iso_to_pst_str(utc_iso: str) -> str:
    """Convert '2026-03-15T07:00Z' -> 'March 15 at 12:00 AM PST'."""
    try:
        dt_utc = datetime.strptime(utc_iso, "%Y-%m-%dT%H:%MZ").replace(tzinfo=timezone.utc)
        dt_pst = dt_utc + PST_OFFSET
        hour = dt_pst.strftime("%I").lstrip("0") or "12"
        return f"{dt_pst.strftime('%B %d')} at {hour}{dt_pst.strftime(':%M %p')} PST"
    except:
        return "TBD"

def fetch_session_times(race_page_url: str) -> dict:
    """
    Visits the race page and extracts session times from the raceStrip JSON blob.
    Returns dict keyed by session name, values are PST strings.
    Only returns entries where timeValid=true.
    """
    try:
        resp = requests.get(race_page_url, headers=headers, timeout=15)
        if not resp.ok:
            return {}
        sessions_match = re.search(r'"sessions"\s*:\s*(\[.*?\])\s*,\s*"currentCompId"', resp.text, re.DOTALL)
        if not sessions_match:
            return {}
        sessions = json.loads(sessions_match.group(1))
        result = {}
        for s in sessions:
            name = s.get("session", "").strip()
            utc_time = s.get("time", "")
            if name and utc_time and s.get("timeValid"):
                result[name] = utc_iso_to_pst_str(utc_time)
        return result
    except Exception as e:
        print(f"  [WARN] Could not fetch session times: {e}")
        return {}


# ==========================================================
# 📂 LOAD EXISTING CALENDAR (to preserve past race data)
# ==========================================================
existing_by_name: dict = {}
if os.path.exists(CALENDAR_PATH):
    try:
        with open(CALENDAR_PATH, "r") as f:
            existing_by_name = {r.get("race_name"): r for r in json.load(f)}
    except:
        pass


# ==========================================================
# 🌐 FETCH SCHEDULE
# ==========================================================
response = requests.get(url_schedule, headers=headers)
raw_data = response.text

event_blocks = re.split(r'"\d{8}":', raw_data)
f1_calendar = []
count = 1

print("Starting extraction...")

for block in event_blocks:
    gp_match   = re.search(r'"gPrx":"(.*?)"',   block)
    time_match = re.search(r'"detail":"(.*?)"',  block)
    link_match = re.search(r'"evLink":"(.*?)"',  block)
    crct_match = re.search(r'"crct":"(.*?)"',    block)

    if not (gp_match and time_match and link_match):
        continue

    gp_name      = gp_match.group(1)
    time_detail  = time_match.group(1)
    ev_link      = link_match.group(1)
    circuit_name = crct_match.group(1) if crct_match else "TBD"

    base_url      = "https://www.espn.com"
    race_page_url = f"{base_url}{ev_link}"
    circuit_url   = f"{base_url}{ev_link.replace('/race/', '/circuit/')}"
    results_url   = f"{base_url}{ev_link.replace('/race/', '/results/')}"

    # EST -> PST fallback for date/start_time
    clean_time = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', time_detail).replace(" EST", "").replace(" EDT", "")
    try:
        dt_est     = datetime.strptime(clean_time, "%a, %B %d at %I:%M %p")
        dt_pst     = dt_est - timedelta(hours=3)
        date_range = f"{dt_pst.strftime('%B')} {dt_pst.day - 2} - {dt_pst.day}"
        start_time = f"{dt_pst.strftime('%B %d')} at {dt_pst.strftime('%I:%M %p').lower().lstrip('0')} PST"
    except:
        date_range, start_time = "TBD", "TBD"

    existing = existing_by_name.get(gp_name)

    # ── Race weekend already started / completed → preserve existing data ──
    if weekend_has_started(date_range):
        print(f"[SKIP] {gp_name} — weekend started or past, keeping existing data.")
        if existing:
            existing["race_number"] = count
            f1_calendar.append(existing)
        else:
            f1_calendar.append({
                "race_number":         count,
                "race_name":           gp_name,
                "circuit":             circuit_name,
                "date":                date_range,
                "start_time_west":     start_time,
                "tv_provider":         "Apple TV",
                "track_svg":           "Not Found",
                "track_svg_extracted": None,
                "session_times":       {},
                "urls": {"race_page": race_page_url, "circuit_info": circuit_url, "results": results_url}
            })
        count += 1
        continue

    # ── Future race → fetch SVG, extract circuit, fetch session times ──
    track_svg_url = existing.get("track_svg", "Not Found") if existing else "Not Found"

    # Fetch SVG URL
    try:
        print(f"Fetching circuit SVG URL for {gp_name}...")
        circuit_resp = requests.get(circuit_url, headers=headers, timeout=10)
        svg_match = re.search(r'https://a\.espncdn\.com/i/venues/f1/day/(\d+\.svg)', circuit_resp.text)
        if svg_match:
            track_svg_url = f"https://a.espncdn.com/i/venues/f1/day/{svg_match.group(1)}"
    except:
        pass

    # Extract circuit outline from SVG
    track_svg_extracted = existing.get("track_svg_extracted") if existing else None
    if track_svg_url and track_svg_url != "Not Found":
        print(f"Extracting circuit outline for {gp_name}...")
        extracted = extract_circuit_from_url(track_svg_url)
        if extracted:
            path_count = extracted.count('<path')
            print(f"  Extracted {path_count} path{'s' if path_count != 1 else ''}")
            track_svg_extracted = extracted
        else:
            print(f"  Extraction failed — keeping previous value if any.")

    # Fetch session times
    print(f"Fetching session times for {gp_name}...")
    session_times = fetch_session_times(race_page_url)
    if session_times:
        print(f"  Found {len(session_times)} session(s): {', '.join(session_times.keys())}")
        if session_times.get("Race"):
            start_time = session_times["Race"]
    else:
        print(f"  No session times found.")
        session_times = existing.get("session_times", {}) if existing else {}

    f1_calendar.append({
        "race_number":         count,
        "race_name":           gp_name,
        "circuit":             circuit_name,
        "date":                date_range,
        "start_time_west":     start_time,
        "tv_provider":         "Apple TV",
        "track_svg":           track_svg_url,
        "track_svg_extracted": track_svg_extracted,
        "session_times":       session_times,
        "urls": {"race_page": race_page_url, "circuit_info": circuit_url, "results": results_url}
    })
    count += 1

    # Small delay to be polite between races
    time.sleep(0.4)


# ==========================================================
# 💾 SAVE
# ==========================================================
os.makedirs("public/data", exist_ok=True)
with open(CALENDAR_PATH, "w") as file:
    json.dump(f1_calendar, file, indent=4)

print(f"\nDone! {count - 1} races written to {CALENDAR_PATH}")