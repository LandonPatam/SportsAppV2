from bs4 import BeautifulSoup
import json
import requests
import io
import os


url = "https://www.nfl.com/standings/league/2025/REG"

payload = {}
headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Referer': 'https://www.nfl.com/standings/',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Priority': 'u=0, i'
}

response = requests.request("GET", url, headers=headers, data=payload)
NFL_team_html = response.text


soup = BeautifulSoup(NFL_team_html, "html.parser")

# Find the main standings table
table = soup.find("table", class_="d3-o-table--detailed")
teams_data = []



division_map = {
    "NFC": {
        "NFC East": ["Philadelphia Eagles","Dallas Cowboys","Washington Commanders","New York Giants"],
        "NFC North": ["Green Bay Packers","Detroit Lions","Chicago Bears","Minnesota Vikings"],
        "NFC South": ["Tampa Bay Buccaneers","Carolina Panthers","Atlanta Falcons","New Orleans Saints"],
        "NFC West": ["Los Angeles Rams","Seattle Seahawks","San Francisco 49ers","Arizona Cardinals"]
    },
    "AFC": {
        "AFC East": ["Buffalo Bills","Miami Dolphins","New England Patriots","New York Jets"],
        "AFC North": ["Baltimore Ravens","Cincinnati Bengals","Cleveland Browns","Pittsburgh Steelers"],
        "AFC South": ["Houston Texans","Indianapolis Colts","Jacksonville Jaguars","Tennessee Titans"],
        "AFC West": ["Denver Broncos","Kansas City Chiefs","Las Vegas Raiders","Los Angeles Chargers"]
    }
}

if table:
    rows = table.find("tbody").find_all("tr", recursive=False)

    for row in rows:
        cols = [c.get_text(strip=True) for c in row.find_all("td")]

        # Extract team name and logo
        team_anchor = row.find("a", class_="d3-o-club-info")
        if team_anchor:
            full_name = team_anchor.find("div", class_="d3-o-club-fullname").find(string=True, recursive=False).strip()
            logo_img = team_anchor.find("img")["src"] if team_anchor.find("img") else ""
            team_link = "https://www.nfl.com" + team_anchor["href"]
        else:
            full_name = short_name = logo_img = team_link = ""

        if len(cols) >= 16:
            team_stats = {
                "name": full_name,
                "conference" : '',
                "division" : '',
                "wins": int(cols[1]),
                "losses": int(cols[2]),
                "ties": int(cols[3]),
                "win_pct": float(cols[4]),
                "points_for": int(cols[5]),
                "points_against": int(cols[6]),
                "point_diff": int(cols[7]),
                "Home": cols[8],
                "Road": cols[9],
                "Div": cols[10],
                "DivPct": cols[11],
                "Conf": cols[12],
                "ConfPct": cols[13],
                "NonConf": cols[14],
                "Strk": cols[15],
                "Last5": cols[16] if len(cols) > 16 else "",
                "logo": logo_img,
                "link": team_link
            }

            # 🔍 Find the matching conference and division
            found = False
            for conference, divisions in division_map.items():
                for division, teams in divisions.items():
                    if full_name in teams:
                        team_stats["conference"] = conference
                        team_stats["division"] = division
                        found = True
                        break
                if found:
                    break

            # If team wasn’t found in the map, mark it (optional)
            if not found:
                team_stats["conference"] = "Unknown"
                team_stats["division"] = "Unknown"

            teams_data.append(team_stats)

# Output to JSON
with open("public/data/nfl_site_nfl_standings.json", "w", encoding="utf-8") as out:
    json.dump(teams_data, out, indent=2, ensure_ascii=False)



import html as htmllib
from typing import List, Dict, Any



url = "https://www.espn.com/nfl/fpi"

payload = {}
headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Referer': 'https://www.google.com/',
  'Connection': 'keep-alive',
  'Cookie': 'SWID=1BC12018-76AD-4298-C23C-5EB9DD70B6BB; edition=espn-en-us; edition-view=espn-en-us; region=ccpa; tveAuth=espn3; cookieMonster=1; __fitt-sess-device.prod=0bda2b6e-c43d-4b38-9605-1db784e1d89f; mbox=PC^#1675cae4ea40400982cd551583a6f1a9.35_0^#1824862869|session^#f75038e2268044a8acedcfa016edb75a^#1762147181; s_ensNR=1761618067402-New; OptanonConsent=isGpcEnabled=0&datestamp=Mon+Oct+27+2025+19%3A23%3A27+GMT-0700+(Pacific+Daylight+Time)&version=202407.2.0&browserGpcFlag=0&isIABGlobal=false&hosts=&consentId=e9d9a673-36ea-482a-bbc0-be0a0c2e9a66&interactionCount=1&isAnonUser=1&landingPath=https%3A%2F%2Fwww.espn.com%2Fnba%2Fstandings&groups=C0001%3A1%2CC0003%3A1%2CBG407%3A1%2CC0002%3A1%2CC0004%3A1%2CC0005%3A1; usprivacy=1YNY; AMCV_EE0201AC512D2BE80A490D4C%40AdobeOrg=-330454231%7CMCMID%7C21080104722962798112362429104193239130%7CMCAAMLH-1761773075%7C9%7CMCAAMB-1762070091%7C6G1ynYcLPuiQxYZrsz_pkqfLG9yMXBpb2zX5dvJdYQJzPXImdj0y%7CMCOPTOUT-1762077292s%7CNONE%7CMCAID%7CNONE%7CvVersion%7C3.1.2%7CMCIDTS%7C20395; _cb=7wPu32JWTGDRHnlv; _chartbeat2=.1761618071782.1761618071782.1.D7xZXhDdqSFLQsx9hB2p1CxBWavfN.1; ab.storage.userId.96ad02b7-2edc-4238-8442-bc35ba85853c=g%3A1BC12018-76AD-4298-C23C-5EB9DD70B6BB%7Ce%3Aundefined%7Cc%3A1761618071793%7Cl%3A1761618071794; ab.storage.sessionId.96ad02b7-2edc-4238-8442-bc35ba85853c=g%3A618d7a20-942d-6bde-6155-fddbba6d0a31%7Ce%3A1761619871802%7Cc%3A1761618071793%7Cl%3A1761618071802; ab.storage.deviceId.96ad02b7-2edc-4238-8442-bc35ba85853c=g%3A675b46c1-c25d-8cfa-f9c5-167bb80dd0eb%7Ce%3Aundefined%7Cc%3A1761618071794%7Cl%3A1761618071794; s_ecid=MCMID%7C21080104722962798112362429104193239130; nol_fpid=4xrlotegxpquurxzsizqc21cqjeys1761618072|1761618072742|1761618072742|1761618072742; _scor_uid=ae659a55ede4490d944632b84ae8ab23; cto_bundle=JEfh-l8lMkZnbEd2WGNTQVlYdjdqSkMlMkZLRDdKZUt1UERMbWlVdzh0YmRPdHk1ZVkzT1BHOWI1YyUyQlk5aGxkV1NOJTJCRnB1WlRwTkM2SDFTaVhkWVNaekVwRHhUeXlONUc2UDc3MTRydHBoU3JvcXZMMnRCV0lMR1lsdHRnWDIlMkZORTJGZUlmTEVrb2Z2NTdnbFZ0RDU5REM1ekpkbUdUOW9GVDQ2dHNybmVJMkltNU0yVkVVJTNE; _cc_id=5841a92d1e3e143af8abb2bbe75ad7d5; panoramaId_expiry=1762222863842; panoramaId=483fa7555f1093ad79db952527d7185ca02c03eab0d02fc65c748e4f33b595c2; panoramaIdType=panoDevice; connectId={"ttl":86400000,"lastUsed":1761618074543,"lastSynced":1761618074543}; __gads=ID=004e9c5f3cff2d56:T=1761618064:RT=1761618064:S=ALNI_MbxIjptHk03T2ZOpy_qKwrO9sDLnA; __gpi=UID=000012b915e0787d:T=1761618064:RT=1761618064:S=ALNI_MbdhHDRDUUk5XKaAkE_8nB0-3jTJg; __eoi=ID=e292e959d05a8c28:T=1761618064:RT=1761618064:S=AA-AfjZFdCPFJxDNzTNtD4AVn8Su; _gcl_au=1.1.1448530675.1761618075; _dcf=1; userAB=B; s_c24=1762072568910; connectionspeed=full; tveMVPDAuth=; country=us; check=true; userZip=91744; country=us; hashedIp=e254a6954ed7a8f960da0d43231c9bcd91eef4d566fd72f864c24baa1fdebff9; client_type=html5; client_version=4.7.1; espn-prev-page=espn%3Anfl%3ApowerIndex; _nr=0; tveProviderName=; userab_1=a1726a151ded9ce691c42b2604985661~ad_espn-403%2Atest-a-1674%2Ceapp_hfcard-456%2Ac-a-1887%2Ceapp_sc4u-414%2Ap-a-1739%2Ceapp_vertfy-446%2Ap-a-1852%2Cespn_app_homefeed_31_app-455%2Ahfa-hb-1885%2Cespn_mweb_pl-454%2Ap-a-1874%2Cespn_watch_for_you-409%2Awatch-fy-a-1711%2Cespn_watch_for_you_web-392%2Awatch-fy-a-1642%2Cespn_watch_rfy_latest-410%2Awatch-fy-e-1719%2Cespn_web_pl-441%2Ap-a-1823%2Cexm_test-379%2Avariant_a3_new-1572%2Cplayer_next_live-424%2Awatch-fy-a-1772%2Cweb_hl_cb-147%2Ahltest-515%2Cweb_index1_pres-99%2Aenhanced-346; block.check=false%7Ctrue; twtr_pixel_opt_in=N; dtcAuth=; SWID=602B85A4-0AFC-4F42-CFE9-D8EFDCFE56E8; _dcf=1; connectionspeed=full; country=us; edition=espn-en-us; edition-view=espn-en-us; region=ccpa',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-User': '?1',
  'If-Modified-Since': 'Mon, 03 Nov 2025 05:04:34 GMT',
  'Priority': 'u=0, i',
  'TE': 'trailers'
}

response = requests.request("GET", url, headers=headers, data=payload)

power_index_data = response.text

def _extract_balanced_objects(raw: str, anchor: str = '{"team"') -> List[str]:
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


def _stats_list_to_map(stats: List[Dict[str, Any]]) -> Dict[str, Any]:
    m: Dict[str, Any] = {}
    for item in stats or []:
        name = item.get("name")
        val = item.get("value")
        if isinstance(val, str):
            try:
                if val.strip() and all(c.isdigit() or c in ".-+" for c in val.strip()):
                    val = int(val) if val.strip().lstrip("+-").isdigit() else float(val)
            except Exception:
                pass
        m[name] = val
    return m


def parse_power_index(html_text: str) -> List[Dict[str, Any]]:
    blocks = _extract_balanced_objects(html_text)
    teams: List[Dict[str, Any]] = []
    for raw_obj in blocks:
        try:
            obj = json.loads(raw_obj)
        except json.JSONDecodeError:
            try:
                obj = json.loads(raw_obj.replace("'", '"'))
            except Exception:
                continue

        if not isinstance(obj, dict) or "team" not in obj or "stats" not in obj:
            continue

        team = obj.get("team", {})
        stats_map = _stats_list_to_map(obj.get("stats", []))

        teams.append({
            "name": team.get("displayName"),
            "abbr": team.get("abbrev"),
            "logo": team.get("logo"),
            "link": f"https://www.espn.com{team.get('links', '')}",
            "fpi": stats_map.get("fpi"),
            "fpirank": stats_map.get("fpirank"),
            "epa_offense": stats_map.get("epaoffense"),
            "epa_defense": stats_map.get("epadefense"),
            "epa_special": stats_map.get("epaspecialteams")
        })
    return teams


# ==========================================================
# STEP 3: LOAD EXISTING TEAM DATA
# ==========================================================
INPUT_JSON = "public/data/nfl_site_nfl_standings.json"        # path to your existing JSON file
OUTPUT_JSON = "public/data/nfl_site_nfl_standings.json" 

with open(INPUT_JSON, "r", encoding="utf-8") as f:
    existing_data = json.load(f)


# ==========================================================
# STEP 4: MERGE DATASETS
# ==========================================================
espn_data = parse_power_index(power_index_data)

# Build lookup by normalized name
def normalize(name: str) -> str:
    return name.lower().replace(" ", "").replace(".", "")

espn_lookup = {normalize(team["name"]): team for team in espn_data if team["name"]}

for team in existing_data:
    key = normalize(team["name"])
    if key in espn_lookup:
        espn_team = espn_lookup[key]
        team["fpi"] = espn_team.get("fpi")
        team["fpirank"] = espn_team.get("fpirank")
        team["epa_offense"] = espn_team.get("epa_offense")
        team["epa_defense"] = espn_team.get("epa_defense")
        team["epa_special"] = espn_team.get("epa_special")

# ==========================================================
# STEP 5: SAVE UPDATED JSON
# ==========================================================
with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(existing_data, f, indent=2)