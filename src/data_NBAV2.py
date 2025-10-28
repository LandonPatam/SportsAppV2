import requests
import json
from collections import defaultdict


# NBA Team Data

url = "https://stats.nba.com/stats/leaguedashteamstats?Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&Height=&ISTRound=&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=2025-26&SeasonSegment=&SeasonType=Regular%20Season&ShotClockRange=&StarterBench=&TeamID=0&TwoWay=0&VsConference=&VsDivision="

payload = {}
headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com',
  'Connection': 'keep-alive',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  'Priority': 'u=4',
  'Cookie': 'ak_bmsc=2328E04EA91FE0CC34309DA826963E8D~000000000000000000000000000000~YAAQXF7WF4gTBuiZAQAAQkSzKB36Z+KWzOQmfB7eY3HHnRB8jSsIEUx2WiUY6g6ztqMA5xs6DfQRMDq3kh+PsHUAzHcVifWMlsJALn7mLMB89sSdvUFo+QuJYWg936dJsffrbj2aO4hXYr3gkdlSu0KyOu7gvO55E1QrTuE/7qgBqpV61w1FQIR6g3F2vtaK9X8OpfYobxxIn0PuGwiOex46fGb6NVaxvkG9MdjoAn5QEMZCCG9F0clrB3sfJjKAIErcWVcpI5Gef58oZECMybf/T91Z6VUY92q8iihitTZzQms+83RgQaFE4FVX195RQKSHhbu3Fk3STo4vPJV9AQ1BSJI9TU0WyezL'
}

r = requests.get(url, headers=headers)
team_data = r.json()

result = team_data["resultSets"][0]
headers_list = result["headers"]
rows = result["rowSet"]

teams = [dict(zip(headers_list, row)) for row in rows]

formatted_teams = []
for t in teams:
    team_dict = {
        # === Required fields ===
        "TEAM_ID": t["TEAM_ID"],
        "TEAM_NAME": t["TEAM_NAME"],
        "GP": t["GP"],
        "W": t["W"],
        "L": t["L"],
        "WIN_PCT": t["W_PCT"],
        "PTS": t["PTS"],
        "REB": t["REB"],
        "AST": t["AST"],
        "FG_PCT": t["FG_PCT"],
        "FG3_PCT": t["FG3_PCT"],
        "FT_PCT": t["FT_PCT"],
    }

    # === Add every other stat after your required ones ===
    for key, value in t.items():
        if key not in team_dict:
            team_dict[key] = value

    formatted_teams.append(team_dict)

# Save to JSON file
with open("public/data/espn_NBA_team_stats.json", "w") as f:
    json.dump(formatted_teams, f, indent=2)
    
    
# NBA Player Data

url = "https://stats.nba.com/stats/leaguedashplayerstats?College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=&DraftYear=&GameScope=&GameSegment=&Height=&ISTRound=&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=2025-26&SeasonSegment=&SeasonType=Regular%20Season&ShotClockRange=&StarterBench=&TeamID=0&VsConference=&VsDivision=&Weight="

payload = {}
headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com',
  'Connection': 'keep-alive',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  'Priority': 'u=4',
  'Cookie': 'ak_bmsc=2328E04EA91FE0CC34309DA826963E8D~000000000000000000000000000000~YAAQXF7WF4gTBuiZAQAAQkSzKB36Z+KWzOQmfB7eY3HHnRB8jSsIEUx2WiUY6g6ztqMA5xs6DfQRMDq3kh+PsHUAzHcVifWMlsJALn7mLMB89sSdvUFo+QuJYWg936dJsffrbj2aO4hXYr3gkdlSu0KyOu7gvO55E1QrTuE/7qgBqpV61w1FQIR6g3F2vtaK9X8OpfYobxxIn0PuGwiOex46fGb6NVaxvkG9MdjoAn5QEMZCCG9F0clrB3sfJjKAIErcWVcpI5Gef58oZECMybf/T91Z6VUY92q8iihitTZzQms+83RgQaFE4FVX195RQKSHhbu3Fk3STo4vPJV9AQ1BSJI9TU0WyezL; bm_sv=B0BACA0161916BAD4D9A8753F47D4C97~YAAQXF7WFzyrBuiZAQAAUGfFKB1oLyYPW6o/T1t+vSK/HqP4BPB0vmYSwJzNsT60dXP51pltxV49dTWLubibVEaiOzxRc8R1ZuDIRtkRLVew0+DZ9IJOhfigV38IDAx9IwNeJLCsR8xjz7dk3K3jsqY7iBsiCdvOVSyi+2Popp3vZXT3a3LhmsoF68lFcSbuNF/dAvma0BV7eUBLl1pcnkbSpz1JZWXjTrx1dI1VVY1Ht+bwi2gQrWBX/2Nd~1'
}

d = requests.get(url, headers=headers)
player_data = d.json()

# Extract the base data
result = player_data["resultSets"][0]
headers_list = result["headers"]
rows = result["rowSet"]

# Convert rows to list of dicts
players = [dict(zip(headers_list, row)) for row in rows]

# Group players by TEAM_ID
team_players = defaultdict(list)

for p in players:
    team_id = p.get("TEAM_ID")

    # Skip any rows without a valid team ID
    if not team_id or team_id == "null":
        continue

    player_dict = {
        "PLAYER_ID": p["PLAYER_ID"],
        "PLAYER_NAME": p["PLAYER_NAME"],
        "TEAM_ID": team_id,
        "TEAM_ABBREVIATION": p["TEAM_ABBREVIATION"],
        "JERSEY_NUMBER": p.get("JERSEY", ""),
        "POSITION": p.get("POSITION", ""),
        "GP": p["GP"],
        "MIN": p["MIN"],
        "PTS": p["PTS"],
        "REB": p["REB"],
        "AST": p["AST"],
        "STL": p["STL"],
        "BLK": p["BLK"],
        "TOV": p["TOV"],
        "FG_PCT": p["FG_PCT"],
        "FG3_PCT": p["FG3_PCT"],
        "FT_PCT": p["FT_PCT"],
        "FGA": p["FGA"],
        "FG3A": p["FG3A"],
        "FTA": p["FTA"],
        "OFF_RATING": p.get("OFF_RATING"),
        "DEF_RATING": p.get("DEF_RATING"),
        "NET_RATING": p.get("NET_RATING"),
        "VALUE_SCORE": p.get("VALUE_SCORE"),
    }

    # Add remaining fields
    for key, value in p.items():
        if key not in player_dict:
            player_dict[key] = value

    team_players[str(team_id)].append(player_dict)


# Save to file
with open("public/data/espn_NBA_player_stats.json", "w") as f:
    json.dump(team_players, f, indent=2)