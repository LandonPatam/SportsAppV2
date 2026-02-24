import requests
import json
import os
from datetime import datetime, timedelta
import pytz
import time

# ==========================================================
# ⚙️ CONFIGURATION
# ==========================================================
FIND_SCHEDULE = False   # Toggle True to force a full crawl from SEASON_START_DATE
SAVE_PATH = "public/data/nba_schedule.json"
TEMP_PATH = SAVE_PATH + ".tmp"  # Path for safe swapping
VALID_NETWORKS = {"Prime Video", "Peacock", "ESPN", "ABC"}
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
# SAFE ATOMIC WRITE HELPER
# Writes JSON to a .tmp file, flushes to OS buffer AND disk,
# then atomically renames it — so the live file is NEVER
# partially written from the browser's perspective.
# ==========================================================
def atomic_write_json(data, save_path: str, temp_path: str):
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.flush()          # flush Python buffers → OS buffer
        os.fsync(f.fileno())  # flush OS buffer → disk
    os.replace(temp_path, save_path)  # atomic rename


# ==========================================================
# DYNAMIC SEASON DATE CALCULATION
# ==========================================================
def get_first_tuesday_on_or_after(year: int, month: int, day: int):
    """Return the first Tuesday on or after the given date."""
    d = datetime(year, month, day).date()
    offset = (1 - d.weekday()) % 7
    return d + timedelta(days=offset)

def get_first_saturday_in_april(year: int):
    """Return the first Saturday in April of the given year."""
    apr1 = datetime(year, 4, 1).date()
    offset = (5 - apr1.weekday()) % 7
    return apr1 + timedelta(days=offset)

def get_season_dates(today):
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
    if not os.path.exists(SAVE_PATH):
        return [], False

    with open(SAVE_PATH, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print("[WARN] Existing schedule JSON is corrupt — starting fresh.")
            return [], True

    if not data:
        return [], False

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
    print("Schedule was reset. Set FIND_SCHEDULE = True to repopulate.")

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
                existing_game = next((g for g in schedule if g.get("game_id") == game_id), None)

                date_str = event.get("date")
                location = event.get("location", "")
                link = event.get("link")

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

                note_text = (event.get("note") or "").lower()
                notes = event.get("notes", [])
                nba_cup_text = next(
                    (n.get("text") for n in notes if "nba cup" in n.get("text", "").lower()),
                    None
                )
                is_nba_cup = "nba cup" in note_text or nba_cup_text is not None
                nba_cup_label = nba_cup_text or (event.get("note") if "nba cup" in note_text else None)

                if existing_game:
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

        schedule.sort(key=lambda x: (str(x.get("date") or ""), str(x.get("time") or "")))
        atomic_write_json(schedule, SAVE_PATH, TEMP_PATH)

        current_date += timedelta(days=1)
        time.sleep(SLEEP_BETWEEN_CALLS)

    print(f"\n Schedule fetch complete — {len(schedule)} total games saved.")

    os.makedirs(os.path.dirname(_STATE_PATH), exist_ok=True)
    with open(_STATE_PATH, "w") as _sf:
        _sf.write(datetime.now().isoformat())


# ==========================================================
# 🧾 PART 2 — UPDATE GAME RESULTS + SCORES
# ==========================================================
if os.path.exists(SAVE_PATH):
    with open(SAVE_PATH, "r", encoding="utf-8") as f:
        try:
            schedule = json.load(f)
        except json.JSONDecodeError:
            print("[WARN] Schedule JSON corrupt on Part 2 load — skipping update.")
            schedule = []
else:
    schedule = []

if not schedule:
    print("No games in schedule to update. Run with FIND_SCHEDULE = True first.")
else:
    updated_count = 0
    total_checked = 0
    live_count = 0

    for game in schedule:
        if not game.get("date"):
            print(f"Skipping game with null date: {game.get('game_id', 'unknown')}")
            continue

        try:
            game_date = datetime.strptime(game["date"], "%Y-%m-%d").date()
        except (ValueError, TypeError) as e:
            print(f"Error parsing date for game {game.get('game_id')}: {e}")
            continue

        if game_date > today:
            continue

        if (game.get("status") == "final" and
            game.get("winner") is not None and
            game.get("winner") != "" and
            game.get("home_score") is not None and
            game.get("away_score") is not None):
            continue

        total_checked += 1

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

            is_final = (
                status == "post"
                or status_state == "post"
                or status_name == "STATUS_FINAL"
                or status_completed
            )

            is_live = (
                status == "in"
                or status_state == "in"
                or status_name in ["STATUS_HALFTIME", "STATUS_END_PERIOD"]
            )

            if is_final:
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
                game.update({
                    "status": "scheduled",
                    "home_score": None,
                    "away_score": None,
                })
                for field in ["period", "clock", "winner"]:
                    game.pop(field, None)

            break

        time.sleep(SLEEP_BETWEEN_CALLS)

    print(f"\nUpdate complete: {updated_count} games finalized, {live_count} games live, {total_checked} total checked")

    schedule.sort(key=lambda x: (str(x.get("date") or ""), str(x.get("time") or "")))
    atomic_write_json(schedule, SAVE_PATH, TEMP_PATH)

    print(f"Schedule saved to {SAVE_PATH}")