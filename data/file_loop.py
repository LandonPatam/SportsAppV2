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

# Scripts
NBA_SCHEDULE_SCRIPT = Path("data/schedule_NBA.py")
NFL_SCHEDULE_SCRIPT = Path("data/schedule_NFL.py")
NBA_DATA_SCRIPT = Path("data/data_NBAV2.py")
NFL_DATA_SCRIPT = Path("data/data_NFLV2.py")

# Run intervals (in seconds)
ACTIVE_INTERVAL = 30         # when games are active (live or upcoming today)
IDLE_INTERVAL = 600          # when no games today (10 minutes)
DATA_INTERVAL = 150          # 2.5 minutes for data scripts

# ==========================================================
# 🧠 HELPERS
# ==========================================================
def parse_game_time(date_str: str, time_str: str) -> datetime:
    """Parse game date and time into datetime object."""
    try:
        # Handle time formats like "7:30 PM" or "TBD"
        if time_str.upper() == "TBD" or not time_str:
            # If TBD, assume start of day
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            return dt.replace(hour=0, minute=0)
        
        # Combine date and time
        datetime_str = f"{date_str} {time_str}"
        return datetime.strptime(datetime_str, "%Y-%m-%d %I:%M %p")
    except Exception as e:
        print(f"[WARN] Failed to parse time '{date_str} {time_str}': {e}")
        return None

def get_sport_status(schedule_path: Path) -> dict:
    """
    Analyze schedule and return status info:
    - has_live: bool
    - has_today_games: bool
    - first_game_time: datetime or None
    - all_games_final: bool (all today's games are final)
    """
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
        today_games = []
        
        for game in games:
            game_date_str = game.get("date", "")
            try:
                game_date = datetime.strptime(game_date_str, "%Y-%m-%d").date()
            except:
                continue
            
            # Check if game is today
            if game_date == today:
                status["has_today_games"] = True
                today_games.append(game)
                
                # Check for live games
                if str(game.get("status", "")).lower() == "live":
                    status["has_live"] = True
                
                # Check if all games are final
                if str(game.get("status", "")).lower() != "final":
                    status["all_games_final"] = False
                
                # Track first game time
                game_time = parse_game_time(game_date_str, game.get("time", ""))
                if game_time:
                    if status["first_game_time"] is None or game_time < status["first_game_time"]:
                        status["first_game_time"] = game_time
        
        # Determine if we should actively run
        if status["has_today_games"]:
            now = datetime.now()
            
            # Start running 30 minutes before first game
            if status["first_game_time"]:
                start_time = status["first_game_time"] - timedelta(minutes=30)
                
                # Should run if: after start time AND (has live games OR not all games are final)
                if now >= start_time and (status["has_live"] or not status["all_games_final"]):
                    status["should_run"] = True
            else:
                # If we can't determine time but have games today, be conservative
                if status["has_live"] or not status["all_games_final"]:
                    status["should_run"] = True
    
    except Exception as e:
        print(f"[WARN] Failed to read {schedule_path.name}: {e}")
    
    return status

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
    print("🏀🏈 Dynamic Sports Scheduler started...")
    
    last_nba_schedule_run = 0
    last_nfl_schedule_run = 0
    last_data_run = 0
    
    while True:
        current_time = time.time()
        
        nba_status = get_sport_status(NBA_SCHEDULE_PATH)
        nfl_status = get_sport_status(NFL_SCHEDULE_PATH)
        
        # Determine intervals based on status
        nba_interval = ACTIVE_INTERVAL if nba_status["should_run"] else IDLE_INTERVAL
        nfl_interval = ACTIVE_INTERVAL if nfl_status["should_run"] else IDLE_INTERVAL
        
        # Status display
        nba_state = "ACTIVE" if nba_status["should_run"] else ("NO GAMES TODAY" if not nba_status["has_today_games"] else "GAMES FINAL")
        nfl_state = "ACTIVE" if nfl_status["should_run"] else ("NO GAMES TODAY" if not nfl_status["has_today_games"] else "GAMES FINAL")
        
        print(f"\n[STATUS] NBA: {nba_state} | NFL: {nfl_state}")
        
        if nba_status["has_live"]:
            print(f"  🏀 NBA has LIVE games")
        if nfl_status["has_live"]:
            print(f"  🏈 NFL has LIVE games")
        
        # Run NBA schedule script if should be active
        if current_time - last_nba_schedule_run >= nba_interval:
            if nba_status["should_run"] or (current_time - last_nba_schedule_run >= IDLE_INTERVAL):
                run_script(NBA_SCHEDULE_SCRIPT)
                last_nba_schedule_run = current_time
        
        # Run NFL schedule script if should be active
        if current_time - last_nfl_schedule_run >= nfl_interval:
            if nfl_status["should_run"] or (current_time - last_nfl_schedule_run >= IDLE_INTERVAL):
                run_script(NFL_SCHEDULE_SCRIPT)
                last_nfl_schedule_run = current_time
        
        # Run data scripts every 2.5 minutes regardless of game status
        if current_time - last_data_run >= DATA_INTERVAL:
            run_script(NBA_DATA_SCRIPT)
            run_script(NFL_DATA_SCRIPT)
            last_data_run = current_time
        
        # Calculate sleep time
        next_check_times = []
        
        if nba_status["should_run"]:
            next_check_times.append(nba_interval - (current_time - last_nba_schedule_run))
        else:
            next_check_times.append(IDLE_INTERVAL - (current_time - last_nba_schedule_run))
        
        if nfl_status["should_run"]:
            next_check_times.append(nfl_interval - (current_time - last_nfl_schedule_run))
        else:
            next_check_times.append(IDLE_INTERVAL - (current_time - last_nfl_schedule_run))
        
        # Always include data interval in sleep calculation
        next_check_times.append(DATA_INTERVAL - (current_time - last_data_run))
        
        sleep_time = max(1, min(next_check_times))
        
        print(f"[SLEEP] Sleeping for {sleep_time:.1f} seconds...\n")
        time.sleep(sleep_time)

# ==========================================================
# ▶️ ENTRY POINT
# ==========================================================
if __name__ == "__main__":
    main()