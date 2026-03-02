from bs4 import BeautifulSoup
import json
import requests
import io
import os
import html as htmllib
from typing import List, Dict, Any

# ==========================================================
# STEP 1: PATH SETUP (Fixes Background Service Issues)
# ==========================================================
# This finds 'SportsAppV2' directory regardless of where the script is called from
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_JSON = os.path.join(BASE_DIR, "public", "data", "nfl_site_nfl_standings.json")

# Ensure the directory exists
os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)

# ==========================================================
# STEP 2: SCRAPE NFL.COM STANDINGS
# ==========================================================
url_nfl = "https://www.nfl.com/standings/league/2025/REG"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

response_nfl = requests.get(url_nfl, headers=headers)
soup = BeautifulSoup(response_nfl.text, "html.parser")
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
        team_anchor = row.find("a", class_="d3-o-club-info")
        if team_anchor:
            full_name = team_anchor.find("div", class_="d3-o-club-fullname").find(string=True, recursive=False).strip()
            logo_img = team_anchor.find("img")["src"] if team_anchor.find("img") else ""
            team_link = "https://www.nfl.com" + team_anchor["href"]
        else:
            continue

        if len(cols) >= 16:
            team_stats = {
                "name": full_name,
                "conference" : '', "division" : '',
                "wins": int(cols[1]), "losses": int(cols[2]), "ties": int(cols[3]),
                "win_pct": float(cols[4]), "points_for": int(cols[5]), "points_against": int(cols[6]),
                "point_diff": int(cols[7]), "Home": cols[8], "Road": cols[9],
                "Div": cols[10], "DivPct": cols[11], "Conf": cols[12], "ConfPct": cols[13],
                "NonConf": cols[14], "Strk": cols[15], "Last5": cols[16] if len(cols) > 16 else "",
                "logo": logo_img, "link": team_link
            }

            # Map Conference/Division
            for conf, divisions in division_map.items():
                for div, teams in divisions.items():
                    if full_name in teams:
                        team_stats["conference"], team_stats["division"] = conf, div
            
            teams_data.append(team_stats)

# ==========================================================
# STEP 3: SCRAPE ESPN FPI DATA
# ==========================================================
url_fpi = "https://www.espn.com/nfl/fpi"
response_fpi = requests.get(url_fpi, headers=headers)
power_index_html = response_fpi.text

def _extract_balanced_objects(raw: str, anchor: str = '{"team"') -> List[str]:
    s = htmllib.unescape(raw)
    out, i, n = [], 0, len(s)
    while True:
        start = s.find(anchor, i)
        if start == -1: break
        brace_depth, j, in_str, esc = 0, start, False, False
        while j < n:
            ch = s[j]
            if in_str:
                if esc: esc = False
                elif ch == '\\': esc = True
                elif ch == '"': in_str = False
            else:
                if ch == '"': in_str = True
                elif ch == '{': brace_depth += 1
                elif ch == '}':
                    brace_depth -= 1
                    if brace_depth == 0:
                        out.append(s[start:j + 1])
                        i = j + 1
                        break
            j += 1
        else: i = start + len(anchor)
    return out

def _stats_list_to_map(stats: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {item.get("name"): item.get("value") for item in stats or []}

def parse_power_index(html_text: str) -> List[Dict[str, Any]]:
    blocks = _extract_balanced_objects(html_text)
    teams = []
    for raw_obj in blocks:
        try:
            obj = json.loads(raw_obj)
            team = obj.get("team", {})
            stats = _stats_list_to_map(obj.get("stats", []))
            teams.append({
                "name": team.get("displayName"),
                "fpi": stats.get("fpi"),
                "fpirank": stats.get("fpirank"),
                "epa_offense": stats.get("epaoffense"),
                "epa_defense": stats.get("epadefense"),
                "epa_special": stats.get("epaspecialteams")
            })
        except: continue
    return teams

# ==========================================================
# STEP 4: MERGE & SAVE (Atomic Swap)
# ==========================================================
espn_data = parse_power_index(power_index_html)
def normalize(name: str): return name.lower().replace(" ", "").replace(".", "")
espn_lookup = {normalize(t["name"]): t for t in espn_data if t["name"]}

for team in teams_data:
    key = normalize(team["name"])
    if key in espn_lookup:
        et = espn_lookup[key]
        team.update({
            "fpi": et.get("fpi"), "fpirank": et.get("fpirank"),
            "epa_offense": et.get("epa_offense"), "epa_defense": et.get("epa_defense"),
            "epa_special": et.get("epa_special")
        })

# Atomic Write: Saves to temp file then swaps (Prevents empty files/crashes)
TEMP_JSON = OUTPUT_JSON + ".tmp"
with open(TEMP_JSON, "w", encoding="utf-8") as f:
    json.dump(teams_data, f, indent=2, ensure_ascii=False)

os.replace(TEMP_JSON, OUTPUT_JSON)
print(f"Successfully updated: {OUTPUT_JSON}")
