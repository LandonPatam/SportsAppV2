import requests
import json
from collections import defaultdict
import html as htmllib
import re
from typing import List, Dict, Any
from bs4 import BeautifulSoup
import os
from datetime import datetime
from urllib.parse import urlencode
import time


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


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEDULE_JSON = os.path.join(BASE_DIR, "public", "data", "nba_schedule.json")
TEAM_STATS_JSON = os.path.join(BASE_DIR, "public", "data", "espn_NBA_team_stats.json")
PLAYER_STATS_JSON = os.path.join(BASE_DIR, "public", "data", "espn_NBA_player_stats.json")
SEASONS_MANIFEST_JSON = os.path.join(BASE_DIR, "public", "data", "nba_seasons.json")

def get_nba_season_year() -> int:
    try:
        with open(SCHEDULE_JSON, "r", encoding="utf-8-sig") as f:
            schedule = json.load(f)
        dates = sorted(
            datetime.strptime(g["date"], "%Y-%m-%d").date()
            for g in schedule
            if g.get("date")
        )
        if dates:
            return dates[0].year
    except Exception:
        pass
    today = datetime.now().date()
    return today.year if today.month >= 7 else today.year - 1

def get_nba_season_string() -> str:
    start_year = get_nba_season_year()
    return f"{start_year}-{str(start_year + 1)[-2:]}"

NBA_SEASON = get_nba_season_string()
print(f"NBA stats season: {NBA_SEASON}")
SEASON_START_YEAR = int(NBA_SEASON.split("-")[0])
SEASON_TEAM_STATS_JSON = os.path.join(BASE_DIR, "public", "data", f"espn_NBA_team_stats_{NBA_SEASON}.json")
SEASON_PLAYER_STATS_JSON = os.path.join(BASE_DIR, "public", "data", f"espn_NBA_player_stats_{NBA_SEASON}.json")

NBA_TEAM_ABBREVIATIONS = {
    "Atlanta Hawks": "ATL",
    "Boston Celtics": "BOS",
    "Brooklyn Nets": "BKN",
    "Charlotte Hornets": "CHA",
    "Chicago Bulls": "CHI",
    "Cleveland Cavaliers": "CLE",
    "Dallas Mavericks": "DAL",
    "Denver Nuggets": "DEN",
    "Detroit Pistons": "DET",
    "Golden State Warriors": "GSW",
    "Houston Rockets": "HOU",
    "Indiana Pacers": "IND",
    "LA Clippers": "LAC",
    "Los Angeles Clippers": "LAC",
    "Los Angeles Lakers": "LAL",
    "Memphis Grizzlies": "MEM",
    "Miami Heat": "MIA",
    "Milwaukee Bucks": "MIL",
    "Minnesota Timberwolves": "MIN",
    "New Orleans Pelicans": "NOP",
    "New York Knicks": "NYK",
    "Oklahoma City Thunder": "OKC",
    "Orlando Magic": "ORL",
    "Philadelphia 76ers": "PHI",
    "Phoenix Suns": "PHX",
    "Portland Trail Blazers": "POR",
    "Sacramento Kings": "SAC",
    "San Antonio Spurs": "SAS",
    "Toronto Raptors": "TOR",
    "Utah Jazz": "UTA",
    "Washington Wizards": "WAS",
}

ZERO_PLAYER_STATS = {
    "GP": 0,
    "MIN": 0,
    "PTS": 0,
    "REB": 0,
    "AST": 0,
    "STL": 0,
    "BLK": 0,
    "TOV": 0,
    "FG_PCT": 0,
    "FG3_PCT": 0,
    "FT_PCT": 0,
    "FGA": 0,
    "FG3A": 0,
    "FTA": 0,
    "OFF_RATING": None,
    "DEF_RATING": None,
    "NET_RATING": None,
    "VALUE_SCORE": None,
}

def nba_stats_url(endpoint: str, extra_params: Dict[str, Any] = None) -> str:
    params = {
        "Conference": "",
        "DateFrom": "",
        "DateTo": "",
        "Division": "",
        "GameScope": "",
        "GameSegment": "",
        "Height": "",
        "ISTRound": "",
        "LastNGames": "0",
        "LeagueID": "00",
        "Location": "",
        "MeasureType": "Base",
        "Month": "0",
        "OpponentTeamID": "0",
        "Outcome": "",
        "PORound": "0",
        "PaceAdjust": "N",
        "PerMode": "PerGame",
        "Period": "0",
        "PlayerExperience": "",
        "PlayerPosition": "",
        "PlusMinus": "N",
        "Rank": "N",
        "Season": NBA_SEASON,
        "SeasonSegment": "",
        "SeasonType": "Regular Season",
        "ShotClockRange": "",
        "StarterBench": "",
        "TeamID": "0",
        "VsConference": "",
        "VsDivision": "",
    }
    if extra_params:
        params.update(extra_params)
    return f"https://stats.nba.com/stats/{endpoint}?{urlencode(params)}"

def nba_roster_url(team_id: int) -> str:
    params = {
        "LeagueID": "00",
        "Season": NBA_SEASON,
        "TeamID": str(team_id),
    }
    return f"https://stats.nba.com/stats/commonteamroster?{urlencode(params)}"

def load_json_or_default(path: str, default):
    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            return json.load(f)
    except Exception:
        return default

def update_seasons_manifest():
    manifest = {"current": NBA_SEASON, "seasons": []}
    if os.path.exists(SEASONS_MANIFEST_JSON):
        try:
            with open(SEASONS_MANIFEST_JSON, "r", encoding="utf-8-sig") as f:
                loaded = json.load(f)
            if isinstance(loaded, dict):
                manifest.update(loaded)
        except Exception:
            pass

    seasons = [
        s for s in manifest.get("seasons", [])
        if isinstance(s, dict) and s.get("id") != NBA_SEASON
    ]
    seasons.append({
        "id": NBA_SEASON,
        "label": NBA_SEASON,
        "start_year": SEASON_START_YEAR,
        "schedule": f"nba_schedule_{NBA_SEASON}.json",
        "team_stats": f"espn_NBA_team_stats_{NBA_SEASON}.json",
        "player_stats": f"espn_NBA_player_stats_{NBA_SEASON}.json",
    })
    seasons.sort(key=lambda s: int(s.get("start_year", 0) or 0), reverse=True)
    manifest["current"] = NBA_SEASON
    manifest["seasons"] = seasons
    atomic_write_json(manifest, SEASONS_MANIFEST_JSON)

def write_team_stats(data):
    atomic_write_json(data, SEASON_TEAM_STATS_JSON)
    atomic_write_json(data, TEAM_STATS_JSON)
    update_seasons_manifest()

def write_player_stats(data):
    atomic_write_json(data, SEASON_PLAYER_STATS_JSON)
    atomic_write_json(data, PLAYER_STATS_JSON)
    update_seasons_manifest()

def create_blank_team_stats(team_source: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    blank_teams = []
    for team in team_source:
        team_id = team.get("TEAM_ID")
        team_name = team.get("TEAM_NAME")
        if not team_id or not team_name:
            continue
        blank = {}
        for key, value in team.items():
            if key in {"TEAM_ID", "TEAM_NAME", "LOGO_URL"}:
                blank[key] = value
            elif isinstance(value, (int, float)):
                blank[key] = 0
            else:
                blank[key] = value
        blank.setdefault("GP", 0)
        blank.setdefault("W", 0)
        blank.setdefault("L", 0)
        blank.setdefault("WIN_PCT", 0)
        blank.setdefault("W_PCT", 0)
        blank_teams.append(blank)
    return blank_teams

def format_player_stats_row(p: Dict[str, Any]) -> Dict[str, Any]:
    player_dict = {
        "PLAYER_ID": p["PLAYER_ID"],
        "PLAYER_NAME": p["PLAYER_NAME"],
        "TEAM_ID": p["TEAM_ID"],
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
    return player_dict

def format_roster_row(row: Dict[str, Any], team_name: str) -> Dict[str, Any]:
    team_id = row.get("TeamID")
    player_dict = {
        "PLAYER_ID": row.get("PLAYER_ID"),
        "PLAYER_NAME": row.get("PLAYER"),
        "TEAM_ID": team_id,
        "TEAM_ABBREVIATION": NBA_TEAM_ABBREVIATIONS.get(team_name, ""),
        "JERSEY_NUMBER": row.get("NUM") or "",
        "POSITION": row.get("POSITION") or "",
        "NICKNAME": row.get("NICKNAME") or "",
        "AGE": row.get("AGE"),
        "HEIGHT": row.get("HEIGHT") or "",
        "WEIGHT": row.get("WEIGHT") or "",
        "SCHOOL": row.get("SCHOOL") or "",
        "EXP": row.get("EXP") or "",
        "PLAYER_SLUG": row.get("PLAYER_SLUG") or "",
        "ROSTER_ONLY": True,
    }
    player_dict.update(ZERO_PLAYER_STATS)
    return player_dict

def fetch_roster_players(team_source: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    roster_players = defaultdict(list)
    for team in team_source:
        team_id = team.get("TEAM_ID")
        team_name = team.get("TEAM_NAME", "")
        if not team_id:
            continue
        try:
            resp = requests.get(nba_roster_url(team_id), headers=headers, timeout=20)
            roster_data = resp.json()
            result = roster_data.get("resultSets", [{}])[0]
            roster_headers = result.get("headers", [])
            roster_rows = result.get("rowSet", [])
            for row in roster_rows:
                player = format_roster_row(dict(zip(roster_headers, row)), team_name)
                if player.get("PLAYER_ID") and player.get("PLAYER_NAME"):
                    roster_players[str(team_id)].append(player)
            print(f"[ROSTER] {team_name}: {len(roster_rows)} players")
        except Exception as e:
            print(f"[WARN] Could not fetch roster for {team_name} ({team_id}): {e}")
        time.sleep(0.2)
    return dict(roster_players)


# NBA Team Data

url = nba_stats_url("leaguedashteamstats", {"TwoWay": "0"})

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

result = team_data.get("resultSets", [{}])[0]
headers_list = result.get("headers", [])
rows = result.get("rowSet", [])

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

if formatted_teams:
    write_team_stats(formatted_teams)
else:
    print(f"[WARN] No NBA team stats returned for {NBA_SEASON}; creating blank current-season team stats.")


# NBA Player Data

url = nba_stats_url("leaguedashplayerstats", {
    "College": "",
    "Country": "",
    "DraftPick": "",
    "DraftYear": "",
    "Weight": "",
})

d = requests.get(url, headers=headers, timeout=10)
player_data = d.json()

result = player_data.get("resultSets", [{}])[0]
headers_list = result.get("headers", [])
rows = result.get("rowSet", [])

players = [dict(zip(headers_list, row)) for row in rows]

team_players = defaultdict(list)

for p in players:
    team_id = p.get("TEAM_ID")
    if not team_id or team_id == "null":
        continue

    team_players[str(team_id)].append(format_player_stats_row(p))

if team_players:
    write_player_stats(dict(team_players))
else:
    print(f"[WARN] No NBA player stats returned for {NBA_SEASON}; fetching current rosters.")
    roster_team_source = formatted_teams or load_json_or_default(SEASON_TEAM_STATS_JSON, []) or load_json_or_default(TEAM_STATS_JSON, [])
    roster_players = fetch_roster_players(roster_team_source)
    if roster_players:
        write_player_stats(roster_players)
        print(f"[OK] Saved roster fallback for {sum(len(v) for v in roster_players.values())} players.")
    else:
        print(f"[WARN] No NBA rosters returned for {NBA_SEASON}; preserving existing player stats.")


# --- Load existing team stats ---
if formatted_teams:
    team_data = formatted_teams
else:
    team_data = load_json_or_default(SEASON_TEAM_STATS_JSON, [])
    if not team_data:
        team_data = create_blank_team_stats(load_json_or_default(TEAM_STATS_JSON, []))

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
write_team_stats(team_data)
