import unittest
from nba_data_helpers import complete_team_stats, merge_player_stats


class NBADataTests(unittest.TestCase):
    def test_opening_day_keeps_all_teams_without_copying_other_teams_stats(self):
        rows = [{"TEAM_ID": 1610612738, "TEAM_NAME": "Boston Celtics", "GP": 1, "PTS": 113}]
        teams = complete_team_stats(rows)
        self.assertEqual(len(teams), 30)
        self.assertEqual(next(t for t in teams if t['TEAM_ID'] == 1610612738)['PTS'], 113)
        self.assertEqual(next(t for t in teams if t['TEAM_ID'] == 1610612747)['GP'], 0)

    def test_partial_stats_preserve_current_season_team_rows(self):
        existing = [{"TEAM_ID": 1610612747, "TEAM_NAME": "Los Angeles Lakers", "GP": 2}]
        teams = complete_team_stats([], existing)
        self.assertEqual(next(t for t in teams if t['TEAM_ID'] == 1610612747)['GP'], 2)

    def test_rosters_fill_missing_players_and_stats_override_roster_placeholders(self):
        roster = {'1': [{'PLAYER_ID': 1, 'PTS': 0}, {'PLAYER_ID': 2, 'PTS': 0}]}
        actual = {'1': [{'PLAYER_ID': 1, 'PTS': 20}]}
        result = merge_player_stats(actual, {}, roster)
        self.assertEqual(result['1'], [{'PLAYER_ID': 1, 'PTS': 20}, {'PLAYER_ID': 2, 'PTS': 0}])
