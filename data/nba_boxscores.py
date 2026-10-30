"""Save ESPN box scores for NBA games as soon as the schedule marks them final.

Reads public/data/nba_schedule.json (kept live by schedule_NBA.py), and for every game
marked final in the last few days without a saved box score, fetches ESPN's game summary
and writes public/data/nba_boxscores/<game_id>.json. A game is only saved once ESPN also
reports it completed, so the stats are the finished lines. Cheap when nothing is pending,
so file_loop.py runs it every few seconds.

ESPN load: requests go through the shared ScoreboardClient (one ESPN request at a time
across all scripts, 1.5s pacing, and the shared cooldown when ESPN refuses or fails).
Each game backs off between attempts (20s doubling to 15 min) so a game ESPN never
closes is not polled every run, and a run makes at most MAX_FETCHES_PER_RUN calls.
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import time

import pytz

from scoreboard_client import (STATE_DIR, ScoreboardClient, ScoreboardUnavailable,
                               acquire_script_lock, read_json, write_json)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEDULE_JSON = os.path.join(BASE_DIR, "public", "data", "nba_schedule.json")
BOXSCORE_DIR = os.path.join(BASE_DIR, "public", "data", "nba_boxscores")
SUMMARY_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={game_id}"
LOOKBACK_DAYS = 3
HEADERS = {"User-Agent": "Mozilla/5.0"}
MAX_FETCHES_PER_RUN = 3
RETRY_BASE_SECONDS = 20
RETRY_MAX_SECONDS = 15 * 60
# Per-game attempt history: {game_id: {"attempts": n, "next_at": epoch seconds}}.
ATTEMPTS_PATH = STATE_DIR / "nba-boxscores.json"


def atomic_write_json(data, save_path: str):
    temp_path = save_path + ".tmp"
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(temp_path, save_path)


def pending_game_ids() -> list[str]:
    try:
        with open(SCHEDULE_JSON, "r", encoding="utf-8") as f:
            games = json.load(f)
    except (OSError, json.JSONDecodeError):
        return []
    if isinstance(games, dict):
        games = games.get("games", [])
    cutoff = (datetime.now(pytz.timezone("America/Los_Angeles")) - timedelta(days=LOOKBACK_DAYS)).strftime("%Y-%m-%d")
    pending = []
    for game in games:
        game_id = str(game.get("game_id") or "")
        final = str(game.get("status") or "").lower() == "final" or bool(game.get("winner"))
        if not game_id or not final or str(game.get("date") or "") < cutoff:
            continue
        if not os.path.exists(os.path.join(BOXSCORE_DIR, f"{game_id}.json")):
            pending.append(game_id)
    return pending


def to_number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_boxscore(game_id: str, summary: dict) -> dict | None:
    status = summary.get("header", {}).get("competitions", [{}])[0].get("status", {}).get("type", {})
    if not status.get("completed"):
        return None
    teams = []
    for team in summary.get("boxscore", {}).get("players", []):
        block = (team.get("statistics") or [{}])[0]
        keys = block.get("keys", [])
        players = []
        for row in block.get("athletes", []):
            stats = dict(zip(keys, row.get("stats", [])))
            made_3 = str(stats.get("threePointFieldGoalsMade-threePointFieldGoalsAttempted", "")).split("-")[0]
            dnp = bool(row.get("didNotPlay")) or not row.get("stats")
            players.append({
                "id": str(row.get("athlete", {}).get("id", "")),
                "name": row.get("athlete", {}).get("displayName"),
                "starter": bool(row.get("starter")),
                "dnp": dnp,
                "min": None if dnp else to_number(stats.get("minutes")),
                "pts": None if dnp else to_number(stats.get("points")),
                "reb": None if dnp else to_number(stats.get("rebounds")),
                "ast": None if dnp else to_number(stats.get("assists")),
                "fg3m": None if dnp else to_number(made_3),
                "stl": None if dnp else to_number(stats.get("steals")),
                "blk": None if dnp else to_number(stats.get("blocks")),
                "tov": None if dnp else to_number(stats.get("turnovers")),
            })
        teams.append({"abbr": team.get("team", {}).get("abbreviation"), "players": players})
    if not teams:
        return None
    return {"game_id": game_id, "fetched_at": datetime.now(timezone.utc).isoformat(), "teams": teams}


def main() -> int:
    acquire_script_lock("nba-boxscores")
    pending = pending_game_ids()
    attempts = {gid: a for gid, a in read_json(ATTEMPTS_PATH, {}).items() if gid in pending}
    client = ScoreboardClient()
    fetched = 0
    for game_id in pending:
        entry = attempts.get(game_id, {"attempts": 0, "next_at": 0})
        if time.time() < entry["next_at"]:
            continue
        if fetched >= MAX_FETCHES_PER_RUN:
            break
        fetched += 1
        try:
            boxscore = parse_boxscore(game_id, client.get_json(SUMMARY_URL.format(game_id=game_id), HEADERS))
        except ScoreboardUnavailable as e:
            print(f"[nba_boxscores] {e}", flush=True)
            break  # shared ESPN cooldown or another request in flight: stop for this run
        except (ValueError, KeyError, IndexError, TypeError) as e:
            print(f"[nba_boxscores] {game_id}: {e}", flush=True)
            boxscore = None
        if boxscore is None:
            # ESPN has not closed the game yet (or the response was unusable); wait longer each time.
            tries = entry["attempts"] + 1
            delay = min(RETRY_BASE_SECONDS * 2 ** (tries - 1), RETRY_MAX_SECONDS)
            attempts[game_id] = {"attempts": tries, "next_at": time.time() + delay}
            continue
        atomic_write_json(boxscore, os.path.join(BOXSCORE_DIR, f"{game_id}.json"))
        attempts.pop(game_id, None)
        print(f"[nba_boxscores] saved {game_id}", flush=True)
    STATE_DIR.mkdir(exist_ok=True)
    write_json(ATTEMPTS_PATH, attempts)
    return 0


if __name__ == "__main__":
    sys.exit(main())
