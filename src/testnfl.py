from bs4 import BeautifulSoup
import json

# Load the HTML file
with open("src/nfl.txt", "r", encoding="utf-8") as f:
    html = f.read()

soup = BeautifulSoup(html, "html.parser")

# Find the main standings table
table = soup.find("table", class_="d3-o-table--detailed")
teams_data = []

if table:
    rows = table.find("tbody").find_all("tr", recursive=False)

    for row in rows:
        cols = [c.get_text(strip=True) for c in row.find_all("td")]

        # Extract team name and logo
        team_anchor = row.find("a", class_="d3-o-club-info")
        if team_anchor:
            full_name = team_anchor.find("div", class_="d3-o-club-fullname").get_text(strip=True)
            short_name = team_anchor.find("div", class_="d3-o-club-shortname").get_text(strip=True)
            logo_img = team_anchor.find("img")["src"] if team_anchor.find("img") else ""
            team_link = "https://www.nfl.com" + team_anchor["href"]
        else:
            full_name = short_name = logo_img = team_link = ""

        if len(cols) >= 16:
            team_stats = {
                "team": full_name,
                "short_name": short_name,
                "logo": logo_img,
                "link": team_link,
                "W": cols[1],
                "L": cols[2],
                "T": cols[3],
                "PCT": cols[4],
                "PF": cols[5],
                "PA": cols[6],
                "NetPts": cols[7],
                "Home": cols[8],
                "Road": cols[9],
                "Div": cols[10],
                "DivPct": cols[11],
                "Conf": cols[12],
                "ConfPct": cols[13],
                "NonConf": cols[14],
                "Strk": cols[15],
                "Last5": cols[16] if len(cols) > 16 else ""
            }
            teams_data.append(team_stats)

# Output to JSON
with open("src/nfl_site_nfl_standings.json", "w", encoding="utf-8") as out:
    json.dump(teams_data, out, indent=2, ensure_ascii=False)

print(f"Extracted {len(teams_data)} teams into nfl_standings.json ✅")
