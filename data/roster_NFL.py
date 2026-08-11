import requests
import re
import json
import time

# ==============================================================
# NFL TEAMS + ESPN NAME SHORTCODES
# (Team name -> ESPN URL segment)
# ==============================================================
teams = {
    "Arizona Cardinals": "ari/arizona-cardinals",
    "Atlanta Falcons": "atl/atlanta-falcons",
    "Baltimore Ravens": "bal/baltimore-ravens",
    "Buffalo Bills": "buf/buffalo-bills",
    "Carolina Panthers": "car/carolina-panthers",
    "Chicago Bears": "chi/chicago-bears",
    "Cincinnati Bengals": "cin/cincinnati-bengals",
    "Cleveland Browns": "cle/cleveland-browns",
    "Dallas Cowboys": "dal/dallas-cowboys",
    "Denver Broncos": "den/denver-broncos",
    "Detroit Lions": "det/detroit-lions",
    "Green Bay Packers": "gb/green-bay-packers",
    "Houston Texans": "hou/houston-texans",
    "Indianapolis Colts": "ind/indianapolis-colts",
    "Jacksonville Jaguars": "jax/jacksonville-jaguars",
    "Kansas City Chiefs": "kc/kansas-city-chiefs",
    "Las Vegas Raiders": "lv/las-vegas-raiders",
    "Los Angeles Chargers": "lac/los-angeles-chargers",
    "Los Angeles Rams": "lar/los-angeles-rams",
    "Miami Dolphins": "mia/miami-dolphins",
    "Minnesota Vikings": "min/minnesota-vikings",
    "New England Patriots": "ne/new-england-patriots",
    "New Orleans Saints": "no/new-orleans-saints",
    "New York Giants": "nyg/new-york-giants",
    "New York Jets": "nyj/new-york-jets",
    "Philadelphia Eagles": "phi/philadelphia-eagles",
    "Pittsburgh Steelers": "pit/pittsburgh-steelers",
    "San Francisco 49ers": "sf/san-francisco-49ers",
    "Seattle Seahawks": "sea/seattle-seahawks",
    "Tampa Bay Buccaneers": "tb/tampa-bay-buccaneers",
    "Tennessee Titans": "ten/tennessee-titans",
    "Washington Commanders": "wsh/washington-commanders"
}

# ==============================================================
# HEADERS (same as your working setup)
# ==============================================================
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": "https://www.google.com/",
    "Connection": "keep-alive",
}

# ==============================================================
# FUNCTION: Extract players from ESPN HTML
# ==============================================================
def extract_players(team_roster_html):
    """Extract all player stats (offense, defense, special teams) from ESPN team stats page."""
    match = re.search(r'"playerStats"\s*:\s*(\[\[.*?\]\])', team_roster_html, re.DOTALL)
    if not match:
        return []

    raw_json = match.group(1)
    cleaned_json = raw_json.replace('\\"', '"')

    try:
        data = json.loads(cleaned_json)
    except json.JSONDecodeError:
        cleaned_json = re.sub(r",\s*}", "}", cleaned_json)
        cleaned_json = re.sub(r",\s*]", "]", cleaned_json)
        data = json.loads(cleaned_json)

    players = []
    for group in data:
        for p in group:
            athlete = p.get("athlete", {})
            stat_group = p.get("statGroups", {})

            player_entry = {
                "name": athlete.get("name"),
                "shortName": athlete.get("shortName"),
                "position": athlete.get("position"),
                "profile_link": athlete.get("href"),
                "headshot": athlete.get("headshot"),
                "stats": {}
            }

            # Some are dict, some are list
            if isinstance(stat_group, dict):
                stat_group = [stat_group]

            for sg in stat_group:
                title = sg.get("title", "Stats")
                # Nested structure: each "sg['stats']" may itself contain more stat sections
                section_stats = {}
                for section in sg.get("stats", []):
                    if "stats" in section:  # e.g. "Tackles", "Sacks", "Interceptions"
                        for s in section.get("stats", []):
                            key = s.get("abbreviation") or s.get("name")
                            val = s.get("displayValue")
                            section_stats[key] = val
                    else:
                        key = section.get("abbreviation") or section.get("name")
                        val = section.get("displayValue")
                        section_stats[key] = val

                player_entry["stats"][title] = section_stats

            players.append(player_entry)

    return players


# ==============================================================
# MAIN SCRAPE LOOP
# ==============================================================
nfl_roster = {}

for team_name, slug in teams.items():
    url = f"https://www.espn.com/nfl/team/stats/_/name/{slug}"
    print(f"📡 Fetching {team_name} stats...")

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        team_roster = response.text

        players = extract_players(team_roster)
        nfl_roster[team_name] = players
        print(f"✅ {team_name}: {len(players)} players extracted.")
    except Exception as e:
        print(f"⚠️ Failed for {team_name}: {e}")
        nfl_roster[team_name] = []

    # Small delay to be kind to ESPN servers
    time.sleep(1.5)

# ==============================================================
# SAVE MASTER JSON
# ==============================================================
with open("public/data/nfl_roster.json", "w", encoding="utf-8") as f:
    json.dump(nfl_roster, f, indent=2, ensure_ascii=False)

print("\n🏁 All teams processed. Master file saved as nfl_roster.json")
