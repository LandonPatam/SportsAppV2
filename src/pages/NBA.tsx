// ============================
// 🏀 NBA Dashboard
// Displays NBA team standings and top player stats
// ============================

import React, { useState, useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { X, Sun, Moon } from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// Static JSON imports
import nbaData from '../nba_team_stats.json';
import nbaPlayerData from '../nba_player_stats.json';
import playerValues from '../nba_player_values.json';

// ============================
// 📘 Type Definitions
// ============================

interface NBATeam {
  TEAM_ID: number;
  TEAM_NAME: string;
  GP: number;
  W: number;
  L: number;
  WIN_PCT: number;
  PTS: number;
  REB: number;
  AST: number;
  FG_PCT: number;
  FG3_PCT: number;
  FT_PCT: number;
  conference?: string;
  division?: string;
}

interface Player {
  PLAYER_ID: number;
  PLAYER_NAME: string;
  TEAM_ID: number;
  TEAM_ABBREVIATION: string;
  JERSEY_NUMBER: string;
  GP: number;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  STL: number;
  BLK: number;
  TOV: number;
  FG_PCT: number;
  FG3_PCT: number;
  FT_PCT: number;
  FGA: number;
  FG3A: number;
  FTA: number;
  OFF_RATING?: number;
  DEF_RATING?: number;
  NET_RATING?: number;
  VALUE_SCORE?: number;
  HYBRID_SCORE?: number;
}

// ============================
// 🗂️ Team Conference + Division Mapping
// ============================

const teamConferences: Record<string, { conference: string; division: string }> = {
  'Oklahoma City Thunder': { conference: 'Western', division: 'Northwest' },
  'Cleveland Cavaliers': { conference: 'Eastern', division: 'Central' },
  'Boston Celtics': { conference: 'Eastern', division: 'Atlantic' },
  'Houston Rockets': { conference: 'Western', division: 'Southwest' },
  'New York Knicks': { conference: 'Eastern', division: 'Atlantic' },
  'LA Clippers': { conference: 'Western', division: 'Pacific' },
  'Los Angeles Lakers': { conference: 'Western', division: 'Pacific' },
  'Indiana Pacers': { conference: 'Eastern', division: 'Central' },
  'Denver Nuggets': { conference: 'Western', division: 'Northwest' },
  'Minnesota Timberwolves': { conference: 'Western', division: 'Northwest' },
  'Memphis Grizzlies': { conference: 'Western', division: 'Southwest' },
  'Golden State Warriors': { conference: 'Western', division: 'Pacific' },
  'Milwaukee Bucks': { conference: 'Eastern', division: 'Central' },
  'Detroit Pistons': { conference: 'Eastern', division: 'Central' },
  'Orlando Magic': { conference: 'Eastern', division: 'Southeast' },
  'Atlanta Hawks': { conference: 'Eastern', division: 'Southeast' },
  'Sacramento Kings': { conference: 'Western', division: 'Pacific' },
  'Chicago Bulls': { conference: 'Eastern', division: 'Central' },
  'Dallas Mavericks': { conference: 'Western', division: 'Southwest' },
  'Miami Heat': { conference: 'Eastern', division: 'Southeast' },
  'Portland Trail Blazers': { conference: 'Western', division: 'Northwest' },
  'Phoenix Suns': { conference: 'Western', division: 'Pacific' },
  'San Antonio Spurs': { conference: 'Western', division: 'Southwest' },
  'Toronto Raptors': { conference: 'Eastern', division: 'Atlantic' },
  'Brooklyn Nets': { conference: 'Eastern', division: 'Atlantic' },
  'Philadelphia 76ers': { conference: 'Eastern', division: 'Atlantic' },
  'New Orleans Pelicans': { conference: 'Western', division: 'Southwest' },
  'Charlotte Hornets': { conference: 'Eastern', division: 'Southeast' },
  'Washington Wizards': { conference: 'Eastern', division: 'Southeast' },
  'Utah Jazz': { conference: 'Western', division: 'Northwest' },
};

// ============================
// 🎨 Team Color Definitions
// ============================

const teamColors: Record<string, { primary: string; secondary: string }> = {
  ATL: { primary: '#E03A3E', secondary: '#C1D32F' },
  BOS: { primary: '#007A33', secondary: '#BA9653' },
  BKN: { primary: '#000000', secondary: '#FFFFFF' },
  CHA: { primary: '#1D1160', secondary: '#00788C' },
  CHI: { primary: '#CE1141', secondary: '#000000' },
  CLE: { primary: '#6F263D', secondary: '#FFB81C' },
  DAL: { primary: '#00538C', secondary: '#002B5E' },
  DEN: { primary: '#0E2240', secondary: '#FEC524' },
  DET: { primary: '#C8102E', secondary: '#006BB6' },
  GSW: { primary: '#1D428A', secondary: '#FFC72C' },
  HOU: { primary: '#CE1141', secondary: '#C4CED4' },
  IND: { primary: '#002D62', secondary: '#FDBB30' },
  LAC: { primary: '#C8102E', secondary: '#1D428A' },
  LAL: { primary: '#552583', secondary: '#FDB927' },
  MEM: { primary: '#5D76A9', secondary: '#12173F' },
  MIA: { primary: '#98002E', secondary: '#F9A01B' },
  MIL: { primary: '#00471B', secondary: '#EDC87F' },
  MIN: { primary: '#0C2340', secondary: '#236192' },
  NOP: { primary: '#0C2340', secondary: '#C8102E' },
  NYK: { primary: '#006BB6', secondary: '#F58426' },
  OKC: { primary: '#007AC1', secondary: '#EF3B24' },
  ORL: { primary: '#0077C0', secondary: '#C4CED4' },
  PHI: { primary: '#006BB6', secondary: '#ED174C' },
  PHX: { primary: '#1D1160', secondary: '#E56020' },
  POR: { primary: '#E03A3E', secondary: '#000000' },
  SAC: { primary: '#5A2D81', secondary: '#63727A' },
  SAS: { primary: '#C4CED4', secondary: '#000000' },
  TOR: { primary: '#CE1141', secondary: '#000000' },
  UTA: { primary: '#002B5C', secondary: '#F9A01B' },
  WAS: { primary: '#002B5C', secondary: '#E31837' },
};

// ============================
// 🏷️ Team Name → Abbreviation Mapping
// ============================

const teamAbbreviations: Record<string, string> = {
  'Atlanta Hawks': 'ATL',
  'Boston Celtics': 'BOS',
  'Brooklyn Nets': 'BKN',
  'Charlotte Hornets': 'CHA',
  'Chicago Bulls': 'CHI',
  'Cleveland Cavaliers': 'CLE',
  'Dallas Mavericks': 'DAL',
  'Denver Nuggets': 'DEN',
  'Detroit Pistons': 'DET',
  'Golden State Warriors': 'GSW',
  'Houston Rockets': 'HOU',
  'Indiana Pacers': 'IND',
  'LA Clippers': 'LAC',
  'Los Angeles Lakers': 'LAL',
  'Memphis Grizzlies': 'MEM',
  'Miami Heat': 'MIA',
  'Milwaukee Bucks': 'MIL',
  'Minnesota Timberwolves': 'MIN',
  'New Orleans Pelicans': 'NOP',
  'New York Knicks': 'NYK',
  'Oklahoma City Thunder': 'OKC',
  'Orlando Magic': 'ORL',
  'Philadelphia 76ers': 'PHI',
  'Phoenix Suns': 'PHX',
  'Portland Trail Blazers': 'POR',
  'Sacramento Kings': 'SAC',
  'San Antonio Spurs': 'SAS',
  'Toronto Raptors': 'TOR',
  'Utah Jazz': 'UTA',
  'Washington Wizards': 'WAS',
};




// ============================
// 🧍 PlayerCard Component
// Displays individual player stats
// ============================

const PlayerCard = ({ player, index }: { player: Player; index: number }) => (
  <Card
    className="overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm"
    style={{ animation: `slideUp 0.4s ease-out ${index * 0.05}s both` }}
  >
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between">
        <div>
          <CardTitle className="text-lg font-bold">{player.PLAYER_NAME}</CardTitle>

          {/* Team badge with team colors */}
          <Badge
            className="text-xs font-semibold border mt-1"
            style={{
              color: teamColors[player.TEAM_ABBREVIATION]?.secondary,
              backgroundColor: teamColors[player.TEAM_ABBREVIATION]?.primary || '#fff',
              borderColor: teamColors[player.TEAM_ABBREVIATION]?.secondary || '#888',
              borderWidth: '2px',
              padding: '0.25rem 0.55rem',
              borderRadius: '0.4rem',
              letterSpacing: '0.5px',
            }}
          >
            {player.TEAM_ABBREVIATION}
          </Badge>
        </div>

        <Badge variant="outline">#{player.JERSEY_NUMBER}</Badge>
      </div>
    </CardHeader>

    <CardContent>
      {/* Player stats grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <StatRow label="PPG" value={player.PTS.toFixed(1)} />
          <StatRow label="RPG" value={player.REB.toFixed(1)} />
          <StatRow label="APG" value={player.AST.toFixed(1)} />
          <StatRow label="STL" value={player.STL.toFixed(1)} />
        </div>
        <div className="space-y-2">
          <StatRow label="FG%" value={(player.FG_PCT * 100).toFixed(1) + '%'} />
          <StatRow label="3P%" value={(player.FG3_PCT * 100).toFixed(1) + '%'} />
          <StatRow label="FT%" value={(player.FT_PCT * 100).toFixed(1) + '%'} />
          <StatRow label="BLK" value={player.BLK.toFixed(1)} />
        </div>
      </div>
    </CardContent>
  </Card>
);

// Small helper component for consistent stat layout
const statDescriptions: Record<string, string> = {
  GP: 'Games played',
  MIN: 'Minutes per game',
  PTS: 'Points per game',
  REB: 'Rebounds per game',
  AST: 'Assists per game',
  STL: 'Steals per game',
  BLK: 'Blocks per game',
  TOV: 'Turnovers per game',
  FG_PCT: 'Field goal percentage',
  FG3_PCT: 'Three-point field goal percentage',
  FT_PCT: 'Free throw percentage',
  FGA: 'Field goal attempts per game',
  FG3A: 'Three-point attempts per game',
  FTA: 'Free throw attempts per game',
  "3PA": 'Three-point attempts per game',
  "FG%": 'Field goal percentage',
  "3P%": 'Three-point percentage',
  "FT%": 'Free throw percentage per game',
  APG: 'Assist per game',
  RPG: 'Rebounds per game',
  "Win %": 'Win percentage',
  "PPG": 'Points per game',
  "OFF": 'Offensive rating',
  "DEF": 'Defensive rating'

};


const StatRow = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: 'high' | 'low' | 'neutral';
}) => {
  const colorClass =
    highlight === 'high'
      ? 'text-green-400 font-semibold'
      : highlight === 'low'
      ? 'text-red-400 font-semibold'
      : 'text-foreground';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 text-sm cursor-help">
            <span className="text-muted-foreground w-12">{label}</span>
            <span className={`${colorClass}`}>{value}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          <p>{statDescriptions[label] || 'Stat description unavailable'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};




// ============================
// 🧑‍🤝‍🧑 PlayerModal Component
// Displays a team's full roster in a modal
// ============================

const PlayerModal = ({ team, onClose }: { team: NBATeam; onClose: () => void }) => {
  const players: Player[] = nbaPlayerData[team.TEAM_ID.toString()] || [];
  

// 🧮 Compute averages for this specific team
const teamAverages = React.useMemo(() => {
  if (!players.length) return null;

  const totals = players.reduce(
    (acc, p) => {
      acc.GP += p.GP;
      acc.MIN += p.MIN;
      acc.PTS += p.PTS;
      acc.REB += p.REB;
      acc.AST += p.AST;
      acc.STL += p.STL;
      acc.BLK += p.BLK;
      acc.TOV += p.TOV;
      acc.FGA += p.FGA;
      acc.FG3A += p.FG3A;
      acc.FTA += p.FTA;
      acc.FG_PCT += p.FG_PCT;
      acc.FG3_PCT += p.FG3_PCT;
      acc.FT_PCT += p.FT_PCT;
      return acc;
    },
    {
      GP: 0, MIN: 0, PTS: 0, REB: 0, AST: 0, STL: 0, BLK: 0,
      TOV: 0, FGA: 0, FG3A: 0, FTA: 0, FG_PCT: 0, FG3_PCT: 0, FT_PCT: 0
    }
  );

  const n = players.length;
  const avg: any = {};
  for (const key in totals) avg[key] = totals[key] / n;
  return avg as typeof totals;
}, [players]);


  // 🎨 Highlight player stat vs. team average
const getTeamHighlight = (player: Player, key: keyof typeof teamAverages) => {
  if (!teamAverages) return 'neutral';

  const playerValue = Number((player as any)[key]);
  const avgValue = Number((teamAverages as any)[key]);
  if (isNaN(playerValue) || isNaN(avgValue)) return 'neutral';

  const diff = playerValue - avgValue;
  if (Math.abs(diff) < 0.01) return 'neutral';

  // 🟥 Stats where lower is better
  const lowerIsBetter = new Set<keyof typeof teamAverages>(['TOV']);
  if (lowerIsBetter.has(key)) {
    return diff < 0 ? 'high' : 'low';
  }

  return diff > 0 ? 'high' : 'low';
};


  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
      onClick={onClose}
      style={{ animation: 'fadeIn 0.2s ease-out' }}
    >
      <div
        className="relative bg-background rounded-2xl shadow-2xl max-w-6xl w-full max-h-[85vh] overflow-hidden border"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'scaleIn 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-3xl font-bold">{team.TEAM_NAME}</h2>
            <p className="text-muted-foreground mt-1">
              {team.W}-{team.L} • {team.division} Division • {(team.WIN_PCT * 100).toFixed(1)}% Win Rate
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Roster Grid */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
          <h3 className="text-xl font-semibold mb-4">Roster ({players.length} Players)</h3>

          {players.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {players.map((player, index) => (
                <Card
                  key={player.PLAYER_ID}
                  className="overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm"
                  style={{ animation: `slideUp 0.4s ease-out ${index * 0.05}s both` }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg font-bold">{player.PLAYER_NAME}</CardTitle>
                        <Badge
                          className="text-xs font-semibold border mt-1"
                          style={{
                            color: teamColors[player.TEAM_ABBREVIATION]?.secondary,
                            backgroundColor: teamColors[player.TEAM_ABBREVIATION]?.primary || '#fff',
                            borderColor: teamColors[player.TEAM_ABBREVIATION]?.secondary || '#888',
                            borderWidth: '2px',
                            padding: '0.25rem 0.55rem',
                            borderRadius: '0.4rem',
                            letterSpacing: '0.5px',
                          }}
                        >
                          {player.TEAM_ABBREVIATION}
                        </Badge>
                      </div>

                      <Badge variant="outline">#{player.JERSEY_NUMBER}</Badge>
                    </div>
                  </CardHeader>

                  <CardContent>
  <div className="grid grid-cols-2 gap-4">
    {/* Left column */}
    <div className="space-y-2">
      <StatRow label="GP" value={player.GP.toFixed(0)} />
      <StatRow label="MIN" value={player.MIN.toFixed(1)} highlight={getTeamHighlight(player, 'MIN')} />
      <StatRow label="PPG" value={player.PTS.toFixed(1)} highlight={getTeamHighlight(player, 'PTS')} />
      <StatRow label="REB" value={player.REB.toFixed(1)} highlight={getTeamHighlight(player, 'REB')} />
      <StatRow label="AST" value={player.AST.toFixed(1)} highlight={getTeamHighlight(player, 'AST')} />
      <StatRow label="STL" value={player.STL.toFixed(1)} highlight={getTeamHighlight(player, 'STL')} />
      <StatRow label="BLK" value={player.BLK.toFixed(1)} highlight={getTeamHighlight(player, 'BLK')} />
       <StatRow
          label="OFF"
          value={player.OFF_RATING.toFixed(1)}
          highlight={player.OFF_RATING > 110 ? 'high' : player.OFF_RATING < 100 ? 'low' : 'neutral'}
        />       
    </div>

    {/* Right column */}
    <div className="space-y-2">
      <StatRow label="TOV" value={player.TOV.toFixed(1)} highlight={getTeamHighlight(player, 'TOV')} />
      <StatRow label="FGA" value={player.FGA.toFixed(1)} highlight={getTeamHighlight(player, 'FGA')} />
      <StatRow label="FG%" value={`${(player.FG_PCT * 100).toFixed(1)}%`} highlight={getTeamHighlight(player, 'FG_PCT')} />
      <StatRow label="3PA" value={player.FG3A.toFixed(1)} highlight={getTeamHighlight(player, 'FG3A')} />
      <StatRow label="3P%" value={`${(player.FG3_PCT * 100).toFixed(1)}%`} highlight={getTeamHighlight(player, 'FG3_PCT')} />
      <StatRow label="FTA" value={player.FTA.toFixed(1)} highlight={getTeamHighlight(player, 'FTA')} />
      <StatRow label="FT%" value={`${(player.FT_PCT * 100).toFixed(1)}%`} highlight={getTeamHighlight(player, 'FT_PCT')} />
       <StatRow
          label="DEF"
          value={player.DEF_RATING.toFixed(1)}
          highlight={player.DEF_RATING < 110 ? 'high' : player.DEF_RATING > 115 ? 'low' : 'neutral'}
        />                

    </div>
  </div>
</CardContent>

                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No player data available for this team</div>
          )}
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};


// ============================
// 🏆 TeamCard Component
// Displays individual team stats
// ============================

const TeamCard = ({
  team,
  onClick,
  leagueAverages,
}: {
  team: NBATeam;
  onClick?: () => void;
  leagueAverages: any;
}) => {
  const teamAbbr = teamAbbreviations[team.TEAM_NAME] || 'UNK';
  const teamColor = teamColors[teamAbbr];
  const winPercentage = (team.WIN_PCT * 100).toFixed(1);

  // Helper to determine stat color
  const getHighlight = (statKey: keyof typeof leagueAverages) => {
    if (!leagueAverages) return undefined;
    const diff = team[statKey] - leagueAverages[statKey];
    if (Math.abs(diff) < 0.01) return 'neutral';
    return diff > 0 ? 'high' : 'low';
  };

  return (
    <Card
      onClick={onClick}
      className={`overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-bold">{team.TEAM_NAME}</CardTitle>
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
          <Badge variant={team.W > team.L ? 'default' : 'secondary'}>
            {team.W}-{team.L}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {/* 2-column stat grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <StatRow
              label="Win %"
              value={`${winPercentage}%`}
              highlight={getHighlight('WIN_PCT')}
            />
            <StatRow
              label="PPG"
              value={team.PTS.toFixed(1)}
              highlight={getHighlight('PTS')}
            />
            <StatRow
              label="RPG"
              value={team.REB.toFixed(1)}
              highlight={getHighlight('REB')}
            />
            <StatRow
              label="APG"
              value={team.AST.toFixed(1)}
              highlight={getHighlight('AST')}
            />

            
          </div>

          <div className="space-y-2">
            <StatRow
              label="FG%"
              value={`${(team.FG_PCT * 100).toFixed(1)}%`}
              highlight={getHighlight('FG_PCT')}
            />
            <StatRow
              label="3P%"
              value={`${(team.FG3_PCT * 100).toFixed(1)}%`}
              highlight={getHighlight('FG3_PCT')}
            />
            <StatRow
              label="FT%"
              value={`${(team.FT_PCT * 100).toFixed(1)}%`}
              highlight={getHighlight('FT_PCT')}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};



// ============================
// 🌙 DarkModeToggle Component
// Allows switching between light and dark mode
// ============================

const DarkModeToggle = () => {
  const [darkMode, setDarkMode] = useState(false);

  // Load preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored === 'dark' || (!stored && prefersDark);
    setDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  // Toggle handler
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
      {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-blue-400" />}
    </button>
  );
};

// ============================
// 🏀 Main NBA Component
// Displays team standings and top scorers
// ============================






const NBA = () => {
  const [nbaTeams, setNbaTeams] = useState<NBATeam[]>([]);
  const [selectedConference, setSelectedConference] = useState<'all' | 'Eastern' | 'Western'>('all');
  const [selectedTeam, setSelectedTeam] = useState<NBATeam | null>(null);
  const [sortField, setSortField] = useState<'WIN_PCT' | 'PTS' | 'REB' | 'AST' | 'FG_PCT' | 'FG3_PCT'>('WIN_PCT');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');


  // Map team data with conference + division
  useEffect(() => {
    const teamsWithConference = nbaData.map((team) => ({
      ...team,
      conference: teamConferences[team.TEAM_NAME]?.conference || 'Unknown',
      division: teamConferences[team.TEAM_NAME]?.division || 'Unknown',
    }));
    setNbaTeams(teamsWithConference);
  }, []);


  // Compute league averages
const leagueAverages = React.useMemo(() => {
  if (nbaTeams.length === 0) return null;

  const totals = nbaTeams.reduce(
    (acc, t) => {
      acc.WIN_PCT += t.WIN_PCT;
      acc.PTS += t.PTS;
      acc.REB += t.REB;
      acc.AST += t.AST;
      acc.FG_PCT += t.FG_PCT;
      acc.FG3_PCT += t.FG3_PCT;
      return acc;
    },
    { WIN_PCT: 0, PTS: 0, REB: 0, AST: 0, FG_PCT: 0, FG3_PCT: 0 }
  );

  const n = nbaTeams.length;
  return {
    WIN_PCT: totals.WIN_PCT / n,
    PTS: totals.PTS / n,
    REB: totals.REB / n,
    AST: totals.AST / n,
    FG_PCT: totals.FG_PCT / n,
    FG3_PCT: totals.FG3_PCT / n,
  };
}, [nbaTeams]);


// Compute league averages for player stats (PTS, REB, AST, FG%, 3P%, FT%)
// Compute league averages for ALL player stats
type PlayerAverages = {
  PTS: number; REB: number; AST: number; STL: number; BLK: number;
  FG_PCT: number; FG3_PCT: number; FT_PCT: number;
  GP: number; MIN: number; TOV: number; FGA: number; FG3A: number; FTA: number;
};

const playerAverages = React.useMemo<PlayerAverages | null>(() => {
  const allPlayers = Object.values(nbaPlayerData).flat() as Player[];
  if (allPlayers.length === 0) return null;

  const totals = allPlayers.reduce(
    (acc, p) => {
      acc.PTS += p.PTS;
      acc.REB += p.REB;
      acc.AST += p.AST;
      acc.STL += p.STL;
      acc.BLK += p.BLK;
      acc.FG_PCT += p.FG_PCT;
      acc.FG3_PCT += p.FG3_PCT;
      acc.FT_PCT += p.FT_PCT;
      acc.GP += p.GP;
      acc.MIN += p.MIN;
      acc.TOV += p.TOV;
      acc.FGA += p.FGA;
      acc.FG3A += p.FG3A;
      acc.FTA += p.FTA;
      return acc;
    },
    {
      PTS: 0, REB: 0, AST: 0, STL: 0, BLK: 0,
      FG_PCT: 0, FG3_PCT: 0, FT_PCT: 0,
      GP: 0, MIN: 0, TOV: 0, FGA: 0, FG3A: 0, FTA: 0,
    }
  );

  const n = allPlayers.length;
  return {
    PTS: totals.PTS / n, REB: totals.REB / n, AST: totals.AST / n,
    STL: totals.STL / n, BLK: totals.BLK / n,
    FG_PCT: totals.FG_PCT / n, FG3_PCT: totals.FG3_PCT / n, FT_PCT: totals.FT_PCT / n,
    GP: totals.GP / n, MIN: totals.MIN / n,
    TOV: totals.TOV / n, FGA: totals.FGA / n, FG3A: totals.FG3A / n, FTA: totals.FTA / n,
  };
}, []);




const getPlayerHighlight = (player: Player, key: keyof NonNullable<typeof playerAverages>) => {
  if (!playerAverages) return 'neutral';

  const playerValue = Number((player as any)[key]);
  const avgValue = Number((playerAverages as any)[key]);

  if (isNaN(playerValue) || isNaN(avgValue)) return 'neutral';

  const diff = playerValue - avgValue;
  if (Math.abs(diff) < 0.01) return 'neutral';

  // mark which stats should be “lower is better”
  const lowerIsBetter = new Set<keyof NonNullable<typeof playerAverages>>([
    'TOV', // turnovers
    // Add others here if you decide: e.g. 'FGA','FG3A','FTA' (usually context-dependent)
  ]);

  if (lowerIsBetter.has(key)) {
    return diff < 0 ? 'high' : 'low';
  }
  return diff > 0 ? 'high' : 'low';
};




type PlayerSortField =
  | 'PTS'
  | 'REB'
  | 'AST'
  | 'STL'
  | 'FG_PCT'
  | 'FG3_PCT'
  | 'FT_PCT'
  | 'VALUE_SCORE';

const [playerSortField, setPlayerSortField] = useState<PlayerSortField>('VALUE_SCORE');


// ✅ Uses precomputed VALUE_SCORE from backend JSON


const getPlayerValueScore = (p: Player) => {
  // Instant lookup from hash map
  const precomputed = playerValues[p.PLAYER_ID];
  if (precomputed !== undefined) return precomputed;

  // fallback for safety
  const fgm = p.FG_PCT * p.FGA;
  const ftm = p.FT_PCT * p.FTA;
  const fgMisses = p.FGA - fgm;
  const ftMisses = p.FTA - ftm;

  const valueScore =
    1.0 * p.PTS +
    0.8 * p.AST +
    0.7 * p.REB +
    1.0 * p.STL +
    0.8 * p.BLK -
    1.0 * p.TOV -
    0.7 * fgMisses -
    0.5 * ftMisses;

  return Number(valueScore.toFixed(2));
};





const getPlayerStat = (p: Player, field: PlayerSortField): number => {
  switch (field) {
    case 'VALUE_SCORE': return getPlayerValueScore(p);
    case 'PTS': return p.PTS;
    case 'REB': return p.REB;
    case 'AST': return p.AST;
    case 'STL': return p.STL;
    case 'FG_PCT': return p.FG_PCT;
    case 'FG3_PCT': return p.FG3_PCT;
    case 'FT_PCT': return p.FT_PCT;
  }
};

// Memoize sorted players to avoid recalculating on every render
const sortedTopPlayers = React.useMemo(() => {
  return Object.values(nbaPlayerData)
    .flat()
    .sort((a: Player, b: Player) => getPlayerStat(b, playerSortField) - getPlayerStat(a, playerSortField))
    .slice(0, 50);
}, [playerSortField]);

// Memoize player value scores to avoid recalculating
const playerValueScores = React.useMemo(() => {
  const scores = new Map<number, number>();
  sortedTopPlayers.forEach(player => {
    scores.set(player.PLAYER_ID, getPlayerValueScore(player));
  });
  return scores;
}, [sortedTopPlayers]);




  // Sort by win %
  // Sort dynamically based on selected field and order
const sortTeams = (teams: NBATeam[]) => {
  const sorted = [...teams].sort((a, b) => {
    const field = sortField;

    // Primary sort by the selected stat
    let diff = a[field] - b[field];

    // If it's a tie (e.g., same WIN_PCT), then sort by number of wins
    if (Math.abs(diff) < 1e-6 && field === 'WIN_PCT') {
      diff = a.W - b.W;
    }

    // Apply ascending or descending order
    return sortOrder === 'asc' ? diff : -diff;
  });

  return sorted;
};


  // Filter teams by conference
  const getFilteredTeams = () =>
    selectedConference === 'all' ? nbaTeams : nbaTeams.filter((t) => t.conference === selectedConference);

  // Get teams per division
  const getDivisionTeams = (division: string) =>
    getFilteredTeams().filter((t) => t.division === division).sort((a, b) => b.WIN_PCT - a.WIN_PCT);



  
  // ============================
  // 🧭 Render
  // ============================

  if (nbaTeams.length === 0) {
    return (
      <PageLayout title="NBA Team Standings - 2024-25 Season">
        <div>Loading...</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="NBA Team Standings - 2024-25 Season">
      <div className="flex justify-end mb-4">
        <DarkModeToggle />
      </div>

      {/* Tabs for All / East / West / Scorers */}
      <Tabs defaultValue="all" className="w-full" onValueChange={(v) => setSelectedConference(v as any)}>
        <TabsList className="grid w-full max-w-lg grid-cols-4 mb-6">
          <TabsTrigger value="all">All Teams</TabsTrigger>
          <TabsTrigger value="Eastern">Eastern</TabsTrigger>
          <TabsTrigger value="Western">Western</TabsTrigger>
          <TabsTrigger value="top-scorers">Top Players</TabsTrigger>
        </TabsList>

        {/* === All Teams === */}

        {/* === Sort Controls === */}
<TabsContent value="all">
  <h2 className="text-2xl font-bold mb-4">All Teams</h2>

  {/* === Sort Controls (only for All Teams) === */}
  <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-muted-foreground">Sort by:</label>
      <Select onValueChange={(v) => setSortField(v as typeof sortField)} value={sortField}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Select stat" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="WIN_PCT">Win %</SelectItem>
          <SelectItem value="PPG">PPG</SelectItem>
          <SelectItem value="REB">RPG</SelectItem>
          <SelectItem value="AST">APG</SelectItem>
          <SelectItem value="FG_PCT">FG%</SelectItem>
          <SelectItem value="FG3_PCT">3P%</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <Button
      variant="outline"
      size="sm"
      onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
    >
      {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
    </Button>
  </div>

  {/* === Team Grid === */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
    {sortTeams(nbaTeams).map((team, index) => (
      <TeamCard
        key={team.TEAM_ID}
        team={{ ...team, rank: index + 1 }}
        leagueAverages={leagueAverages}
        onClick={() => setSelectedTeam(team)}
      />
    ))}
  </div>
</TabsContent>


        {/* === Eastern Conference === */}
        <TabsContent value="Eastern" className="space-y-6">
          {['Atlantic', 'Central', 'Southeast'].map((division) => {
            const divisionTeams = getDivisionTeams(division);
            return (
              divisionTeams.length > 0 && (
                <div key={division}>
                  <h3 className="text-lg font-semibold mb-3">Eastern {division}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {divisionTeams.map((team) => (
  <TeamCard
    key={team.TEAM_ID}
    team={team}
    onClick={() => setSelectedTeam(team)}
    leagueAverages={leagueAverages} // ✅ add this line
  />
))}

                  </div>
                </div>
              )
            );
          })}
        </TabsContent>

        {/* === Western Conference === */}
        <TabsContent value="Western" className="space-y-6">
          {['Northwest', 'Pacific', 'Southwest'].map((division) => {
            const divisionTeams = getDivisionTeams(division);
            return (
              divisionTeams.length > 0 && (
                <div key={division}>
                  <h3 className="text-lg font-semibold mb-3">Western {division}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {divisionTeams.map((team) => (
  <TeamCard
    key={team.TEAM_ID}
    team={team}
    onClick={() => setSelectedTeam(team)}
    leagueAverages={leagueAverages} // ✅ add this line
  />
))}

                  </div>
                </div>
              )
            );
          })}
        </TabsContent>



{/* === Top Players === */}
<TabsContent value="top-scorers">
  <h2 className="text-2xl font-bold mb-4">Top Players</h2>

  {/* === Filter Controls === */}
<div className="flex flex-wrap items-center justify-between mb-4 gap-3">
  <div className="flex items-center gap-2">
    <label className="text-sm font-medium text-muted-foreground">Filter by:</label>

    <div className="flex items-center gap-2">
      {/* Dropdown */}
      <Select onValueChange={(v) => setPlayerSortField(v as PlayerSortField)} value={playerSortField}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select stat" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="VALUE_SCORE">Value Score</SelectItem>
          <SelectItem value="PTS">Points (PTS)</SelectItem>
          <SelectItem value="REB">Rebounds (REB)</SelectItem>
          <SelectItem value="AST">Assists (AST)</SelectItem>
          <SelectItem value="STL">Steals (STL)</SelectItem>
          <SelectItem value="FG_PCT">Field Goal % (FG%)</SelectItem>
          <SelectItem value="FG3_PCT">3-Point % (3P%)</SelectItem>
          <SelectItem value="FT_PCT">Free Throw % (FT%)</SelectItem>
        </SelectContent>
      </Select>

      {/* ✅ Tooltip only shows when Value Score is selected */}
      {playerSortField === 'VALUE_SCORE' && (
        <TooltipProvider>
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <span className="cursor-help text-muted-foreground hover:text-foreground"></span>
            </TooltipTrigger>
            <TooltipContent side="right" align="center" className="max-w-[240px] text-sm">
              <p>
                The <strong>Value Score</strong> is a weighted all-around stat:
                <br />
                <span className="text-muted-foreground">
                  40% Points · 20% Rebounds · 20% Assists · 10% Steals · 10% Shooting Efficiency
                </span>
                <br />
                It reflects a player’s total contribution to team success.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  </div>
</div>



  {/* === Player Grid (All Stats with Tooltips) === */}
  
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {Object.values(nbaPlayerData)
    .flat()
    .sort((a: Player, b: Player) => getPlayerStat(b, playerSortField) - getPlayerStat(a, playerSortField))
    .slice(0, 50)
    .map((player: Player, index) => (
      <Card
        key={player.PLAYER_ID}
        className="overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm"
        style={{ animation: `slideUp 0.4s ease-out ${index * 0.05}s both` }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg font-bold">
                #{index + 1} {player.PLAYER_NAME}
              </CardTitle>
              <Badge
                className="text-xs font-semibold border mt-1"
                style={{
                  color: teamColors[player.TEAM_ABBREVIATION]?.secondary,
                  backgroundColor: teamColors[player.TEAM_ABBREVIATION]?.primary || '#fff',
                  borderColor: teamColors[player.TEAM_ABBREVIATION]?.secondary || '#888',
                  borderWidth: '2px',
                  padding: '0.25rem 0.55rem',
                  borderRadius: '0.4rem',
                  letterSpacing: '0.5px',
                }}
              >
                {player.TEAM_ABBREVIATION}
              </Badge>
            </div>

            <Badge
              className="text-xs font-semibold mt-1 bg-blue-600 text-white border-blue-700"
              style={{ letterSpacing: '0.3px', padding: '0.25rem 0.5rem' }}
            >
              {playerSortField === 'VALUE_SCORE'
                ? `Value: ${getPlayerValueScore(player).toFixed(1)}`
                : `${playerSortField.replace('_', ' ')}: ${getPlayerStat(player, playerSortField).toFixed(1)}`}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
  {/* Grid of Player Stats with Tooltips */}
  <div className="grid grid-cols-2 gap-4">
    {/* Left column */}
    <div className="space-y-2">
      <StatRow
        label="GP"
        value={player.GP.toFixed(0)}
        /*highlight={getPlayerHighlight(player, 'GP')}*/
      />
      <StatRow
        label="MIN"
        value={player.MIN.toFixed(1)}
        highlight={getPlayerHighlight(player, 'MIN')}
      />
      <StatRow
        label="PPG"
        value={player.PTS.toFixed(1)}
        highlight={getPlayerHighlight(player, 'PTS')}
      />
      <StatRow
        label="REB"
        value={player.REB.toFixed(1)}
        highlight={getPlayerHighlight(player, 'REB')}
      />
      <StatRow
        label="AST"
        value={player.AST.toFixed(1)}
        highlight={getPlayerHighlight(player, 'AST')}
      />
      <StatRow
        label="STL"
        value={player.STL.toFixed(1)}
        highlight={getPlayerHighlight(player, 'STL')}
      />
      <StatRow
        label="BLK"
        value={player.BLK.toFixed(1)}
        highlight={getPlayerHighlight(player, 'BLK')}
      />

    </div>

    {/* Right column */}
    <div className="space-y-2">
      <StatRow
        label="TOV"
        value={player.TOV.toFixed(1)}
        highlight={getPlayerHighlight(player, 'TOV')}
      />
      <StatRow
        label="FGA"
        value={player.FGA.toFixed(1)}
        highlight={getPlayerHighlight(player, 'FGA')}
      />
      <StatRow
        label="FG%"
        value={`${(player.FG_PCT * 100).toFixed(1)}%`}
        highlight={getPlayerHighlight(player, 'FG_PCT')}
      />
      <StatRow
        label="3PA"
        value={player.FG3A.toFixed(1)}
        highlight={getPlayerHighlight(player, 'FG3A')}
      />
      <StatRow
        label="3P%"
        value={`${(player.FG3_PCT * 100).toFixed(1)}%`}
        highlight={getPlayerHighlight(player, 'FG3_PCT')}
      />
      <StatRow
        label="FTA"
        value={player.FTA.toFixed(1)}
        highlight={getPlayerHighlight(player, 'FTA')}
      />
      <StatRow
        label="FT%"
        value={`${(player.FT_PCT * 100).toFixed(1)}%`}
        highlight={getPlayerHighlight(player, 'FT_PCT')}
      />    
    </div>
  </div>
</CardContent>

      </Card>
    ))}
</div>
</TabsContent>


      </Tabs>

      {/* Player Modal */}
      {selectedTeam && <PlayerModal team={selectedTeam} onClose={() => setSelectedTeam(null)} />}
    </PageLayout>
  );
};

export default NBA;
