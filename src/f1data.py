import fastf1
import pandas as pd
import json
import os

os.makedirs('f1_cache', exist_ok=True)
fastf1.Cache.enable_cache('f1_cache')

YEAR = 2025
OUT_PATH = os.path.join(r"D:\Personal Projects\SportsAppV2\src", "driver_standings_2025.json")

schedule = fastf1.get_event_schedule(YEAR)
completed = schedule[schedule['EventDate'] < pd.Timestamp.now()]
completed = completed[completed['RoundNumber'] > 0]

if completed.empty:
    print(f"No completed races in {YEAR}")
    raise SystemExit(0)

completed_rounds = set(completed['RoundNumber'].tolist())

# Load existing JSON if present
if os.path.exists(OUT_PATH):
    with open(OUT_PATH, 'r', encoding='utf-8') as f:
        existing_data = json.load(f)
    last_meta = existing_data[-1] if isinstance(existing_data[-1], dict) and '_processed_rounds' in existing_data[-1] else {}
    processed_rounds = set(last_meta.get('_processed_rounds', []))
    new_rounds = completed_rounds - processed_rounds
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
    processed_rounds = set()
    new_rounds = completed_rounds
    driver_totals = {}

if not new_rounds:
    print(f"✓ All {len(completed_rounds)} races already processed (processed rounds: {sorted(processed_rounds)})")
    raise SystemExit(0)

print(f"Processing new rounds: {sorted(new_rounds)}")


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


# Process new rounds
for rn in sorted(new_rounds):
    race_row = completed[completed['RoundNumber'] == rn].iloc[0]
    print(f"Loading Round {rn}: {race_row['EventName']} ({race_row['EventDate'].date()})")

    try:
        session_r = fastf1.get_session(YEAR, rn, 'R')
        session_r.load()
        print("  -> Loaded race session")
        driver_totals = add_session_points(session_r, driver_totals)
    except Exception as e:
        print(f"  ⚠ Could not load race session for round {rn}: {e}")

    try:
        session_s = fastf1.get_session(YEAR, rn, 'S')
        session_s.load()
        print("  -> Loaded sprint session")
        driver_totals = add_session_points(session_s, driver_totals)
    except Exception:
        pass

# Build final list
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

with open(OUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(driver_stats, f, indent=2, ensure_ascii=False)

print(f"✓ Saved season standings to {OUT_PATH}")
print("Top 10:")
for d in driver_stats[:-1][:10]:
    print(f"P{d['position']:2d}. {d['driver'][:22]:22s} {d['points']:6.1f} pts | Wins: {d['wins']:2d} | Podiums: {d['podiums']:2d}")
