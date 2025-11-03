import requests
import json
import os
from datetime import datetime, timedelta
import pytz
import time

# ==========================================================
# CONFIGURATION
# ==========================================================
FIND_SCHEDULE = False   # Toggle True to crawl schedule, False to skip
SAVE_PATH = "public/data/nfl_schedule.json"
VALID_NETWORKS = {"ESPN", "ABC", "FOX", "CBS", "NBC", "NFL Network", "Prime Video", "Peacock"}
SLEEP_BETWEEN_CALLS = 1.5
MAX_EMPTY_DAYS = 20
SEASON_START_DATE = datetime(2025, 9, 4).date()
# ==========================================================

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0",
    "Accept": "*/*",
    "Referer": "https://www.espn.com/",
}

UTC = pytz.utc
PACIFIC = pytz.timezone("America/Los_Angeles")

today = datetime.now().date()
year = today.year if today.month >= 7 else today.year - 1
season_end = datetime(year + 1, 2, 15).date()

# ==========================================================
# Load Existing Schedule
# ==========================================================
if os.path.exists(SAVE_PATH):
    with open(SAVE_PATH, "r", encoding="utf-8") as f:
        schedule = json.load(f)
else:
    schedule = []

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
# PART 1 – FIND SCHEDULE (Optional)
# ==========================================================
if FIND_SCHEDULE:
    print("Starting NFL schedule fetch...")
    current_date = SEASON_START_DATE
    empty_days = 0

    while current_date <= season_end and empty_days < MAX_EMPTY_DAYS:
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
                if game_id in seen_ids:
                    continue

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

        os.makedirs(os.path.dirname(SAVE_PATH), exist_ok=True)
        with open(SAVE_PATH, "w", encoding="utf-8") as out:
            json.dump(schedule, out, indent=2, ensure_ascii=False)

        current_date += timedelta(days=1)
        time.sleep(SLEEP_BETWEEN_CALLS)

    print(f"\nSchedule fetch complete – {len(schedule)} total games saved.")


# ==========================================================
# PART 2 – UPDATE GAME RESULTS + SCORES
# ==========================================================
print("\nUpdating past game results and scores...")
with open(SAVE_PATH, "r", encoding="utf-8") as f:
    schedule = json.load(f)

updated_count = 0
total_checked = 0
live_count = 0

for game in schedule:
    game_date = datetime.strptime(game["date"], "%Y-%m-%d").date()

    # Skip future games
    if game_date > today:
        continue

    # Skip fully complete games
    if game.get("status") == "final" and game.get("winner") and game.get("home_score") and game.get("away_score"):
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
            # Final game update (compute winner fallback to avoid repeated updates)
            winner = next((t.get("displayName") for t in competitors if t.get("winner")), None)
            # Fallback winner calculation if API didn't set one (e.g., ties or missing flag)
            try:
                hs = int(home_score) if home_score is not None else None
                as_ = int(away_score) if away_score is not None else None
            except Exception:
                hs = as_ = None
            if not winner and hs is not None and as_ is not None:
                if hs > as_:
                    winner = home_team.get("displayName") or home_team.get("team", {}).get("displayName")
                elif as_ > hs:
                    winner = away_team.get("displayName") or away_team.get("team", {}).get("displayName")
                else:
                    # Tie game; mark explicitly so subsequent runs skip this entry
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
            # Print a clearer message for ties
            if winner == "TIE":
                print(f"Final (tie): {away_team.get('displayName')} {away_score} - {home_team.get('displayName')} {home_score}")
            else:
                print(f"Final: {winner or 'N/A'} | {away_team.get('displayName')} {away_score} - {home_team.get('displayName')} {home_score}")

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
            print(f"Live: {away_team.get('displayName')} {away_score} - {home_team.get('displayName')} {home_score} | {game['clock']} Q{game.get('period','')}")

        else:
            # Scheduled / not started yet: ensure scores cleared and status set
            game.update({
                "status": "scheduled",
                "home_score": None,
                "away_score": None,
            })
            for field in ["period", "clock"]:
                game.pop(field, None)
            print(f"Scheduled: {game['matchup']} ({game['date']}) at {game.get('time', 'TBA')}")

    time.sleep(SLEEP_BETWEEN_CALLS)

# Final sort and save updated results
for g in schedule:
    ensure_ts_utc(g)
schedule.sort(key=lambda x: (str(x.get("date") or ""), int(x.get("ts_utc") or 0)))
with open(SAVE_PATH, "w", encoding="utf-8") as out:
    json.dump(schedule, out, indent=2, ensure_ascii=False)

print(f"\nUpdated {updated_count} completed games, {live_count} live games ({total_checked} checked).")
