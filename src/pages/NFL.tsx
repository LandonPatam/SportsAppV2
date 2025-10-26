import React, { useState, useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sun, Moon } from 'lucide-react';
import nflTeamData from '../nfl_team_stats.json';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';


/* ============================================================================
 * TYPE DEFINITIONS
 * ============================================================================ */

interface NFLTeam {
  name: string;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  ties: number;
  win_pct: number;
  points_for: number;
  points_against: number;
  point_diff: number;
  mov: number; // Margin of Victory
}

/* ============================================================================
 * TEAM COLORS CONFIGURATION
 * NFL team primary and secondary colors for badges
 * ============================================================================ */

const teamColors: Record<string, { primary: string; secondary: string }> = {
  'Buffalo Bills': { primary: '#00338D', secondary: '#C60C30' },
  'Miami Dolphins': { primary: '#008E97', secondary: '#FC4C02' },
  'New England Patriots': { primary: '#002244', secondary: '#C60C30' },
  'New York Jets': { primary: '#125740', secondary: '#FFFFFF' },
  'Baltimore Ravens': { primary: '#241773', secondary: '#9E7C0C' },
  'Cincinnati Bengals': { primary: '#FB4F14', secondary: '#000000' },
  'Cleveland Browns': { primary: '#311D00', secondary: '#FF3C00' },
  'Pittsburgh Steelers': { primary: '#FFB612', secondary: '#101820' },
  'Houston Texans': { primary: '#03202F', secondary: '#A71930' },
  'Indianapolis Colts': { primary: '#002C5F', secondary: '#A2AAAD' },
  'Jacksonville Jaguars': { primary: '#006778', secondary: '#D7A22A' },
  'Tennessee Titans': { primary: '#4B92DB', secondary: '#C8102E' },
  'Denver Broncos': { primary: '#FB4F14', secondary: '#002244' },
  'Kansas City Chiefs': { primary: '#E31837', secondary: '#FFB81C' },
  'Las Vegas Raiders': { primary: '#000000', secondary: '#A5ACAF' },
  'Los Angeles Chargers': { primary: '#002A5E', secondary: '#FFC20E' },
  'Dallas Cowboys': { primary: '#041E42', secondary: '#869397' },
  'New York Giants': { primary: '#0B2265', secondary: '#A71930' },
  'Philadelphia Eagles': { primary: '#004C54', secondary: '#A5ACAF' },
  'Washington Commanders': { primary: '#5A1414', secondary: '#FFB612' },
  'Chicago Bears': { primary: '#0B162A', secondary: '#C83803' },
  'Detroit Lions': { primary: '#0076B6', secondary: '#B0B7BC' },
  'Green Bay Packers': { primary: '#203731', secondary: '#FFB612' },
  'Minnesota Vikings': { primary: '#4F2683', secondary: '#FFC62F' },
  'Atlanta Falcons': { primary: '#A71930', secondary: '#000000' },
  'Carolina Panthers': { primary: '#0085CA', secondary: '#101820' },
  'New Orleans Saints': { primary: '#D3BC8D', secondary: '#101820' },
  'Tampa Bay Buccaneers': { primary: '#D50A0A', secondary: '#FF7900' },
  'Arizona Cardinals': { primary: '#97233F', secondary: '#000000' },
  'Los Angeles Rams': { primary: '#003594', secondary: '#FFA300' },
  'San Francisco 49ers': { primary: '#AA0000', secondary: '#B3995D' },
  'Seattle Seahawks': { primary: '#002244', secondary: '#69BE28' },
};

/* ============================================================================
 * TEAM ABBREVIATIONS
 * Mapping of full team names to their standard abbreviations
 * ============================================================================ */

const teamAbbreviations: Record<string, string> = {
  'Buffalo Bills': 'BUF',
  'Miami Dolphins': 'MIA',
  'New England Patriots': 'NE',
  'New York Jets': 'NYJ',
  'Baltimore Ravens': 'BAL',
  'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE',
  'Pittsburgh Steelers': 'PIT',
  'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND',
  'Jacksonville Jaguars': 'JAX',
  'Tennessee Titans': 'TEN',
  'Denver Broncos': 'DEN',
  'Kansas City Chiefs': 'KC',
  'Las Vegas Raiders': 'LV',
  'Los Angeles Chargers': 'LAC',
  'Dallas Cowboys': 'DAL',
  'New York Giants': 'NYG',
  'Philadelphia Eagles': 'PHI',
  'Washington Commanders': 'WAS',
  'Chicago Bears': 'CHI',
  'Detroit Lions': 'DET',
  'Green Bay Packers': 'GB',
  'Minnesota Vikings': 'MIN',
  'Atlanta Falcons': 'ATL',
  'Carolina Panthers': 'CAR',
  'New Orleans Saints': 'NO',
  'Tampa Bay Buccaneers': 'TB',
  'Arizona Cardinals': 'ARI',
  'Los Angeles Rams': 'LAR',
  'San Francisco 49ers': 'SF',
  'Seattle Seahawks': 'SEA',
};

/* ============================================================================
 * DARK MODE TOGGLE COMPONENT
 * Allows users to switch between light and dark themes
 * ============================================================================ */

const DarkModeToggle = () => {
  const [darkMode, setDarkMode] = useState(false);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored === 'dark' || (!stored && prefersDark);
    setDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  // Toggle theme and persist to localStorage
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggleDarkMode}
      className="p-2 rounded-md transition-all duration-200 hover:bg-accent flex items-center justify-center"
      title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {darkMode ? (
        <Sun className="w-5 h-5 text-yellow-400" />
      ) : (
        <Moon className="w-5 h-5 text-blue-400" />
      )}
    </button>
  );
};


// Small helper for labeled stats with hover tooltips
const statDescriptions: Record<string, string> = {
  'Win %': 'Team win percentage',
  'Points For (PF)': 'Total points scored by the team',
  'Points Against (PA)': 'Total points allowed by the team',
  'Point Diff (PD)': 'Point differential (points for - points against)',
  MoV: 'Average margin of victory per game',
  PPG: 'Points per game scored by the team',
};

const StatRow = ({ label, value }: { label: string; value: string | number }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex justify-between text-sm cursor-help">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-semibold">{value}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" align="center">
        <p>{statDescriptions[label] || 'Stat description unavailable'}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);


/* ============================================================================
 * TEAM CARD COMPONENT
 * Displays individual NFL team statistics and record
 * ============================================================================ */




const TeamCard = ({ team }: { team: NFLTeam }) => {
  const totalGames = team.wins + team.losses + team.ties;
  const teamColor = teamColors[team.name];
  const teamAbbr = teamAbbreviations[team.name] || '';

  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            {/* Team name */}
            <CardTitle className="text-lg font-bold">{team.name}</CardTitle>

            {/* Team abbreviation badge with team colors */}
            <Badge
              className="text-xs font-semibold border mt-1"
              style={{
                backgroundColor: teamColor?.primary || '#555',
                color: teamColor?.secondary || '#fff',
                borderColor: teamColor?.secondary || '#fff',
                borderWidth: '2px',
                padding: '0.25rem 0.55rem',
                borderRadius: '0.4rem',
                letterSpacing: '0.5px',
              }}
            >
              {teamAbbr}
            </Badge>
          </div>

          {/* Win-Loss record badge */}
          <Badge
            className={`${
              team.win_pct >= 0.5
                ? 'bg-blue-500 text-white hover:bg-blue-700'
                : 'bg-gray-800 text-white hover:bg-red-700'
            }`}
          >
            {team.wins}-{team.losses}
            {team.ties > 0 ? `-${team.ties}` : ''}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {/* Team statistics grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Left column stats */}
          <div className="space-y-2">
            <StatRow label="Win %" value={`${(team.win_pct * 100).toFixed(1)}%`} />
            <StatRow label="Points For (PF)" value={team.points_for} />
            <StatRow label="Points Against (PA)" value={team.points_against} />
          </div>

          {/* Right column stats */}
          <div className="space-y-2">
            <StatRow
              label="Point Diff (PD)"
              value={`${team.point_diff >= 0 ? '+' : ''}${team.point_diff}`}
              //highlight={team.point_diff >= 0}
            />
            <StatRow
              label="MoV"
              value={`${team.mov >= 0 ? '+' : ''}${team.mov.toFixed(1)}`}
              //highlight={team.mov >= 0}
            />
            <StatRow
              label="PPG"
              value={
                totalGames > 0
                  ? (team.points_for / totalGames).toFixed(1)
                  : '0.0'
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/* ============================================================================
 * MAIN NFL COMPONENT
 * ============================================================================ */

const NFL = () => {
  const [teams, setTeams] = useState<NFLTeam[]>([]);

  // Load team data on mount
  useEffect(() => {
    setTeams(nflTeamData);
  }, []);

  /**
   * Sorts teams by win percentage, then wins, then point differential
   */
  const sortTeamsByRecord = (teams: NFLTeam[]) => {
    return [...teams].sort((a, b) => {
      if (b.win_pct !== a.win_pct) return b.win_pct - a.win_pct;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.point_diff - a.point_diff;
    });
  };

  return (
    <PageLayout title="NFL Teams & Standings - 2024-25 Season">
      {/* Dark mode toggle */}
      <div className="flex justify-end">
        <DarkModeToggle />
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
          <TabsTrigger value="all">All Teams</TabsTrigger>
          <TabsTrigger value="AFC">AFC</TabsTrigger>
          <TabsTrigger value="NFC">NFC</TabsTrigger>
        </TabsList>

        {/* All Teams Tab - Ranked by record */}
        <TabsContent value="all">
          <h2 className="text-2xl font-bold mb-4">All Teams (Ranked)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {sortTeamsByRecord(teams).map((team, index) => (
              <TeamCard key={team.name} team={{ ...team, rank: index + 1 }} />
            ))}
          </div>
        </TabsContent>

        {/* AFC and NFC Conference Tabs */}
        {['AFC', 'NFC'].map((conference) => (
          <TabsContent key={conference} value={conference} className="space-y-8">
            <h2 className="text-2xl font-bold mb-4">{conference}</h2>
            
            {/* Render each division within the conference */}
            {['East', 'North', 'South', 'West'].map((division) => {
              const divisionTeams = teams
                .filter((team) => team.conference === conference)
                .filter((team) => team.division.endsWith(division))
                .sort((a, b) => b.wins - a.wins);

              if (divisionTeams.length === 0) return null;

              return (
                <div key={`${conference}-${division}`} className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
                    {conference} {division}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {divisionTeams.map((team) => (
                      <TeamCard key={team.name} team={team} />
                    ))}
                  </div>
                </div>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
    </PageLayout>
  );
};

export default NFL;