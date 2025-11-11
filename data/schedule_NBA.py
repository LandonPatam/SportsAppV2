import requests
import json
import os
from datetime import datetime, timedelta
import pytz
import time

# ==========================================================
# ⚙️ CONFIGURATION
# ==========================================================
FIND_SCHEDULE = False   # ✅ Toggle True to crawl schedule, False to skip
SAVE_PATH = "public/data/nba_schedule.json"
VALID_NETWORKS = {"Prime Video", "Peacock", "ESPN"}
SLEEP_BETWEEN_CALLS = 1.5
MAX_EMPTY_DAYS = 20
SEASON_START_DATE = datetime(2025, 10, 21).date()
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
season_end = datetime(year + 1, 4, 30).date()

# ==========================================================
# 📂 Load Existing Schedule
# ==========================================================
if os.path.exists(SAVE_PATH):
    with open(SAVE_PATH, "r", encoding="utf-8") as f:
        schedule = json.load(f)
else:
    schedule = []

seen_ids = {g["game_id"] for g in schedule}

# ==========================================================
# 🏀 PART 1 — FIND SCHEDULE (Optional)
# ==========================================================
if FIND_SCHEDULE:
    print("🔍 Starting schedule fetch (Oct 21 → Apr 30)...")
    current_date = SEASON_START_DATE
    empty_days = 0

    while current_date <= season_end and empty_days < MAX_EMPTY_DAYS:
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
                
                # 🏆 Detect NBA Cup games
                # 🏆 Detect NBA Cup games (works with either note or notes[])
                note_text = (event.get("note") or "").lower()
                notes = event.get("notes", [])
                nba_cup_text = next(
                    (n.get("text") for n in notes if "nba cup" in n.get("text", "").lower()),
                    None
                )

                # If either note or notes mentions NBA Cup, flag it
                is_nba_cup = "nba cup" in note_text or nba_cup_text is not None
                nba_cup_label = nba_cup_text or (event.get("note") if "nba cup" in note_text else None)



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
                "is_nba_cup": is_nba_cup,          # ✅ Boolean
                "tournament": nba_cup_label or None  # Optional label text
            })


                seen_ids.add(game_id)

                print(f"Added {away_name} @ {home_name} — {date_clean} {time_clean}")

            except Exception as e:
                print(f"Error parsing event: {e}")

        os.makedirs(os.path.dirname(SAVE_PATH), exist_ok=True)
        with open(SAVE_PATH, "w", encoding="utf-8") as out:
            json.dump(schedule, out, indent=2, ensure_ascii=False)

        current_date += timedelta(days=1)
        time.sleep(SLEEP_BETWEEN_CALLS)

    print(f"\n Schedule fetch complete — {len(schedule)} total games saved.")


# ==========================================================
# 🧾 PART 2 — UPDATE GAME RESULTS + SCORES
# ==========================================================
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
            # Final game update
            winner = next((t.get("displayName") for t in competitors if t.get("winner")), None)
            game.update({
                "winner": winner,
                "home_score": home_score,
                "away_score": away_score,
                "status": "final"
            })
            for field in ["period", "clock"]:
                game.pop(field, None)
            updated_count += 1


        elif is_live and game_date == today:
            # Game currently live — no extra flag, just status
            game.update({
                "home_score": home_score,
                "away_score": away_score,
                "status": "live",
                "period": fullStatus.get("period"),
                "clock": fullStatus.get("displayClock", "")
            })
            game.pop("winner", None)
            live_count += 1
  

        else:
            # Scheduled / not started yet
            game.update({"status": "scheduled"})
            for field in ["period", "clock"]:
                game.pop(field, None)


    time.sleep(SLEEP_BETWEEN_CALLS)

# Save updated results
with open(SAVE_PATH, "w", encoding="utf-8") as out:
    json.dump(schedule, out, indent=2, ensure_ascii=False)