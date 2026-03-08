import requests
import json
import re
import os
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
# 🧠 HELPERS
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
    Returns dict keyed by session name, values are PST strings. e.g.:
      { "Free Practice 1": "March 12 at 8:30 PM PST", "Race": "March 15 at 12:00 AM PST", ... }
    Only returns entries where timeValid=true (skips completed sessions showing lap times).
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
        dt_est    = datetime.strptime(clean_time, "%a, %B %d at %I:%M %p")
        dt_pst    = dt_est - timedelta(hours=3)
        date_range = f"{dt_pst.strftime('%B')} {dt_pst.day - 2} - {dt_pst.day}"
        start_time = f"{dt_pst.strftime('%B %d')} at {dt_pst.strftime('%I:%M %p').lower().lstrip('0')} PST"
    except:
        date_range, start_time = "TBD", "TBD"

    existing = existing_by_name.get(gp_name)

    # ── Race weekend already started / completed → preserve existing data ──
    if weekend_has_started(date_range):
        print(f"[SKIP] {gp_name} — weekend started or past, keeping existing data.")
        if existing:
            existing["race_number"] = count  # keep number in sync
            f1_calendar.append(existing)
        else:
            # No existing entry at all — store minimal record without fetching
            f1_calendar.append({
                "race_number":    count,
                "race_name":      gp_name,
                "circuit":        circuit_name,
                "date":           date_range,
                "start_time_west": start_time,
                "tv_provider":    "Apple TV",
                "track_svg":      "Not Found",
                "session_times":  {},
                "urls": {"race_page": race_page_url, "circuit_info": circuit_url, "results": results_url}
            })
        count += 1
        continue

    # ── Future race → fetch SVG and session times fresh ──
    track_svg_url = existing.get("track_svg", "Not Found") if existing else "Not Found"
    try:
        print(f"Fetching circuit SVG for {gp_name}...")
        circuit_resp = requests.get(circuit_url, headers=headers, timeout=10)
        svg_match = re.search(r'https://a\.espncdn\.com/i/venues/f1/day/(\d+\.svg)', circuit_resp.text)
        if svg_match:
            track_svg_url = f"https://a.espncdn.com/i/venues/f1/day/{svg_match.group(1)}"
    except:
        pass

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
        "race_number":    count,
        "race_name":      gp_name,
        "circuit":        circuit_name,
        "date":           date_range,
        "start_time_west": start_time,
        "tv_provider":    "Apple TV",
        "track_svg":      track_svg_url,
        "session_times":  session_times,
        "urls": {"race_page": race_page_url, "circuit_info": circuit_url, "results": results_url}
    })
    count += 1

# ==========================================================
# 💾 SAVE
# ==========================================================
os.makedirs("public/data", exist_ok=True)
with open("public/data/f1_calendar.json", "w") as file:
    json.dump(f1_calendar, file, indent=4)


print(f"\nDone! {count - 1} races written to {CALENDAR_PATH}")