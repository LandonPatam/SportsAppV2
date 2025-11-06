import requests
import json
from collections import defaultdict
import html as htmllib
import re
from typing import List, Dict, Any
from bs4 import BeautifulSoup


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
  'Priority': 'u=4',}

d = requests.get(url, headers=headers, timeout=10)
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
    
    
print(f"[OK] NBA Team and Player data updated")

# --- Load existing team stats ---
with open("public/data/espn_NBA_team_stats.json", "r", encoding="utf-8") as f:
    team_data = json.load(f)

# --- Attach the logo for each team ---
for team in team_data:
    team_id = team.get("TEAM_ID")
    if team_id:
        # Construct the NBA logo URL using the official CDN pattern
        team["LOGO_URL"] = f"https://cdn.nba.com/logos/nba/{team_id}/primary/L/logo.svg"

# --- Parse BPI directly from saved ESPN HTML and merge ---
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

    # Fallback: parse rendered table rows and merge by BPI rank
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
    url = "https://www.espn.com/nba/bpi"

    payload = {}
    headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Referer': 'https://www.google.com/',
    'Connection': 'keep-alive',
    'Cookie': 'SWID=1BC12018-76AD-4298-C23C-5EB9DD70B6BB; edition=espn-en-us; edition-view=espn-en-us; region=ccpa; tveAuth=espn3; cookieMonster=1; __fitt-sess-device.prod=5f9743f5-1991-4b56-9df2-7e9b375039cf; mbox=PC^#1675cae4ea40400982cd551583a6f1a9.35_0^#1824862869|session^#eea1bc0aab58454d83a920073615455e^#1762410355; s_ensNR=1761618067402-New; OptanonConsent=isGpcEnabled=0&datestamp=Mon+Oct+27+2025+19%3A23%3A27+GMT-0700+(Pacific+Daylight+Time)&version=202407.2.0&browserGpcFlag=0&isIABGlobal=false&hosts=&consentId=e9d9a673-36ea-482a-bbc0-be0a0c2e9a66&interactionCount=1&isAnonUser=1&landingPath=https%3A%2F%2Fwww.espn.com%2Fnba%2Fstandings&groups=C0001%3A1%2CC0003%3A1%2CBG407%3A1%2CC0002%3A1%2CC0004%3A1%2CC0005%3A1; usprivacy=1YNY; AMCV_EE0201AC512D2BE80A490D4C%40AdobeOrg=-330454231%7CMCMID%7C21080104722962798112362429104193239130%7CMCAAMLH-1761773075%7C9%7CMCAAMB-1762070091%7C6G1ynYcLPuiQxYZrsz_pkqfLG9yMXBpb2zX5dvJdYQJzPXImdj0y%7CMCOPTOUT-1762077292s%7CNONE%7CMCAID%7CNONE%7CvVersion%7C3.1.2%7CMCIDTS%7C20395; _cb=7wPu32JWTGDRHnlv; _chartbeat2=.1761618071782.1761618071782.1.D7xZXhDdqSFLQsx9hB2p1CxBWavfN.1; ab.storage.userId.96ad02b7-2edc-4238-8442-bc35ba85853c=g%3A1BC12018-76AD-4298-C23C-5EB9DD70B6BB%7Ce%3Aundefined%7Cc%3A1761618071793%7Cl%3A1761618071794; ab.storage.sessionId.96ad02b7-2edc-4238-8442-bc35ba85853c=g%3A618d7a20-942d-6bde-6155-fddbba6d0a31%7Ce%3A1761619871802%7Cc%3A1761618071793%7Cl%3A1761618071802; ab.storage.deviceId.96ad02b7-2edc-4238-8442-bc35ba85853c=g%3A675b46c1-c25d-8cfa-f9c5-167bb80dd0eb%7Ce%3Aundefined%7Cc%3A1761618071794%7Cl%3A1761618071794; s_ecid=MCMID%7C21080104722962798112362429104193239130; nol_fpid=4xrlotegxpquurxzsizqc21cqjeys1761618072|1761618072742|1761618072742|1761618072742; _scor_uid=ae659a55ede4490d944632b84ae8ab23; cto_bundle=JEfh-l8lMkZnbEd2WGNTQVlYdjdqSkMlMkZLRDdKZUt1UERMbWlVdzh0YmRPdHk1ZVkzT1BHOWI1YyUyQlk5aGxkV1NOJTJCRnB1WlRwTkM2SDFTaVhkWVNaekVwRHhUeXlONUc2UDc3MTRydHBoU3JvcXZMMnRCV0lMR1lsdHRnWDIlMkZORTJGZUlmTEVrb2Z2NTdnbFZ0RDU5REM1ekpkbUdUOW9GVDQ2dHNybmVJMkltNU0yVkVVJTNE; _cc_id=5841a92d1e3e143af8abb2bbe75ad7d5; connectId={"ttl":86400000,"lastUsed":1761618074543,"lastSynced":1761618074543}; __gads=ID=004e9c5f3cff2d56:T=1761618064:RT=1761618064:S=ALNI_MbxIjptHk03T2ZOpy_qKwrO9sDLnA; __gpi=UID=000012b915e0787d:T=1761618064:RT=1761618064:S=ALNI_MbdhHDRDUUk5XKaAkE_8nB0-3jTJg; __eoi=ID=e292e959d05a8c28:T=1761618064:RT=1761618064:S=AA-AfjZFdCPFJxDNzTNtD4AVn8Su; _gcl_au=1.1.1448530675.1761618075; s_c24=1762072568910; connectionspeed=full; dtcAuth=; _dcf=1; country=us; check=true; block.check=false%7Ctrue; userZip=91744; country=us; hashedIp=e254a6954ed7a8f960da0d43231c9bcd91eef4d566fd72f864c24baa1fdebff9; client_type=html5; client_version=4.7.1; espn-prev-page=espn%3Anba%3ApowerIndex; SWID=602B85A4-0AFC-4F42-CFE9-D8EFDCFE56E8; _dcf=1; connectionspeed=full; country=us; edition=espn-en-us; edition-view=espn-en-us; region=ccpa',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1',
    'If-Modified-Since': 'Thu, 06 Nov 2025 05:59:16 GMT',
    'Priority': 'u=0, i',
    'TE': 'trailers'
    }

    response = requests.request("GET", url, headers=headers, data=payload)
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

# --- Save updated JSON ---
with open("public/data/espn_NBA_team_stats.json", "w", encoding="utf-8") as f:
    json.dump(team_data, f, indent=2, ensure_ascii=False)
