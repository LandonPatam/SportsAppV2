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
            print(f"[{race_name}] Results fetched — Winner: {winner_name}{sprint_tag}")
        # If positions is empty, the page isn't ready yet — leave the race entry untouched
        # so the next run will try again once results are published

    # Summary output
    if last_completed is None and updated == 0:
        print("Season hasn't started yet — no results to fetch.")
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


TEAMS_PATH = "public/data/f1_teams.json"


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

    print(f"Fetched standings for {len(result)} drivers "
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

    with open(TEAMS_PATH, "r") as f:
        teams = json.load(f)

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

    with open(TEAMS_PATH, "w") as f:
        json.dump(teams, f, indent=4)

    print(f"Points written for {updated} driver(s) in {TEAMS_PATH}.")
    if unmatched:
        print(f"Could not match (set to 0): {', '.join(unmatched)}")


if __name__ == "__main__":
    update_calendar()
    update_driver_points()