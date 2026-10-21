"""Keep teams without regular-season appearances in NBA output."""
NBA_TEAMS = {1610612737: 'Atlanta Hawks', 1610612738: 'Boston Celtics', 1610612751: 'Brooklyn Nets', 1610612766: 'Charlotte Hornets', 1610612741: 'Chicago Bulls', 1610612739: 'Cleveland Cavaliers', 1610612742: 'Dallas Mavericks', 1610612743: 'Denver Nuggets', 1610612765: 'Detroit Pistons', 1610612744: 'Golden State Warriors', 1610612745: 'Houston Rockets', 1610612754: 'Indiana Pacers', 1610612746: 'LA Clippers', 1610612747: 'Los Angeles Lakers', 1610612763: 'Memphis Grizzlies', 1610612748: 'Miami Heat', 1610612749: 'Milwaukee Bucks', 1610612750: 'Minnesota Timberwolves', 1610612740: 'New Orleans Pelicans', 1610612752: 'New York Knicks', 1610612760: 'Oklahoma City Thunder', 1610612753: 'Orlando Magic', 1610612755: 'Philadelphia 76ers', 1610612756: 'Phoenix Suns', 1610612757: 'Portland Trail Blazers', 1610612758: 'Sacramento Kings', 1610612759: 'San Antonio Spurs', 1610612761: 'Toronto Raptors', 1610612762: 'Utah Jazz', 1610612764: 'Washington Wizards'}


def complete_team_stats(rows, existing=()):
    current = {str(t["TEAM_ID"]): t for t in existing}
    current.update({str(t["TEAM_ID"]): t for t in rows})
    template = next(iter(rows), {})
    for team_id, name in NBA_TEAMS.items():
        key = str(team_id)
        if key not in current:
            blank = {k: 0 for k, v in template.items() if isinstance(v, (int, float))}
            blank.update(TEAM_ID=team_id, TEAM_NAME=name, GP=0, W=0, L=0,
                         WIN_PCT=0, W_PCT=0, PTS=0, REB=0, AST=0,
                         FG_PCT=0, FG3_PCT=0, FT_PCT=0)
            current[key] = blank
    return sorted(current.values(), key=lambda t: t["TEAM_NAME"])


def merge_player_stats(stats, existing, rosters):
    # Current-season rosters fill gaps; actual stats always take precedence.
    merged = {}
    for source in (rosters, existing, stats):
        for team_id, players in source.items():
            by_id = {str(p["PLAYER_ID"]): p for p in merged.get(team_id, [])}
            by_id.update({str(p["PLAYER_ID"]): p for p in players})
            merged[team_id] = list(by_id.values())
    return merged
