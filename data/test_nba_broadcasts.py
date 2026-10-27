import contextlib
import io
import json
import os
from pathlib import Path
import runpy
import tempfile
import unittest
from datetime import datetime
from unittest.mock import patch

import pytz

from nba_broadcasts import get_nba_tv_providers


class NBABroadcastTests(unittest.TestCase):
    def test_espn_warriors_nuggets_network_maps_to_peacock(self):
        self.assertEqual(get_nba_tv_providers([{
            "name": "NBC Sports Network", "shortName": "NBCSN",
            "callLetters": "NBCSN", "isNational": True,
        }]), ["Peacock"])

    def test_aliases_and_short_names_deduplicate_peacock(self):
        self.assertEqual(get_nba_tv_providers([
            {"name": " nbcsn "}, {"name": "Peacock"},
            {"shortName": "NBCSN"}, {"callLetters": "NBCSN"},
        ]), ["Peacock"])

    def test_other_national_networks_are_preserved(self):
        names = ["Prime Video", "Peacock", "ESPN", "ESPN2", "ABC", "NBC", "ESPN+", "ESPN Deportes", "Telemundo", "Universo", "TNT", "TBS", "truTV"]
        self.assertEqual(get_nba_tv_providers([{"name": n} for n in names]), names)

    def test_other_network_aliases(self):
        aliases = {
            "ESPN 2": "ESPN2", "ESPN News": "ESPNEWS", "ESPN U": "ESPNU",
            "Amazon Prime Video": "Prime Video", "Amazon Prime": "Prime Video",
            "Prime": "Prime Video", "Peacock TV": "Peacock", "Peacock Premium": "Peacock",
            "American Broadcasting Company": "ABC", "National Broadcasting Company": "NBC",
        }
        for alias, provider in aliases.items():
            with self.subTest(alias=alias):
                self.assertEqual(get_nba_tv_providers([{"name": alias}]), [provider])

    def test_network_fallback_fields(self):
        for field in ("shortName", "callLetters", "station", "slug"):
            with self.subTest(field=field):
                self.assertEqual(get_nba_tv_providers([
                    {"name": "Unfamiliar full name", field: "nbcsn"},
                ]), ["Peacock"])

    def test_espn_plus_stays_distinct(self):
        self.assertEqual(get_nba_tv_providers([
            {"name": "ESPN"}, {"name": "ESPN+"}, {"name": "ESPN2"},
            {"name": "ESPN Deportes"},
        ]), ["ESPN", "ESPN+", "ESPN2", "ESPN Deportes"])

    def test_unfamiliar_us_national_tv_and_streaming_networks_are_kept(self):
        self.assertEqual(get_nba_tv_providers([
            {"name": "New TV Network", "isNational": True, "type": "TV", "region": "us"},
            {"shortName": "New Stream", "isNational": True, "type": "Streaming"},
        ]), ["New TV Network", "New Stream"])

    def test_radio_regional_international_and_subscription_listings_are_excluded(self):
        self.assertEqual(get_nba_tv_providers([
            {"name": "ESPN Radio", "isNational": True, "type": "Radio", "region": "us"},
            {"name": "ESPN", "isNational": True, "type": "Radio", "region": "us"},
            {"name": "ESPN", "isNational": True, "type": "TV", "region": "br"},
            {"name": "NBA League Pass", "isNational": False, "type": "Subscription Package"},
            {"name": "Regional Sports", "isNational": False, "type": "TV", "region": "us"},
        ]), [])

    def test_regional_nbc_networks_are_not_peacock(self):
        self.assertEqual(get_nba_tv_providers([
            {"name": "NBC Sports Bay Area", "shortName": "NBCSBA"},
            {"name": "NBC Sports Boston", "shortName": "NBCSB"},
            {"name": "Altitude"},
        ]), [])

    def test_empty_broadcasts(self):
        for broadcasts in (None, [], [{}, {"name": None}], [None, "ESPN"]):
            self.assertEqual(get_nba_tv_providers(broadcasts), [])

    def test_live_only_scheduler_refreshes_broadcasts_without_full_crawl(self):
        script = Path(__file__).with_name("schedule_NBA.py").resolve()
        today = datetime.now(pytz.timezone("America/Los_Angeles")).date()
        year = today.year if today.month >= 7 else today.year - 1
        season_file = f"nba_schedule_{year}-{str(year + 1)[-2:]}.json"
        cases = [
            ("pre", {"broadcasts": [{"name": "NBC Sports Network"}]}, ["Peacock"]),
            ("in", {"broadcasts": [{"name": "NBC Sports Network"}]}, ["Peacock"]),
            ("post", {"broadcasts": [{"name": "NBC Sports Network"}]}, ["Peacock"]),
            ("pre", {"broadcasts": [{"name": "NBATV"}, {"name": "ESPN2"}]}, ["ESPN2"]),
            ("in", {"broadcasts": [{"name": "New Network", "isNational": True, "region": "us", "type": "TV"}]}, ["New Network"]),
            ("pre", {}, ["ESPN"]),
            ("pre", {"broadcasts": []}, []),
        ]
        for status, broadcast_fields, expected in cases:
            with self.subTest(status=status, broadcast_fields=broadcast_fields):
                event = {
                    "id": "401909876", "status": status, **broadcast_fields,
                    "competitors": [
                        {"homeAway": "home", "displayName": "Denver Nuggets", "score": "110"},
                        {"homeAway": "away", "displayName": "Golden State Warriors", "score": "100"},
                    ],
                }
                response = {"sports": [{"leagues": [{"events": [event]}]}]}
                game = {
                    "game_id": "401909876", "date": today.isoformat(), "time": "7:00 PM",
                    "matchup": "Golden State Warriors @ Denver Nuggets",
                    "tv_providers": ["ESPN"], "status": "scheduled",
                }
                with tempfile.TemporaryDirectory() as directory:
                    output = Path(directory) / "public" / "data"
                    output.mkdir(parents=True)
                    (output / "nba_schedule.json").write_text(json.dumps([game]), encoding="utf-8")
                    with (
                        contextlib.chdir(directory),
                        contextlib.redirect_stdout(io.StringIO()),
                        patch.dict(os.environ, {"SPORTS_LIVE_ONLY": "1"}),
                        patch("scoreboard_client.acquire_script_lock"),
                        patch("scoreboard_client.ScoreboardClient.get_json", return_value=response) as fetch,
                    ):
                        runpy.run_path(str(script), run_name="__main__")
                    fetch.assert_called_once()
                    for filename in ("nba_schedule.json", season_file):
                        saved = json.loads((output / filename).read_text(encoding="utf-8"))
                        self.assertEqual(saved[0]["tv_providers"], expected)
                        self.assertEqual(saved[0]["status"], {"pre": "scheduled", "in": "live", "post": "final"}[status])


if __name__ == "__main__":
    unittest.main()
