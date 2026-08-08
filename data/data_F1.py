import requests
import json
import re
import os

TEAMS_PATH = "public/data/f1_teams.json"
TEAMS_BACKUP_PATH = "data/public/data/f1_teams.json"

def _valid_f1_teams(teams):
    return (
        isinstance(teams, list)
        and len(teams) >= 10
        and all(isinstance(team, dict) and team.get("name") and team.get("drivers") for team in teams)
    )

def _load_valid_teams(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            teams = json.load(f)
        return teams if _valid_f1_teams(teams) else None
    except Exception:
        return None

def _restore_teams_from_backup():
    backup = _load_valid_teams(TEAMS_BACKUP_PATH)
    if not backup:
        return None
    os.makedirs(os.path.dirname(TEAMS_PATH), exist_ok=True)
    with open(TEAMS_PATH, "w", encoding="utf-8") as f:
        json.dump(backup, f, indent=4)
    print(f"[WARN] Restored F1 teams from {TEAMS_BACKUP_PATH}; scrape/update output was invalid.")
    return backup

def _safe_write_teams(teams, label="F1 teams"):
    if not _valid_f1_teams(teams):
        print(f"[WARN] Refusing to overwrite {TEAMS_PATH}: {label} produced invalid/empty team data.")
        _restore_teams_from_backup()
        return False

    os.makedirs(os.path.dirname(TEAMS_PATH), exist_ok=True)
    with open(TEAMS_PATH, "w", encoding="utf-8") as f:
        json.dump(teams, f, indent=4)

    os.makedirs(os.path.dirname(TEAMS_BACKUP_PATH), exist_ok=True)
    with open(TEAMS_BACKUP_PATH, "w", encoding="utf-8") as f:
        json.dump(teams, f, indent=4)

    return True

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/',
    'Connection': 'keep-alive'
}

try:
    response = requests.get("https://www.formula1.com/en/drivers", headers=headers, timeout=15)
    response.raise_for_status()
    raw_data = response.text
except Exception as e:
    print(f"[WARN] Could not fetch Formula1 teams/drivers page: {e}")
    raw_data = ""

TEAM_MAP = {
    'alpine': 'Alpine',
    'astonmartin': 'Aston Martin',
    'audi': 'Audi',
    'cadillac': 'Cadillac',
    'ferrari': 'Ferrari',
    'haasf1team': 'Haas F1 Team',
    'mclaren': 'McLaren',
    'mercedes': 'Mercedes',
    'racingbulls': 'Racing Bulls',
    'redbullracing': 'Red Bull Racing',
    'williams': 'Williams',
}

# ── 1. DRIVERS ───────────────────────────────────────────────────────────────
# Each driver anchor: <a href="/en/drivers/SLUG">...</a>
# Names in body-m-compact-regular / body-m-compact-bold spans
# Team derived from CDN image path: /2026/TEAMSLUG/drivercode/

drivers_by_team = {}   # team_slug -> list of driver dicts
seen_drivers = set()

for slug, block in re.findall(r'href="/en/drivers/([a-z0-9-]+)">(.*?)</a>', raw_data, re.DOTALL):
    if slug in seen_drivers or slug == 'hall-of-fame':
        continue

    first_match = re.search(r'body-m-compact-regular[^"]*"[^>]*>([^<]+)<', block)
    last_match  = re.search(r'body-m-compact-bold[^"]*"[^>]*>([^<]+)<', block)
    if not first_match or not last_match:
        continue

    seen_drivers.add(slug)

    first = first_match.group(1).strip()
    last  = last_match.group(1).strip()

    img_match   = re.search(r'src="(https://media\.formula1\.com/image/upload/[^"]+right\.webp)"', block)
    picture_url = None
    team_slug   = None

    if img_match:
        raw_url     = img_match.group(1)
        picture_url = re.sub(r'w_\d+', 'w_440', raw_url)
        ts = re.search(r'/\d{4}/([^/]+)/', raw_url)
        if ts:
            team_slug = ts.group(1)

    drivers_by_team.setdefault(team_slug, []).append({
        "name":        f"{first} {last}",
        "picture_url": picture_url,
    })

# ── 2. TEAMS ─────────────────────────────────────────────────────────────────
# Team card anchors: <a href="/en/teams/SLUG">...</a>
# Logo:  common/f1/2026/TEAMSLUG/2026TEAMSLUGlogowhite.webp
# Car:   common/f1/2026/TEAMSLUG/2026TEAMSLUGcarright.webp
# Name:  display-s-bold span

teams = {}
seen_teams = set()

for tag_attrs, team_url_slug, block in re.findall(r'<a([^>]*?href="/en/teams/([a-z0-9-]+)"[^>]*?)>(.*?)</a>', raw_data, re.DOTALL):
    if team_url_slug in seen_teams:
        continue

    # Logo image
    logo_match = re.search(
        r'src="(https://media\.formula1\.com/image/upload/[^"]+logowhite\.webp)"', block)
    # Car image
    car_match  = re.search(
        r'src="(https://media\.formula1\.com/image/upload/[^"]+carright\.webp)"', block)
    # Team display name
    name_match = re.search(r'display-s-bold[^"]*"[^>]*>([^<]+)<', block)

    if not logo_match and not car_match:
        continue  # skip non-team-card anchors

    seen_teams.add(team_url_slug)

    team_name = name_match.group(1).strip() if name_match else team_url_slug.title()

    # Team colour from style="--f1-team-colour:#xxxxxx" on the <a> tag itself
    colour_match = re.search(r'--f1-team-colour:(#[0-9a-fA-F]{3,6})', tag_attrs)
    team_colour = colour_match.group(1) if colour_match else None

    # Map url slug → internal image slug (they differ e.g. haas vs haasf1team)
    logo_url = logo_match.group(1) if logo_match else None
    car_url  = car_match.group(1)  if car_match  else None

    # Derive internal team slug from logo URL path
    internal_slug = None
    if logo_url:
        m = re.search(r'/2026/([^/]+)/', logo_url)
        if m:
            internal_slug = m.group(1)

    teams[team_url_slug] = {
        "name":       team_name,
        "colour":     team_colour,
        "logo_url":   logo_url,
        "car_url":    car_url,
        "drivers":    drivers_by_team.get(internal_slug, []),
    }

# Sort teams alphabetically, drivers within each team by last name
output = []
for slug in sorted(teams):
    entry = teams[slug]
    entry["drivers"].sort(key=lambda d: d["name"].split()[-1])
    output.append(entry)

if _safe_write_teams(output, "Formula1 teams scrape"):
    print(f"\n[OK] Wrote {len(output)} teams to {TEAMS_PATH}")


import requests
import json
import re
import os
from datetime import datetime, timedelta
import pytz

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/',
    'Connection': 'keep-alive'
}

CALENDAR_PATH = "public/data/f1_calendar.json"
PST = pytz.timezone("America/Los_Angeles")


def get_race_start(race: dict):
    """
    Parses 'start_time_west' like "March 07 at 8:00 pm PST"
    and returns a timezone-aware datetime, or None if unparseable.
    Year is injected explicitly to avoid Python 3.15 deprecation warning.
    """
    start_str = race.get("start_time_west", "")
    date_range = race.get("date", "")
    year = datetime.now().year

    clean = re.sub(r'\s+', ' ', start_str).replace(" PST", "").replace(" PDT", "").strip()
    for fmt in ("%B %d at %I:%M %p %Y", "%B %d at %I %p %Y"):
        try:
            naive_dt = datetime.strptime(f"{clean} {year}", fmt)
            return PST.localize(naive_dt)
        except ValueError:
            continue

    # Fallback: end day of "March 5 - 7" at 11:59 PM
    match = re.match(r'(\w+)\s+\d+\s*-\s*(\d+)', date_range)
    if match:
        month_str, end_day = match.group(1), match.group(2)
        try:
            naive_dt = datetime.strptime(f"{month_str} {end_day} {year} 23:59", "%B %d %Y %H:%M")
            return PST.localize(naive_dt)
        except ValueError:
            pass

    return None


def has_race_finished(race: dict) -> bool:
    race_start = get_race_start(race)
    if race_start is None:
        return False
    return datetime.now(PST) > (race_start + timedelta(hours=4))


def parse_positions_from_module(html: str, module_title: str) -> list:
    """Extract driver standings from a named ESPN module (e.g. 'Race Positions' or 'Sprint Race Positions')."""
    match = re.search(
        rf'"moduleTitle"\s*:\s*"{re.escape(module_title)}.*?"data"\s*:\s*(\[.*?\])\s*[,}}]',
        html,
        re.DOTALL
    )
    if not match:
        return []
    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError:
        return []

    results = []
    for entry in data:
        athlete = entry.get("athlete", {})
        results.append({
            "position": entry.get("position"),
            "driver": athlete.get("displayName", "Unknown"),
            "short_name": athlete.get("shortName", ""),
            "team": entry.get("team", athlete.get("team", "")),
            "team_color": athlete.get("teamColor", ""),
            "country": athlete.get("country", ""),
            "headshot": athlete.get("headshot", ""),
            "laps_completed": entry.get("lapsCompleted"),
            "pits": entry.get("pits"),
            "fastest_lap": entry.get("fastestLap"),
            "race_time": entry.get("raceTime"),
            "time_behind_leader": entry.get("timeBehindLeader"),
            "position_change": entry.get("positionChange"),
            "is_retired": entry.get("isRetired", False)
        })

    results.sort(key=lambda x: x["position"] if x["position"] is not None else 999)
    return results


def fetch_race_results(results_url: str) -> dict:
    """
    Fetches a race results page and returns a dict with:
      - 'results': main race positions
      - 'sprint_results': sprint race positions (only on sprint weekends, else None)
    """
    try:
        resp = requests.get(results_url, headers=headers, timeout=15)
        if resp.status_code != 200:
            return {"results": [], "sprint_results": None}
        html = resp.text
        return {
            "results": parse_positions_from_module(html, "Race Positions"),
            "sprint_results": parse_positions_from_module(html, "Sprint Race Positions") or None
        }
    except Exception:
        return {"results": [], "sprint_results": None}


def update_calendar():
    if not os.path.exists(CALENDAR_PATH):
        print(f"ERROR: {CALENDAR_PATH} not found. Run the schedule script first.")
        return

    with open(CALENDAR_PATH, "r") as f:
        calendar = json.load(f)

    updated = 0
    last_completed = None
    next_race = None

    for race in calendar:
        race_name = race.get("race_name", "Unknown")

        # Only skip if the main race results list is non-empty and has a real winner race_time.
        # - Checks race["results"] directly (not sprint_results) so sprint-only data doesn't count.
        # - Validates race_time on position 1 of the main results, since that field only
        #   exists after the race finishes (qualifying/practice entries won't have it).
        main_results = race.get("results") or []
        main_winner = next((p for p in main_results if p.get("position") == 1), None)
        has_real_race_results = (
            bool(main_results)
            and main_winner is not None
            and main_winner.get("race_time") not in (None, "", "--")
        )
        if has_real_race_results:
            last_completed = race_name
            continue

        # Hasn't finished yet — mark as next upcoming and stop looking
        if not has_race_finished(race):
            if next_race is None:
                next_race = race
            continue

        # Finished but no results yet — fetch
        fetched = fetch_race_results(race.get("urls", {}).get("results", ""))
        positions = fetched["results"]
        sprint_positions = fetched["sprint_results"]

        if positions:
            winner_entry = next((p for p in positions if p["position"] == 1), None)
            race["winner"] = {
                "driver": winner_entry["driver"],
                "short_name": winner_entry["short_name"],
                "team": winner_entry["team"],
                "team_color": winner_entry["team_color"],
                "headshot": winner_entry["headshot"],
                "race_time": winner_entry["race_time"],
                "fastest_lap": winner_entry["fastest_lap"],
            } if winner_entry else None
            race["results"] = positions

            # Sprint weekend — store sprint winner + results separately
            if sprint_positions:
                sprint_winner_entry = next((p for p in sprint_positions if p["position"] == 1), None)
                race["sprint_winner"] = {
                    "driver": sprint_winner_entry["driver"],
                    "short_name": sprint_winner_entry["short_name"],
                    "team": sprint_winner_entry["team"],
                    "team_color": sprint_winner_entry["team_color"],
                    "headshot": sprint_winner_entry["headshot"],
                    "race_time": sprint_winner_entry["race_time"],
                    "fastest_lap": sprint_winner_entry["fastest_lap"],
                } if sprint_winner_entry else None
                race["sprint_results"] = sprint_positions
            else:
                race["sprint_winner"] = None
                race["sprint_results"] = None

            last_completed = race_name
            updated += 1
            winner_name = race["winner"]["driver"] if race["winner"] else "Unknown"
            sprint_tag = f" | Sprint: {race['sprint_winner']['driver']}" if race.get("sprint_winner") else ""
            #print(f"[{race_name}] Results fetched — Winner: {winner_name}{sprint_tag}")
        # If positions is empty, the page isn't ready yet — leave the race entry untouched
        # so the next run will try again once results are published

    # Summary output
    if last_completed is None and updated == 0:
        print("[OK] Season hasn't started yet — no results to fetch.")
    else:
        if last_completed:
            print(f"Last completed race : {last_completed}")
        if next_race:
            start_time = next_race.get("start_time_west", "TBD")
            print(f"Next upcoming race  : {next_race.get('race_name')} ({start_time})")
        else:
            print("Next upcoming race  : Season complete")
        print(f"{updated} new result(s) saved." if updated else "No new results to update.")

    with open(CALENDAR_PATH, "w") as f:
        json.dump(calendar, f, indent=4)


def _normalize(name: str) -> str:
    """Lowercase + strip accents for fuzzy name matching (e.g. Hülkenberg → hulkenberg)."""
    import unicodedata
    return unicodedata.normalize("NFD", name.lower()).encode("ascii", "ignore").decode()


def fetch_driver_standings(season: int = None) -> dict:
    """
    Scrapes ESPN F1 standings for the given season.
    Returns a dict:
      { 'Lando Norris': { 'points': 423, 'race_points': {'AUS': 25, 'CHN': 18, ...} }, ... }
    Race values are int or None (None = DNS/DNF/not entered, stored as '-' on ESPN).
    """
    if season is None:
        season = datetime.now().year

    url = f"https://www.espn.com/f1/standings/_/season/{season}"
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code != 200:
            print(f"ERROR: Failed to fetch standings (HTTP {resp.status_code})")
            return {}
        html = resp.text
    except Exception as e:
        print(f"ERROR: Could not reach ESPN standings page: {e}")
        return {}

    # ESPN's standings table splits into two separate <tbody> elements:
    #   tbody[0] — sticky left side: driver name + total PTS (one cell per row)
    #   tbody[1] — scrollable right side: per-race points (one cell per race per row)
    # Both tbodies share the same row order (championship standing), so we zip by index.

    tbodies = re.findall(r'<tbody[^>]*>(.*?)</tbody>', html, re.DOTALL)
    if len(tbodies) < 2:
        print("WARNING: Could not find standings table — page structure may have changed.")
        return {}

    left_rows  = re.findall(r'<tr[^>]*>(.*?)</tr>', tbodies[0], re.DOTALL)
    right_rows = re.findall(r'<tr[^>]*>(.*?)</tr>', tbodies[1], re.DOTALL)

    # Race column headers from <th> elements with Table__TH class
    th_pattern = r'<th[^>]*class="[^"]*Table__TH[^"]*"[^>]*>(.*?)</th>'
    raw_headers = re.findall(th_pattern, html, re.DOTALL)
    cols = [re.sub(r'<[^>]+>', '', h).strip() for h in raw_headers
            if re.sub(r'<[^>]+>', '', h).strip()]
    race_cols = cols[1:]  # drop 'PTS'

    if not race_cols or not left_rows:
        print("WARNING: Could not find race column headers — page structure may have changed.")
        return {}

    def parse_val(v):
        v = v.strip()
        if v in ('-', '--', ' ', ''):
            return None
        try:
            return int(v)
        except ValueError:
            return None

    result = {}
    for left_row, right_row in zip(left_rows, right_rows):
        names = re.findall(r'hide-mobile">([^<]+)</span>', left_row)
        if not names:
            continue
        name = names[0].strip()
        pts_cells  = re.findall(r'stat-cell">([^<]+)', left_row)
        race_cells = re.findall(r'stat-cell">([^<]+)', right_row)
        total = parse_val(pts_cells[0]) if pts_cells else 0
        race_points = {race_cols[j]: parse_val(race_cells[j])
                       for j in range(min(len(race_cols), len(race_cells)))}
        result[name] = {'points': total or 0, 'race_points': race_points}

    print(f"[OK] Fetched standings for {len(result)} drivers "
          f"({len(race_cols)} races, season {season}).")
    return result


def update_driver_points():
    """
    Fetches current-season driver standings from ESPN and writes into f1_teams.json:
      driver['points']       — total championship points (int)
      driver['race_points']  — { 'AUS': 25, 'CHN': 18, 'JPN': None, ... }
    """
    if not os.path.exists(TEAMS_PATH):
        print(f"ERROR: {TEAMS_PATH} not found.")
        return

    standings = fetch_driver_standings()
    if not standings:
        return

    teams = _load_valid_teams(TEAMS_PATH)
    if teams is None:
        teams = _restore_teams_from_backup()
    if teams is None:
        print(f"ERROR: {TEAMS_PATH} is invalid and no valid backup exists.")
        return

    norm_map = {_normalize(k): v for k, v in standings.items()}

    updated = 0
    unmatched = []

    for team in teams:
        for driver in team.get("drivers", []):
            driver_name = driver.get("name", "")

            # Try exact match, then normalised, then last-name partial
            data = standings.get(driver_name)
            if data is None:
                data = norm_map.get(_normalize(driver_name))
            if data is None:
                last = _normalize(driver_name.split()[-1]) if driver_name else ""
                data = next((v for k, v in norm_map.items() if last in k), None)

            if data is not None:
                driver["points"] = data["points"]
                driver["race_points"] = data["race_points"]
                updated += 1
            else:
                driver["points"] = 0
                driver["race_points"] = {}
                unmatched.append(driver_name)

        # Sum driver points for the team total
        team["team_points"] = sum(d.get("points", 0) for d in team.get("drivers", []))

        # Sum per-race points across both drivers for team_race_points
        team_race = {}
        for driver in team.get("drivers", []):
            for race, pts in driver.get("race_points", {}).items():
                if pts is not None:
                    team_race[race] = (team_race.get(race) or 0) + pts
                elif race not in team_race:
                    team_race[race] = None
        # Preserve column order from standings
        all_races = next(
            (list(d["race_points"].keys()) for d in team.get("drivers", []) if d.get("race_points")),
            []
        )
        team["team_race_points"] = {r: team_race.get(r) for r in all_races}

    if not _safe_write_teams(teams, "ESPN standings update"):
        return

    print(f"[OK] Points written for {updated} driver(s) in {TEAMS_PATH}.")
    if unmatched:
        print(f"Could not match (set to 0): {', '.join(unmatched)}")


def fetch_circuit_stats():
    """
    Scrapes all circuit data from a single formula-timer.com/circuit page fetch
    and writes it into f1_calendar.json under circuit_stats per race.
    Fields: location, length, corners, tags, lap_record, top_speed.
    """
    if not os.path.exists(CALENDAR_PATH):
        print(f"ERROR: {CALENDAR_PATH} not found.")
        return

    with open(CALENDAR_PATH) as f:
        calendar = json.load(f)

    # ── Race name keyword → formula-timer circuit ID ─────────────────────────
    RACE_TO_FT = {
        'Australian':    'albert_park',
        'Chinese':       'shanghai',
        'Japanese':      'suzuka',
        'Bahrain':       'bahrain',
        'Saudi':         'jeddah',
        'Miami':         'miami',
        'Canadian':      'villeneuve',
        'Monaco':        'monaco',
        'Barcelona':     'catalunya',
        'Austrian':      'red_bull_ring',
        'British':       'silverstone',
        'Belgian':       'spa',
        'Hungarian':     'hungaroring',
        'Dutch':         'zandvoort',
        'Italian':       'monza',
        'Spanish':       'madrid',
        'Azerbaijan':    'baku',
        'Singapore':     'marina_bay',
        'United States': 'americas',
        'Mexico':        'rodriguez',
        'Paulo':         'interlagos',
        'Las Vegas':     'vegas',
        'Qatar':         'losail',
        'Abu Dhabi':     'yas_marina',
    }

    # ── Historical top speed (km/h) — not on formula-timer ───────────────────
    TOP_SPEEDS = {
        'albert_park':   335,
        'shanghai':      338,
        'suzuka':        320,
        'bahrain':       323,
        'jeddah':        344,
        'miami':         320,
        'villeneuve':    339,
        'monaco':        298,
        'catalunya':     324,
        'red_bull_ring': 316,
        'silverstone':   322,
        'spa':           355,
        'hungaroring':   304,
        'zandvoort':     318,
        'monza':         372,
        'madrid':        320,
        'baku':          358,
        'marina_bay':    300,
        'americas':      334,
        'rodriguez':     358,
        'interlagos':    332,
        'vegas':         350,
        'losail':        336,
        'yas_marina':    325,
    }

    def strip_html(s):
        s = re.sub(r'<!--.*?-->', '', s, flags=re.DOTALL)
        s = re.sub(r'<[^>]+>', ' ', s)
        s = re.sub(r'&amp;', '&', s)
        s = re.sub(r'&#x27;', "'", s)
        return re.sub(r'\s+', ' ', s).strip()

    # ── Single page fetch ─────────────────────────────────────────────────────
    try:
        resp = requests.get('https://formula-timer.com/circuit', headers=headers, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        print(f"ERROR fetching formula-timer: {e}")
        return

    # Parse all circuit cards: each is an <a href="/circuit/ID"> block
    cards = re.findall(r'href="(/circuit/[^"]+)">(.*?)(?=href="/circuit/|$)',
                       resp.text, re.DOTALL)
    ft_data = {}
    for href, content in cards:
        ft_id = href.replace('/circuit/', '')

        loc_m   = re.search(r'text-gray-200 text-sm[^"]*"[^>]*>(.*?)</p>', content, re.DOTALL)
        len_m   = re.search(r'Length:</span><div[^>]*>(.*?)</div>', content, re.DOTALL)
        cor_m   = re.search(r'Corners:</span><div[^>]*>(.*?)</div>', content, re.DOTALL)
        lap_m   = re.search(r'font-mono font-bold[^"]*"[^>]*>(.*?)</div>', content, re.DOTALL)
        raw_tags = re.findall(r'rounded-full[^"]*"[^>]*>(.*?)</span>', content, re.DOTALL)

        lap_record = None
        if lap_m:
            lap_time = strip_html(lap_m.group(1))
            drv_m = re.search(r'text-slate-400[^"]*"[^>]*>(.*?)</div>',
                              content[lap_m.end():], re.DOTALL)
            if drv_m:
                raw = strip_html(drv_m.group(1))
                dm  = re.match(r'^(.+?)\s*\((\d{4})\)\s*$', raw)
                lap_record = {
                    'time':   lap_time,
                    'driver': dm.group(1).strip() if dm else raw,
                    'year':   int(dm.group(2)) if dm else None,
                }

        ft_data[ft_id] = {
            'location':   strip_html(loc_m.group(1)) if loc_m else None,
            'length':     strip_html(len_m.group(1)) if len_m else None,
            'corners':    int(strip_html(cor_m.group(1))) if cor_m else None,
            'tags':       [strip_html(t) for t in raw_tags if strip_html(t)],
            'lap_record': lap_record,
        }

    print(f"Parsed {len(ft_data)} circuits from formula-timer")

    # ── Match each calendar race and write stats ──────────────────────────────
    updated = 0
    for race in calendar:
        if race.get('circuit_stats'):
            print(f"[SKIP] {race['race_name']} — already populated")
            continue

        ft_id = next(
            (fid for kw, fid in RACE_TO_FT.items() if kw.lower() in race['race_name'].lower()),
            None
        )
        if not ft_id or ft_id not in ft_data:
            print(f"[WARN] {race['race_name']} — no match (ft_id={ft_id})")
            continue

        stats = dict(ft_data[ft_id])
        if ft_id in TOP_SPEEDS:
            stats['top_speed'] = f"{TOP_SPEEDS[ft_id]} km/h"

        race['circuit_stats'] = stats
        updated += 1
        lap = (stats.get('lap_record') or {})
        print(f"[OK] {race['race_name']} ({ft_id}): "
              f"loc={stats.get('location')} corners={stats.get('corners')} "
              f"tags={stats.get('tags')} lap={lap.get('time')}")

    with open(CALENDAR_PATH, 'w') as f:
        json.dump(calendar, f, indent=4)

    print(f"\n[OK] Circuit stats saved for {updated} race(s).")


if __name__ == "__main__":
    update_calendar()
    update_driver_points()
    fetch_circuit_stats()
