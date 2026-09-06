import json
import time
import subprocess
import os
import sys
import pytz
from scoreboard_client import acquire_script_lock
from pathlib import Path
from datetime import datetime, timedelta

# ==========================================================
# ⚙️ CONFIGURATION
# ==========================================================
NBA_SCHEDULE_PATH = Path("public/data/nba_schedule.json")
NFL_SCHEDULE_PATH = Path("public/data/nfl_schedule.json")
F1_CALENDAR_PATH  = Path("public/data/f1_calendar.json")

# Scripts
NBA_SCHEDULE_SCRIPT = Path("data/schedule_NBA.py")
NFL_SCHEDULE_SCRIPT = Path("data/schedule_NFL.py")
NBA_DATA_SCRIPT     = Path("data/data_NBAV2.py")
NFL_DATA_SCRIPT     = Path("data/data_NFLV2.py")
F1_DATA_SCRIPT      = Path("data/data_F1.py")      # race results + driver standings
# F1_CALENDAR_SCRIPT removed — run manually at the start of a new season

# NBA/NFL intervals (seconds)
ACTIVE_INTERVAL = 15     # when games are live/upcoming today
IDLE_INTERVAL   = 600    # no games today (10 min)
DATA_INTERVAL   = 150    # NBA/NFL data scripts (2.5 min)

# F1 intervals (seconds)
F1_RACE_INTERVAL = 5  * 60   # 5 min — during race weekend (results change fast)
F1_IDLE_INTERVAL = 30 * 60   # 30 min — normal days (standings trickle update)

# ==========================================================
# 🧠 NBA/NFL HELPERS
# ==========================================================
def parse_game_time(date_str: str, time_str: str) -> datetime:
    try:
        if time_str.upper() == "TBD" or not time_str:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            return dt.replace(hour=0, minute=0)
        datetime_str = f"{date_str} {time_str}"
        return datetime.strptime(datetime_str, "%Y-%m-%d %I:%M %p")
    except Exception as e:
        print(f"[WARN] Failed to parse time '{date_str} {time_str}': {e}")
        return None

def get_sport_status(schedule_path: Path) -> dict:
    status = {
        "has_live": False,
        "has_today_games": False,
        "first_game_time": None,
        "all_games_final": True,
        "should_run": False
    }

    if not schedule_path.exists():
        return status

    try:
        with open(schedule_path, "r", encoding="utf-8") as f:
            games = json.load(f)

        today = datetime.now(pytz.timezone("America/Los_Angeles")).date()

        for game in games:
            game_date_str = game.get("date", "")
            try:
                game_date = datetime.strptime(game_date_str, "%Y-%m-%d").date()
            except:
                continue

            # Keep games that cross Pacific midnight on the active cadence.
            if game_date <= today and str(game.get("status", "")).lower() == "live":
                status["has_live"] = True
                status["should_run"] = True
            if game_date == today:
                status["has_today_games"] = True

                if str(game.get("status", "")).lower() == "live":
                    status["has_live"] = True

                if str(game.get("status", "")).lower() != "final":
                    status["all_games_final"] = False

                game_time = parse_game_time(game_date_str, game.get("time", ""))
                if game_time:
                    if status["first_game_time"] is None or game_time < status["first_game_time"]:
                        status["first_game_time"] = game_time

        if status["has_today_games"]:
            now = datetime.now(pytz.timezone("America/Los_Angeles")).replace(tzinfo=None)
            if status["first_game_time"]:
                start_time = status["first_game_time"] - timedelta(minutes=30)
                if now >= start_time and not status["all_games_final"]:
                    status["should_run"] = True
            else:
                if status["has_live"] or not status["all_games_final"]:
                    status["should_run"] = True

    except Exception as e:
        print(f"[WARN] Failed to read {schedule_path.name}: {e}")

    return status


# ==========================================================
# 🏎️ F1 HELPERS
# ==========================================================
MONTH_MAP = {
    "january": 1, "february": 2, "march": 3,    "april": 4,
    "may": 5,     "june": 6,     "july": 7,      "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

def parse_f1_race_end_date(date_str: str):
    """Parse F1 date range like "March 5 - 7" -> race day datetime (end of day)."""
    try:
        parts = date_str.strip().split()
        month = MONTH_MAP.get(parts[0].lower())
        if not month:
            return None
        end_day = int(parts[-1])
        year = datetime.now().year
        return datetime(year, month, end_day, 23, 59)
    except:
        return None

def get_f1_status() -> dict:
    """
    Reads f1_calendar.json and determines whether we're in an active race weekend.
    Window = 3 days before race day through 5 hours after race end.
    """
    status = {"is_race_weekend": False, "next_race_name": None}

    if not F1_CALENDAR_PATH.exists():
        return status

    try:
        with open(F1_CALENDAR_PATH, "r", encoding="utf-8") as f:
            calendar = json.load(f)

        now = datetime.now()

        for race in calendar:
            race_date = parse_f1_race_end_date(race.get("date", ""))
            if race_date is None:
                continue

            window_start = race_date - timedelta(days=3)
            window_end   = race_date + timedelta(hours=5)

            if window_start <= now <= window_end:
                status["is_race_weekend"] = True
                status["next_race_name"]  = race.get("race_name", "Unknown")
                return status

            if race_date > now and status["next_race_name"] is None:
                status["next_race_name"] = race.get("race_name", "Unknown")

    except Exception as e:
        print(f"[WARN] Failed to read f1_calendar.json: {e}")

    return status


# ==========================================================
# 🔧 RUNNER
# ==========================================================
def main():
    scheduler_lock = acquire_script_lock("sports-scheduler")
    running = {}
    last_run = {}
    os.chdir(Path(__file__).resolve().parents[1])
    try:
        while True:
            now = time.monotonic()
            nba = get_sport_status(NBA_SCHEDULE_PATH)
            nfl = get_sport_status(NFL_SCHEDULE_PATH)
            f1 = get_f1_status()
            jobs = [
                (NBA_SCHEDULE_SCRIPT, ACTIVE_INTERVAL if nba["should_run"] else IDLE_INTERVAL, nba["should_run"]),
                (NFL_SCHEDULE_SCRIPT, ACTIVE_INTERVAL if nfl["should_run"] else IDLE_INTERVAL, nfl["should_run"]),
                (NBA_DATA_SCRIPT, DATA_INTERVAL, False),
                (NFL_DATA_SCRIPT, DATA_INTERVAL, False),
                (F1_DATA_SCRIPT, F1_RACE_INTERVAL if f1["is_race_weekend"] else F1_IDLE_INTERVAL, False),
            ]
            for script, interval, live_only in jobs:
                child = running.get(script)
                if child is not None and child.poll() is None:
                    continue
                if now - last_run.get(script, float("-inf")) < interval:
                    continue
                env = os.environ.copy()
                env["SPORTS_LIVE_ONLY"] = "1" if live_only else "0"
                running[script] = subprocess.Popen([sys.executable, "-u", str(script)], env=env)
                last_run[script] = now
            # Slow stats jobs cannot hold up either league's score updates.
            time.sleep(1)
    finally:
        for child in running.values():
            if child.poll() is None:
                child.terminate()
        for child in running.values():
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
        scheduler_lock.close()


if __name__ == "__main__":
    main()
