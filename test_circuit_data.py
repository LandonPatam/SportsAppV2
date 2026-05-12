import requests
import re

url = "https://formula-timer.com/circuit"
response = requests.get(url)

def strip_html(s):
    s = re.sub(r'<!--.*?-->', '', s, flags=re.DOTALL)
    s = re.sub(r'<[^>]+>', ' ', s)
    s = re.sub(r'&amp;', '&', s)
    s = re.sub(r'&#x27;', "'", s)
    return re.sub(r'\s+', ' ', s).strip()

# Each card is an <a href="/circuit/ID"> block
cards = re.findall(r'href="(/circuit/[^"]+)">(.*?)(?=href="/circuit/|$)',
                   response.text, re.DOTALL)

print(f"Found {len(cards)} circuits\n")

for href, content in cards:
    circuit_id = href.replace('/circuit/', '')

    # Location: Melbourne, Australia
    loc_m = re.search(r'text-gray-200 text-sm[^"]*"[^>]*>(.*?)</p>', content, re.DOTALL)
    location = strip_html(loc_m.group(1)) if loc_m else '?'

    # Length
    len_m = re.search(r'Length:</span><div[^>]*>(.*?)</div>', content, re.DOTALL)
    length = strip_html(len_m.group(1)) if len_m else '?'

    # Corners
    cor_m = re.search(r'Corners:</span><div[^>]*>(.*?)</div>', content, re.DOTALL)
    corners = strip_html(cor_m.group(1)) if cor_m else '?'

    # Tags (all rounded-full spans)
    raw_tags = re.findall(r'rounded-full[^"]*"[^>]*>(.*?)</span>', content, re.DOTALL)
    tags = [strip_html(t) for t in raw_tags if strip_html(t)]

    # Lap record time
    lap_time_m = re.search(r'font-mono font-bold[^"]*"[^>]*>(.*?)</div>', content, re.DOTALL)
    lap_time = strip_html(lap_time_m.group(1)) if lap_time_m else '?'

    # Driver + year (next text-slate-400 div after the lap time)
    lap_driver = '?'
    if lap_time_m:
        after = content[lap_time_m.end():]
        drv_m = re.search(r'text-slate-400[^"]*"[^>]*>(.*?)</div>', after, re.DOTALL)
        if drv_m:
            lap_driver = strip_html(drv_m.group(1))

    print(f"[{circuit_id}]")
    print(f"  Location : {location}")
    print(f"  Length   : {length}")
    print(f"  Corners  : {corners}")
    print(f"  Tags     : {', '.join(tags)}")
    print(f"  Lap Rec  : {lap_time} — {lap_driver}")
    print()
