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


if __name__ == "__main__":
    update_calendar()