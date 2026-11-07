"""One-time fix: correct F1 session times stored with a fixed UTC-7 offset.

Older versions of F1_calendar.py always used UTC-7 (PDT), so every November/December
session in public/data/f1_calendar.json is one hour late. This rewrites only the time
strings (and the broken "November -1 - 1" Mexico date); results and everything else
are left untouched.

Safe to run more than once: the old script never wrote "PDT", so if the file already
contains a PDT label it has been fixed and nothing is changed.

Run from the site root:  python data/fix_f1_dst.py
"""
import json
import re
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

PATH = Path(__file__).resolve().parents[1] / "public" / "data" / "f1_calendar.json"
PT = ZoneInfo("America/Los_Angeles")
RX = re.compile(r"^([A-Za-z]+ \d+) at (\d{1,2}):(\d{2}) ([AP]M) P[SD]T$", re.I)


def fix(value, year):
    m = RX.match(value or "")
    if not m:
        return value
    wall = datetime.strptime(f"{m[1]} {year} {m[2]}:{m[3]} {m[4].upper()}", "%B %d %Y %I:%M %p")
    if wall.month in (11, 12):
        local = (wall + timedelta(hours=7)).replace(tzinfo=timezone.utc).astimezone(PT)
    else:
        local = wall.replace(tzinfo=PT)
    hour = local.strftime("%I").lstrip("0") or "12"
    return f"{local.strftime('%B %d')} at {hour}{local.strftime(':%M %p')} {local.tzname()}"


def main():
    raw = PATH.read_text(encoding="utf-8")
    if " PDT\"" in raw:
        print("Already fixed (found PDT labels); nothing to do.")
        return
    data = json.loads(raw)
    year = datetime.now().year
    for race in data:
        race["start_time_west"] = fix(race.get("start_time_west"), year)
        sessions = race.get("session_times") or {}
        for key in sessions:
            sessions[key] = fix(sessions[key], year)
        if race.get("date") == "November -1 - 1":
            race["date"] = "October 30 - November 1"
    backup = PATH.with_suffix(".json.bak")
    shutil.copy2(PATH, backup)
    PATH.write_text(json.dumps(data, indent=4), encoding="utf-8")
    print(f"Fixed {PATH} (backup at {backup})")


if __name__ == "__main__":
    main()
