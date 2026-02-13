import requests
import json
import os
from datetime import datetime, timedelta
import pytz
import time

# ==========================================================
# ⚙️ CONFIGURATION - EDIT THESE
# ==========================================================
SAVE_PATH = "public/data/nba_schedule.json"
VALID_NETWORKS = {"Prime Video", "Peacock", "ESPN", "ABC"}
SLEEP_BETWEEN_CALLS = 1.5

# >>> SET YOUR DATE RANGE HERE <<<
START_DATE = datetime(2026, 2, 13).date()  # Feb 21, 2026
END_DATE = datetime(2026, 4, 12).date()    # Feb 21, 2026
# ==========================================================

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0",
    "Accept": "*/*",
    "Referer": "https://www.espn.com/",
}

UTC = pytz.utc
PACIFIC = pytz.timezone("America/Los_Angeles")

print(f"🔍 Updating schedule for dates: {START_DATE} to {END_DATE}")

# Load existing schedule
if not os.path.exists(SAVE_PATH):
    print(f"Error: {SAVE_PATH} not found!")
    exit(1)

with open(SAVE_PATH, "r", encoding="utf-8") as f:
    schedule = json.load(f)

seen_ids = {g.get("game_id") for g in schedule if g.get("game_id")}
print(f"Loaded {len(schedule)} existing games")

# Fetch games for the specified date range
current_date = START_DATE
games_added = 0
games_updated = 0

while current_date <= END_DATE:
    date_str_param = current_date.strftime("%Y%m%d")
    
    url = (
        f"https://site.web.api.espn.com/apis/personalized/v2/scoreboard/header"
        f"?sport=basketball&league=nba&region=us&lang=en&contentorigin=espn"
        f"&configuration=STREAM_MENU&platform=web&features=sfb-all%2Ccutl"
        f"&showAirings=buy%2Clive%2Creplay&tz=America%2FNew_York&dates={date_str_param}"
    )
    
    print(f"\n📅 Fetching {date_str_param} ({current_date})...")
    response = requests.get(url, headers=HEADERS)
    
    try:
        data = response.json()
    except Exception as e:
        print(f"Error parsing response: {e}")
        current_date += timedelta(days=1)
        time.sleep(SLEEP_BETWEEN_CALLS)
        continue
    
    events = (
        data.get("sports", [])[0]
        .get("leagues", [])[0]
        .get("events", [])
        if data.get("sports")
        else []
    )
    
    if not events:
        print(f"  No games found for {current_date}")
    else:
        print(f"  Found {len(events)} events")
    
    for event in events:
        try:
            game_id = event.get("id")
            if not game_id:
                continue
            
            # Check if this game already exists
            existing_game = next((g for g in schedule if g.get("game_id") == game_id), None)
            
            date_str = event.get("date")
            location = event.get("location", "")
            link = event.get("link")
            
            # Convert UTC → PT (same as schedule_NBA.py)
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
            
            # 🏆 Detect NBA Cup games (same logic as schedule_NBA.py)
            note_text = (event.get("note") or "").lower()
            notes = event.get("notes", [])
            nba_cup_text = next(
                (n.get("text") for n in notes if "nba cup" in n.get("text", "").lower()),
                None
            )
            is_nba_cup = "nba cup" in note_text or nba_cup_text is not None
            nba_cup_label = nba_cup_text or (event.get("note") if "nba cup" in note_text else None)
            
            if existing_game:
                # Update existing game (same as schedule_NBA.py)
                print(f"  ✏️  Updating: {away_name} @ {home_name} — {date_clean} {time_clean}")
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
                games_updated += 1
            else:
                # Add new game (same as schedule_NBA.py)
                print(f"  ➕ Adding: {away_name} @ {home_name} — {date_clean} {time_clean}")
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
                games_added += 1
        
        except Exception as e:
            print(f"  ⚠️  Error parsing event: {e}")
    
    current_date += timedelta(days=1)
    time.sleep(SLEEP_BETWEEN_CALLS)

# Sort and save (same as schedule_NBA.py)
schedule.sort(key=lambda x: (str(x.get("date") or ""), str(x.get("time") or "")))

os.makedirs(os.path.dirname(SAVE_PATH), exist_ok=True)
with open(SAVE_PATH, "w", encoding="utf-8") as out:
    json.dump(schedule, out, indent=2, ensure_ascii=False)

print(f"\n✅ Complete!")
print(f"   Added: {games_added} new games")
print(f"   Updated: {games_updated} existing games")
print(f"   Total games in schedule: {len(schedule)}")
print(f"   Saved to: {SAVE_PATH}")