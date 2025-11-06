import requests
from bs4 import BeautifulSoup
import json
import re
import sys
from collections import defaultdict




# Gets All track IDs
url = "https://www.espn.com/f1/schedule"

payload = {}
headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Connection': 'keep-alive',
  'Cookie': 'SWID=1BC12018-76AD-4298-C23C-5EB9DD70B6BB; edition=espn-en-us; edition-view=espn-en-us; region=ccpa; tveAuth=espn3; cookieMonster=1; connectionspeed=full; __fitt-sess-device.prod=ce855d3a-c6af-4583-8995-a9489db1e9b6; dtcAuth=; mbox=PC^#1675cae4ea40400982cd551583a6f1a9.35_0^#1824862869|session^#eb8c6f4ac51e4586b74f7a05490cdbcc^#1761704477; s_ensNR=1761618067402-New; OptanonConsent=isGpcEnabled=0&datestamp=Mon+Oct+27+2025+19%3A23%3A27+GMT-0700+(Pacific+Daylight+Time)&version=202407.2.0&browserGpcFlag=0&isIABGlobal=false&hosts=&consentId=e9d9a673-36ea-482a-bbc0-be0a0c2e9a66&interactionCount=1&isAnonUser=1&landingPath=https%3A%2F%2Fwww.espn.com%2Fnba%2Fstandings&groups=C0001%3A1%2CC0003%3A1%2CBG407%3A1%2CC0002%3A1%2CC0004%3A1%2CC0005%3A1; usprivacy=1YNY; AMCV_EE0201AC512D2BE80A490D4C%40AdobeOrg=-50417514%7CMCMID%7C21080104722962798112362429104193239130%7CMCAAMLH-1762222871%7C9%7CMCAAMB-1762222871%7C6G1ynYcLPuiQxYZrsz_pkqfLG9yMXBpb2zX5dvJdYQJzPXImdj0y%7CMCOPTOUT-1761625272s%7CNONE%7CMCAID%7CNONE%7CvVersion%7C5.5.0; _cb=7wPu32JWTGDRHnlv; _chartbeat2=.1761618071782.1761618071782.1.D7xZXhDdqSFLQsx9hB2p1CxBWavfN.1; ab.storage.userId.96ad02b7-2edc-4238-8442-bc35ba85853c=g%3A1BC12018-76AD-4298-C23C-5EB9DD70B6BB%7Ce%3Aundefined%7Cc%3A1761618071793%7Cl%3A1761618071794; ab.storage.sessionId.96ad02b7-2edc-4238-8442-bc35ba85853c=g%3A618d7a20-942d-6bde-6155-fddbba6d0a31%7Ce%3A1761619871802%7Cc%3A1761618071793%7Cl%3A1761618071802; ab.storage.deviceId.96ad02b7-2edc-4238-8442-bc35ba85853c=g%3A675b46c1-c25d-8cfa-f9c5-167bb80dd0eb%7Ce%3Aundefined%7Cc%3A1761618071794%7Cl%3A1761618071794; s_ecid=MCMID%7C21080104722962798112362429104193239130; nol_fpid=4xrlotegxpquurxzsizqc21cqjeys1761618072|1761618072742|1761618072742|1761618072742; _scor_uid=ae659a55ede4490d944632b84ae8ab23; cto_bundle=JEfh-l8lMkZnbEd2WGNTQVlYdjdqSkMlMkZLRDdKZUt1UERMbWlVdzh0YmRPdHk1ZVkzT1BHOWI1YyUyQlk5aGxkV1NOJTJCRnB1WlRwTkM2SDFTaVhkWVNaekVwRHhUeXlONUc2UDc3MTRydHBoU3JvcXZMMnRCV0lMR1lsdHRnWDIlMkZORTJGZUlmTEVrb2Z2NTdnbFZ0RDU5REM1ekpkbUdUOW9GVDQ2dHNybmVJMkltNU0yVkVVJTNE; _cc_id=5841a92d1e3e143af8abb2bbe75ad7d5; panoramaId_expiry=1762222863842; panoramaId=483fa7555f1093ad79db952527d7185ca02c03eab0d02fc65c748e4f33b595c2; panoramaIdType=panoDevice; connectId={"ttl":86400000,"lastUsed":1761618074543,"lastSynced":1761618074543}; __gads=ID=004e9c5f3cff2d56:T=1761618064:RT=1761618064:S=ALNI_MbxIjptHk03T2ZOpy_qKwrO9sDLnA; __gpi=UID=000012b915e0787d:T=1761618064:RT=1761618064:S=ALNI_MbdhHDRDUUk5XKaAkE_8nB0-3jTJg; __eoi=ID=e292e959d05a8c28:T=1761618064:RT=1761618064:S=AA-AfjZFdCPFJxDNzTNtD4AVn8Su; _gcl_au=1.1.1448530675.1761618075; tveMVPDAuth=; country=us; _dcf=1; check=true; block.check=false%7Ctrue; userZip=91744; country=us; hashedIp=e254a6954ed7a8f960da0d43231c9bcd91eef4d566fd72f864c24baa1fdebff9; _dd_s=rum=0&expire=1761703597523; client_type=html5; client_version=4.7.1; espn-prev-page=espn%3Af1%3Aschedule; country=us; edition=espn-en-us; edition-view=espn-en-us; region=ccpa',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'If-Modified-Since': 'Wed, 29 Oct 2025 01:51:33 GMT',
  'Priority': 'u=0, i',
  'TE': 'trailers'
}

response_2 = requests.request("GET", url, headers=headers, data=payload)
f1_calender = response_2.text



pattern = r"/f1/events/(\d+)\?"
event_ids = re.findall(pattern, f1_calender)


unique_sorted = sorted(set(event_ids))

# --- Extract schedule data from calendar page ---
schedule_data = []

# Separate session containers
race_sessions = []
sprint_sessions = []
qualifying_sessions = []
fp_sessions = []

# Track seen sessions to prevent duplicates
seen_sessions = set()

# --- Round counter ---
round_number = 1

for race_ID in unique_sorted:
    url = f"https://www.espn.com/f1/results/_/id/{race_ID}"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Connection': 'keep-alive'
    }

    response = requests.get(url, headers=headers)
    f1_race_data = response.text
    soup = BeautifulSoup(f1_race_data, "lxml")

    # --- Extract event info ---
    event_name_elem = soup.find(class_="GamestripRacing__EventName")
    date_elem = soup.find(class_="GamestripRacing__Date")
    location_elem = soup.find(class_="GamestripRacing__Location")

    event_name = event_name_elem.get_text(strip=True) if event_name_elem else "Unknown Grand Prix"
    circuit_name = location_elem.get_text(strip=True) if location_elem else "Unknown Circuit"
    date_text = date_elem.get_text(strip=True) if date_elem else "Unknown Date"

    # --- Extract country from embedded JSON ---
    country_match = re.search(r'"address"\s*:\s*{[^}]*"country"\s*:\s*"([^"]+)"', f1_race_data)
    country = country_match.group(1) if country_match else "Unknown"

    # --- Store current round number before incrementing (used for both schedule and session data) ---
    current_round = round_number

    # --- Add to schedule data (only once per race, before processing sessions) ---
    schedule_data.append({
        "round": current_round,
        "event_name": event_name,
        "circuit_name": circuit_name,
        "country": country,
        "date": date_text,
        "event_id": race_ID
    })

    # Increment round after adding to schedule (before processing sessions)
    round_number += 1

    # --- Extract session data ---
    pattern = r'"title"\s*:\s*"([^"]+)"[\s\S]*?"data":\s*\[(.*?)\]\s*[,}]'
    matches = re.findall(pattern, f1_race_data)

    if not matches:
        #print(f"No Race Data for {event_name}. Skipping.")
        continue

    for title, data_block in matches:
        data_str = "[" + data_block.strip() + "]"
        data_str = re.sub(r",\s*}", "}", data_str)
        data_str = re.sub(r",\s*]", "]", data_str)

        try:
            data = json.loads(data_str)
        except json.JSONDecodeError:
            continue

        # --- Identify session type ---
        title_lower = title.lower().replace(" ", "")

        if "sprint" in title_lower and "qual" in title_lower:
            session_type = "Sprint Qualifying"
        elif "sprint" in title_lower:
            session_type = "Sprint"
        elif "qual" in title_lower:
            session_type = "Qualifying"
        elif any(x in title_lower for x in ["practice", "freepractice", "fp1", "fp2", "fp3", "fp-"]):
            session_type = "Practice"
        elif "race" in title_lower or "weekendresults" in title_lower:
            session_type = "Race"
        else:
            session_type = "Other"


        # Skip duplicates — same event + session type already saved
        key = f"{event_name}_{session_type}"
        if key in seen_sessions:
            continue
        seen_sessions.add(key)

        # --- Build session JSON ---
        session_json = {
            "round": current_round,
            "event_name": event_name,
            "circuit_name": circuit_name,
            "country": country,
            "date": date_text,
            "session_type": session_type,
            "drivers": []
        }

        for entry in data:
            a = entry.get("athlete", {})
            driver = {
                "driver_code": a.get("abbrev", ""),
                "driver_name": a.get("displayName", ""),
                "team": entry.get("team", ""),
                "nationality": a.get("country", ""),
                "position": entry.get("position", ""),
                "grid_position": entry.get("order", ""),
                "status": "Finished" if not entry.get("isRetired", False) else "Retired",
                "race_time": entry.get("raceTime", "")
            }

            # --- Qualifying extras ---
            if session_type.lower() in ["qualifying", "sprint qualifying"]:
                driver["q1"] = entry.get("q1", "")
                driver["q2"] = entry.get("q2", "")
                driver["q3"] = entry.get("q3", "")

            # --- Race points ---
            if session_type.lower() == "race":
                driver["fastest_lap"] = entry.get("fastestLap", "").split()[0] if entry.get("fastestLap") else ""
                driver["points"] = ({1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}
                                    .get(int(entry.get("position", 0))
                                         if str(entry.get("position", "")).isdigit() else 0, 0.0))

            # --- Sprint points ---
            if session_type.lower() == "sprint":
                driver["points"] = ({1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1}
                                    .get(int(entry.get("position", 0))
                                         if str(entry.get("position", "")).isdigit() else 0, 0.0))

            session_json["drivers"].append(driver)

        # --- Add to correct list ---
        if session_type.lower() == "race":
            race_sessions.append(session_json)
        elif session_type.lower() == "sprint":
            sprint_sessions.append(session_json)
        elif session_type.lower() in ["qualifying", "sprint qualifying"]:
            qualifying_sessions.append(session_json)
        elif session_type.lower() == "practice":
            fp_sessions.append(session_json)


# --- ✅ Save all results separately ---
def save_json(filename, data):
    with open(filename, "w", encoding="utf-8") as out:
        json.dump(data, out, indent=2, ensure_ascii=False)

save_json("public/data/f1_schedule.json", schedule_data)
save_json("public/data/espn_race_data.json", race_sessions)
save_json("public/data/espn_sprint_data.json", sprint_sessions)

save_json("public/data/espn_fp_data.json", fp_sessions)

print("[OK] Schedule Data saved")
print("[OK] Race Data saved")



# --- Load race and sprint results ---
with open("public/data/espn_race_data.json", "r", encoding="utf-8") as f:
    race_data = json.load(f)

with open("public/data/espn_sprint_data.json", "r", encoding="utf-8") as f:
    sprint_data = json.load(f)

# --- Track driver stats ---
drivers = defaultdict(lambda: {
    "points": 0.0,
    "race_wins": 0,
    "sprint_wins": 0,
    "podiums": 0,
    "nationality": "",
    "team": "",
    "results": []  # Only store race positions
})

# --- Process race results ---
for session in race_data:
    for d in session["drivers"]:
        name = d["driver_name"]
        pos = d.get("position")
        pts = d.get("points", 0)
        team = d.get("team", "")
        nationality = d.get("nationality", "")

        try:
            pos_num = int(pos)
        except (ValueError, TypeError):
            pos_num = None

        # Store static info
        if not drivers[name]["team"]:
            drivers[name]["team"] = team
        if not drivers[name]["nationality"]:
            drivers[name]["nationality"] = nationality

        # Add points and results
        drivers[name]["points"] += pts
        if pos_num:
            drivers[name]["results"].append(pos_num)

        # Wins and podiums
        if pos_num == 1:
            drivers[name]["race_wins"] += 1
        if pos_num and pos_num <= 3:
            drivers[name]["podiums"] += 1

# --- Process sprint results ---
for session in sprint_data:
    for d in session["drivers"]:
        name = d["driver_name"]
        pos = d.get("position")
        pts = d.get("points", 0)
        try:
            pos_num = int(pos)
        except (ValueError, TypeError):
            pos_num = None

        # Add sprint data
        drivers[name]["points"] += pts
        if pos_num == 1:
            drivers[name]["sprint_wins"] += 1

# --- Final standings ---
driver_standings = []
total_races = len(race_data)

for name, stats in drivers.items():
    podium_pct = round((stats["podiums"] / total_races) * 100, 2) if total_races > 0 else 0
    driver_standings.append({
        "driver": name,
        "team": stats["team"],
        "nationality": stats["nationality"],
        "points": round(stats["points"], 1),
        "race_wins": stats["race_wins"],
        "sprint_wins": stats["sprint_wins"],
        "podiums": stats["podiums"],
        "podium_percentage": podium_pct,
        "results": stats["results"]  # Only positions
    })

driver_standings.sort(key=lambda x: x["points"], reverse=True)

# --- Save ---
import re

# --- Sort by total points ---
driver_standings.sort(key=lambda x: x["points"], reverse=True)

# --- Add position ranking ---
for i, driver in enumerate(driver_standings, start=1):
    driver["position"] = i

# --- Save to JSON with compact 'results' formatting ---
with open("public/data/espn_driver_standings.json", "w", encoding="utf-8") as out:
    json_text = json.dumps(driver_standings, indent=2, ensure_ascii=False)

    # Compress only the "results" arrays into one line
    json_text = re.sub(
        r'"results":\s*\[[^\]]*\]',
        lambda m: m.group(0).replace("\n", "").replace("  ", "").replace("    ", "").replace("      ", " "),
        json_text
    )

    out.write(json_text)

print(f"✅ Driver standings generated for {len(driver_standings)} drivers with positions and compact results.")

