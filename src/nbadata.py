# nba_team_stats_2026.py
from nba_api.stats.endpoints import leaguedashteamstats
import pandas as pd
import json
import os

os.makedirs('nba_cache', exist_ok=True)
print("Fetching NBA Regular Season team stats for 2025–26 season...")

# Request regular season data
data = leaguedashteamstats.LeagueDashTeamStats(
    season="2025-26",
    season_type_all_star="Regular Season",
    per_mode_detailed="PerGame",
    league_id_nullable="00"  # 00 = NBA (01 = ABA, 10 = WNBA, 20 = G League)
).get_data_frames()[0]

if data.empty:
    print("⚠️ No regular season data found yet for 2025–26. The season may not have started.")
else:
    # Filter out any non-NBA teams just in case
    df = data[[
        "TEAM_ID", "TEAM_NAME", "GP", "W", "L", "W_PCT",
        "PTS", "REB", "AST", "FG_PCT", "FG3_PCT", "FT_PCT"
    ]].rename(columns={"W_PCT": "WIN_PCT"})
    
    # Filter out teams with 0 games played (preseason artifacts)
    df = df[df["GP"] > 0]
    
    df = df.sort_values(by="WIN_PCT", ascending=False)
    teams_data = df.to_dict(orient="records")
    
    out_path = r"D:\Personal Projects\SportsAppV2\src\nba_team_stats.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(teams_data, f, indent=2)
    
    print(f"✅ Saved NBA 2025–26 Regular Season stats to {out_path}")
    print(f"   Teams: {len(teams_data)} | Games played range: {df['GP'].min()}-{df['GP'].max()}")