import requests
import json
import re
import os

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/',
    'Connection': 'keep-alive'
}

print("Fetching F1 drivers page...")
response = requests.get("https://www.formula1.com/en/drivers", headers=headers)
raw_data = response.text

TEAM_MAP = {
    'alpine': 'Alpine',
    'astonmartin': 'Aston Martin',
    'audi': 'Audi',
    'cadillac': 'Cadillac',
    'ferrari': 'Ferrari',
    'haasf1team': 'Haas F1 Team',
    'mclaren': 'McLaren',
    'mercedes': 'Mercedes',
    'racingbulls': 'Racing Bulls',
    'redbullracing': 'Red Bull Racing',
    'williams': 'Williams',
}

# ── 1. DRIVERS ───────────────────────────────────────────────────────────────
# Each driver anchor: <a href="/en/drivers/SLUG">...</a>
# Names in body-m-compact-regular / body-m-compact-bold spans
# Team derived from CDN image path: /2026/TEAMSLUG/drivercode/

drivers_by_team = {}   # team_slug -> list of driver dicts
seen_drivers = set()

for slug, block in re.findall(r'href="/en/drivers/([a-z0-9-]+)">(.*?)</a>', raw_data, re.DOTALL):
    if slug in seen_drivers or slug == 'hall-of-fame':
        continue

    first_match = re.search(r'body-m-compact-regular[^"]*"[^>]*>([^<]+)<', block)
    last_match  = re.search(r'body-m-compact-bold[^"]*"[^>]*>([^<]+)<', block)
    if not first_match or not last_match:
        continue

    seen_drivers.add(slug)

    first = first_match.group(1).strip()
    last  = last_match.group(1).strip()

    img_match   = re.search(r'src="(https://media\.formula1\.com/image/upload/[^"]+right\.webp)"', block)
    picture_url = None
    team_slug   = None

    if img_match:
        raw_url     = img_match.group(1)
        picture_url = re.sub(r'w_\d+', 'w_440', raw_url)
        ts = re.search(r'/\d{4}/([^/]+)/', raw_url)
        if ts:
            team_slug = ts.group(1)

    drivers_by_team.setdefault(team_slug, []).append({
        "name":        f"{first} {last}",
        "picture_url": picture_url,
    })
    print(f"  Driver: {first} {last} — {TEAM_MAP.get(team_slug, team_slug)}")

# ── 2. TEAMS ─────────────────────────────────────────────────────────────────
# Team card anchors: <a href="/en/teams/SLUG">...</a>
# Logo:  common/f1/2026/TEAMSLUG/2026TEAMSLUGlogowhite.webp
# Car:   common/f1/2026/TEAMSLUG/2026TEAMSLUGcarright.webp
# Name:  display-s-bold span

teams = {}
seen_teams = set()

for team_url_slug, block in re.findall(r'href="/en/teams/([a-z0-9-]+)">(.*?)</a>', raw_data, re.DOTALL):
    if team_url_slug in seen_teams:
        continue

    # Logo image
    logo_match = re.search(
        r'src="(https://media\.formula1\.com/image/upload/[^"]+logowhite\.webp)"', block)
    # Car image
    car_match  = re.search(
        r'src="(https://media\.formula1\.com/image/upload/[^"]+carright\.webp)"', block)
    # Team display name
    name_match = re.search(r'display-s-bold[^"]*"[^>]*>([^<]+)<', block)

    if not logo_match and not car_match:
        continue  # skip non-team-card anchors

    seen_teams.add(team_url_slug)

    team_name = name_match.group(1).strip() if name_match else team_url_slug.title()

    # Map url slug → internal image slug (they differ e.g. haas vs haasf1team)
    logo_url = logo_match.group(1) if logo_match else None
    car_url  = car_match.group(1)  if car_match  else None

    # Derive internal team slug from logo URL path
    internal_slug = None
    if logo_url:
        m = re.search(r'/2026/([^/]+)/', logo_url)
        if m:
            internal_slug = m.group(1)

    teams[team_url_slug] = {
        "name":     team_name,
        "logo_url": logo_url,
        "car_url":  car_url,
        "drivers":  drivers_by_team.get(internal_slug, []),
    }
    print(f"  Team:   {team_name} ({len(teams[team_url_slug]['drivers'])} drivers)")

# Sort teams alphabetically, drivers within each team by last name
output = []
for slug in sorted(teams):
    entry = teams[slug]
    entry["drivers"].sort(key=lambda d: d["name"].split()[-1])
    output.append(entry)

with open("public/data/f1_teams.json", "w") as f:
    json.dump(output, f, indent=4)

print(f"\nDone! Wrote {len(output)} teams to public/data/f1_drivers/drivers.json")