import unittest

from local_nfl_broadcasts import local_game_ids


class LocalListingsTests(unittest.TestCase):
    day = "2026-09-20"
    games = [{"game_id": "1", "date": day,
              "matchup": "Minnesota Vikings @ Chicago Bears"},
             {"game_id": "2", "date": day,
              "matchup": "Green Bay Packers @ New York Jets"}]

    def row(self, **changes):
        fields = {"data-listDateTime": self.day + " 10:00:00",
                  "data-callsign": "KTTV", "data-league": "NFL",
                  "data-live": "1", "data-team1": "Minnesota Vikings",
                  "data-team2": "Chicago Bears"}
        fields.update(changes)
        return '<div ' + ' '.join(f'{k}="{v}"' for k, v in fields.items()) + '></div>'

    def test_matches_only_exact_pair(self):
        self.assertEqual(local_game_ids(self.row(), self.day, "KTTV", self.games), {"1"})

    def test_generic_replay_and_other_league_do_not_confirm(self):
        for changes in [{"data-team1": "", "data-team2": ""},
                        {"data-live": ""}, {"data-league": "NCAA"},
                        {"data-team2": "Green Bay Packers"}]:
            with self.subTest(changes=changes):
                self.assertEqual(local_game_ids(self.row(**changes), self.day, "KTTV", self.games), set())

    def test_wrong_date_station_or_blocked_page_rejected(self):
        for html in ["<html>Access denied</html>",
                     self.row(**{"data-listDateTime": "2026-09-27 10:00:00"}),
                     self.row(**{"data-callsign": "OTHER"})]:
            with self.assertRaises(ValueError):
                local_game_ids(html, self.day, "KTTV", self.games)


if __name__ == "__main__":
    unittest.main()
