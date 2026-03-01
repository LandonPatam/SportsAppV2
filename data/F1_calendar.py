import requests
import json
import re
import os
from datetime import datetime, timedelta

# Your provided configuration
url_schedule = "https://www.espn.com/f1/schedule"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/',
    'Cookie': 'OptanonConsent=isGpcEnabled=0...', # Truncated for brevity, use your full string
    'Connection': 'keep-alive'
}

# 1. Get the Schedule
response = requests.get(url_schedule, headers=headers)
raw_data = response.text

# Split into race blocks to avoid skipping the first one
event_blocks = re.split(r'"\d{8}":', raw_data)
f1_calendar = []
count = 1

print("Starting extraction...")

for block in event_blocks:
    gp_match = re.search(r'"gPrx":"(.*?)"', block)
    time_match = re.search(r'"detail":"(.*?)"', block)
    link_match = re.search(r'"evLink":"(.*?)"', block)
    crct_match = re.search(r'"crct":"(.*?)"', block)

    if gp_match and time_match and link_match:
        gp_name = gp_match.group(1)
        time_detail = time_match.group(1)
        ev_link = link_match.group(1)
        circuit_name = crct_match.group(1) if crct_match else "TBD"

        # URLs
        base_url = "https://www.espn.com"
        circuit_url = f"{base_url}{ev_link.replace('/race/', '/circuit/')}"
        
        # --- NEW: Get SVG from Circuit Page ---
        track_svg_url = "Not Found"
        try:
            print(f"Fetching SVG for {gp_name}...")
            circuit_resp = requests.get(circuit_url, headers=headers, timeout=10)
            # Find the number.svg pattern in the circuit page HTML
            svg_match = re.search(r'https://a\.espncdn\.com/i/venues/f1/day/(\d+\.svg)', circuit_resp.text)
            if svg_match:
                track_svg_url = f"https://a.espncdn.com/i/venues/f1/day/{svg_match.group(1)}"
        except:
            pass

        # Time Conversion (EST to PST)
        clean_time = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', time_detail).replace(" EST", "").replace(" EDT", "")
        try:
            dt_est = datetime.strptime(clean_time, "%a, %B %d at %I:%M %p")
            dt_pst = dt_est - timedelta(hours=3)
            date_range = f"{dt_pst.strftime('%B')} {dt_pst.day - 2} - {dt_pst.day}"
            start_time = f"{dt_pst.strftime('%B %d')} at {dt_pst.strftime('%I:%M %p').lower().lstrip('0')} PST"
        except:
            date_range, start_time = "TBD", "TBD"

        f1_calendar.append({
            "race_number": count,
            "race_name": gp_name,
            "circuit": circuit_name,
            "date": date_range,
            "start_time_west": start_time,
            "tv_provider": "Apple TV",
            "track_svg": track_svg_url,
            "urls": {
                "race_page": f"{base_url}{ev_link}",
                "circuit_info": circuit_url,
                "results": f"{base_url}{ev_link.replace('/race/', '/results/')}"
            }
        })
        count += 1

# 2. Save JSON
os.makedirs("public/data", exist_ok=True)
with open("public/data/f1_calendar.json", "w") as file:
    json.dump(f1_calendar, file, indent=4)

print("Done! Check public/data/f1_calendar.json")