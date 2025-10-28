# nba_team_stats_2026.py
from nba_api.stats.endpoints import leaguedashteamstats, leaguedashplayerstats, commonteamroster
import pandas as pd
import json
import os
import time
from datetime import datetime, timedelta

# ==============================
# ⚙️ Setup
# ==============================
os.makedirs('nba_cache', exist_ok=True)

def should_update_players(cache_file, max_age_hours=24):
    """Check if the player data JSON is too old or missing."""
    if not os.path.exists(cache_file):
        return True
    file_time = datetime.fromtimestamp(os.path.getmtime(cache_file))
    age = datetime.now() - file_time
    return age > timedelta(hours=max_age_hours)

def get_team_ids_hash(teams_data):
    """Hash team IDs + GP count to detect updates in data."""
    return hash(tuple((t["TEAM_ID"], t["GP"]) for t in teams_data))

import math

def compute_value_score(p):
    """Compute the unscaled Value Score."""
    def safe_num(x):
        return float(x) if x not in [None, '', 'NaN'] and not math.isnan(x) else 0.0

    PTS = safe_num(p.get("PTS"))
    AST = safe_num(p.get("AST"))
    REB = safe_num(p.get("REB"))
    STL = safe_num(p.get("STL"))
    BLK = safe_num(p.get("BLK"))
    TOV = safe_num(p.get("TOV"))
    FGA = safe_num(p.get("FGA"))
    FTA = safe_num(p.get("FTA"))
    FG_PCT = safe_num(p.get("FG_PCT"))
    FT_PCT = safe_num(p.get("FT_PCT"))

    FGM = FG_PCT * FGA
    FTM = FT_PCT * FTA
    fgMisses = FGA - FGM
    ftMisses = FTA - FTM

    valueScore = (
        1.0 * PTS +
        0.8 * AST +
        0.7 * REB +
        1.0 * STL +
        0.8 * BLK -
        1.0 * TOV -
        0.7 * fgMisses -
        0.5 * ftMisses
    )

    return round(valueScore, 2)


def normalize_value_scores(players):
    """
    Given a list of player dicts, compute value scores scaled 0–100.
    Returns a dict of {player_id: normalized_score}.
    """
    scores = {}
    raw_scores = []

    # Step 1: compute all raw scores
    for p in players:
        score = compute_value_score(p)
        scores[p["PLAYER_ID"]] = score
        raw_scores.append(score)

    # Step 2: find min/max
    min_score = min(raw_scores)
    max_score = max(raw_scores)
    spread = max_score - min_score or 1  # avoid div-by-zero

    # Step 3: normalize
    normalized_scores = {
        pid: round(100 * (score - min_score) / spread, 2)
        for pid, score in scores.items()
    }

    return normalized_scores







# ==============================
# 🏀 Fetch Team Stats
# ==============================
print("Fetching NBA Regular Season team stats for 2025–26 season...")

# Basic per-game team stats
base_stats = leaguedashteamstats.LeagueDashTeamStats(
    season="2025-26",
    season_type_all_star="Regular Season",
    per_mode_detailed="PerGame",
    league_id_nullable="00"
).get_data_frames()[0]

# Advanced (Off/Def/Net ratings)
adv_stats = leaguedashteamstats.LeagueDashTeamStats(
    season="2025-26",
    season_type_all_star="Regular Season",
    per_mode_detailed="PerGame",
    measure_type_detailed_defense="Advanced",
    league_id_nullable="00"
).get_data_frames()[0]

if base_stats.empty:
    print("⚠️ No data available yet. The 2025–26 regular season may not have started.")
    exit()

# Merge base + advanced stats
data = pd.merge(
    base_stats,
    adv_stats[["TEAM_ID", "OFF_RATING", "DEF_RATING", "NET_RATING"]],
    on="TEAM_ID",
    how="left"
)

# Keep relevant columns
df = data[[
    "TEAM_ID", "TEAM_NAME", "GP", "W", "L", "W_PCT",
    "PTS", "REB", "AST", "FG_PCT", "FG3_PCT", "FT_PCT",
    "OFF_RATING", "DEF_RATING", "NET_RATING"
]].rename(columns={"W_PCT": "WIN_PCT"})

df = df[df["GP"] > 0]
df = df.sort_values(by="WIN_PCT", ascending=False)
teams_data = df.to_dict(orient="records")

# Save team stats
team_json_path = r"D:\Personal Projects\SportsAppV2\src\nba_team_stats.json"
with open(team_json_path, "w", encoding="utf-8") as f:
    json.dump(teams_data, f, indent=2)

print(f"✅ Saved NBA 2025–26 team stats to {team_json_path}")

# ==============================
# 🧍 Fetch Player Stats
# ==============================
players_json_path = r"D:\Personal Projects\SportsAppV2\src\nba_player_stats.json"
cache_meta_path = r"D:\Personal Projects\SportsAppV2\nba_cache\roster_cache_meta.json"

current_hash = get_team_ids_hash(teams_data)
needs_update = should_update_players(players_json_path, max_age_hours=168)

if os.path.exists(cache_meta_path):
    with open(cache_meta_path, "r") as f:
        cache_meta = json.load(f)
        if cache_meta.get("teams_hash") != current_hash:
            needs_update = True
            print("⚠️ Detected team updates — refreshing player stats...")
else:
    needs_update = True

if not needs_update:
    print("✅ NBA player data already up to date.")
    exit()

print("\nFetching player stats for all teams...")

try:
    # Basic player stats
    player_stats = leaguedashplayerstats.LeagueDashPlayerStats(
        season="2025-26",
        season_type_all_star="Regular Season",
        per_mode_detailed="PerGame",
        league_id_nullable="00"
    ).get_data_frames()[0]

    if player_stats.empty:
        print("⚠️ No player data found yet.")
        exit()

    players_df = player_stats[[
        "PLAYER_ID", "PLAYER_NAME", "TEAM_ID", "TEAM_ABBREVIATION",
        "GP", "MIN", "PTS", "REB", "AST", "STL", "BLK", "TOV",
        "FG_PCT", "FG3_PCT", "FT_PCT", "FGA", "FG3A", "FTA"
    ]].copy()

    players_df = players_df[players_df["GP"] > 0]

    # 💡 Fetch player advanced metrics for OFF/DEF/NET ratings
    print("Fetching advanced player metrics (OFF/DEF/NET ratings)...")
    adv_player_df = leaguedashplayerstats.LeagueDashPlayerStats(
        season="2025-26",
        season_type_all_star="Regular Season",
        per_mode_detailed="PerGame",
        measure_type_detailed_defense="Advanced",
        league_id_nullable="00"
    ).get_data_frames()[0]

    # Merge basic + advanced
    players_df = pd.merge(
        players_df,
        adv_player_df[["PLAYER_ID", "OFF_RATING", "DEF_RATING", "NET_RATING"]],
        on="PLAYER_ID",
        how="left"
    )

    # 👕 Get jersey numbers + positions
    print("\nFetching roster info (jerseys + positions)...")
    player_meta = {}

    for team in teams_data:
        team_id = team["TEAM_ID"]
        try:
            roster = commonteamroster.CommonTeamRoster(
                season="2025-26",
                team_id=team_id
            ).get_data_frames()[0]

            if not roster.empty:
                for _, player in roster.iterrows():
                    pid = int(player["PLAYER_ID"])
                    jersey = str(player["NUM"]) if pd.notna(player["NUM"]) else "0"
                    position = str(player["POSITION"]) if pd.notna(player["POSITION"]) else "N/A"
                    player_meta[pid] = {"jersey": jersey, "position": position}

            time.sleep(0.5)  # respect rate limits
        except Exception as e:
            print(f"  ✗ Roster fetch failed for team {team_id}: {e}")

    # 🧩 Group players by team
    players_by_team = {}
    for team in teams_data:
        team_id = team["TEAM_ID"]
        team_players = players_df[players_df["TEAM_ID"] == team_id].copy()
        team_players = team_players.sort_values(by="PTS", ascending=False)

        team_list = []
        for _, p in team_players.iterrows():
            pid = int(p["PLAYER_ID"])
            meta = player_meta.get(pid, {"jersey": "0", "position": "N/A"})
            
            # ✅ Compute using the current row (convert to dict first)
            player_dict = p.to_dict()
            value_score = compute_value_score(player_dict)



            team_list.append({
                "PLAYER_ID": pid,
                "PLAYER_NAME": p["PLAYER_NAME"],
                "TEAM_ID": int(p["TEAM_ID"]),
                "TEAM_ABBREVIATION": p["TEAM_ABBREVIATION"],
                "JERSEY_NUMBER": meta["jersey"],
                "POSITION": meta["position"],
                "GP": int(p["GP"]),
                "MIN": round(float(p["MIN"]), 1),
                "PTS": round(float(p["PTS"]), 1),
                "REB": round(float(p["REB"]), 1),
                "AST": round(float(p["AST"]), 1),
                "STL": round(float(p["STL"]), 1),
                "BLK": round(float(p["BLK"]), 1),
                "TOV": round(float(p["TOV"]), 1),
                "FG_PCT": round(float(p["FG_PCT"]), 3),
                "FG3_PCT": round(float(p["FG3_PCT"]), 3),
                "FT_PCT": round(float(p["FT_PCT"]), 3),
                "FGA": round(float(p["FGA"]), 1),
                "FG3A": round(float(p["FG3A"]), 1),
                "FTA": round(float(p["FTA"]), 1),
                "OFF_RATING": round(float(p["OFF_RATING"]), 1) if pd.notna(p["OFF_RATING"]) else None,
                "DEF_RATING": round(float(p["DEF_RATING"]), 1) if pd.notna(p["DEF_RATING"]) else None,
                "NET_RATING": round(float(p["NET_RATING"]), 1) if pd.notna(p["NET_RATING"]) else None,
                "VALUE_SCORE": value_score
            })

        players_by_team[str(team_id)] = team_list
        print(f"  ✓ {team['TEAM_NAME']}: {len(team_list)} players")


    # Flatten all players into one list
    all_players = [p for team_list in players_by_team.values() for p in team_list]

    # Compute normalized value scores
    normalized_scores = normalize_value_scores(all_players)

    # Apply to players_by_team
    for team_list in players_by_team.values():
        for p in team_list:
            p["VALUE_SCORE"] = normalized_scores[p["PLAYER_ID"]]

    
    # Save player stats
    with open(players_json_path, "w", encoding="utf-8") as f:
        json.dump(players_by_team, f, indent=2)
        
        
    # =========================================
# ⚡ Create Value Score Hash Table (ID → VALUE_SCORE)
# =========================================
    value_score_map = {}

    for team_players in players_by_team.values():
        for player in team_players:
            pid = str(player["PLAYER_ID"])
            value_score_map[pid] = player["VALUE_SCORE"]

    value_map_path = r"D:\Personal Projects\SportsAppV2\src\nba_player_values.json"
    with open(value_map_path, "w", encoding="utf-8") as f:
        json.dump(value_score_map, f, indent=2)

    print(f"💾 Saved value score map to {value_map_path} ({len(value_score_map)} players)")


    cache_meta = {
        "teams_hash": current_hash,
        "last_updated": datetime.now().isoformat(),
        "num_teams": len(teams_data),
        "total_players": len(players_df)
    }

    with open(cache_meta_path, "w", encoding="utf-8") as f:
        json.dump(cache_meta, f, indent=2)

    print(f"\n✅ Saved player stats to {players_json_path}")
    print(f"   Total players: {len(players_df)}")
    print(f"   Teams processed: {len(players_by_team)}")

except Exception as e:
    print(f"❌ Error fetching player stats: {e}")
