import pandas as pd
import json

url = "https://www.pro-football-reference.com/years/2025/"

# Table IDs to scrape
table_ids = ["NFC", "AFC"]

# Division mappings
division_map = {
    "NFC": {
        "NFC East": ["Philadelphia Eagles","Dallas Cowboys","Washington Commanders","New York Giants"],
        "NFC North": ["Green Bay Packers","Detroit Lions","Chicago Bears","Minnesota Vikings"],
        "NFC South": ["Tampa Bay Buccaneers","Carolina Panthers","Atlanta Falcons","New Orleans Saints"],
        "NFC West": ["Los Angeles Rams","Seattle Seahawks","San Francisco 49ers","Arizona Cardinals"]
    },
    "AFC": {
        "AFC East": ["Buffalo Bills","Miami Dolphins","New England Patriots","New York Jets"],
        "AFC North": ["Baltimore Ravens","Cincinnati Bengals","Cleveland Browns","Pittsburgh Steelers"],
        "AFC South": ["Houston Texans","Indianapolis Colts","Jacksonville Jaguars","Tennessee Titans"],
        "AFC West": ["Denver Broncos","Kansas City Chiefs","Las Vegas Raiders","Los Angeles Chargers"]
    }
}

# Collect all teams
all_teams = []

for table_id in table_ids:
    tm_df = pd.read_html(url, header=0, attrs={'id': table_id})[0]

    # Determine division names for this conference
    divisions = list(division_map[table_id].keys())

    # Keep only the team rows
    df_filtered = tm_df[~tm_df["Tm"].isin(divisions)]

    # Rename columns
    df_filtered = df_filtered.rename(columns={
        "Tm": "name",
        "W": "wins",
        "L": "losses",
        "T": "ties",
        "PF": "points_for",
        "PA": "points_against",
        "PD": "point_diff",
        "MoV": "mov"
    })

    # Convert numeric columns
    numeric_cols = ["wins", "losses", "ties", "points_for", "points_against", "point_diff", "mov"]
    for col in numeric_cols:
        df_filtered[col] = pd.to_numeric(df_filtered[col], errors='coerce').fillna(0)

    # Add conference
    df_filtered["conference"] = table_id

    # Add division
    def get_division(team_name):
        for div, teams in division_map[table_id].items():
            if team_name in teams:
                return div
        return "Unknown"
    df_filtered["division"] = df_filtered["name"].apply(get_division)

    # Calculate Win % (as a float)
    df_filtered["win_pct"] = df_filtered["wins"] / (df_filtered["wins"] + df_filtered["losses"] + df_filtered["ties"])

    # Keep only needed columns
    df_filtered = df_filtered[[
        "name","conference","division","wins","losses","ties",
        "win_pct","points_for","points_against","point_diff","mov"
    ]]

    # Add to all_teams list
    all_teams.append(df_filtered)

# Combine NFC and AFC
final_df = pd.concat(all_teams, ignore_index=True)

# Convert to JSON
json_data = final_df.to_dict(orient="records")

out_path = r"D:\Personal Projects\SportsAppV2\src\nfl_team_stats.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(json_data, f, indent=4)
    
print(f"[OK] NFL Data up to date")
#print(json.dumps(json_data, indent=4))
