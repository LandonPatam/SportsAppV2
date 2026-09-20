"""Daily local NFL listings for ZIP 91789 (KTTV / KCBS).

Run with --force to bypass the persistent 24-hour check interval.
Only explicit live NFL matchups qualify; generic listings never qualify.
"""
import argparse
import re
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path

import pytz
import requests

from scoreboard_client import acquire_script_lock, read_json, write_json, STATE_DIR

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/data/nfl_local_broadcasts.json"
STATE = STATE_DIR / "local-nfl-last-check.json"
PACIFIC = pytz.timezone("America/Los_Angeles")
STATIONS = {
    "FOX": ("KTTV", "fox-kttv-los-angeles-ca/1949"),
    "CBS": ("KCBS-TV", "cbs-kcbs-los-angeles-ca/2172"),
}


class Listings(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []

    def handle_starttag(self, tag, attrs):
        row = dict(attrs)
        if row.get("data-listdatetime") and row.get("data-callsign"):
            self.rows.append(row)


def normalize(value):
    return re.sub(r"[^a-z0-9]", "", value.lower())


def local_game_ids(html, day, callsign, games):
    parser = Listings()
    parser.feed(html)
    rows = [r for r in parser.rows if r["data-callsign"] == callsign
            and r["data-listdatetime"].startswith(day + " ")]
    if not rows:
        raise ValueError("No dated station listings; page may be blocked or unavailable")
    confirmed = set()
    for row in rows:
        if row.get("data-league") != "NFL" or row.get("data-live") != "1":
            continue
        teams = {normalize(row.get("data-team1", "")), normalize(row.get("data-team2", ""))}
        if "" in teams or len(teams) != 2:
            continue
        for game in games:
            matchup = game.get("matchup", "").split("@")
            if game.get("date") == day and len(matchup) == 2 and teams == {normalize(t) for t in matchup}:
                confirmed.add(str(game["game_id"]))
    return confirmed


def main(force=False):
    lock = acquire_script_lock("local-nfl-broadcasts")
    try:
        now = datetime.now(timezone.utc)
        previous = read_json(STATE, {})
        if not force and now.timestamp() - previous.get("attempted_at", 0) < 86400:
            print("[LOCAL NFL] Already checked within 24 hours")
            return
        games = read_json(ROOT / "public/data/nfl_schedule.json", [])
        today = now.astimezone(PACIFIC).date()
        end = today + timedelta(days=13)
        days = sorted({g.get("date", "") for g in games
                       if today.isoformat() <= (g.get("date") or "") <= end.isoformat()})
        if not days:
            return
        coverage = read_json(OUTPUT, {})
        coverage["_market"] = "91789 (Walnut, CA) - Los Angeles DMA"
        coverage["_comment"] = "Automatically checked daily against KTTV/ KCBS listings. Unconfirmed regional games have no label."
        write_json(STATE, {"attempted_at": now.timestamp()})
        errors = []
        with requests.Session() as session:
            session.headers["User-Agent"] = "SportsAppV2 local TV listings checker"
            for day in days:
                for network, (callsign, station_path) in STATIONS.items():
                    candidates = [g for g in games if g.get("date") == day
                                  and network in g.get("tv_providers", [])]
                    if not candidates:
                        continue
                    url = f"https://www.tvpassport.com/tv-listings/stations/{station_path}/{day}"
                    try:
                        response = session.get(url, timeout=25)
                        response.raise_for_status()
                        ids = local_game_ids(response.text, day, callsign, candidates)
                        # Replace this station/day, including withdrawn assignments.
                        for game in candidates:
                            key = str(game["game_id"])
                            providers = [p for p in coverage.get(key, []) if p != network]
                            if key in ids:
                                providers.append(network)
                            if providers:
                                coverage[key] = providers
                            else:
                                coverage.pop(key, None)
                        coverage.setdefault("_sources", {})[f"{day}/{network}"] = {
                            "url": url, "checked_at": now.isoformat(), "game_ids": sorted(ids),
                        }
                        print(f"[LOCAL NFL] {day} {callsign}: {len(ids)} confirmed")
                    except (requests.RequestException, ValueError) as error:
                        errors.append(f"{day} {callsign}: {error}")
                        print(f"[LOCAL NFL] Keeping previous coverage: {errors[-1]}")
        coverage["_last_checked"] = now.isoformat()
        coverage["_errors"] = errors
        write_json(OUTPUT, coverage)
    finally:
        lock.close()


if __name__ == "__main__":
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("--force", action="store_true")
    main(args.parse_args().force)
