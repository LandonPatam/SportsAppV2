import requests
import json
import os
from datetime import datetime, timedelta
import pytz
import time

# ==========================================================
# CONFIGURATION
# ==========================================================
FIND_SCHEDULE = os.getenv("NFL_FIND_SCHEDULE", "").lower() in {"1", "true", "yes"}   # env override to crawl schedule
SAVE_PATH = "public/data/nfl_schedule.json"
TEMP_PATH = SAVE_PATH + ".tmp"
VALID_NETWORKS = {"ESPN", "ABC", "FOX", "CBS", "NBC", "NFL Network", "Prime Video", "Peacock"}
SLEEP_BETWEEN_CALLS = float(os.getenv("NFL_SCHEDULE_SLEEP", "1.5"))
MAX_EMPTY_DAYS = 20
ENABLE_UPCOMING_SEASON_AUTO_DETECT = True

# --- Postseason auto-crawl settings ---
POSTSEASON_SCAN_INTERVAL_HOURS = 6               # how often to re-scan during playoffs
_STATE_PATH = "public/data/.nfl_schedule_last_scan.txt"
# ==========================================================

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0",
    "Accept": "*/*",
    "Referer": "https://www.espn.com/",
}

UTC = pytz.utc
PACIFIC = pytz.timezone("America/Los_Angeles")

def get_espn_schedule_url(date_obj):
    date_str_param = date_obj.strftime("%Y%m%d")
    return (
        f"https://site.web.api.espn.com/apis/personalized/v2/scoreboard/header"
        f"?sport=football&league=nfl&region=us&lang=en&contentorigin=espn"
        f"&configuration=STREAM_MENU&platform=web&features=sfb-all%2Ccutl"
        f"&showAirings=buy%2Clive%2Creplay&tz=America%2FNew_York&dates={date_str_param}"
    )

def fetch_espn_events_for_date(date_obj):
    response = requests.get(get_espn_schedule_url(date_obj), headers=HEADERS, timeout=15)
    data = response.json()
    return (
        data.get("sports", [])[0]
        .get("leagues", [])[0]
        .get("events", [])
        if data.get("sports")
        else []
    )

def find_first_regular_season_event_date(approx_start):
    for offset in range(-7, 22):
        date_obj = approx_start + timedelta(days=offset)
        try:
            events = fetch_espn_events_for_date(date_obj)
        except Exception:
            continue

        regular_events = [event for event in events if str(event.get("seasonType")) == "2"]
        if not regular_events:
            continue

        first_event = min(regular_events, key=lambda event: event.get("date", ""))
        try:
            dt_utc = datetime.strptime(first_event["date"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)
            return dt_utc.astimezone(PACIFIC).date()
        except Exception:
            return date_obj

    return approx_start

# ==========================================================
# SAFE ATOMIC WRITE HELPER
# ==========================================================
def atomic_write_json(data, save_path: str, temp_path: str):
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(temp_path, save_path)

# ==========================================================
# DYNAMIC SEASON DATE CALCULATION
# ==========================================================
def get_labor_day(year: int):
    """Labor Day = first Monday in September."""
    # Sept 1 — figure out what day of the week it lands on, then advance to Monday
    sept1 = datetime(year, 9, 1).date()
    # weekday(): Monday=0 ... Sunday=6
    days_until_monday = (7 - sept1.weekday()) % 7
    if days_until_monday == 0 and sept1.weekday() != 0:
        days_until_monday = 7
    return sept1 + timedelta(days=days_until_monday)

def get_season_dates(today: object) -> tuple:
    """
    Returns (season_year, season_start, season_end) for the NFL season
    that is current or most recently started relative to today.

    season_year  – the calendar year the season STARTS in (e.g. 2025 for the 2025 season)
    season_start – Thursday after Labor Day (NFL Kickoff game)
    season_end   – mid-February of the following year (Super Bowl buffer)
    """
    # The NFL season that "owns" a given date:
    #   - Before the kickoff Thursday of year Y  → still the (Y-1) season
    #   - On or after that Thursday              → the Y season
    # We check the current year's kickoff first; if today is before it, fall back to last year.
    candidate_year = today.year
    labor_day = get_labor_day(candidate_year)
    kickoff_thursday = labor_day + timedelta(days=3)  # Thursday after Labor Day

    previous_season_end = datetime(candidate_year, 2, 16).date()

    if today >= kickoff_thursday:
        season_year = candidate_year
    elif ENABLE_UPCOMING_SEASON_AUTO_DETECT and today > previous_season_end:
        try:
            has_published_schedule = False
            for offset in range(0, 21):
                if fetch_espn_events_for_date(kickoff_thursday + timedelta(days=offset)):
                    has_published_schedule = True
                    break
            season_year = candidate_year if has_published_schedule else candidate_year - 1
            if has_published_schedule:
                print(f"[AUTO] Upcoming {candidate_year} NFL schedule is available on ESPN.")
        except Exception as e:
            print(f"[WARN] Could not check upcoming NFL schedule availability: {e}")
            season_year = candidate_year - 1
    else:
        season_year = candidate_year - 1

    # Recalculate kickoff for the resolved season year
    labor_day = get_labor_day(season_year)
    estimated_start  = labor_day + timedelta(days=3)           # Traditional kickoff Thursday
    season_start     = find_first_regular_season_event_date(estimated_start)
    postseason_start = season_start + timedelta(weeks=18)       # ~Wild Card weekend
    season_end       = datetime(season_year + 1, 2, 16).date()  # Day after latest possible Super Bowl

    return season_year, season_start, postseason_start, season_end

today = datetime.now().date()
SEASON_YEAR, SEASON_START_DATE, POSTSEASON_START, SEASON_END_DATE = get_season_dates(today)
print(f"Active season: {SEASON_YEAR} | Start: {SEASON_START_DATE} | "
      f"Postseason: {POSTSEASON_START} | End: {SEASON_END_DATE}")

# ==========================================================
# Load Existing Schedule (with new-season auto-reset)
# ==========================================================
def load_schedule() -> tuple:
    """
    Loads the schedule JSON.  If the file contains games from a previous
    season (detected by comparing the earliest game date against the current
    SEASON_START_DATE), the file is wiped and an empty list is returned so
    FIND_SCHEDULE can repopulate it cleanly.

    Returns (schedule_list, was_reset: bool)
    """
    if not os.path.exists(SAVE_PATH):
        return [], False

    with open(SAVE_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not data:
        return [], False

    # Find the earliest valid game date in the file
    earliest = None
    for g in data:
        d = g.get("date")
        if not d:
            continue
        try:
            parsed = datetime.strptime(d, "%Y-%m-%d").date()
            if earliest is None or parsed < earliest:
                earliest = parsed
        except (ValueError, TypeError):
            continue

    # If every game predates the current season's start, this is a stale file
    if earliest is not None and earliest < SEASON_START_DATE:
        print(f"[NEW SEASON DETECTED] Earliest game in JSON is {earliest}, "
              f"but current season starts {SEASON_START_DATE}. Resetting schedule.")
        atomic_write_json([], SAVE_PATH, TEMP_PATH)
        if os.path.exists(_STATE_PATH):
            os.remove(_STATE_PATH)
        return [], True

    return data, False

schedule, schedule_was_reset = load_schedule()
if schedule_was_reset:
    FIND_SCHEDULE = True
    print("[AUTO] New season detected — auto-populating schedule.")

# Ensure each game has a UTC timestamp for reliable sorting
def ensure_ts_utc(g: dict) -> int:
    ts = g.get("ts_utc")
    if isinstance(ts, int) and ts > 0:
        return ts
    # Try to build from date + time in PT
    date_str = (g.get("date") or "")
    time_str = (g.get("time") or "").strip()
    if date_str and time_str and time_str.upper() != "TBA":
        try:
            # Time was saved in PT; parse then convert to UTC epoch
            dt_local = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %I:%M %p")
            dt_pt = PACIFIC.localize(dt_local)
            dt_u = dt_pt.astimezone(UTC)
            g["ts_utc"] = int(dt_u.timestamp())
            return g["ts_utc"]
        except Exception:
            pass
    # Fallback: noon PT of date
    if date_str:
        try:
            dt_local = datetime.strptime(f"{date_str} 12:00 PM", "%Y-%m-%d %I:%M %p")
            dt_pt = PACIFIC.localize(dt_local)
            dt_u = dt_pt.astimezone(UTC)
            g["ts_utc"] = int(dt_u.timestamp())
            return g["ts_utc"]
        except Exception:
            pass
    g["ts_utc"] = 0
    return 0

# Normalize any pre-existing items
for g in schedule:
    ensure_ts_utc(g)

seen_ids = {g.get("game_id") for g in schedule if g.get("game_id")}

# ==========================================================
# AUTO-CRAWL during postseason
# ==========================================================
_crawl_start_date = SEASON_START_DATE

if not FIND_SCHEDULE:
    if POSTSEASON_START <= today <= SEASON_END_DATE:
        last_scan = None
        if os.path.exists(_STATE_PATH):
            try:
                with open(_STATE_PATH, "r") as _sf:
                    last_scan = datetime.fromisoformat(_sf.read().strip())
            except Exception:
                last_scan = None

        hours_since = (
            (datetime.now() - last_scan).total_seconds() / 3600
            if last_scan else float("inf")
        )

        if hours_since >= POSTSEASON_SCAN_INTERVAL_HOURS:
            FIND_SCHEDULE = True
            _crawl_start_date = today
            print(f"[AUTO] Postseason detected — scanning from {today} (last scan: {last_scan or 'never'})")
        else:
            print(f"[AUTO] Postseason window active but last scan was {hours_since:.1f}h ago — skipping.")
else:
    if not schedule_was_reset:
        print("[MANUAL] FIND_SCHEDULE forced True — full crawl from SEASON_START_DATE.")

# ==========================================================
# PART 1 – FIND SCHEDULE (Optional)
# ==========================================================
if FIND_SCHEDULE:
    print("Starting NFL schedule fetch...")
    current_date = _crawl_start_date
    empty_days = 0

    while current_date <= SEASON_END_DATE and empty_days < MAX_EMPTY_DAYS:
        date_str_param = current_date.strftime("%Y%m%d")

        url = (
            f"https://site.web.api.espn.com/apis/personalized/v2/scoreboard/header"
            f"?sport=football&league=nfl&region=us&lang=en&contentorigin=espn"
            f"&configuration=STREAM_MENU&platform=web&features=sfb-all%2Ccutl"
            f"&showAirings=buy%2Clive%2Creplay&tz=America%2FNew_York&dates={date_str_param}"
        )

        print(f"Fetching {date_str_param} ...")
        response = requests.get(url, headers=HEADERS)
        try:
            data = response.json()
        except Exception:
            print("Invalid or empty JSON – skipping.")
            current_date += timedelta(days=1)
            continue

        events = (
            data.get("sports", [])[0]
            .get("leagues", [])[0]
            .get("events", [])
            if data.get("sports")
            else []
        )

        if not events:
            empty_days += 1
            print(f"No games found – {empty_days} empty day(s).")
            current_date += timedelta(days=1)
            time.sleep(SLEEP_BETWEEN_CALLS)
            continue

        empty_days = 0

        for event in events:
            try:
                game_id = event.get("id")
                
                # Check if this game already exists
                existing_game = next((g for g in schedule if g.get("game_id") == game_id), None)
                
                date_str = event.get("date")
                location = event.get("location", "")
                link = event.get("link")

                # Convert UTC → PT
                dt_utc = datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)
                dt_pt = dt_utc.astimezone(PACIFIC)
                date_clean = dt_pt.strftime("%Y-%m-%d")
                time_clean = (
                    dt_pt.strftime("%-I:%M %p") if os.name != "nt"
                    else dt_pt.strftime("%I:%M %p").lstrip("0")
                )

                competitors = event.get("competitors", [])
                away_team = next((t for t in competitors if t.get("homeAway") == "away"), {})
                home_team = next((t for t in competitors if t.get("homeAway") == "home"), {})

                away_name = away_team.get("displayName", "")
                home_name = home_team.get("displayName", "")

                broadcasts = event.get("broadcasts", [])
                tv_providers = [
                    b.get("name")
                    for b in broadcasts
                    if b.get("name") in VALID_NETWORKS
                ]

                if existing_game:
                    # Update existing playoff game with new details
                    print(f"Updating playoff game: {away_name} @ {home_name} – {date_clean} {time_clean}")
                    existing_game.update({
                        "matchup": f"{away_name} @ {home_name}",
                        "date": date_clean,
                        "time": time_clean,
                        "location": location,
                        "tv_providers": tv_providers,
                        "game_link": link,
                        "ts_utc": int(dt_utc.timestamp()),
                    })
                else:
                    # Add new game
                    item = {
                        "game_id": game_id,
                        "matchup": f"{away_name} @ {home_name}",
                        "date": date_clean,
                        "time": time_clean,
                        "location": location,
                        "tv_providers": tv_providers,
                        "game_link": link,
                        "winner": None,
                        "home_score": None,
                        "away_score": None,
                        "ts_utc": int(dt_utc.timestamp()),
                    }
                    schedule.append(item)
                    seen_ids.add(game_id)
                    print(f"Added {away_name} @ {home_name} – {date_clean} {time_clean}")

            except Exception as e:
                print(f"Error parsing event: {e}")

        # Sort schedule by date then kickoff time (UTC)
        for g in schedule:
            ensure_ts_utc(g)
        schedule.sort(key=lambda x: (str(x.get("date") or ""), int(x.get("ts_utc") or 0)))

        atomic_write_json(schedule, SAVE_PATH, TEMP_PATH)

        current_date += timedelta(days=1)
        time.sleep(SLEEP_BETWEEN_CALLS)

    print(f"\nSchedule fetch complete – {len(schedule)} total games saved.")

    os.makedirs(os.path.dirname(_STATE_PATH), exist_ok=True)
    with open(_STATE_PATH, "w") as _sf:
        _sf.write(datetime.now().isoformat())


# ==========================================================
# PART 2 – UPDATE GAME RESULTS + SCORES
# ==========================================================
# Re-read from disk (PART 1 may have just written fresh data)
if os.path.exists(SAVE_PATH):
    with open(SAVE_PATH, "r", encoding="utf-8") as f:
        schedule = json.load(f)
else:
    schedule = []

if not schedule:
    print("No games in schedule to update. Run with FIND_SCHEDULE = True first.")
else:
    updated_count = 0
    total_checked = 0
    live_count = 0

    for game in schedule:
        # Skip games with null dates (playoff games not yet scheduled)
        if not game.get("date"):
            print(f"Skipping game with null date: {game.get('game_id', 'unknown')}")
            continue
        
        try:
            game_date = datetime.strptime(game["date"], "%Y-%m-%d").date()
        except (ValueError, TypeError) as e:
            print(f"Error parsing date for game {game.get('game_id')}: {e}")
            continue

        # Skip future games
        if game_date > today:
            continue

        # Only skip if the game is truly complete with all data populated.
        # This allows games with null values to be updated.
        if (game.get("status") == "final" and 
            game.get("winner") is not None and 
            game.get("home_score") is not None and 
            game.get("away_score") is not None and
            game.get("winner") != ""):
            continue

        total_checked += 1

        # Fetch scoreboard data for that date
        date_str_param = game_date.strftime("%Y%m%d")
        url = (
            f"https://site.web.api.espn.com/apis/personalized/v2/scoreboard/header"
            f"?sport=football&league=nfl&region=us&lang=en&contentorigin=espn"
            f"&configuration=STREAM_MENU&platform=web&features=sfb-all%2Ccutl"
            f"&showAirings=buy%2Clive%2Creplay&tz=America%2FNew_York&dates={date_str_param}"
        )

        response = requests.get(url, headers=HEADERS)
        try:
            data = response.json()
        except Exception:
            continue

        events = (
            data.get("sports", [])[0]
            .get("leagues", [])[0]
            .get("events", [])
            if data.get("sports")
            else []
        )

        for event in events:
            if event.get("id") != game["game_id"]:
                continue

            # Get status info
            status = event.get("status", "")
            fullStatus = event.get("fullStatus", {})
            status_type = fullStatus.get("type", {})
            status_state = status_type.get("state", "")
            status_name = status_type.get("name", "")
            status_completed = status_type.get("completed", False)

            competitors = event.get("competitors", [])
            home_team = next((t for t in competitors if t.get("homeAway") == "home"), {})
            away_team = next((t for t in competitors if t.get("homeAway") == "away"), {})
            home_score = home_team.get("score")
            away_score = away_team.get("score")

            # Determine if game is final
            is_final = (
                status == "post"
                or status_state == "post"
                or status_name == "STATUS_FINAL"
                or status_completed
            )

            # Determine if game is live
            is_live = (
                status == "in"
                or status_state == "in"
                or status_name in ["STATUS_HALFTIME", "STATUS_END_PERIOD"]
            )

            if is_final:
                winner = next((t.get("displayName") for t in competitors if t.get("winner")), None)
                # Fallback winner calculation if API didn't set one (e.g. ties or missing flag)
                try:
                    hs = int(home_score) if home_score is not None else None
                    as_ = int(away_score) if away_score is not None else None
                except (ValueError, TypeError):
                    hs = as_ = None
                if not winner and hs is not None and as_ is not None:
                    if hs > as_:
                        winner = home_team.get("displayName") or home_team.get("team", {}).get("displayName")
                    elif as_ > hs:
                        winner = away_team.get("displayName") or away_team.get("team", {}).get("displayName")
                    else:
                        winner = "TIE"
                        game["tie"] = True
                game.update({
                    "winner": winner,
                    "home_score": home_score,
                    "away_score": away_score,
                    "status": "final"
                })
                for field in ["period", "clock"]:
                    game.pop(field, None)
                updated_count += 1
                print(f"Updated final: {game.get('matchup')} - {winner} wins {away_score}-{home_score}")

            elif is_live and game_date == today:
                game.update({
                    "home_score": home_score,
                    "away_score": away_score,
                    "status": "live",
                    "period": fullStatus.get("period"),
                    "clock": fullStatus.get("displayClock", "")
                })
                game.pop("winner", None)
                live_count += 1
                print(f"Updated live: {game.get('matchup')} - {away_score}-{home_score}")

            else:
                # Scheduled / not started yet: ensure scores cleared and status set
                game.update({
                    "status": "scheduled",
                    "home_score": None,
                    "away_score": None,
                })
                for field in ["period", "clock", "winner"]:
                    game.pop(field, None)

            # Break after finding the matching game — no need to keep scanning
            break

        time.sleep(SLEEP_BETWEEN_CALLS)

    print(f"\nUpdate complete: {updated_count} games finalized, {live_count} games live, {total_checked} total checked")

    # Final sort and save updated results
    for g in schedule:
        ensure_ts_utc(g)
    schedule.sort(key=lambda x: (str(x.get("date") or ""), int(x.get("ts_utc") or 0)))
    atomic_write_json(schedule, SAVE_PATH, TEMP_PATH)

    print(f"Schedule saved to {SAVE_PATH}")
