import fastf1
import pandas as pd
import json
import os

os.makedirs('f1_cache', exist_ok=True)
fastf1.Cache.enable_cache('f1_cache')

YEAR = 2025
STANDINGS_PATH = os.path.join(r"D:\Personal Projects\SportsAppV2\src", "driver_standings_2025.json")
RACE_RESULTS_PATH = os.path.join(r"D:\Personal Projects\SportsAppV2\src", "race_results_2025.json")

schedule = fastf1.get_event_schedule(YEAR)
completed = schedule[schedule['EventDate'] < pd.Timestamp.now()]
completed = completed[completed['RoundNumber'] > 0]

if completed.empty:
    print(f"No completed races in {YEAR}")
    raise SystemExit(0)

completed_rounds = set(completed['RoundNumber'].tolist())

# Load existing standings JSON
if os.path.exists(STANDINGS_PATH):
    with open(STANDINGS_PATH, 'r', encoding='utf-8') as f:
        existing_data = json.load(f)
    last_meta = existing_data[-1] if isinstance(existing_data[-1], dict) and '_processed_rounds' in existing_data[-1] else {}
    processed_rounds_standings = set(last_meta.get('_processed_rounds', []))
    driver_totals = {
        d['code']: {
            'driver': d['driver'],
            'team': d['team'],
            'points': float(d['points']),
            'wins': d.get('wins', 0),
            'podiums': d.get('podiums', 0),
            'races': d.get('races', 0),
            'nationality': d.get('nationality', 'UNK')
        }
        for d in existing_data if isinstance(d, dict) and 'code' in d
    }
else:
    processed_rounds_standings = set()
    driver_totals = {}

# Load existing race results JSON
if os.path.exists(RACE_RESULTS_PATH):
    with open(RACE_RESULTS_PATH, 'r', encoding='utf-8') as f:
        race_results_data = json.load(f)
    # Get processed rounds from race results
    processed_rounds_races = set(r['round'] for r in race_results_data if isinstance(r, dict) and 'round' in r)
else:
    race_results_data = []
    processed_rounds_races = set()

# Find new rounds that need processing
new_rounds_standings = completed_rounds - processed_rounds_standings
new_rounds_races = completed_rounds - processed_rounds_races

# Determine what needs updating
needs_standings_update = bool(new_rounds_standings)
needs_races_update = bool(new_rounds_races)

if not needs_standings_update and not needs_races_update:
    #print(f"[OK] All {len(completed_rounds)} races already processed")
    #print(f"  Standings processed rounds: {sorted(processed_rounds_standings)}")
    #print(f"  Race results processed rounds: {sorted(processed_rounds_races)}")
    #print(f"[OK] Saved F1 stats to {STANDINGS_PATH} and {RACE_RESULTS_PATH}")
    print("[OK] F1 Data is up to date")
    raise SystemExit(0)

if needs_standings_update:
    print(f"Processing new rounds for standings: {sorted(new_rounds_standings)}")
if needs_races_update:
    print(f"Processing new rounds for race results: {sorted(new_rounds_races)}")

# Process all new rounds (union of both)
new_rounds = new_rounds_standings | new_rounds_races


def add_session_points(session, driver_totals, debug=False):
    results = session.results

    if debug:
        print("  Columns in results:", results.columns.tolist())
        print("  Sample:", results.head(3).to_dict(orient='records'))

    # Identify columns
    points_col = next((c for c in ['Points', 'points', 'Pts'] if c in results.columns), None)
    name_col = next((c for c in ['FullName', 'Driver', 'DriverName'] if c in results.columns), None)
    team_col = next((c for c in ['TeamName', 'Team'] if c in results.columns), None)
    nationality_col = next((c for c in ['CountryCode', 'Country', 'Nationality'] if c in results.columns), None)

    if not points_col:
        raise RuntimeError("Could not find points column")

    for idx, row in results.iterrows():
        code = row.get('Abbreviation') or str(row.get('Number') or idx)
        name = row.get(name_col) if name_col else str(row.get('Driver') or code)
        team = row.get(team_col) if team_col else "Unknown"
        nationality = row.get(nationality_col) if nationality_col else "UNK"
        pts = float(row.get(points_col, 0) or 0)
        position = int(row.get('Position', 0) or 0)

        # Initialize driver if not already tracked
        if code not in driver_totals:
            driver_totals[code] = {
                'driver': name,
                'team': team,
                'points': 0.0,
                'wins': 0,
                'podiums': 0,
                'races': 0,
                'nationality': nationality
            }

        # Update stats
        d = driver_totals[code]
        d['points'] += pts
        d['races'] += 1
        if position == 1:
            d['wins'] += 1
            d['podiums'] += 1
        elif 1 < position <= 3:
            d['podiums'] += 1

    return driver_totals


def get_fastest_lap_time(session, driver_abbreviation):
    """Get the fastest lap time for a specific driver"""
    try:
        # Get all laps for this driver
        driver_laps = session.laps.pick_driver(driver_abbreviation)
        
        if driver_laps.empty:
            return None
        
        # Get fastest lap
        fastest_lap = driver_laps.pick_fastest()
        
        if fastest_lap is None or fastest_lap.empty:
            return None
        
        # Get lap time
        lap_time = fastest_lap['LapTime']
        
        if pd.isna(lap_time):
            return None
        
        # Convert timedelta to string format (e.g., "1:23.456")
        total_seconds = lap_time.total_seconds()
        minutes = int(total_seconds // 60)
        seconds = total_seconds % 60
        
        return f"{minutes}:{seconds:06.3f}"
        
    except Exception as e:
        return None


def extract_race_results(session, round_number, event_name, circuit_name, country, event_date, session_type='Race'):
    """Extract detailed race results for all drivers in a race"""
    results = session.results
    driver_results = []
    
    # Identify columns
    points_col = next((c for c in ['Points', 'points', 'Pts'] if c in results.columns), None)
    name_col = next((c for c in ['FullName', 'Driver', 'DriverName'] if c in results.columns), None)
    team_col = next((c for c in ['TeamName', 'Team'] if c in results.columns), None)
    nationality_col = next((c for c in ['CountryCode', 'Country', 'Nationality'] if c in results.columns), None)
    
    print(f"    -> Processing {len(results)} drivers...")
    
    for idx, row in results.iterrows():
        code = row.get('Abbreviation') or str(row.get('Number') or idx)
        name = row.get(name_col) if name_col else str(row.get('Driver') or code)
        team = row.get(team_col) if team_col else "Unknown"
        nationality = row.get(nationality_col) if nationality_col else "UNK"
        pts = float(row.get(points_col, 0) or 0)
        position = int(row.get('Position', 0) or 0)
        grid_position = int(row.get('GridPosition', 0) or 0)
        status = str(row.get('Status', 'Unknown'))
        
        # Get race time
        time_str = str(row.get('Time', ''))
        if pd.isna(row.get('Time')) or time_str == 'NaT':
            time_str = ''
        
        # Get fastest lap time
        print(f"      -> Getting fastest lap for {name} ({code})...")
        fastest_lap = get_fastest_lap_time(session, code)
        
        driver_results.append({
            'driver_code': code,
            'driver_name': name,
            'team': team,
            'nationality': nationality,
            'position': position,
            'grid_position': grid_position,
            'points': pts,
            'status': status,
            'race_time': time_str,
            'fastest_lap': fastest_lap if fastest_lap else 'N/A'
        })
    
    # Sort by position
    driver_results.sort(key=lambda x: x['position'] if x['position'] > 0 else 999)
    
    return {
        'round': round_number,
        'event_name': event_name,
        'circuit_name': circuit_name,
        'country': country,
        'date': event_date,
        'session_type': session_type,
        'drivers': driver_results
    }


# Process new rounds
for rn in sorted(new_rounds):
    race_row = completed[completed['RoundNumber'] == rn].iloc[0]
    event_name = race_row['EventName']
    circuit_name = race_row.get('Location', 'Unknown')
    country = race_row.get('Country', 'Unknown')
    event_date = race_row['EventDate'].strftime('%Y-%m-%d')
    
    print(f"\nLoading Round {rn}: {event_name} ({event_date})")

    # Process main race
    try:
        session_r = fastf1.get_session(YEAR, rn, 'R')
        session_r.load()
        print("  -> Loaded race session")
        
        # Update standings if needed
        if rn in new_rounds_standings:
            driver_totals = add_session_points(session_r, driver_totals)
        
        # Extract race results if needed
        if rn in new_rounds_races:
            print("  -> Extracting race results and fastest laps...")
            race_result = extract_race_results(
                session_r, rn, event_name, circuit_name, country, event_date, 'Race'
            )
            race_results_data.append(race_result)
        
    except Exception as e:
        print(f"  ⚠ Could not load race session for round {rn}: {e}")
        import traceback
        traceback.print_exc()

    # Process sprint if exists
    try:
        session_s = fastf1.get_session(YEAR, rn, 'S')
        session_s.load()
        print("  -> Loaded sprint session")
        
        # Update standings if needed
        if rn in new_rounds_standings:
            driver_totals = add_session_points(session_s, driver_totals)
        
        # Extract sprint results if needed
        if rn in new_rounds_races:
            print("  -> Extracting sprint results and fastest laps...")
            sprint_result = extract_race_results(
                session_s, rn, event_name, circuit_name, country, event_date, 'Sprint'
            )
            race_results_data.append(sprint_result)
        
    except Exception:
        pass

# Sort race results by round and session type
race_results_data.sort(key=lambda x: (x['round'], x['session_type']))

# Build final standings list if updated
if needs_standings_update:
    driver_stats = []
    for code, data in driver_totals.items():
        total_races = max(1, data['races'])
        podium_pct = round((data['podiums'] / total_races) * 100, 1)
        driver_stats.append({
            'position': 0,
            'code': code,
            'driver': data['driver'],
            'team': data['team'],
            'nationality': data['nationality'],
            'points': round(data['points'], 1),
            'wins': data['wins'],
            'podiums': data['podiums'],
            'podium_pct': podium_pct
        })

    driver_stats.sort(key=lambda x: x['points'], reverse=True)
    for i, d in enumerate(driver_stats):
        d['position'] = i + 1

    driver_stats.append({'_processed_rounds': sorted(list(completed_rounds))})

    # Save standings
    with open(STANDINGS_PATH, 'w', encoding='utf-8') as f:
        json.dump(driver_stats, f, indent=2, ensure_ascii=False)
    print(f"\n[OK] Saved season standings to {STANDINGS_PATH}")

# Save race results if updated
if needs_races_update:
    with open(RACE_RESULTS_PATH, 'w', encoding='utf-8') as f:
        json.dump(race_results_data, f, indent=2, ensure_ascii=False)
    print(f"[OK] Saved race results to {RACE_RESULTS_PATH}")

# Print top 10
if needs_standings_update:
    print("\nTop 10:")
    for d in driver_stats[:-1][:10]:
        print(f"P{d['position']:2d}. {d['driver'][:22]:22s} {d['points']:6.1f} pts | Wins: {d['wins']:2d} | Podiums: {d['podiums']:2d}")