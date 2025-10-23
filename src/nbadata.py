# nba_team_stats_2026.py
from nba_api.stats.endpoints import leaguedashteamstats, leaguedashplayerstats, commonteamroster
import pandas as pd
import json
import os
import time
from datetime import datetime, timedelta

os.makedirs('nba_cache', exist_ok=True)

def should_update_players(cache_file, max_age_hours=24):
    """Check if player data needs updating based on file age"""
    if not os.path.exists(cache_file):
        return True
    
    file_time = datetime.fromtimestamp(os.path.getmtime(cache_file))
    age = datetime.now() - file_time
    
    return age > timedelta(hours=max_age_hours)

def get_team_ids_hash(teams_data):
    """Create a hash of team IDs and game counts to detect roster changes"""
    return hash(tuple((t["TEAM_ID"], t["GP"]) for t in teams_data))

# Fetch team stats
print("Fetching NBA Regular Season team stats for 2025–26 season...")
data = leaguedashteamstats.LeagueDashTeamStats(
    season="2025-26",
    season_type_all_star="Regular Season",
    per_mode_detailed="PerGame",
    league_id_nullable="00"
).get_data_frames()[0]

if data.empty:
    print("⚠️ No regular season data found yet for 2025–26. The season may not have started.")
else:
    # Process team data
    df = data[[
        "TEAM_ID", "TEAM_NAME", "GP", "W", "L", "W_PCT",
        "PTS", "REB", "AST", "FG_PCT", "FG3_PCT", "FT_PCT"
    ]].rename(columns={"W_PCT": "WIN_PCT"})
    
    df = df[df["GP"] > 0]
    df = df.sort_values(by="WIN_PCT", ascending=False)
    teams_data = df.to_dict(orient="records")
    
    # Save team stats
    out_path = r"D:\Personal Projects\SportsAppV2\src\nba_team_stats.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(teams_data, f, indent=2)
    
    print(f"[OK] Saved NBA 2025–26 Regular Season stats to {out_path}")
    
    # Check if we need to update player data
    players_path = r"D:\Personal Projects\SportsAppV2\src\nba_player_stats.json"
    cache_meta_path = r"D:\Personal Projects\SportsAppV2\nba_cache\roster_cache_meta.json"
    
    current_hash = get_team_ids_hash(teams_data)
    needs_update = should_update_players(players_path, max_age_hours=168)
    
    # Check if teams have changed
    if os.path.exists(cache_meta_path):
        with open(cache_meta_path, "r") as f:
            cache_meta = json.load(f)
            if cache_meta.get("teams_hash") != current_hash:
                needs_update = True
                print("⚠️ Team changes detected, updating player stats...")
    else:
        needs_update = True
    
    if needs_update:
        # Fetch player stats for the entire league
        print("\nFetching player stats for all players...")
        
        try:
            player_stats = leaguedashplayerstats.LeagueDashPlayerStats(
                season="2025-26",
                season_type_all_star="Regular Season",
                per_mode_detailed="PerGame",
                league_id_nullable="00"
            ).get_data_frames()[0]
            
            if not player_stats.empty:
                # Select relevant columns
                players_df = player_stats[[
                    "PLAYER_ID", "PLAYER_NAME", "TEAM_ID", "TEAM_ABBREVIATION",
                    "GP", "MIN", "PTS", "REB", "AST", "STL", "BLK", "TOV",
                    "FG_PCT", "FG3_PCT", "FT_PCT", "FGA", "FG3A", "FTA"
                ]].copy()
                
                # Filter out players with 0 games played
                players_df = players_df[players_df["GP"] > 0]
                
                # Fetch jersey numbers for each team
                print("\nFetching jersey numbers for players...")
                jersey_numbers = {}
                
                for team in teams_data:
                    team_id = team["TEAM_ID"]
                    try:
                        roster = commonteamroster.CommonTeamRoster(
                            season="2025-26",
                            team_id=team_id
                        ).get_data_frames()[0]
                        
                        if not roster.empty:
                            for _, player in roster.iterrows():
                                player_id = int(player["PLAYER_ID"])
                                jersey_num = player["NUM"] if pd.notna(player["NUM"]) else "0"
                                jersey_numbers[player_id] = str(jersey_num)
                        
                        time.sleep(0.6)  # Rate limiting
                    except Exception as e:
                        print(f"  ✗ Error fetching roster for team {team_id}: {e}")
                
                # Group players by team
                players_by_team = {}
                for team in teams_data:
                    team_id = team["TEAM_ID"]
                    team_players = players_df[players_df["TEAM_ID"] == team_id].copy()
                    
                    # Sort by points per game (descending)
                    team_players = team_players.sort_values(by="PTS", ascending=False)
                    
                    # Convert to list of dictionaries
                    players_list = []
                    for _, player in team_players.iterrows():
                        player_id = int(player["PLAYER_ID"])
                        players_list.append({
                            "PLAYER_ID": player_id,
                            "PLAYER_NAME": player["PLAYER_NAME"],
                            "TEAM_ID": int(player["TEAM_ID"]),
                            "TEAM_ABBREVIATION": player["TEAM_ABBREVIATION"],
                            "JERSEY_NUMBER": jersey_numbers.get(player_id, "0"),
                            "GP": int(player["GP"]),
                            "MIN": round(float(player["MIN"]), 1),
                            "PTS": round(float(player["PTS"]), 1),
                            "REB": round(float(player["REB"]), 1),
                            "AST": round(float(player["AST"]), 1),
                            "STL": round(float(player["STL"]), 1),
                            "BLK": round(float(player["BLK"]), 1),
                            "TOV": round(float(player["TOV"]), 1),
                            "FG_PCT": round(float(player["FG_PCT"]), 3) if pd.notna(player["FG_PCT"]) else 0.0,
                            "FG3_PCT": round(float(player["FG3_PCT"]), 3) if pd.notna(player["FG3_PCT"]) else 0.0,
                            "FT_PCT": round(float(player["FT_PCT"]), 3) if pd.notna(player["FT_PCT"]) else 0.0,
                            "FGA": round(float(player["FGA"]), 1),
                            "FG3A": round(float(player["FG3A"]), 1),
                            "FTA": round(float(player["FTA"]), 1)
                        })
                    
                    players_by_team[str(team_id)] = players_list
                    print(f"  ✓ {team['TEAM_NAME']}: {len(players_list)} players")
                
                # Save player stats
                with open(players_path, "w", encoding="utf-8") as f:
                    json.dump(players_by_team, f, indent=2)
                
                # Save cache metadata
                cache_meta = {
                    "teams_hash": current_hash,
                    "last_updated": datetime.now().isoformat(),
                    "num_teams": len(teams_data),
                    "total_players": len(players_df)
                }
                with open(cache_meta_path, "w", encoding="utf-8") as f:
                    json.dump(cache_meta, f, indent=2)
                
                print(f"\n[OK] Saved player stats to {players_path}")
                print(f"   Total players: {len(players_df)}")
                print(f"   Teams with player data: {len(players_by_team)}")
            else:
                print("⚠️ No player data found for 2025-26 season")
                
        except Exception as e:
            print(f"✗ Error fetching player stats: {e}")
    else:
        print(f"\n[CACHED] Player stats data is up to date (less than 168 hours old)")
        print(f"   Skipping player stats fetch. Delete {players_path} to force update.")