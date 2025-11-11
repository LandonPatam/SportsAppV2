import json
import time
import subprocess
from pathlib import Path

# ==========================================================
# ⚙️ CONFIGURATION
# ==========================================================
NBA_SCHEDULE_PATH = Path("public/data/nba_schedule.json")
NFL_SCHEDULE_PATH = Path("public/data/nfl_schedule.json")

# Scripts
NBA_SCHEDULE_SCRIPT = Path("data/schedule_NBA.py")
NFL_SCHEDULE_SCRIPT = Path("data/schedule_NFL.py")
NBA_DATA_SCRIPT = Path("data/data_NBAV2.py")
NFL_DATA_SCRIPT = Path("data/data_NFLV2.py")

# Run intervals (in seconds)
LIVE_INTERVAL = 30           # when a game is live
NORMAL_INTERVAL = 120        # when no live game
DATA_INTERVAL = 150          # 2.5 minutes for data scripts

# ==========================================================
# 🧠 HELPERS
# ==========================================================
def has_live_game(schedule_path: Path) -> bool:
    """Return True if any game in schedule has status == 'live'."""
    if not schedule_path.exists():
        return False
    try:
        with open(schedule_path, "r", encoding="utf-8") as f:
            games = json.load(f)
        for game in games:
            status = str(game.get("status", "")).lower()
            if status == "live":
                return True
    except Exception as e:
        print(f"[WARN] Failed to read {schedule_path.name}: {e}")
    return False


def run_script(script_path: Path):
    """Run a Python script as a subprocess."""
    try:
        subprocess.run(["python", str(script_path)], check=False)
        print(f"[RUN] {script_path.name} executed successfully.")
    except Exception as e:
        print(f"[ERROR] Running {script_path.name}: {e}")


# ==========================================================
# 🔁 MAIN LOOP
# ==========================================================
def main():
    print("🏀🏈 Scheduler started (NBA/NFL dynamic interval)...")

    # Track timers for 2.5-minute data scripts
    last_data_run = 0

    while True:
        nba_live = has_live_game(NBA_SCHEDULE_PATH)
        nfl_live = has_live_game(NFL_SCHEDULE_PATH)

        # Determine how often to rerun schedule scripts
        interval = LIVE_INTERVAL if (nba_live or nfl_live) else NORMAL_INTERVAL

        # Always run schedule scripts
        print(f"\n[STATUS] {'LIVE detected' if (nba_live or nfl_live) else 'No live games'}")
        run_script(NBA_SCHEDULE_SCRIPT)
        run_script(NFL_SCHEDULE_SCRIPT)

        # Run the data scripts every 2.5 minutes
        if time.time() - last_data_run >= DATA_INTERVAL:
            run_script(NBA_DATA_SCRIPT)
            run_script(NFL_DATA_SCRIPT)
            last_data_run = time.time()

        print(f"[SLEEP] Sleeping for {interval} seconds...\n")
        time.sleep(interval)


# ==========================================================
# ▶️ ENTRY POINT
# ==========================================================
if __name__ == "__main__":
    main()
