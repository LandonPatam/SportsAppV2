from bs4 import BeautifulSoup
import json
import requests
import io
import os
import html as htmllib
from typing import List, Dict, Any
from datetime import datetime
import pytz
from scoreboard_client import ScoreboardClient, ScoreboardUnavailable

# ==========================================================
# STEP 1: PATH SETUP (Fixes Background Service Issues)
# ==========================================================
# This finds 'SportsAppV2' directory regardless of where the script is called from
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_JSON = os.path.join(BASE_DIR, "public", "data", "nfl_site_nfl_standings.json")
SCHEDULE_JSON = os.path.join(BASE_DIR, "public", "data", "nfl_schedule.json")

# Ensure the directory exists
os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)

def get_nfl_season_year() -> int:
    try:
        with open(SCHEDULE_JSON, "r", encoding="utf-8") as f:
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
    return datetime.now().year

SEASON_YEAR = get_nfl_season_year()


# ==========================================================
# SCORE BACKFILL — keep completed schedule games current even
# when this process starts after the game has already ended.
# ==========================================================
SCOREBOARD_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0',
    'Accept': '*/*',
    'Referer': 'https://www.espn.com/',
}


def _scoreboard_events(data):
    try:
        return data.get('sports', [])[0].get('leagues', [])[0].get('events', [])
    except (AttributeError, IndexError, KeyError, TypeError):
        return []


def _missing_score(game):
    return game.get('home_score') in (None, '') or game.get('away_score') in (None, '')


def backfill_missing_schedule_scores():
    """Fetch final/live scores for any past schedule entries that lack them."""
    try:
        with open(SCHEDULE_JSON, 'r', encoding='utf-8-sig') as f:
            schedule = json.load(f)
    except (OSError, ValueError) as exc:
        print(f'[WARN] Could not read NFL schedule for score backfill: {exc}')
        return

    today = datetime.now(pytz.timezone('America/Los_Angeles')).date()
    missing_by_date = {}
    for game in schedule:
        try:
            game_date = datetime.strptime(game.get('date', ''), '%Y-%m-%d').date()
        except (TypeError, ValueError):
            continue
        if game_date <= today and _missing_score(game):
            missing_by_date.setdefault(game_date, []).append(game)

    if not missing_by_date:
        return

    client = ScoreboardClient()
    changed = False
    for game_date, games in missing_by_date.items():
        date_param = game_date.strftime('%Y%m%d')
        url = (
            'https://site.web.api.espn.com/apis/personalized/v2/scoreboard/header'
            '?sport=football&league=nfl&region=us&lang=en&contentorigin=espn'
            '&configuration=STREAM_MENU&platform=web&features=sfb-all%2Ccutl'
            f'&showAirings=buy%2Clive%2Creplay&tz=America%2FNew_York&dates={date_param}'
        )
        try:
            events = {str(event.get('id')): event for event in _scoreboard_events(client.get_json(url, SCOREBOARD_HEADERS))}
        except ScoreboardUnavailable as exc:
            print(f'[WARN] NFL score backfill deferred for {game_date}: {exc}')
            break
        except Exception as exc:
            print(f'[WARN] NFL score backfill failed for {game_date}: {exc}')
            continue

        for game in games:
            event = events.get(str(game.get('game_id')))
            if not event:
                continue
            competitors = event.get('competitors', [])
            home = next((team for team in competitors if team.get('homeAway') == 'home'), {})
            away = next((team for team in competitors if team.get('homeAway') == 'away'), {})
            home_score, away_score = home.get('score'), away.get('score')
            if home_score is None or away_score is None:
                continue

            status_type = event.get('fullStatus', {}).get('type', {})
            is_final = (
                event.get('status') == 'post'
                or status_type.get('state') == 'post'
                or status_type.get('name') == 'STATUS_FINAL'
                or status_type.get('completed', False)
            )
            is_live = event.get('status') == 'in' or status_type.get('state') == 'in'
            if not is_final and not is_live:
                continue

            game.update({'home_score': home_score, 'away_score': away_score, 'status': 'final' if is_final else 'live'})
            if is_final:
                winner = next((team.get('displayName') for team in competitors if team.get('winner')), None)
                if not winner:
                    try:
                        if int(home_score) > int(away_score):
                            winner = home.get('displayName')
                        elif int(away_score) > int(home_score):
                            winner = away.get('displayName')
                        else:
                            winner = 'TIE'
                            game['tie'] = True
                    except (TypeError, ValueError):
                        pass
                game['winner'] = winner
                game.pop('period', None)
                game.pop('clock', None)
            else:
                game['period'] = event.get('fullStatus', {}).get('period')
                game['clock'] = event.get('fullStatus', {}).get('displayClock', '')
                game.pop('winner', None)
            changed = True

    if changed:
        temp_path = SCHEDULE_JSON + '.tmp'
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(schedule, f, indent=2, ensure_ascii=False)
        os.replace(temp_path, SCHEDULE_JSON)
        print('[INFO] Backfilled missing NFL schedule scores.')


backfill_missing_schedule_scores()

# ==========================================================
# STEP 2: SCRAPE NFL.COM STANDINGS
# ==========================================================
url_nfl = f"https://www.nfl.com/standings/league/{SEASON_YEAR}/REG"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

response_nfl = requests.get(url_nfl, headers=headers)
soup = BeautifulSoup(response_nfl.text, "html.parser")
table = soup.find("table", class_="d3-o-table--detailed")

teams_data = []

def parse_int(value, default=0):
    try:
        text = str(value).strip().replace(",", "")
        return int(text) if text else default
    except Exception:
        return default

def parse_float(value, default=0.0):
    try:
        text = str(value).strip()
        return float(text) if text else default
    except Exception:
        return default

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

existing_lookup = {}
try:
    with open(OUTPUT_JSON, "r", encoding="utf-8") as f:
        existing_lookup = {t.get("name"): t for t in json.load(f)}
except Exception:
    existing_lookup = {}

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
                "wins": parse_int(cols[1]), "losses": parse_int(cols[2]), "ties": parse_int(cols[3]),
                "win_pct": parse_float(cols[4]), "points_for": parse_int(cols[5]), "points_against": parse_int(cols[6]),
                "point_diff": parse_int(cols[7]), "Home": cols[8] or "0 - 0 - 0", "Road": cols[9] or "0 - 0 - 0",
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

if not teams_data:
    print(f"[WARN] NFL.com standings table not found for {SEASON_YEAR}; writing preseason 0-0 records.")
    for conf, divisions in division_map.items():
        for div, names in divisions.items():
            for full_name in names:
                existing = existing_lookup.get(full_name, {})
                teams_data.append({
                    "name": full_name,
                    "conference": conf,
                    "division": div,
                    "wins": 0,
                    "losses": 0,
                    "ties": 0,
                    "win_pct": 0.0,
                    "points_for": 0,
                    "points_against": 0,
                    "point_diff": 0,
                    "Home": "0 - 0 - 0",
                    "Road": "0 - 0 - 0",
                    "Div": "0 - 0 - 0",
                    "DivPct": "0.0",
                    "Conf": "0 - 0 - 0",
                    "ConfPct": "0.0",
                    "NonConf": "0 - 0 - 0",
                    "Strk": "",
                    "Last5": "",
                    "logo": existing.get("logo", ""),
                    "link": existing.get("link", ""),
                })

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
