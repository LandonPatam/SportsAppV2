import requests
import json
import os
import time
from datetime import datetime, timedelta
from collections import defaultdict

# ==============================
# Helper Functions
# ==============================

def parse_shooting_stat(stat_str):
    """Parse '6-11' format into made and attempted shots."""
    if not stat_str or stat_str in ['', '-', 'NaN']:
        return 0, 0
    try:
        made, attempted = stat_str.split('-')
        return float(made), float(attempted)
    except:
        return 0, 0

def is_regular_season_game(event):
    """Check if the game is a regular season game (type 2)."""
    try:
        season_type = event.get('season', {}).get('type', 0)
        return season_type == 2
    except:
        return False

def is_game_completed(event):
    """Check if the game has been completed."""
    try:
        status = event.get('status', {})
        status_type = status.get('type', {})
        completed = status_type.get('completed', False)
        state = status_type.get('state', '')
        return completed or state == 'post'
    except:
        return False

def get_nba_teams():
    """Fetch all NBA teams from ESPN API."""
    url = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        teams = []
        if 'sports' in data:
            for sport in data['sports']:
                if 'leagues' in sport:
                    for league in sport['leagues']:
                        if 'teams' in league:
                            for team_entry in league['teams']:
                                team = team_entry.get('team', {})
                                teams.append({
                                    'id': team.get('id'),
                                    'name': team.get('displayName'),
                                    'abbreviation': team.get('abbreviation')
                                })
        
        return teams
    except Exception as e:
        print(f"Error fetching teams: {e}")
        return []

def get_team_roster(team_id):
    """Get roster for a specific team."""
    url = f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{team_id}/roster"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        roster = {}
        if 'athletes' in data:
            for athlete in data['athletes']:
                player_id = athlete.get('id')
                roster[player_id] = {
                    'id': player_id,
                    'name': athlete.get('displayName'),
                    'jersey': athlete.get('jersey', '0'),
                    'position': athlete.get('position', {}).get('abbreviation', 'N/A')
                }
        
        return roster
    except Exception as e:
        print(f"Error fetching roster for team {team_id}: {e}")
        return {}

def aggregate_team_and_player_stats(team_id, team_abbrev):
    """
    Aggregate both team and player stats from completed regular season games.
    """
    team_stats = {
        'games_played': 0,
        'wins': 0,
        'losses': 0,
        'pts': 0,
        'pts_allowed': 0,
        'reb': 0,
        'ast': 0,
        'fg_made': 0,
        'fg_att': 0,
        'fg3_made': 0,
        'fg3_att': 0,
        'ft_made': 0,
        'ft_att': 0
    }
    
    player_stats = defaultdict(lambda: {
        'games': 0,
        'min': 0,
        'pts': 0,
        'reb': 0,
        'ast': 0,
        'stl': 0,
        'blk': 0,
        'tov': 0,
        'fg_made': 0,
        'fg_att': 0,
        'fg3_made': 0,
        'fg3_att': 0,
        'ft_made': 0,
        'ft_att': 0
    })
    
    season_start = datetime(2025, 10, 22)
    current_date = datetime.now()
    days_to_search = (current_date - season_start).days + 1
    
    for days in range(days_to_search):
        date = season_start + timedelta(days=days)
        
        if date > current_date:
            break
            
        date_str = date.strftime('%Y%m%d')
        url = f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={date_str}"
        
        try:
            response = requests.get(url)
            response.raise_for_status()
            data = response.json()
            
            if 'events' in data:
                for event in data['events']:
                    if not is_regular_season_game(event) or not is_game_completed(event):
                        continue
                    
                    game_id = event.get('id')
                    
                    if 'competitions' in event:
                        for comp in event['competitions']:
                            team_found = False
                            our_team_index = None
                            
                            if 'competitors' in comp:
                                for idx, competitor in enumerate(comp['competitors']):
                                    if competitor.get('team', {}).get('id') == team_id:
                                        team_found = True
                                        our_team_index = idx
                                        break
                            
                            if team_found:
                                team_stats['games_played'] += 1
                                
                                # Get win/loss
                                our_team = comp['competitors'][our_team_index]
                                is_winner = our_team.get('winner', False)
                                
                                if is_winner:
                                    team_stats['wins'] += 1
                                else:
                                    team_stats['losses'] += 1
                                
                                # Get detailed game stats
                                game_url = f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={game_id}"
                                game_response = requests.get(game_url)
                                game_data = game_response.json()
                                
                                # Process team stats
                                if 'boxscore' in game_data and 'teams' in game_data['boxscore']:
                                    for team in game_data['boxscore']['teams']:
                                        team_info = team.get('team', {})
                                        is_our_team = team_info.get('id') == team_id
                                        
                                        statistics = team.get('statistics', [])
                                        team_game_stats = {}
                                        for stat in statistics:
                                            stat_name = stat.get('name', '')
                                            stat_value = stat.get('displayValue', '0')
                                            team_game_stats[stat_name] = stat_value
                                        
                                        def safe_float(val):
                                            try:
                                                return float(val) if val not in ['', '-', None] else 0
                                            except:
                                                return 0
                                        
                                        if is_our_team:
                                            # Try multiple possible field names for points
                                            pts = safe_float(team_game_stats.get('points', 
                                                  team_game_stats.get('totalPoints',
                                                  team_game_stats.get('PTS', 0))))
                                            
                                            # If still 0, try getting from competition score
                                            if pts == 0:
                                                pts = safe_float(comp['competitors'][our_team_index].get('score', 0))
                                            
                                            reb = safe_float(team_game_stats.get('totalRebounds', 0))
                                            ast = safe_float(team_game_stats.get('assists', 0))
                                            
                                            fg_made, fg_att = parse_shooting_stat(team_game_stats.get('fieldGoalsMade-fieldGoalsAttempted', '0-0'))
                                            fg3_made, fg3_att = parse_shooting_stat(team_game_stats.get('threePointFieldGoalsMade-threePointFieldGoalsAttempted', '0-0'))
                                            ft_made, ft_att = parse_shooting_stat(team_game_stats.get('freeThrowsMade-freeThrowsAttempted', '0-0'))
                                            
                                            team_stats['pts'] += pts
                                            team_stats['reb'] += reb
                                            team_stats['ast'] += ast
                                            team_stats['fg_made'] += fg_made
                                            team_stats['fg_att'] += fg_att
                                            team_stats['fg3_made'] += fg3_made
                                            team_stats['fg3_att'] += fg3_att
                                            team_stats['ft_made'] += ft_made
                                            team_stats['ft_att'] += ft_att
                                        else:
                                            # For opponent, try getting points from multiple sources
                                            opp_pts = safe_float(team_game_stats.get('points',
                                                      team_game_stats.get('totalPoints',
                                                      team_game_stats.get('PTS', 0))))
                                            
                                            # If still 0, get from competition score
                                            if opp_pts == 0:
                                                opp_index = 1 - our_team_index
                                                opp_pts = safe_float(comp['competitors'][opp_index].get('score', 0))
                                            
                                            team_stats['pts_allowed'] += opp_pts
                                
                                # Process player stats
                                if 'boxscore' in game_data and 'players' in game_data['boxscore']:
                                    for team in game_data['boxscore']['players']:
                                        if team.get('team', {}).get('id') == team_id:
                                            if 'statistics' in team:
                                                for stat_group in team['statistics']:
                                                    labels = stat_group.get('labels', [])
                                                    
                                                    if 'athletes' in stat_group:
                                                        for player in stat_group['athletes']:
                                                            player_id = player.get('athlete', {}).get('id')
                                                            stats = player.get('stats', [])
                                                            
                                                            game_stats = {}
                                                            for i, label in enumerate(labels):
                                                                if i < len(stats):
                                                                    game_stats[label] = stats[i]
                                                            
                                                            fg_made, fg_att = parse_shooting_stat(game_stats.get('FG', '0-0'))
                                                            fg3_made, fg3_att = parse_shooting_stat(game_stats.get('3PT', '0-0'))
                                                            ft_made, ft_att = parse_shooting_stat(game_stats.get('FT', '0-0'))
                                                            
                                                            def safe_float(val):
                                                                try:
                                                                    return float(val) if val not in ['', '-', None] else 0
                                                                except:
                                                                    return 0
                                                            
                                                            ps = player_stats[player_id]
                                                            ps['games'] += 1
                                                            ps['min'] += safe_float(game_stats.get('MIN', 0))
                                                            ps['pts'] += safe_float(game_stats.get('PTS', 0))
                                                            ps['reb'] += safe_float(game_stats.get('REB', 0))
                                                            ps['ast'] += safe_float(game_stats.get('AST', 0))
                                                            ps['stl'] += safe_float(game_stats.get('STL', 0))
                                                            ps['blk'] += safe_float(game_stats.get('BLK', 0))
                                                            ps['tov'] += safe_float(game_stats.get('TO', 0))
                                                            ps['fg_made'] += fg_made
                                                            ps['fg_att'] += fg_att
                                                            ps['fg3_made'] += fg3_made
                                                            ps['fg3_att'] += fg3_att
                                                            ps['ft_made'] += ft_made
                                                            ps['ft_att'] += ft_att
            
            time.sleep(0.3)  # Rate limiting
            
        except Exception as e:
            continue
    
    return team_stats, dict(player_stats)

# ==============================
# Main Execution
# ==============================

print("Fetching NBA team data from ESPN API...")

teams = get_nba_teams()

if not teams:
    print("⚠️ No teams found")
    exit()

print(f"Found {len(teams)} teams\n")

teams_data = []
players_by_team = {}

for team in teams:
    team_id = team['id']
    team_name = team['name']
    team_abbrev = team['abbreviation']
    
    print(f"Processing {team_name}...")
    
    # Get roster
    roster = get_team_roster(team_id)
    
    # Aggregate stats
    team_stats, player_stats = aggregate_team_and_player_stats(team_id, team_abbrev)
    
    gp = team_stats['games_played']
    
    if gp == 0:
        print(f"  ⚠️ No completed games found for {team_name}")
        continue
    
    # Calculate team averages
    win_pct = team_stats['wins'] / gp if gp > 0 else 0
    fg_pct = team_stats['fg_made'] / team_stats['fg_att'] if team_stats['fg_att'] > 0 else 0
    fg3_pct = team_stats['fg3_made'] / team_stats['fg3_att'] if team_stats['fg3_att'] > 0 else 0
    ft_pct = team_stats['ft_made'] / team_stats['ft_att'] if team_stats['ft_att'] > 0 else 0
    
    teams_data.append({
        "TEAM_ID": int(team_id),
        "TEAM_NAME": team_name,
        "GP": gp,
        "W": team_stats['wins'],
        "L": team_stats['losses'],
        "WIN_PCT": round(win_pct, 3),
        "PTS": round(team_stats['pts'] / gp, 1),
        "REB": round(team_stats['reb'] / gp, 1),
        "AST": round(team_stats['ast'] / gp, 1),
        "FG_PCT": round(fg_pct, 3),
        "FG3_PCT": round(fg3_pct, 3),
        "FT_PCT": round(ft_pct, 3),
        "OFF_RATING": None,
        "DEF_RATING": None,
        "NET_RATING": None
    })
    
    # Process player stats
    team_players = []
    
    for player_id, ps in player_stats.items():
        games = ps['games']
        
        if games == 0:
            continue
        
        # Get player info from roster
        player_info = roster.get(player_id, {
            'name': 'Unknown',
            'jersey': '0',
            'position': 'N/A'
        })
        
        fg_pct = ps['fg_made'] / ps['fg_att'] if ps['fg_att'] > 0 else 0
        fg3_pct = ps['fg3_made'] / ps['fg3_att'] if ps['fg3_att'] > 0 else 0
        ft_pct = ps['ft_made'] / ps['ft_att'] if ps['ft_att'] > 0 else 0
        
        player_dict = {
            "PLAYER_ID": int(player_id),
            "PLAYER_NAME": player_info['name'],
            "TEAM_ID": int(team_id),
            "TEAM_ABBREVIATION": team_abbrev,
            "JERSEY_NUMBER": str(player_info['jersey']),
            "POSITION": player_info['position'],
            "GP": games,
            "MIN": round(ps['min'] / games, 1),
            "PTS": round(ps['pts'] / games, 1),
            "REB": round(ps['reb'] / games, 1),
            "AST": round(ps['ast'] / games, 1),
            "STL": round(ps['stl'] / games, 1),
            "BLK": round(ps['blk'] / games, 1),
            "TOV": round(ps['tov'] / games, 1),
            "FG_PCT": round(fg_pct, 3),
            "FG3_PCT": round(fg3_pct, 3),
            "FT_PCT": round(ft_pct, 3),
            "FGA": round(ps['fg_att'] / games, 1),
            "FG3A": round(ps['fg3_att'] / games, 1),
            "FTA": round(ps['ft_att'] / games, 1),
            "OFF_RATING": None,
            "DEF_RATING": None,
            "NET_RATING": None,
            "VALUE_SCORE": 0
        }
        
        team_players.append(player_dict)
    
    # Sort by points
    team_players.sort(key=lambda x: x['PTS'], reverse=True)
    players_by_team[str(team_id)] = team_players
    
    print(f"  ✓ {len(team_players)} players with stats")
    
    time.sleep(0.5)

# Sort teams by win percentage
teams_data.sort(key=lambda x: x['WIN_PCT'], reverse=True)

# Save files
team_json_path = "nba_team_stats_v2.json"
players_json_path = "nba_player_stats_v2.json"

with open(team_json_path, "w", encoding="utf-8") as f:
    json.dump(teams_data, f, indent=2)

with open(players_json_path, "w", encoding="utf-8") as f:
    json.dump(players_by_team, f, indent=2)

print(f"\n✅ Saved NBA team stats to {team_json_path}")
print(f"✅ Saved NBA player stats to {players_json_path}")
print(f"   Total teams: {len(teams_data)}")
print(f"   Total players: {sum(len(p) for p in players_by_team.values())}")