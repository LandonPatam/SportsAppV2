import json
import time
import subprocess
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
F1_CALENDAR_SCRIPT  = Path("data/F1_calendar.py")  # track/circuit info (slow-changing)

# NBA/NFL intervals (seconds)
ACTIVE_INTERVAL = 15     # when games are live/upcoming today
IDLE_INTERVAL   = 600    # no games today (10 min)
DATA_INTERVAL   = 150    # NBA/NFL data scripts (2.5 min)

# F1 intervals (seconds)
F1_RACE_INTERVAL     = 5  * 60       # 5 min — during race weekend (results change fast)
F1_IDLE_INTERVAL     = 30 * 60       # 30 min — normal days (standings trickle update)
F1_CALENDAR_INTERVAL = 24 * 60 * 60  # 24 hours — circuit/track info rarely changes

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

        today = datetime.now().date()

        for game in games:
            game_date_str = game.get("date", "")
            try:
                game_date = datetime.strptime(game_date_str, "%Y-%m-%d").date()
            except:
                continue

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
            now = datetime.now()
            if status["first_game_time"]:
                # Activate 30 min before first game starts
                start_time = status["first_game_time"] - timedelta(minutes=30)
                # Keep active until all games are final
                # Trigger if: past the pre-game window AND games aren't all done yet
                # This catches the case where a game is past its start time but ESPN
                # hasn't flipped it to "live" yet — don't wait for the live flag
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
def run_script(script_path: Path):
    try:
        subprocess.run(["python", str(script_path)], check=False)
        print(f"[RUN] {script_path.name} executed successfully.")
    except Exception as e:
        print(f"[ERROR] Running {script_path.name}: {e}")


# ==========================================================
# 🔁 MAIN LOOP
# ==========================================================
def main():
    print("🏀🏈🏎️  Dynamic Sports Scheduler started...")

    last_nba_schedule_run = 0
    last_nfl_schedule_run = 0
    last_data_run         = 0
    last_f1_data_run      = 0
    # Only run F1 calendar immediately if the file doesn't exist yet;
    # otherwise wait the full 24h interval before running again.
    last_f1_calendar_run  = 0 if not F1_CALENDAR_PATH.exists() else time.time()

    while True:
        now = time.time()

        nba_status = get_sport_status(NBA_SCHEDULE_PATH)
        nfl_status = get_sport_status(NFL_SCHEDULE_PATH)
        f1_status  = get_f1_status()

        nba_interval = ACTIVE_INTERVAL if nba_status["should_run"] else IDLE_INTERVAL
        nfl_interval = ACTIVE_INTERVAL if nfl_status["should_run"] else IDLE_INTERVAL
        f1_interval  = F1_RACE_INTERVAL if f1_status["is_race_weekend"] else F1_IDLE_INTERVAL

        nba_state = "ACTIVE" if nba_status["should_run"] else ("NO GAMES" if not nba_status["has_today_games"] else "FINAL")
        nfl_state = "ACTIVE" if nfl_status["should_run"] else ("NO GAMES" if not nfl_status["has_today_games"] else "FINAL")
        f1_state  = "RACE WEEKEND" if f1_status["is_race_weekend"] else "OFF WEEKEND"

        print(f"\n[STATUS] NBA: {nba_state} | NFL: {nfl_state} | F1: {f1_state}", end="")
        if f1_status["next_race_name"]:
            label = "Current" if f1_status["is_race_weekend"] else "Next"
            print(f" ({label}: {f1_status['next_race_name']})", end="")
        print()

        if nba_status["has_live"]:       print("  🏀 NBA has LIVE games")
        if nfl_status["has_live"]:       print("  🏈 NFL has LIVE games")
        if f1_status["is_race_weekend"]: print(f"  🏎️  F1 race weekend — polling every {f1_interval // 60} min")

        # ── NBA schedule ───────────────────────────────────────
        if now - last_nba_schedule_run >= nba_interval:
            if nba_status["should_run"] or (now - last_nba_schedule_run >= IDLE_INTERVAL):
                run_script(NBA_SCHEDULE_SCRIPT)
                last_nba_schedule_run = now

        # ── NFL schedule ───────────────────────────────────────
        if now - last_nfl_schedule_run >= nfl_interval:
            if nfl_status["should_run"] or (now - last_nfl_schedule_run >= IDLE_INTERVAL):
                run_script(NFL_SCHEDULE_SCRIPT)
                last_nfl_schedule_run = now

        # ── NBA / NFL data (every 2.5 min) ─────────────────────
        if now - last_data_run >= DATA_INTERVAL:
            run_script(NBA_DATA_SCRIPT)
            run_script(NFL_DATA_SCRIPT)
            last_data_run = now

        # ── F1 data: race results + driver standings ───────────
        # Race weekend → every 5 min  |  Off weekend → every 30 min
        if now - last_f1_data_run >= f1_interval:
            run_script(F1_DATA_SCRIPT)
            last_f1_data_run = now

        # ── F1 calendar: circuit/track info (every 24 h) ───────
        if now - last_f1_calendar_run >= F1_CALENDAR_INTERVAL:
            run_script(F1_CALENDAR_SCRIPT)
            last_f1_calendar_run = now

        # ── Sleep until the next thing is due ──────────────────
        next_runs = [
            nba_interval         - (now - last_nba_schedule_run),
            nfl_interval         - (now - last_nfl_schedule_run),
            DATA_INTERVAL        - (now - last_data_run),
            f1_interval          - (now - last_f1_data_run),
            F1_CALENDAR_INTERVAL - (now - last_f1_calendar_run),
        ]
        sleep_time = max(1, min(next_runs))
        print(f"[SLEEP] {sleep_time:.0f}s\n")
        time.sleep(sleep_time)


# ==========================================================
# ▶️ ENTRY POINT
# ==========================================================
if __name__ == "__main__":
    main()