import requests
import json
import os
from datetime import datetime, timedelta
import pytz
import time

# ==========================================================
# ⚙️ CONFIGURATION
# ==========================================================
FIND_SCHEDULE = True   # Toggle True to force a full crawl from SEASON_START_DATE
SAVE_PATH = "public/data/nba_schedule.json"
VALID_NETWORKS = {"Prime Video", "Peacock", "ESPN"}
SLEEP_BETWEEN_CALLS = 1.5
MAX_EMPTY_DAYS = 20

# --- Postseason auto-crawl settings ---
POSTSEASON_SCAN_INTERVAL_HOURS = 6               # how often to re-scan during postseason
_STATE_PATH = "public/data/.nba_schedule_last_scan.txt"
# ==========================================================

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0",
    "Accept": "*/*",
    "Referer": "https://www.espn.com/",
}

UTC = pytz.utc
PACIFIC = pytz.timezone("America/Los_Angeles")

# ==========================================================
# DYNAMIC SEASON DATE CALCULATION
# ==========================================================
def get_first_tuesday_on_or_after(year: int, month: int, day: int):
    """Return the first Tuesday on or after the given date."""
    d = datetime(year, month, day).date()
    # weekday(): Monday=0, Tuesday=1, ...
    offset = (1 - d.weekday()) % 7   # days forward to next Tuesday (0 if already Tuesday)
    return d + timedelta(days=offset)

def get_first_saturday_in_april(year: int):
    """Return the first Saturday in April of the given year."""
    apr1 = datetime(year, 4, 1).date()
    # weekday(): Saturday=5
    offset = (5 - apr1.weekday()) % 7
    return apr1 + timedelta(days=offset)

def get_season_dates(today):
    """
    Returns (season_year, season_start, postseason_start, season_end) for the
    NBA season that is current or most recently started relative to today.

    season_year      – the calendar year the season STARTS in (e.g. 2025)
    season_start     – first Tuesday on or after Oct 22 of season_year
                       (NBA regular season opener is always on that Tuesday)
    postseason_start – first Saturday in April of (season_year + 1)
                       (first-round games begin the weekend after the
                        play-in tournament, which is always that first Sat)
    season_end       – June 30 of (season_year + 1)
                       (Finals can run into mid-June; this gives plenty of buffer)
    """
    # Figure out which season "owns" today.
    # The pivot is the regular-season opener of the current calendar year.
    #   - On or after that opener  → we're in THIS year's season
    #   - Before it                → we're still in LAST year's season
    candidate_year = today.year
    candidate_start = get_first_tuesday_on_or_after(candidate_year, 10, 22)

    if today >= candidate_start:
        season_year = candidate_year
    else:
        season_year = candidate_year - 1

    season_start     = get_first_tuesday_on_or_after(season_year, 10, 22)
    postseason_start = get_first_saturday_in_april(season_year + 1)
    season_end       = datetime(season_year + 1, 6, 30).date()

    return season_year, season_start, postseason_start, season_end

today = datetime.now().date()
SEASON_YEAR, SEASON_START_DATE, POSTSEASON_START, SEASON_END_DATE = get_season_dates(today)
print(f"Active season: {SEASON_YEAR} | Start: {SEASON_START_DATE} | "
      f"Postseason: {POSTSEASON_START} | End: {SEASON_END_DATE}")

# ==========================================================
# 📂 Load Existing Schedule (with new-season auto-reset)
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
        os.makedirs(os.path.dirname(SAVE_PATH), exist_ok=True)
        with open(SAVE_PATH, "w", encoding="utf-8") as f:
            json.dump([], f)
        # Also nuke the last-scan state file so postseason auto-crawl doesn't
        # think it already ran for the new season
        if os.path.exists(_STATE_PATH):
            os.remove(_STATE_PATH)
        return [], True

    return data, False

schedule, schedule_was_reset = load_schedule()
if schedule_was_reset:
    print("Schedule was reset. Set FIND_SCHEDULE = True to repopulate.")

seen_ids = {g.get("game_id") for g in schedule if g.get("game_id")}

# ==========================================================
# AUTO-CRAWL: enable FIND_SCHEDULE during postseason if enough
# time has passed since the last scan
# ==========================================================
_crawl_start_date = SEASON_START_DATE   # default: full crawl from season start

if not FIND_SCHEDULE:
    # Only consider auto-crawl when we're in the postseason window
    if POSTSEASON_START <= today <= SEASON_END_DATE:
        # Read last-scan timestamp from state file
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
            _crawl_start_date = today  # only scan forward from today
            print(f"[AUTO] Postseason detected — scanning from {today} (last scan: {last_scan or 'never'})")
        else:
            print(f"[AUTO] Postseason window active but last scan was {hours_since:.1f}h ago — skipping.")
    # else: outside postseason, respect the manual False
else:
    print("[MANUAL] FIND_SCHEDULE forced True — full crawl from SEASON_START_DATE.")

# ==========================================================
# 🏀 PART 1 — FIND SCHEDULE (Optional)
# ==========================================================
if FIND_SCHEDULE:
    print("🔍 Starting schedule fetch...")
    current_date = _crawl_start_date
    empty_days = 0

    while current_date <= SEASON_END_DATE and empty_days < MAX_EMPTY_DAYS:
        date_str_param = current_date.strftime("%Y%m%d")

        url = (
            f"https://site.web.api.espn.com/apis/personalized/v2/scoreboard/header"
            f"?sport=basketball&league=nba&region=us&lang=en&contentorigin=espn"
            f"&configuration=STREAM_MENU&platform=web&features=sfb-all%2Ccutl"
            f"&showAirings=buy%2Clive%2Creplay&tz=America%2FNew_York&dates={date_str_param}"
        )

        print(f"📅 Fetching {date_str_param} ...")
        response = requests.get(url, headers=HEADERS)
        try:
            data = response.json()
        except Exception:
            print(" Invalid or empty JSON — skipping.")
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
            print(f" No games found — {empty_days} empty day(s).")
            current_date += timedelta(days=1)
            time.sleep(SLEEP_BETWEEN_CALLS)
            continue

        empty_days = 0

        for event in events:
            try:
                game_id = event.get("id")

                # Check if this game already exists (handles playoff games
                # that were added with null details and now have real info)
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

                # 🏆 Detect NBA Cup games (works with either note or notes[])
                note_text = (event.get("note") or "").lower()
                notes = event.get("notes", [])
                nba_cup_text = next(
                    (n.get("text") for n in notes if "nba cup" in n.get("text", "").lower()),
                    None
                )
                is_nba_cup = "nba cup" in note_text or nba_cup_text is not None
                nba_cup_label = nba_cup_text or (event.get("note") if "nba cup" in note_text else None)

                if existing_game:
                    # Update existing game with fresh details (covers playoff
                    # games that initially came in with nulls)
                    print(f"Updating game: {away_name} @ {home_name} — {date_clean} {time_clean}")
                    existing_game.update({
                        "matchup": f"{away_name} @ {home_name}",
                        "date": date_clean,
                        "time": time_clean,
                        "location": location,
                        "tv_providers": tv_providers,
                        "game_link": link,
                        "is_nba_cup": is_nba_cup,
                        "tournament": nba_cup_label or None,
                    })
                else:
                    # Brand-new game
                    schedule.append({
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
                        "is_nba_cup": is_nba_cup,
                        "tournament": nba_cup_label or None,
                    })
                    seen_ids.add(game_id)
                    print(f"Added {away_name} @ {home_name} — {date_clean} {time_clean}")

            except Exception as e:
                print(f"Error parsing event: {e}")

        # Sort and persist after every day's batch
        schedule.sort(key=lambda x: (str(x.get("date") or ""), str(x.get("time") or "")))

        os.makedirs(os.path.dirname(SAVE_PATH), exist_ok=True)
        with open(SAVE_PATH, "w", encoding="utf-8") as out:
            json.dump(schedule, out, indent=2, ensure_ascii=False)

        current_date += timedelta(days=1)
        time.sleep(SLEEP_BETWEEN_CALLS)

    print(f"\n Schedule fetch complete — {len(schedule)} total games saved.")

    # Write last-scan timestamp so auto-crawl can throttle next run
    os.makedirs(os.path.dirname(_STATE_PATH), exist_ok=True)
    with open(_STATE_PATH, "w") as _sf:
        _sf.write(datetime.now().isoformat())


# ==========================================================
# 🧾 PART 2 — UPDATE GAME RESULTS + SCORES
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
        # Using explicit `is not None` so that null scores/winners still get updated.
        if (game.get("status") == "final" and
            game.get("winner") is not None and
            game.get("winner") != "" and
            game.get("home_score") is not None and
            game.get("away_score") is not None):
            continue

        total_checked += 1

        # Fetch scoreboard data for that date
        date_str_param = game_date.strftime("%Y%m%d")
        url = (
            f"https://site.web.api.espn.com/apis/personalized/v2/scoreboard/header"
            f"?sport=basketball&league=nba&region=us&lang=en&contentorigin=espn"
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
                # Pull winner from API first; fall back to score comparison
                winner = next((t.get("displayName") for t in competitors if t.get("winner")), None)
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
                    # NBA doesn't have ties in regulation but OT is possible;
                    # if scores are somehow equal mark it so we don't loop forever
                    else:
                        winner = "TIE"

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
                # Game currently live
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
                # Scheduled / not started yet: clear any stale scores
                game.update({
                    "status": "scheduled",
                    "home_score": None,
                    "away_score": None,
                })
                for field in ["period", "clock", "winner"]:
                    game.pop(field, None)

            # Found our game — no need to keep scanning this date's events
            break

        time.sleep(SLEEP_BETWEEN_CALLS)

    print(f"\nUpdate complete: {updated_count} games finalized, {live_count} games live, {total_checked} total checked")

    # Final sort and save
    schedule.sort(key=lambda x: (str(x.get("date") or ""), str(x.get("time") or "")))
    with open(SAVE_PATH, "w", encoding="utf-8") as out:
        json.dump(schedule, out, indent=2, ensure_ascii=False)

    print(f"Schedule saved to {SAVE_PATH}")