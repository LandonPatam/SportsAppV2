"""
Builds a comprehensive NFL team dataset and writes it to public/data/complete_team_data.json

Data sources (ESPN):
- Standings (records, divisions, conferences):
  https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?season={season}&region=us&lang=en
- Team statistics - Multiple endpoints for complete coverage:
  https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/team?season={season}&region=us&lang=en
  https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/{season}/types/2/teams/{team_id}/statistics

If ESPN endpoints are unavailable, falls back to merging from local NFL standings
file (public/data/nfl_site_nfl_standings.json) for basic records/points.

Usage:
  python data/test_complete_NFL.py [--season 2024] [--verbose]
"""
from __future__ import annotations

import json
import sys
import time
import argparse
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import requests  # type: ignore
except Exception:
    requests = None  # Network may be restricted in some environments


ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "public" / "data" / "complete_team_data.json"
LOCAL_STANDINGS = ROOT / "public" / "data" / "nfl_site_nfl_standings.json"


def fetch_json(url: str, timeout: float = 20.0, verbose: bool = False) -> Optional[dict]:
    if requests is None:
        if verbose:
            print(f"requests not available; cannot fetch {url}")
        return None
    try:
        if verbose:
            print(f"GET {url}")
        r = requests.get(url, timeout=timeout, headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        })
        if r.status_code != 200:
            if verbose:
                print(f"Non-200: {r.status_code} for {url}")
            return None
        return r.json()
    except Exception as e:
        if verbose:
            print(f"Fetch error {url}: {e}")
        return None


def safe_get(obj: Any, *path: Any, default=None):
    cur = obj
    for key in path:
        if isinstance(cur, dict):
            cur = cur.get(key)
        elif isinstance(cur, list) and isinstance(key, int) and 0 <= key < len(cur):
            cur = cur[key]
        else:
            return default
    return cur if cur is not None else default


def parse_espn_standings(js: dict, verbose: bool = False) -> Dict[str, Dict[str, Any]]:
    """Parse ESPN standings JSON into a dict keyed by team name with record details.
    Returns: { teamName: { name, abbreviation, conference, division, wins, losses, ties, win_pct,
                           division_record: 'W-L-T', conference_record: 'W-L-T' } }
    """
    teams: Dict[str, Dict[str, Any]] = {}

    if not isinstance(js, dict):
        return teams

    # ESPN standings structure: children (conferences) → children (divisions) → standings → entries
    children = js.get("children") or []
    if verbose:
        print(f"Standings: found {len(children)} conference groups")

    for conference_group in children:
        # Conference name from parent group
        conference_name = safe_get(conference_group, "name") or ""
        if verbose:
            print(f"  Processing conference: {conference_name}")
        
        # Each conference has divisions as children
        divisions = conference_group.get("children") or []
        
        for division_group in divisions:
            division_name = safe_get(division_group, "name") or ""
            standings = safe_get(division_group, "standings") or {}
            entries = standings.get("entries") or []
            
            if verbose:
                print(f"    Division {division_name}: {len(entries)} teams")
            
            for entry in entries:
                team = entry.get("team") or {}
                name = team.get("displayName") or team.get("name")
                abbr = team.get("abbreviation")
                team_id = team.get("id")
                
                if not name:
                    continue
                
                # Parse stats array for overall record
                stats = entry.get("stats") or []
                wins = losses = ties = 0
                win_pct = 0.0
                points_for = points_against = None
                
                for stat in stats:
                    stat_name = (stat.get("name") or "").lower()
                    stat_abbr = (stat.get("abbreviation") or "").lower()
                    value = stat.get("value")
                    display_value = stat.get("displayValue")
                    
                    if stat_abbr == "w" or "wins" in stat_name:
                        wins = int(value or 0)
                    elif stat_abbr == "l" or "losses" in stat_name:
                        losses = int(value or 0)
                    elif stat_abbr == "t" or "ties" in stat_name:
                        ties = int(value or 0)
                    elif stat_abbr == "pct" or "winpercent" in stat_name:
                        try:
                            win_pct = float(value or 0)
                        except:
                            win_pct = 0.0
                    elif stat_abbr == "pf" or "pointsfor" in stat_name:
                        try:
                            points_for = float(value or 0)
                        except:
                            pass
                    elif stat_abbr == "pa" or "pointsagainst" in stat_name:
                        try:
                            points_against = float(value or 0)
                        except:
                            pass
                
                # Calculate win_pct if not provided
                if win_pct == 0.0 and (wins + losses + ties) > 0:
                    win_pct = (wins + 0.5 * ties) / (wins + losses + ties)
                
                # Parse records by type (division, conference)
                records = entry.get("records") or []
                div_rec = conf_rec = ""
                
                for rec in records:
                    rec_type = (rec.get("type") or "").lower()
                    summary = rec.get("summary") or ""
                    
                    if "division" in rec_type and summary:
                        div_rec = summary
                    elif "conference" in rec_type and summary:
                        conf_rec = summary
                
                item = {
                    "name": name,
                    "abbreviation": abbr or "",
                    "team_id": team_id,
                    "conference": conference_name,
                    "division": division_name,
                    "wins": wins,
                    "losses": losses,
                    "ties": ties,
                    "win_pct": win_pct,
                    "division_record": div_rec,
                    "conference_record": conf_rec,
                    "points_for": points_for,
                    "points_against": points_against,
                }
                
                teams[name] = item
                
                if verbose:
                    print(f"      {name}: {wins}-{losses}-{ties}, {conference_name}/{division_name}")

    return teams


def fetch_team_stats_by_category(season: int, verbose: bool = False) -> Dict[str, Dict[str, Any]]:
    """Fetch stats from category-specific endpoints."""
    stats_by_name: Dict[str, Dict[str, Any]] = {}
    
    # Category codes that ESPN uses
    categories = {
        "passing": "passing",
        "rushing": "rushing", 
        "receiving": "receiving",
        "scoring": "scoring",
        "kicking": "kicking",
        "defense": "defensiveInterceptions",  # or "defense"
        "tackles": "tackles",
        "sacks": "sacks",
    }
    
    for cat_key, cat_code in categories.items():
        url = f"https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/team?region=us&lang=en&contentorigin=espn&season={season}&seasontype=2&split=1&category={cat_code}"
        
        if verbose:
            print(f"\nFetching {cat_key} stats...")
        
        data = fetch_json(url, verbose=False)
        if not data:
            continue
            
        teams = data.get("teams") or []
        
        for team_node in teams:
            team_info = team_node.get("team") or {}
            name = team_info.get("displayName") or team_info.get("name")
            if not name:
                continue
                
            if name not in stats_by_name:
                stats_by_name[name] = {
                    "passing": {},
                    "rushing": {},
                    "kicking": {},
                    "defense": {},
                    "epa": {}
                }
            
            # Get stats from this category
            categories_data = team_node.get("categories") or []
            for cat in categories_data:
                stats = cat.get("stats") or []
                
                for st in stats:
                    sname = (st.get("name") or "").lower().replace(" ", "")
                    abbrev = (st.get("abbreviation") or "").lower()
                    
                    try:
                        value = float(st.get("value") or st.get("displayValue") or 0)
                    except:
                        continue
                    
                    # Route stats to appropriate bucket based on category
                    if cat_key == "passing":
                        if "yard" in sname and "sack" not in sname:
                            stats_by_name[name]["passing"]["yards"] = value
                        elif "touchdown" in sname or abbrev == "td":
                            stats_by_name[name]["passing"]["td"] = value
                        elif "interception" in sname or abbrev == "int":
                            stats_by_name[name]["passing"]["int"] = value
                        elif "completionpct" in sname or abbrev == "cmp%":
                            stats_by_name[name]["passing"]["cmp_pct"] = value
                        elif "attempt" in sname or abbrev == "att":
                            stats_by_name[name]["passing"]["att"] = value
                        elif "completion" in sname and abbrev == "cmp":
                            stats_by_name[name]["passing"]["cmp"] = value
                        elif "rating" in sname or abbrev == "qbr":
                            stats_by_name[name]["passing"]["rate"] = value
                    
                    elif cat_key == "rushing":
                        if "yard" in sname:
                            stats_by_name[name]["rushing"]["yards"] = value
                        elif "touchdown" in sname or abbrev == "td":
                            stats_by_name[name]["rushing"]["td"] = value
                        elif "attempt" in sname or abbrev in ("att", "car"):
                            stats_by_name[name]["rushing"]["att"] = value
                        elif "avg" in sname or "average" in sname:
                            stats_by_name[name]["rushing"]["avg"] = value
                        elif "long" in sname or abbrev == "lng":
                            stats_by_name[name]["rushing"]["long"] = value
                        elif "firstdown" in sname or abbrev == "fd":
                            stats_by_name[name]["rushing"]["first_downs"] = value
                    
                    elif cat_key in ("scoring", "kicking"):
                        if "fieldgoalmade" in sname or "fieldgoalsmade" in sname or abbrev == "fgm":
                            stats_by_name[name]["kicking"]["fgm"] = value
                        elif "fieldgoalattempt" in sname or abbrev == "fga":
                            stats_by_name[name]["kicking"]["fga"] = value
                        elif "fieldgoal" in sname and ("pct" in sname or abbrev == "fg%"):
                            stats_by_name[name]["kicking"]["fg_pct"] = value
                        elif "extrapointmade" in sname or abbrev == "xpm":
                            stats_by_name[name]["kicking"]["xpm"] = value
                        elif "extrapointattempt" in sname or abbrev == "xpa":
                            stats_by_name[name]["kicking"]["xpa"] = value
                        elif "point" in sname and "total" in sname:
                            stats_by_name[name]["kicking"]["points"] = value
                    
                    elif cat_key in ("defense", "tackles", "sacks"):
                        if "sack" in sname:
                            stats_by_name[name]["defense"]["sacks"] = value
                        elif "interception" in sname or abbrev == "int":
                            stats_by_name[name]["defense"]["ints"] = value
                        elif "tackle" in sname and "loss" not in sname:
                            stats_by_name[name]["defense"]["tackles"] = value
                        elif "fumble" in sname and "force" in sname:
                            stats_by_name[name]["defense"]["forced_fumbles"] = value
                        elif "fumble" in sname and "recover" in sname:
                            stats_by_name[name]["defense"]["fumble_recoveries"] = value
                        elif "passdefense" in sname or abbrev == "pd":
                            stats_by_name[name]["defense"]["passes_defended"] = value
                        elif "tackleforloss" in sname or abbrev == "tfl":
                            stats_by_name[name]["defense"]["tackles_for_loss"] = value
    
    if verbose:
        print(f"\nGathered stats for {len(stats_by_name)} teams across categories")
    
    return stats_by_name


def fetch_fpi_data(season: int, verbose: bool = False) -> Dict[str, float]:
    """Fetch FPI (Football Power Index) ratings for teams.
    Returns dict of team name -> FPI value
    """
    fpi_by_name: Dict[str, float] = {}
    
    # Try FPI-specific endpoint
    fpi_url = f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings?season={season}"
    fpi_js = fetch_json(fpi_url, verbose=verbose)
    
    if fpi_js and isinstance(fpi_js, dict):
        standings = fpi_js.get("standings") or {}
        entries = standings.get("entries") or []
        for entry in entries:
            team = entry.get("team") or {}
            name = team.get("displayName") or team.get("name")
            if not name:
                continue
            stats = entry.get("stats") or []
            for stat in stats:
                stat_name = (stat.get("name") or "").lower()
                if "fpi" in stat_name or "powerindex" in stat_name:
                    try:
                        fpi_by_name[name] = float(stat.get("value") or 0)
                    except:
                        pass
    
    if verbose:
        print(f"\nFPI data: found {len(fpi_by_name)} teams with ratings")
    
    return fpi_by_name


def load_local_standings(verbose: bool = False) -> Dict[str, Dict[str, Any]]:
    if not LOCAL_STANDINGS.exists():
        if verbose:
            print("Local standings file not found:", LOCAL_STANDINGS)
        return {}
    try:
        data = json.loads(LOCAL_STANDINGS.read_text(encoding="utf-8"))
        out: Dict[str, Dict[str, Any]] = {}
        # Team name -> abbreviation mapping
        name_to_abbr = {
            'Buffalo Bills': 'BUF', 'Miami Dolphins': 'MIA', 'New England Patriots': 'NE', 'New York Jets': 'NYJ',
            'Baltimore Ravens': 'BAL', 'Cincinnati Bengals': 'CIN', 'Cleveland Browns': 'CLE', 'Pittsburgh Steelers': 'PIT',
            'Houston Texans': 'HOU', 'Indianapolis Colts': 'IND', 'Jacksonville Jaguars': 'JAX', 'Tennessee Titans': 'TEN',
            'Denver Broncos': 'DEN', 'Kansas City Chiefs': 'KC', 'Las Vegas Raiders': 'LV', 'Los Angeles Chargers': 'LAC',
            'Dallas Cowboys': 'DAL', 'New York Giants': 'NYG', 'Philadelphia Eagles': 'PHI', 'Washington Commanders': 'WSH',
            'Chicago Bears': 'CHI', 'Detroit Lions': 'DET', 'Green Bay Packers': 'GB', 'Minnesota Vikings': 'MIN',
            'Atlanta Falcons': 'ATL', 'Carolina Panthers': 'CAR', 'New Orleans Saints': 'NO', 'Tampa Bay Buccaneers': 'TB',
            'Arizona Cardinals': 'ARI', 'Los Angeles Rams': 'LAR', 'San Francisco 49ers': 'SF', 'Seattle Seahawks': 'SEA',
        }

        for t in data:
            name = t.get("name")
            if not name:
                continue
            wins = int(t.get("wins") or 0)
            losses = int(t.get("losses") or 0)
            ties = int(t.get("ties") or 0)
            total = max(1, wins + losses + ties)
            
            passing = {}
            rushing = {}
            kicking = {}
            defense = {}
            epa = {}
            
            # Passing
            for src, dest in [("pass_att", "att"), ("pass_cmp", "cmp"), ("pass_cmp_pct", "cmp_pct"),
                             ("pass_yds_per_att", "yds_per_att"), ("pass_yds", "yards"), ("pass_td", "td"),
                             ("pass_int", "int"), ("pass_rate", "rate"), ("pass_first_downs", "first_downs"),
                             ("pass_first_down_pct", "first_down_pct"), ("pass_20_plus", "twenty_plus"),
                             ("pass_40_plus", "forty_plus"), ("pass_long", "long"), ("pass_sacks", "sacks"),
                             ("pass_sack_yds", "sack_yds")]:
                if t.get(src) is not None:
                    passing[dest] = t.get(src)
            
            # Rushing
            for src, dest in [("rush_att", "att"), ("rush_yds", "yards"), ("rush_avg", "avg"),
                             ("rush_td", "td"), ("rush_long", "long"), ("rush_first_downs", "first_downs")]:
                if t.get(src) is not None:
                    rushing[dest] = t.get(src)
            
            # Kicking
            for src, dest in [("fg_made", "fgm"), ("fg_att", "fga"), ("fg_pct", "fg_pct"),
                             ("xp_made", "xpm"), ("xp_att", "xpa")]:
                if t.get(src) is not None:
                    kicking[dest] = t.get(src)
            
            # Defense
            for src, dest in [("def_sacks", "sacks"), ("def_int", "ints"), ("def_tackles", "tackles"),
                             ("def_ff", "forced_fumbles"), ("def_fr", "fumble_recoveries")]:
                if t.get(src) is not None:
                    defense[dest] = t.get(src)
            
            # EPA
            for src, dest in [("epa_offense", "offense"), ("epa_defense", "defense"),
                             ("epa_passing", "passing"), ("epa_rushing", "rushing")]:
                if t.get(src) is not None:
                    epa[dest] = t.get(src)
            
            out[name] = {
                "name": name,
                "conference": t.get("conference") or "",
                "division": t.get("division") or "",
                "wins": wins,
                "losses": losses,
                "ties": ties,
                "win_pct": float(t.get("win_pct") if t.get("win_pct") is not None else (wins + 0.5 * ties) / total),
                "division_record": t.get("Div") or t.get("division_record") or "",
                "conference_record": t.get("Conf") or t.get("conference_record") or "",
                "points_for": t.get("points_for"),
                "points_against": t.get("points_against"),
                "passing": passing,
                "rushing": rushing,
                "kicking": kicking,
                "defense": defense,
                "epa": epa,
                "fpi": t.get("fpi"),
            }
        return out
    except Exception as e:
        if verbose:
            print("Failed to load local standings:", e)
        return {}


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--season", type=int, default=time.gmtime().tm_year)
    p.add_argument("--verbose", action="store_true")
    args = p.parse_args(argv)

    season = args.season
    verbose = args.verbose
    if verbose:
        print(f"Building complete team data for season={season}")
        print("=" * 60)

    # 1) ESPN Standings for records/splits
    standings_url = f"https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?season={season}&region=us&lang=en"
    standings_js = fetch_json(standings_url, verbose=verbose)
    rec_by_name = parse_espn_standings(standings_js, verbose=verbose) if standings_js else {}

    if not rec_by_name:
        if verbose:
            print("\nFalling back to local standings data.")
        rec_by_name = load_local_standings(verbose=verbose)

    # 2) Fetch stats by category
    stats_by_name = fetch_team_stats_by_category(season, verbose=verbose)

    # 3) FPI Ratings
    fpi_by_name = fetch_fpi_data(season, verbose=verbose)

    # 4) Merge everything
    result: List[Dict[str, Any]] = []
    all_names = set(rec_by_name.keys()) | set(stats_by_name.keys())
    
    if verbose:
        print(f"\n{'=' * 60}")
        print(f"Merging data for {len(all_names)} teams")
    
    for name in sorted(all_names):
        base = rec_by_name.get(name, {"name": name}).copy()
        buckets = stats_by_name.get(name, {})
        
        # Merge stat buckets
        for bucket_name in ["passing", "rushing", "kicking", "defense", "epa"]:
            if buckets.get(bucket_name):
                if bucket_name in base and base.get(bucket_name):
                    base[bucket_name].update(buckets[bucket_name])
                else:
                    base[bucket_name] = buckets[bucket_name]
        
        # Add FPI
        if name in fpi_by_name:
            base["fpi"] = fpi_by_name[name]
        
        # Ensure all buckets exist
        base.setdefault("passing", {})
        base.setdefault("rushing", {})
        base.setdefault("kicking", {})
        base.setdefault("defense", {})
        base.setdefault("epa", {})
        base.setdefault("fpi", None)
        
        # Remove team_id from output (internal use only)
        base.pop("team_id", None)
        
        result.append(base)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(result, indent=2), encoding="utf-8")
    
    if verbose:
        print(f"\n{'=' * 60}")
        print(f"✓ Wrote {len(result)} teams to {OUT_PATH}")
        if result:
            sample = result[0]
            print(f"\nSample: {sample.get('name')} ({sample.get('abbreviation')})")
            print(f"  Record: {sample.get('wins')}-{sample.get('losses')}-{sample.get('ties')}")
            print(f"  Passing: {len(sample.get('passing', {}))} fields - {list(sample.get('passing', {}).keys())[:5]}")
            print(f"  Rushing: {len(sample.get('rushing', {}))} fields - {list(sample.get('rushing', {}).keys())}")
            print(f"  Kicking: {len(sample.get('kicking', {}))} fields - {list(sample.get('kicking', {}).keys())}")
            print(f"  Defense: {len(sample.get('defense', {}))} fields - {list(sample.get('defense', {}).keys())}")
            print(f"  EPA: {sample.get('epa')}")
            print(f"  FPI: {sample.get('fpi')}")
    else:
        print(str(OUT_PATH))
    
    return 0


if __name__ == "__main__":
    raise SystemExit(main())