from bs4 import BeautifulSoup
import json
import requests
import io

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
            full_name = team_anchor.find("div", class_="d3-o-club-fullname").get_text(strip=True)
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

print(f"[OK] NFL Team data updated")
