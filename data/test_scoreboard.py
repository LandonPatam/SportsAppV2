"""Offline regression checks: python -m unittest discover -s data -p test_scoreboard.py"""
import contextlib
import io
import json
import os
import runpy
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from pathlib import Path
from unittest.mock import Mock, patch

import pytz
import requests
import scoreboard_client as client
import file_loop

ROOT = Path(__file__).resolve().parents[1]


def response(events=(), status=200, headers=None):
    result = Mock(status_code=status, headers=headers or {})
    result.json.return_value = {"sports": [{"leagues": [{"events": list(events)}]}]}
    if status >= 400:
        result.raise_for_status.side_effect = requests.HTTPError(str(status))
    return result


class ScoreboardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state = Path(self.temp.name) / "state"
        patcher = patch.object(client, "STATE_DIR", self.state)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_same_date_is_fetched_once_even_across_process_instances(self):
        with patch.object(requests.Session, "get", return_value=response()) as get:
            first = client.ScoreboardClient()
            first.get_json("https://example.test/nba/today", {})
            first.get_json("https://example.test/nba/today", {})
            client.ScoreboardClient().get_json("https://example.test/nba/today", {})
        self.assertEqual(get.call_count, 1)
        self.assertEqual(get.call_args.kwargs["timeout"], (3, 7))

    def test_cooldown_survives_new_client_and_covers_other_league(self):
        for status, headers, minimum in [
            (429, {"Retry-After": "120"}, 119),
            (403, {}, 3599),
            (429, {"Retry-After": format_datetime(datetime.now(timezone.utc) + timedelta(minutes=5))}, 298),
        ]:
            with self.subTest(status=status, headers=headers):
                self.state.mkdir(exist_ok=True)
                client.write_json(self.state / "espn-backoff.json", {})
                with patch.object(requests.Session, "get", return_value=response(status=status, headers=headers)) as get:
                    with self.assertRaises(client.ScoreboardUnavailable):
                        client.ScoreboardClient().get_json("https://example.test/nba", {})
                    state = client.read_json(self.state / "espn-backoff.json", {})
                    self.assertGreater(state["until"] - client.time.time(), minimum)
                    with self.assertRaises(client.ScoreboardUnavailable):
                        client.ScoreboardClient().get_json("https://example.test/nfl", {})
                    self.assertEqual(get.call_count, 1)

    def test_timeout_and_malformed_json_do_not_publish_cache(self):
        for failure in (requests.Timeout(), ValueError("bad JSON")):
            client.STATE_DIR.mkdir(exist_ok=True)
            client.write_json(self.state / "espn-backoff.json", {})
            with patch.object(requests.Session, "get", side_effect=failure):
                with self.assertRaises(client.ScoreboardUnavailable):
                    client.ScoreboardClient().get_json("https://example.test/bad", {})
            self.assertEqual(list(self.state.glob("*.json")), [self.state / "espn-backoff.json"])

    def test_process_lock_prevents_overlap_and_releases(self):
        lock = client.ProcessLock("test")
        try:
            with self.assertRaises(OSError):
                client.ProcessLock("test")
        finally:
            lock.close()
        client.ProcessLock("test").close()

    def test_scheduler_keeps_polling_nfl_while_other_jobs_are_busy(self):
        launched = []

        def spawn(args, **kwargs):
            launched.append((args[-1], kwargs["env"]["SPORTS_LIVE_ONLY"]))
            child = Mock()
            child.poll.return_value = 0 if args[-1] == str(file_loop.NFL_SCHEDULE_SCRIPT) else None
            return child

        previous = Path.cwd()
        try:
            with patch.object(file_loop, "get_sport_status", return_value={"should_run": True}), \
                 patch.object(file_loop, "get_f1_status", return_value={"is_race_weekend": False}), \
                 patch.object(file_loop.subprocess, "Popen", side_effect=spawn), \
                 patch.object(file_loop.time, "monotonic", side_effect=[0, 15]), \
                 patch.object(file_loop.time, "sleep", side_effect=[None, KeyboardInterrupt]):
                with self.assertRaises(KeyboardInterrupt):
                    file_loop.main()
        finally:
            os.chdir(previous)
        self.assertEqual(launched.count((str(file_loop.NFL_SCHEDULE_SCRIPT), "1")), 2)
        self.assertEqual(launched.count((str(file_loop.NBA_SCHEDULE_SCRIPT), "1")), 1)
        self.assertEqual(launched.count((str(file_loop.NBA_DATA_SCRIPT), "0")), 1)

    def test_both_scripts_update_multiple_games_with_one_request(self):
        today = datetime.now(pytz.timezone("America/Los_Angeles")).strftime("%Y-%m-%d")
        games = [{"game_id": str(i), "date": today, "time": "12:00 PM",
                  "matchup": "Away @ Home", "status": "live", "home_score": 1,
                  "away_score": 1, "period": 1, "clock": "12:00"} for i in (1, 2)]
        events = [{"id": str(i), "status": "in" if i == 1 else "post",
                   "fullStatus": {"period": 3, "displayClock": "4:32", "type": {}},
                   "competitors": [{"homeAway": "home", "displayName": "Home", "score": 20},
                                   {"homeAway": "away", "displayName": "Away", "score": 17}]}
                  for i in (1, 2)]
        previous = Path.cwd()
        try:
            os.chdir(self.temp.name)
            Path("public/data").mkdir(parents=True)
            for league in ("NBA", "NFL"):
                with self.subTest(league=league):
                    path = Path(f"public/data/{league.lower()}_schedule.json")
                    path.write_text(json.dumps(games), encoding="utf-8")
                    with patch.dict(os.environ, SPORTS_LIVE_ONLY="1"), \
                         patch.object(requests.Session, "get", return_value=response(events)) as get, \
                         contextlib.redirect_stdout(io.StringIO()):
                        namespace = runpy.run_path(str(ROOT / "data" / f"schedule_{league}.py"))
                    namespace["_script_lock"].close()
                    self.assertEqual(get.call_count, 1)
                    saved = json.loads(path.read_text(encoding="utf-8"))
                    self.assertEqual(saved[0]["status"], "live")
                    self.assertEqual(saved[0]["clock"], "4:32")
                    self.assertEqual(saved[0]["home_score"], 20)
                    self.assertEqual(saved[1]["status"], "final")
                    self.assertEqual(saved[1]["winner"], "Home")
                    self.assertNotIn("clock", saved[1])
                    if league == "NBA":
                        season_path = Path(namespace["SEASON_SAVE_PATH"])
                        self.assertEqual(json.loads(season_path.read_text()), saved)
        finally:
            os.chdir(previous)


if __name__ == "__main__":
    unittest.main()
