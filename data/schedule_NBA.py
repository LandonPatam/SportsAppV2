import re
from scoreboard_client import ScoreboardClient, ScoreboardUnavailable, acquire_script_lock
import json
import os
import sys
from datetime import datetime, timedelta

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import pytz
import time

_script_lock = acquire_script_lock("schedule_NBA")
scoreboard_client = ScoreboardClient()
LIVE_ONLY = os.getenv("SPORTS_LIVE_ONLY") == "1"

# ==========================================================
# ⚙️ CONFIGURATION
# ==========================================================
FIND_SCHEDULE = os.getenv("NBA_FIND_SCHEDULE", "").lower() in {"1", "true", "yes"}   # env override to force a full crawl
if LIVE_ONLY:
    FIND_SCHEDULE = False
SAVE_PATH = "public/data/nba_schedule.json"
TEMP_PATH = SAVE_PATH + ".tmp"  # Path for safe swapping
SEASONS_MANIFEST_PATH = "public/data/nba_seasons.json"
VALID_NETWORKS = {"Prime Video", "Peacock", "ESPN", "ABC", "NBC"}
SLEEP_BETWEEN_CALLS = float(os.getenv("NBA_SCHEDULE_SLEEP", "1.5"))
MAX_EMPTY_DAYS = 20
ENABLE_UPCOMING_SEASON_AUTO_DETECT = True
UPCOMING_SEASON_CHECK_INTERVAL_HOURS = 24

# --- Postseason auto-crawl settings ---
POSTSEASON_SCAN_INTERVAL_HOURS = 1               # how often to re-scan during postseason
_STATE_PATH = "public/data/.nba_schedule_last_scan.txt"
_UPCOMING_STATE_PATH = "public/data/.nba_upcoming_schedule_last_check.txt"
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
        f"?sport=basketball&league=nba&region=us&lang=en&contentorigin=espn"
        f"&configuration=STREAM_MENU&platform=web&features=sfb-all%2Ccutl"
        f"&showAirings=buy%2Clive%2Creplay&tz=America%2FNew_York&dates={date_str_param}"
    )

def fetch_espn_events_for_date(date_obj):
    data = scoreboard_client.get_json(get_espn_schedule_url(date_obj), HEADERS)
    return (
        data.get("sports", [])[0]
        .get("leagues", [])[0]
        .get("events", [])
        if data.get("sports")
        else []
    )

def should_check_upcoming_schedule():
    if not os.path.exists(_UPCOMING_STATE_PATH):
        return True
    try:
        with open(_UPCOMING_STATE_PATH, "r", encoding="utf-8") as f:
            last_check = datetime.fromisoformat(f.read().strip())
        return (datetime.now() - last_check).total_seconds() / 3600 >= UPCOMING_SEASON_CHECK_INTERVAL_HOURS
    except Exception:
        return True

def mark_upcoming_schedule_checked():
    os.makedirs(os.path.dirname(_UPCOMING_STATE_PATH), exist_ok=True)
    with open(_UPCOMING_STATE_PATH, "w", encoding="utf-8") as f:
        f.write(datetime.now().isoformat())

def get_espn_season_value(season_start_year: int):
    # ESPN stores NBA season by ending year: 2026-27 is returned as season 2027.
    return season_start_year + 1

def find_first_regular_season_event_date(approx_start, season_year, force_check=False):
    if not force_check and not should_check_upcoming_schedule():
        return None

    espn_season = get_espn_season_value(season_year)
    try:
        for offset in range(-30, 46):
            date_obj = approx_start + timedelta(days=offset)
            try:
                events = fetch_espn_events_for_date(date_obj)
            except ScoreboardUnavailable:
                raise
            except Exception as e:
                print(f"[WARN] Could not check NBA schedule for {date_obj}: {e}")
                continue
            regular_events = [
                event for event in events
                if str(event.get("seasonType")) == "2" and int(event.get("season", 0) or 0) == espn_season
            ]
            if not regular_events:
                continue

            first_event = min(regular_events, key=lambda event: event.get("date", ""))
            try:
                dt_utc = datetime.strptime(first_event["date"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)
                return dt_utc.astimezone(PACIFIC).date()
            except Exception:
                return date_obj
        return None
    finally:
        if sys.exc_info()[0] is None:
            mark_upcoming_schedule_checked()

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
        f.flush()
        os.fsync(f.fileno())
    # On Windows, os.replace can fail if the target is locked; fall back to direct write
    try:
        os.replace(temp_path, save_path)
    except PermissionError:
        with open(save_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        try:
            os.remove(temp_path)
        except OSError:
            pass

def season_label_for_year(season_year: int) -> str:
    return f"{season_year}-{str(season_year + 1)[-2:]}"

def update_seasons_manifest(season_label: str, season_year: int):
    manifest = {"current": season_label, "seasons": []}
    if os.path.exists(SEASONS_MANIFEST_PATH):
        try:
            with open(SEASONS_MANIFEST_PATH, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            if isinstance(loaded, dict):
                manifest.update(loaded)
        except Exception:
            pass

    seasons = [
        s for s in manifest.get("seasons", [])
        if isinstance(s, dict) and s.get("id") != season_label
    ]
    seasons.append({
        "id": season_label,
        "label": season_label,
        "start_year": season_year,
        "schedule": f"nba_schedule_{season_label}.json",
        "team_stats": f"espn_NBA_team_stats_{season_label}.json",
        "player_stats": f"espn_NBA_player_stats_{season_label}.json",
    })
    seasons.sort(key=lambda s: int(s.get("start_year", 0) or 0), reverse=True)
    manifest["current"] = season_label
    manifest["seasons"] = seasons
    atomic_write_json(manifest, SEASONS_MANIFEST_PATH, SEASONS_MANIFEST_PATH + ".tmp")

def write_schedule_json(data):
    atomic_write_json(data, SEASON_SAVE_PATH, SEASON_SAVE_PATH + ".tmp")
    atomic_write_json(data, SAVE_PATH, TEMP_PATH)
    update_seasons_manifest(SEASON_LABEL, SEASON_YEAR)


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

def find_existing_schedule_start_for_year(season_year: int):
    if not os.path.exists(SAVE_PATH):
        return None
    try:
        with open(SAVE_PATH, "r", encoding="utf-8-sig") as f:
            schedule = json.load(f)
        dates = [
            datetime.strptime(g["date"], "%Y-%m-%d").date()
            for g in schedule
            if g.get("date")
        ]
    except Exception:
        return None

    season_dates = [
        d for d in dates
        if d.year == season_year and d.month >= 9
    ]
    return min(season_dates) if season_dates else None

def get_season_dates(today):
    candidate_year = today.year
    candidate_start = get_first_tuesday_on_or_after(candidate_year, 10, 22)
    previous_season_end = datetime(candidate_year, 6, 30).date()

    if today >= candidate_start:
        season_year = candidate_year
    elif ENABLE_UPCOMING_SEASON_AUTO_DETECT and today > previous_season_end:
        existing_start = find_existing_schedule_start_for_year(candidate_year)
        if existing_start:
            season_year = candidate_year
            season_start = existing_start
            postseason_start = get_first_saturday_in_april(season_year + 1)
            season_end = datetime(season_year + 1, 6, 30).date()
            return season_year, season_start, postseason_start, season_end
        detected_start = find_first_regular_season_event_date(candidate_start, candidate_year, force_check=FIND_SCHEDULE)
        if detected_start:
            print(f"[AUTO] Upcoming {candidate_year} NBA schedule is available on ESPN.")
            season_year = candidate_year
            season_start = detected_start
            postseason_start = get_first_saturday_in_april(season_year + 1)
            season_end = datetime(season_year + 1, 6, 30).date()
            return season_year, season_start, postseason_start, season_end
        season_year = candidate_year - 1
    else:
        season_year = candidate_year - 1

    estimated_start  = get_first_tuesday_on_or_after(season_year, 10, 22)
    detected_start   = find_first_regular_season_event_date(estimated_start, season_year, force_check=today >= estimated_start)
    season_start     = detected_start or estimated_start
    postseason_start = get_first_saturday_in_april(season_year + 1)
    season_end       = datetime(season_year + 1, 6, 30).date()

    return season_year, season_start, postseason_start, season_end

today = datetime.now(PACIFIC).date()
if LIVE_ONLY:
    with open(SAVE_PATH, encoding="utf-8-sig") as live_file:
        live_schedule = json.load(live_file)
    known_dates = [datetime.strptime(g["date"], "%Y-%m-%d").date()
                   for g in live_schedule if g.get("date")]
    known_start = min(known_dates)
    known_year = known_start.year if known_start.month >= 7 else known_start.year - 1
    # Reuse the published season without network discovery during live polling.
    SEASON_YEAR, SEASON_START_DATE = known_year, known_start
    POSTSEASON_START = get_first_saturday_in_april(known_year + 1)
    SEASON_END_DATE = datetime(known_year + 1, 6, 30).date()
else:
    SEASON_YEAR, SEASON_START_DATE, POSTSEASON_START, SEASON_END_DATE = get_season_dates(today)
SEASON_LABEL = season_label_for_year(SEASON_YEAR)
SEASON_SAVE_PATH = f"public/data/nba_schedule_{SEASON_LABEL}.json"
print(f"Active season: {SEASON_YEAR} | Start: {SEASON_START_DATE} | "
      f"Postseason: {POSTSEASON_START} | End: {SEASON_END_DATE}")

# ==========================================================
# 📂 Load Existing Schedule (with new-season auto-reset)
# ==========================================================
def load_schedule() -> tuple:
    load_path = SEASON_SAVE_PATH if os.path.exists(SEASON_SAVE_PATH) else SAVE_PATH
    if not os.path.exists(load_path):
        return [], False

    with open(load_path, "r", encoding="utf-8-sig") as f:
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
        write_schedule_json([])
        if os.path.exists(_STATE_PATH):
            os.remove(_STATE_PATH)
        return [], True

    return data, False

schedule, schedule_was_reset = load_schedule()
if schedule_was_reset:
    FIND_SCHEDULE = True
    print("[AUTO] New season detected — auto-populating schedule.")

seen_ids = {g.get("game_id") for g in schedule if g.get("game_id")}

# ==========================================================
# AUTO-CRAWL during postseason
# ==========================================================
_crawl_start_date = SEASON_START_DATE

if not FIND_SCHEDULE:
    if not LIVE_ONLY and POSTSEASON_START <= today <= SEASON_END_DATE:
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
            # Look back up to 10 days so games played before the last scan aren't missed.
            # This is critical for catching early playoff series games (Games 1 & 2) that
            # were played before the scraper first ran in postseason mode.
            _crawl_start_date = max(POSTSEASON_START, today - timedelta(days=10))
            print(f"[AUTO] Postseason detected — scanning from {_crawl_start_date} (last scan: {last_scan or 'never'})")
        else:
            print(f"[AUTO] Postseason window active but last scan was {hours_since:.1f}h ago — skipping.")
else:
    print("[MANUAL] FIND_SCHEDULE forced True — full crawl from SEASON_START_DATE.")

# ==========================================================
# 🏀 PRE-COMPUTE DECIDED PLAYOFF SERIES
# Used in Part 1 to skip re-adding "If Necessary" games for
# series that are already over (one team has 4 wins).
# ==========================================================
_decided_series: set = set()
_sw: dict = {}
for _g in schedule:
    if not _g.get("is_playoff") or _g.get("status") != "final" or not _g.get("winner"):
        continue
    _sa = _g["matchup"].split("@")[0].strip()
    _sh = _g["matchup"].split("@")[1].strip()
    _sk = tuple(sorted([_sa, _sh]))
    _sw.setdefault(_sk, {})
    _sw[_sk][_g["winner"]] = _sw[_sk].get(_g["winner"], 0) + 1
for _sk, _wins in _sw.items():
    if any(w >= 4 for w in _wins.values()):
        _decided_series.add(_sk)

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
        try:
            data = scoreboard_client.get_json(url, HEADERS)
        except ScoreboardUnavailable:
            raise
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

                is_playoff = any(kw in note_text for kw in ("round", "conference", "finals", "semifinal", "playoff"))
                series_note = event.get("note") if is_playoff else None
                _series_game_match = re.search(r'game\s+(\d+)', note_text)
                series_game_number = int(_series_game_match.group(1)) if _series_game_match else None

                if (is_playoff
                        and "if necessary" in note_text
                        and not existing_game):
                    _key = tuple(sorted([away_name, home_name]))
                    if _key in _decided_series:
                        print(f"Skipping If Necessary game for decided series: {away_name} @ {home_name}")
                        continue

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
                        "is_playoff": is_playoff,
                        "series_note": series_note,
                        "series_game_number": series_game_number,
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
                        "is_playoff": is_playoff,
                        "series_note": series_note,
                        "series_game_number": series_game_number,
                    })
                    seen_ids.add(game_id)
                    print(f"Added {away_name} @ {home_name} — {date_clean} {time_clean}")

            except Exception as e:
                print(f"Error parsing event: {e}")

        schedule.sort(key=lambda x: (str(x.get("date") or ""), str(x.get("time") or "")))
        write_schedule_json(schedule)

        current_date += timedelta(days=1)
        time.sleep(SLEEP_BETWEEN_CALLS)

    print(f"\n Schedule fetch complete — {len(schedule)} total games saved.")

    os.makedirs(os.path.dirname(_STATE_PATH), exist_ok=True)
    with open(_STATE_PATH, "w") as _sf:
        _sf.write(datetime.now().isoformat())


# ==========================================================
# 🧾 PART 2 — UPDATE GAME RESULTS + SCORES
# ==========================================================
if os.path.exists(SEASON_SAVE_PATH) or os.path.exists(SAVE_PATH):
    with open(SEASON_SAVE_PATH if os.path.exists(SEASON_SAVE_PATH) else SAVE_PATH, "r", encoding="utf-8-sig") as f:
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

        if LIVE_ONLY and game_date < today - timedelta(days=1) and game.get("status") != "live":
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

        try:
            data = scoreboard_client.get_json(url, HEADERS)
        except ScoreboardUnavailable:
            raise
        except Exception:
            continue

        events = (
            data.get("sports", [])[0]
            .get("leagues", [])[0]
            .get("events", [])
            if data.get("sports")
            else []
        )

        found_in_espn = False
        for event in events:
            if event.get("id") != game["game_id"]:
                continue

            found_in_espn = True
            status = event.get("status", "")
            fullStatus = event.get("fullStatus", {})
            status_type = fullStatus.get("type", {})
            status_state = status_type.get("state", "")
            status_name = status_type.get("name", "")
            status_completed = status_type.get("completed", False)

            if status_name in ("STATUS_CANCELED", "STATUS_POSTPONED"):
                game["status"] = "cancelled"
                print(f"Marking cancelled: {game.get('matchup')} ({status_name})")
                break

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

            elif is_live:
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

        if not found_in_espn and game_date < today:
            game["status"] = "cancelled"
            print(f"Not found in ESPN, marking cancelled: {game.get('matchup')} on {game_date}")


    removed = [g for g in schedule if g.get("status") == "cancelled"]
    schedule = [g for g in schedule if g.get("status") != "cancelled"]
    if removed:
        print(f"Removed {len(removed)} phantom/cancelled game(s): {[g.get('matchup') for g in removed]}")

    # Remove "If Necessary" playoff games where the series is already decided (4 wins)
    series_wins: dict = {}
    for g in schedule:
        if not g.get("is_playoff") or g.get("status") != "final" or not g.get("winner"):
            continue
        away = g["matchup"].split("@")[0].strip()
        home = g["matchup"].split("@")[1].strip()
        key = tuple(sorted([away, home]))
        series_wins.setdefault(key, {})
        series_wins[key][g["winner"]] = series_wins[key].get(g["winner"], 0) + 1

    decided_removed = []
    kept = []
    for g in schedule:
        # Remove any future (non-final, non-live) playoff game whose series is already decided.
        # This covers both "If Necessary" games and regular scheduled games that became
        # unnecessary after a sweep (e.g. Games 5 & 6 when a team wins 4-0).
        if (g.get("is_playoff")
                and g.get("status") not in ("final", "live")
                and g.get("status") != "cancelled"
                and not g.get("winner")):
            away = g["matchup"].split("@")[0].strip()
            home = g["matchup"].split("@")[1].strip()
            key = tuple(sorted([away, home]))
            if any(w >= 4 for w in series_wins.get(key, {}).values()):
                decided_removed.append(g)
                continue
        kept.append(g)

    if decided_removed:
        schedule = kept
        print(f"Removed {len(decided_removed)} future game(s) from decided series: {[g.get('series_note') + ' (' + g.get('matchup','') + ')' for g in decided_removed]}")

    print(f"\nUpdate complete: {updated_count} games finalized, {live_count} games live, {total_checked} total checked")

    schedule.sort(key=lambda x: (str(x.get("date") or ""), str(x.get("time") or "")))
    write_schedule_json(schedule)

    print(f"Schedule saved to {SEASON_SAVE_PATH} and {SAVE_PATH}")
