import requests
import json
from collections import defaultdict
import html as htmllib
import re
from typing import List, Dict, Any
from bs4 import BeautifulSoup
import os


# ==========================================================
# SAFE ATOMIC WRITE HELPER
# Writes JSON to a .tmp file, flushes to disk, then renames.
# The live file is NEVER partially written.
# ==========================================================
def atomic_write_json(data, save_path: str):
    temp_path = save_path + ".tmp"
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(temp_path, save_path)


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
  'Priority': 'u=4',}

r = requests.get(url, headers=headers, timeout=10)
team_data = r.json()

result = team_data["resultSets"][0]
headers_list = result["headers"]
rows = result["rowSet"]

teams = [dict(zip(headers_list, row)) for row in rows]

formatted_teams = []
for t in teams:
    team_dict = {
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
    for key, value in t.items():
        if key not in team_dict:
            team_dict[key] = value
    formatted_teams.append(team_dict)

atomic_write_json(formatted_teams, "public/data/espn_NBA_team_stats.json")


# NBA Player Data

url = "https://stats.nba.com/stats/leaguedashplayerstats?College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=&DraftYear=&GameScope=&GameSegment=&Height=&ISTRound=&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=2025-26&SeasonSegment=&SeasonType=Regular%20Season&ShotClockRange=&StarterBench=&TeamID=0&VsConference=&VsDivision=&Weight="

d = requests.get(url, headers=headers, timeout=10)
player_data = d.json()

result = player_data["resultSets"][0]
headers_list = result["headers"]
rows = result["rowSet"]

players = [dict(zip(headers_list, row)) for row in rows]

team_players = defaultdict(list)

for p in players:
    team_id = p.get("TEAM_ID")
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
    for key, value in p.items():
        if key not in player_dict:
            player_dict[key] = value
    team_players[str(team_id)].append(player_dict)

atomic_write_json(dict(team_players), "public/data/espn_NBA_player_stats.json")


# --- Load existing team stats ---
with open("public/data/espn_NBA_team_stats.json", "r", encoding="utf-8") as f:
    team_data = json.load(f)

# --- Attach logo for each team ---
for team in team_data:
    team_id = team.get("TEAM_ID")
    if team_id:
        team["LOGO_URL"] = f"https://cdn.nba.com/logos/nba/{team_id}/primary/L/logo.svg"

# --- Parse BPI from ESPN ---
def _extract_balanced_objects(raw: str, anchor: str = '{"team"'):
    s = htmllib.unescape(raw)
    out = []
    i = 0
    n = len(s)
    while True:
        start = s.find(anchor, i)
        if start == -1:
            break
        brace_depth = 0
        j = start
        in_str = False
        esc = False
        while j < n:
            ch = s[j]
            if in_str:
                if esc:
                    esc = False
                elif ch == '\\':
                    esc = True
                elif ch == '"':
                    in_str = False
            else:
                if ch == '"':
                    in_str = True
                elif ch == '{':
                    brace_depth += 1
                elif ch == '}':
                    brace_depth -= 1
                    if brace_depth == 0:
                        out.append(s[start:j + 1])
                        i = j + 1
                        break
            j += 1
        else:
            i = start + len(anchor)
    return out


def _stats_list_to_map(stats):
    m = {}
    for item in stats or []:
        name = item.get("name")
        val = item.get("value")
        if isinstance(val, str):
            try:
                if val.replace(".", "", 1).replace("-", "", 1).isdigit():
                    val = float(val) if "." in val else int(val)
            except Exception:
                pass
        m[name] = val
    return m


def _get_first_present(d, keys):
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return None


def parse_nba_bpi(html: str):
    blocks = _extract_balanced_objects(html)
    teams = []

    for raw_obj in blocks:
        try:
            obj = json.loads(raw_obj)
        except json.JSONDecodeError:
            continue
        if "team" not in obj or "stats" not in obj:
            continue
        team = obj["team"]
        stats = _stats_list_to_map(obj["stats"])
        teams.append({
            "name": team.get("displayName"),
            "abbr": team.get("abbrev"),
            "logo": team.get("logo"),
            "bpi": _get_first_present(stats, ["bpi", "BPI", "bpi_value"]),
            "bpirank": _get_first_present(stats, ["bpirank", "BPI RK", "bpi_rank", "rank_bpi", "bpiRank"]),
            "off": _get_first_present(stats, ["off", "OFF", "off_bpi", "offense", "off_rating", "offRating", "offBpi"]),
            "def": _get_first_present(stats, ["def", "DEF", "def_bpi", "defense", "def_rating", "defRating", "defBpi"]),
            "pbpi": _get_first_present(stats, ["proj_bpi", "pbpi", "PBPI", "projected_bpi", "projBpi"])
        })

    try:
        soup = BeautifulSoup(html, "html.parser")
        by_rank = {}
        for tr in soup.find_all("tr"):
            tds = tr.find_all("td")
            if len(tds) < 6:
                continue
            rec, bpi_s, rank_s, off_s, def_s, pbpi_s = [td.get_text(strip=True) for td in tds[:6]]
            if not re.match(r"^\d+-\d+$", rec):
                continue
            if not re.match(r"^\d+$", rank_s):
                continue
            def to_num(s):
                s = s.strip()
                if s in ("--", "—", "-"):
                    return None
                try:
                    return float(s)
                except Exception:
                    return None
            rank = int(rank_s)
            by_rank[rank] = {
                "bpi": to_num(bpi_s),
                "off": to_num(off_s),
                "def": to_num(def_s),
                "pbpi": to_num(pbpi_s),
                "record": rec,
            }
        if by_rank:
            for t in teams:
                try:
                    r = int(t.get("bpirank") or 0)
                except Exception:
                    r = 0
                if r in by_rank:
                    nums = by_rank[r]
                    if t.get("off") is None and nums.get("off") is not None:
                        t["off"] = nums.get("off")
                    if t.get("def") is None and nums.get("def") is not None:
                        t["def"] = nums.get("def")
                    if t.get("pbpi") is None and nums.get("pbpi") is not None:
                        t["pbpi"] = nums.get("pbpi")
    except Exception:
        pass

    return teams


try:
    bpi_url = "https://www.espn.com/nba/bpi"
    bpi_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Referer': 'https://www.google.com/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }
    response = requests.get(bpi_url, headers=bpi_headers)
    nba_bpi_data = response.text

    bpi_rows = parse_nba_bpi(nba_bpi_data)
    name_to_bpi = {row.get("name"): row for row in bpi_rows if row.get("name")}
    for team in team_data:
        nm = team.get("TEAM_NAME")
        b = name_to_bpi.get(nm)
        if not b:
            continue
        team["bpi"] = b.get("bpi")
        team["bpirank"] = b.get("bpirank")
        team["off"] = b.get("off")
        team["def"] = b.get("def")
        team["pbpi"] = b.get("pbpi")
except Exception:
    pass

# --- Save updated team stats atomically ---
atomic_write_json(team_data, "public/data/espn_NBA_team_stats.json")