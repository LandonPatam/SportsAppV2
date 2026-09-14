"""Daily NBA roster-cache refresh.

This runs separately from the frequent team/player-stat job because NBA Stats
throttles roster endpoints aggressively. The cache is used if player stats are
temporarily unavailable.
"""
import json
import os
import time
from datetime import datetime
from pathlib import Path

import requests

from scoreboard_client import acquire_script_lock


BASE_DIR = Path(__file__).resolve().parents[1]
SCHEDULE_JSON = BASE_DIR / "public" / "data" / "nba_schedule.json"
TEAM_STATS_JSON = BASE_DIR / "public" / "data" / "espn_NBA_team_stats.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": "https://www.nba.com/",
    "Origin": "https://www.nba.com",
}

TEAM_ABBREVIATIONS = {
    "Atlanta Hawks": "ATL", "Boston Celtics": "BOS", "Brooklyn Nets": "BKN",
    "Charlotte Hornets": "CHA", "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE",
    "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN", "Detroit Pistons": "DET",
    "Golden State Warriors": "GSW", "Houston Rockets": "HOU", "Indiana Pacers": "IND",
    "LA Clippers": "LAC", "Los Angeles Clippers": "LAC", "Los Angeles Lakers": "LAL",
    "Memphis Grizzlies": "MEM", "Miami Heat": "MIA", "Milwaukee Bucks": "MIL",
    "Minnesota Timberwolves": "MIN", "New Orleans Pelicans": "NOP", "New York Knicks": "NYK",
    "Oklahoma City Thunder": "OKC", "Orlando Magic": "ORL", "Philadelphia 76ers": "PHI",
    "Phoenix Suns": "PHX", "Portland Trail Blazers": "POR", "Sacramento Kings": "SAC",
    "San Antonio Spurs": "SAS", "Toronto Raptors": "TOR", "Utah Jazz": "UTA",
    "Washington Wizards": "WAS",
}

ZERO_PLAYER_STATS = {
    "GP": 0, "MIN": 0, "PTS": 0, "REB": 0, "AST": 0, "STL": 0, "BLK": 0,
    "TOV": 0, "FG_PCT": 0, "FG3_PCT": 0, "FT_PCT": 0, "FGA": 0, "FG3A": 0,
    "FTA": 0, "OFF_RATING": None, "DEF_RATING": None, "NET_RATING": None,
    "VALUE_SCORE": None,
}


def read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return default


def season_string() -> str:
    schedule = read_json(SCHEDULE_JSON, [])
    dates = []
    for game in schedule:
        try:
            dates.append(datetime.strptime(game.get("date", ""), "%Y-%m-%d").date())
        except (AttributeError, TypeError, ValueError):
            continue
    start_year = min(dates).year if dates else datetime.now().year
    return f"{start_year}-{str(start_year + 1)[-2:]}"


def roster_url(team_id: int, season: str) -> str:
    return (
        "https://stats.nba.com/stats/commonteamroster"
        f"?LeagueID=00&Season={season}&TeamID={team_id}"
    )


def format_player(row: dict, team_name: str) -> dict:
    player = {
        "PLAYER_ID": row.get("PLAYER_ID"),
        "PLAYER_NAME": row.get("PLAYER"),
        "TEAM_ID": row.get("TeamID"),
        "TEAM_ABBREVIATION": TEAM_ABBREVIATIONS.get(team_name, ""),
        "JERSEY_NUMBER": row.get("NUM") or "",
        "POSITION": row.get("POSITION") or "",
        "NICKNAME": row.get("NICKNAME") or "",
        "AGE": row.get("AGE"),
        "HEIGHT": row.get("HEIGHT") or "",
        "WEIGHT": row.get("WEIGHT") or "",
        "SCHOOL": row.get("SCHOOL") or "",
        "EXP": row.get("EXP") or "",
        "PLAYER_SLUG": row.get("PLAYER_SLUG") or "",
        "ROSTER_ONLY": True,
    }
    player.update(ZERO_PLAYER_STATS)
    return player


def main():
    lock = acquire_script_lock("nba-roster-refresh")
    try:
        season = season_string()
        cache_path = BASE_DIR / "public" / "data" / f"nba_roster_cache_{season}.json"
        previous = read_json(cache_path, {})
        teams = read_json(TEAM_STATS_JSON, [])
        if not isinstance(teams, list) or not teams:
            print("[WARN] NBA roster refresh skipped: no team stats are available yet.")
            return

        rosters = dict(previous) if isinstance(previous, dict) else {}
        session = requests.Session()
        for team in teams:
            team_id = team.get("TEAM_ID")
            team_name = team.get("TEAM_NAME", "")
            if not team_id or not team_name:
                continue
            try:
                response = session.get(roster_url(team_id, season), headers=HEADERS, timeout=(5, 30))
                response.raise_for_status()
                result = response.json().get("resultSets", [{}])[0]
                headers = result.get("headers", [])
                rows = result.get("rowSet", [])
                players = [format_player(dict(zip(headers, row)), team_name) for row in rows]
                rosters[str(team_id)] = [p for p in players if p.get("PLAYER_ID") and p.get("PLAYER_NAME")]
                print(f"[ROSTER] {team_name}: {len(rows)} players")
            except Exception as exc:
                print(f"[WARN] Could not refresh roster for {team_name} ({team_id}): {exc}")
            time.sleep(1)

        temp_path = cache_path.with_suffix(".tmp")
        temp_path.write_text(json.dumps(rosters, indent=2, ensure_ascii=False), encoding="utf-8")
        temp_path.replace(cache_path)
        print(f"[OK] NBA roster cache refreshed for {season}.")
    finally:
        lock.close()


if __name__ == "__main__":
    main()
