// ============================
// 🏀 NBA Dashboard
// Displays NBA team standings and top player stats
// ============================

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { X, Sun, Moon, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Chart.js for wins/losses pie
import { Chart as ChartJS, ArcElement, Tooltip as ChartJSTooltip, Legend as ChartJSLegend, RadialLinearScale, PointElement, LineElement, Filler } from 'chart.js';
import { Doughnut, Radar } from 'react-chartjs-2';
ChartJS.register(ArcElement, ChartJSTooltip, ChartJSLegend, RadialLinearScale, PointElement, LineElement, Filler);
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';




// ============================
// 📘 Type Definitions
// ============================

interface NBATeam {
  TEAM_ID: number;
  TEAM_NAME: string;
  conference?: string;
  division?: string;
  LOGO_URL?: string;
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
  TOV: number;
  W_PCT: number;
  MIN: number;
  FGM: number;
  FGA: number;
  FG3M: number;
  FG3A: number;
  FTM: number;
  FTA: number;
  OREB: number;
  DREB: number;
  STL: number;
  BLK: number;
  BLKA: number;
  PF: number;
  PFD: number;
  PLUS_MINUS: number;
  GP_RANK: number;
  W_RANK: number;
  L_RANK: number;
  W_PCT_RANK: number;
  MIN_RANK: number;
  FGM_RANK: number;
  FGA_RANK: number;
  FG_PCT_RANK: number;
  FG3M_RANK: number;
  FG3A_RANK: number;
  FG3_PCT_RANK: number;
  FTM_RANK: number;
  FTA_RANK: number;
  FT_PCT_RANK: number;
  OREB_RANK: number;
  DREB_RANK: number;
  REB_RANK: number;
  AST_RANK: number;
  TOV_RANK: number;
  STL_RANK: number;
  BLK_RANK: number;
  BLKA_RANK: number;
  PF_RANK: number;
  PFD_RANK: number;
  PTS_RANK: number;
  PLUS_MINUS_RANK: number;
  rank: number;
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
  THING?: number;
}

type LeagueAverageMap = {
  WIN_PCT: number;
  PTS: number;
  REB: number;
  AST: number;
  FG_PCT: number;
  FG3_PCT: number;
  FT_PCT: number;
  W_PCT: number;
  MIN: number;
  FGM: number;
  FGA: number;
  FG3M: number;
  FG3A: number;
  FTM: number;
  FTA: number;
  OREB: number;
  DREB: number;
  TOV: number;
  STL: number;
  BLK: number;
  BLKA: number;
  PF: number;
  PFD: number;
  PLUS_MINUS: number;
  bpi: number;
  off: number;
  def: number;
  pbpi: number;
};

const createLeagueAverageSeed = (): LeagueAverageMap => ({
  WIN_PCT: 0,
  PTS: 0,
  REB: 0,
  AST: 0,
  FG_PCT: 0,
  FG3_PCT: 0,
  FT_PCT: 0,
  W_PCT: 0,
  MIN: 0,
  FGM: 0,
  FGA: 0,
  FG3M: 0,
  FG3A: 0,
  FTM: 0,
  FTA: 0,
  OREB: 0,
  DREB: 0,
  TOV: 0,
  STL: 0,
  BLK: 0,
  BLKA: 0,
  PF: 0,
  PFD: 0,
  PLUS_MINUS: 0,
  bpi: 0,
  off: 0,
  def: 0,
  pbpi: 0,
});

const PLAYER_STAT_KEYS: (keyof Player)[] = [
  'MIN',
  'PTS',
  'REB',
  'AST',
  'STL',
  'BLK',
  'TOV',
  'FGA',
  'FG_PCT',
  'FG3A',
  'FG3_PCT',
  'FTA',
  'FT_PCT',
];

const PLAYER_LOWER_IS_BETTER = new Set<keyof Player>(['TOV']);
const FAVORITE_TEAMS_STORAGE_KEY = 'nbaFavoriteTeamIds';

type StatLeaderMap = Partial<Record<keyof Player, { value: number; playerIds: number[] }>>;

// Cache of the latest full team list for cross-component best-stat checks
let ALL_TEAMS_CACHE: NBATeam[] = [];

// ============================
// Schedule Types (support multiple shapes)
// ============================

interface ScheduleGameAny {
  game_id: string;
  date?: string;          // e.g., '2025-10-31'
  time?: string;          // e.g., '4:00 PM' or status detail
  tv?: string;            // joined provider names
  tv_providers?: string[]; // alternate provider list
  home?: string;          // team abbrev (optional)
  away?: string;          // team abbrev (optional)
  matchup?: string;       // e.g., 'Atlanta Hawks @ Indiana Pacers'
  location?: string;
  game_link?: string;
}

type NBAScheduleData =
  | { teams?: Record<string, string>; games?: ScheduleGameAny[] }
  | ScheduleGameAny[];

// ============================
// Stronger stat key types to fix TS
// ============================

type TeamStatKey =
  | 'WIN_PCT' | 'PTS' | 'REB' | 'AST' | 'FG_PCT' | 'FG3_PCT' | 'FT_PCT'
  | 'FG3M' | 'FG3A' | 'FTM' | 'FTA' | 'OREB' | 'DREB' | 'STL' | 'BLK' | 'TOV'
  | 'PLUS_MINUS';

type TeamAverages = {
  GP: number; MIN: number; PTS: number; REB: number; AST: number; STL: number; BLK: number;
  TOV: number; FGA: number; FG3A: number; FTA: number; FG_PCT: number; FG3_PCT: number; FT_PCT: number;
};

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
  ATL: { primary: '#E03A3E', secondary: '#C1D32F' }, // Red, Volt Green
  BOS: { primary: '#007A33', secondary: '#BA9653' }, // Green, Gold
  BKN: { primary: '#000000', secondary: '#FFFFFF' }, // Black, White
  CHA: { primary: '#1D1160', secondary: '#00788C' }, // Purple, Teal
  CHI: { primary: '#CE1141', secondary: '#000000' }, // Red, Black
  CLE: { primary: '#860038', secondary: '#FDBB30' }, // Wine, Gold
  DAL: { primary: '#00538C', secondary: '#B8C4CA' }, // Blue, Silver
  DEN: { primary: '#0E2240', secondary: '#FEC524' }, // Navy, Gold
  DET: { primary: '#C8102E', secondary: '#006BB6' }, // Red, Blue
  GSW: { primary: '#1D428A', secondary: '#FFC72C' }, // Royal Blue, Gold
  HOU: { primary: '#CE1141', secondary: '#000000' }, // Red, Black
  IND: { primary: '#002D62', secondary: '#FDBB30' }, // Navy, Gold
  LAC: { primary: '#090941', secondary: '#ffffff' }, // Red, Blue
  LAL: { primary: '#552583', secondary: '#FDB927' }, // Purple, Gold
  MEM: { primary: '#5D76A9', secondary: '#12173F' }, // Beale Street Blue, Navy
  MIA: { primary: '#98002E', secondary: '#F9A01B' }, // Red, Yellow
  MIL: { primary: '#00471B', secondary: '#EEE1C6' }, // Green, Cream
  MIN: { primary: '#0C2340', secondary: '#236192' }, // Midnight Navy, Lake Blue
  NOP: { primary: '#0C2340', secondary: '#C8102E' }, // Navy, Red
  NYK: { primary: '#006BB6', secondary: '#F58426' }, // Blue, Orange
  OKC: { primary: '#007AC1', secondary: '#EF3B24' }, // Blue, Orange
  ORL: { primary: '#0077C0', secondary: '#C4CED4' }, // Blue, Silver
  PHI: { primary: '#006BB6', secondary: '#ED174C' }, // Blue, Red
  PHX: { primary: '#1D1160', secondary: '#E56020' }, // Purple, Orange
  POR: { primary: '#E03A3E', secondary: '#000000' }, // Red, Black
  SAC: { primary: '#5A2D81', secondary: '#63727A' }, // Purple, Silver
  SAS: { primary: '#C4CED4', secondary: '#000000' }, // Silver, Black
  TOR: { primary: '#000000', secondary: '#CE1141' }, // Red, Black
  UTA: { primary: '#ffffff', secondary: '#753BBD' }, // Navy, Gold
  WAS: { primary: '#002B5C', secondary: '#E31837' }, // Navy, Red
};

type TeamFilterKey =
  | 'WIN_PCT'
  | 'PTS'
  | 'REB'
  | 'FT_PCT'
  | 'TOV'
  | 'OREB'
  | 'DREB'
  | 'STL'
  | 'BLK'
  | 'FG_PCT'
  | 'FG3_PCT'
  | 'bpi'
  | 'off'
  | 'def'
  | 'pbpi';

type TeamFilterConfig = {
  key: TeamFilterKey;
  label: string;
  type: 'number' | 'percent';
  placeholder?: string;
};

const TEAM_FILTER_FIELDS: TeamFilterConfig[] = [
    { key: 'WIN_PCT', label: 'Win % ≥', type: 'percent', placeholder: '55' },
    { key: 'PTS', label: 'PPG ≥', type: 'number', placeholder: '115' },
    { key: 'REB', label: 'RPG ≥', type: 'number', placeholder: '45' },
    { key: 'FT_PCT', label: 'FT% ≥', type: 'percent', placeholder: '75' },
    { key: 'TOV', label: 'TOV ≥', type: 'number', placeholder: '12' },
    { key: 'OREB', label: 'OREB ≥', type: 'number', placeholder: '10' },
    { key: 'DREB', label: 'DREB ≥', type: 'number', placeholder: '33' },
    { key: 'STL', label: 'STL ≥', type: 'number', placeholder: '7' },
    { key: 'BLK', label: 'BLK ≥', type: 'number', placeholder: '5' },
    { key: 'FG_PCT', label: 'FG% ≥', type: 'percent', placeholder: '47' },
    { key: 'FG3_PCT', label: '3P% ≥', type: 'percent', placeholder: '36' },
    { key: 'bpi', label: 'BPI ≥', type: 'number', placeholder: '4' },
    { key: 'off', label: 'OFF ≥', type: 'number', placeholder: '3' },
    { key: 'def', label: 'DEF ≥', type: 'number', placeholder: '3' },
    { key: 'pbpi', label: 'PBPI ≥', type: 'number', placeholder: '4' },
  ];

const getInitialTeamFilters = (): Record<TeamFilterKey, string> =>
  TEAM_FILTER_FIELDS.reduce(
    (acc, field) => {
      acc[field.key] = '';
      return acc;
    },
    {} as Record<TeamFilterKey, string>,
  );

type TeamSortField =
  | 'WIN_PCT'
  | 'PTS'
  | 'REB'
  | 'AST'
  | 'FG_PCT'
  | 'FG3_PCT'
  | 'FT_PCT'
  | 'TOV'
  | 'OREB'
  | 'DREB'
  | 'STL'
  | 'BLK'
  | 'bpi'
  | 'off'
  | 'def'
  | 'pbpi';



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

const teamGradientColors: Record<string, { start: string; end: string }> = {
  'ATL': { start: '#ff0004ff', end: '#fff831ff' },
  'BOS': { start: '#007A33', end: '#ffffffff' },
  'BKN': { start: '#000000', end: '#FFFFFF' },
  'CHA': { start: '#1D1160', end: '#00788C' },
  'CHI': { start: '#CE1141', end: '#000000' },
  'CLE': { start: '#860038', end: '#FDBB30' },
  'DAL': { start: '#00538C', end: '#002B5E' },
  'DEN': { start: '#FEC524', end: '#0E2240' },
  'DET': { start: '#C8102E', end: '#1D42BA' },
  'GSW': { start: '#1D428A', end: '#FFC72C' },
  'HOU': { start: '#CE1141', end: '#000000' },
  'IND': { start: '#002D62', end: '#FDBB30' },
  'LAC': { start: '#ffffffff', end: '#1D428A' },
  'LAL': { start: '#552583', end: '#FDB927' },
  'MEM': { start: '#5D76A9', end: '#12173F' },
  'MIA': { start: '#98002E', end: '#F9A01B' },
  'MIL': { start: '#00471B', end: '#EEE1C6' },
  'MIN': { start: '#0C2340', end: '#236192' },
  'NOP': { start: '#0C2340', end: '#C8102E' },
  'NYK': { start: '#006BB6', end: '#F58426' },
  'OKC': { start: '#007AC1', end: '#EF3B24' },
  'ORL': { start: '#0077C0', end: '#C4CED4' },
  'PHI': { start: '#006BB6', end: '#ED174C' },
  'PHX': { start: '#1D1160', end: '#E56020' },
  'POR': { start: '#ffffffff', end: '#E03A3E' },
  'SAC': { start: '#5A2D81', end: '#63727A' },
  'SAS': { start: '#C4CED4', end: '#000000' },
  'TOR': { start: '#CE1141', end: '#000000' },
  'UTA': { start: '#270063ff', end: '#ffffffff' },
  'WAS': { start: '#002B5C', end: '#E31837' },
};

const abbreviationToTeamName: Record<string, string> = Object.fromEntries(
  Object.entries(teamAbbreviations).map(([name, abbr]) => [abbr, name])
);

interface ResolvedGameTeams {
  homeAbbr?: string;
  awayAbbr?: string;
  homeName?: string;
  awayName?: string;
}

const resolveMatchupTeams = (game: ScheduleGameAny): ResolvedGameTeams => {
  let awayAbbr = ((game as any).away || '').toString().trim().toUpperCase();
  let homeAbbr = ((game as any).home || '').toString().trim().toUpperCase();
  awayAbbr = awayAbbr || undefined;
  homeAbbr = homeAbbr || undefined;
  let awayName: string | undefined = (game as any).away_name;
  let homeName: string | undefined = (game as any).home_name;

  if ((!awayAbbr || !homeAbbr) && game.matchup) {
    const parts = game.matchup.split('@');
    const rawAway = parts[0]?.trim();
    const rawHome = parts[1]?.trim();
    if (rawAway) {
      awayName = rawAway;
      const abbr = (teamAbbreviations as any)[rawAway];
      if (abbr) awayAbbr = String(abbr).toUpperCase();
    }
    if (rawHome) {
      homeName = rawHome;
      const abbr = (teamAbbreviations as any)[rawHome];
      if (abbr) homeAbbr = String(abbr).toUpperCase();
    }
  }

  if (!awayName && awayAbbr) awayName = abbreviationToTeamName[awayAbbr];
  if (!homeName && homeAbbr) homeName = abbreviationToTeamName[homeAbbr];
  return { awayAbbr, homeAbbr, awayName, homeName };
};



// ============================
// Dashboard Compact Components
// ============================

const DashboardTeamMiniCard = React.forwardRef<HTMLDivElement, { team: NBATeam; highlight?: boolean; onClick?: () => void }>(
  ({ team, highlight = false, onClick }, ref) => {
  const abbr = teamAbbreviations[team.TEAM_NAME] || 'UNK';
  const colors = teamColors[abbr] || { primary: '#222', secondary: '#555' };
  return (
    <div
      ref={ref}
      className={`relative rounded-xl overflow-hidden transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={
        highlight
          ? {
              boxShadow: `0 0 18px rgba(255,255,255,0.55)`,
              outline: `2px solid rgba(255,255,255,0.85)`,
              outlineOffset: '0px',
            }
          : undefined
      }
//            style={{
//        backgroundImage: `linear-gradient(300deg, ${colors.primary}, ${colors.secondary})`,
//        padding: '2px',
//       }}
    >
<div 
  className="absolute inset-0.5 rounded-lg" 
  style={{ backgroundColor: ' #16181d47' }}
  aria-hidden 
/>      <div className="relative z-10 flex items-center gap-4 p-3 border">
        {team.LOGO_URL && (
          <img
            src={team.LOGO_URL}
            alt={`${team.TEAM_NAME} logo`}
            className="w-8 h-8 rounded-sm object-contain"
            loading="lazy"
            width={32}
            height={32}
          />
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{team.TEAM_NAME}</div>
        </div>
        <Badge className="ml-auto text-sm font-semibold bg-white text-black hover:bg-white hover:text-black">
          {team.W} - {team.L}
        </Badge>
      </div>
    </div>
  );
});
DashboardTeamMiniCard.displayName = 'DashboardTeamMiniCard';

const DashboardPlayerMiniCard = ({
  player,
  logoMap,
  rank,
}: {
  player: Player;
  logoMap: Record<string, string>;
  rank?: number;
}) => {
  const abbr = player.TEAM_ABBREVIATION || 'UNK';
  const logo = logoMap[abbr];
  return (
    <div className="relative rounded-xl overflow-hidden">
      <div
        className="absolute inset-0.5 rounded-lg"
        style={{ backgroundColor: '#16181d47' }}
        aria-hidden
      />
      <div className="relative z-10 flex items-center gap-4 p-3 border">
        {logo && (
          <img
            src={logo}
            alt={`${abbr} logo`}
            className="w-8 h-8 rounded-sm object-contain"
            loading="lazy"
            width={32}
            height={32}
          />
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{player.PLAYER_NAME}</div>
        </div>

         <div className="ml-auto text-2xl font-semibold text-white">
          {}
        </div>
        <Badge className="ml-auto text-sm font-semibold bg-white text-black hover:bg-white hover:text-black">
          {rank ?? ''}
        </Badge>
      </div>
    </div>
  );
};

const DashboardTodaySchedule = ({
  scheduleData,
  logoMap,
  recordMap,
  onGapChange,
  onTeamFocus,
  favoriteTeamIds = [],
  abbrToTeamMap = {},
}: {
  scheduleData: NBAScheduleData | null;
  logoMap: Record<string, string>;
  recordMap: Record<string, string>;
  onGapChange?: (gap: number) => void;
  onTeamFocus?: (info: { teamName?: string; teamAbbr?: string }) => void;
  favoriteTeamIds?: number[];
  abbrToTeamMap?: Record<string, NBATeam>;
}) => {
  const favoriteTeamSet = React.useMemo(() => new Set(favoriteTeamIds), [favoriteTeamIds]);
  const todayKey = React.useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate() + 0).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const games = React.useMemo(() => {
    if (!scheduleData) return [] as ScheduleGameAny[];
    const arr: ScheduleGameAny[] = Array.isArray(scheduleData)
      ? (scheduleData as ScheduleGameAny[])
      : (scheduleData.games || []);
    
    const todayGames = arr.filter((g) => String(g.date || '').slice(0, 10) === todayKey);
    
    // If no favorites, show no games
    if (favoriteTeamIds.length === 0) return [];
    
    // Filter to only show games with favorite teams
    return todayGames.filter((g) => {
      let awayAbbr = (g as any).away as string | undefined;
      let homeAbbr = (g as any).home as string | undefined;
      
      // Try to get team abbr from matchup if not directly available
      if ((!awayAbbr || !homeAbbr) && g.matchup) {
        const parts = g.matchup.split('@');
        const awayName = parts[0]?.trim();
        const homeName = parts[1]?.trim();
        awayAbbr = awayName ? (teamAbbreviations as any)[awayName] : undefined;
        homeAbbr = homeName ? (teamAbbreviations as any)[homeName] : undefined;
      }
      
      const normalizedAwayAbbr = (awayAbbr || '').toUpperCase();
      const normalizedHomeAbbr = (homeAbbr || '').toUpperCase();
      const awayTeamObj = normalizedAwayAbbr ? abbrToTeamMap[normalizedAwayAbbr] : undefined;
      const homeTeamObj = normalizedHomeAbbr ? abbrToTeamMap[normalizedHomeAbbr] : undefined;
      
      // Show game if either team is a favorite
      return (awayTeamObj && favoriteTeamSet.has(awayTeamObj.TEAM_ID)) ||
             (homeTeamObj && favoriteTeamSet.has(homeTeamObj.TEAM_ID));
    });
  }, [scheduleData, todayKey, favoriteTeamIds, abbrToTeamMap]);

  const shellRef = React.useRef<HTMLDivElement>(null);
  
  // State for dynamic layout calculations
  const [layout, setLayout] = React.useState(() => ({
    gap: 8,
    cardHeight: 100,
    scale: 1,      
    isStacked: false, 
    logoOffset: 0,
    recordOffset: 0,
    ready: false,
  }));

  const recomputeLayout = React.useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    
    const rect = shell.getBoundingClientRect();
    const totalHeight = rect.height;
    if (!totalHeight || !Number.isFinite(totalHeight)) return;
    
    const count = Math.max(1, games.length);

    // 1. Calculate dynamic Gap
    const gap = Math.max(4, Math.min(12, totalHeight * 0.012));

    // 2. Calculate Exact Height Per Card
    const availableHeight = totalHeight - (gap * (count + 1));
    const rawCardHeight = availableHeight / count;
    
    // 3. Determine Scale Factor
    let scale = rawCardHeight / 110; 
    scale = Math.max(0.5, Math.min(2.5, scale));

    // 4. Determine Layout Mode
    const isStacked = rawCardHeight > 140;

    // 5. Calculate Independent Offsets
    const baseline = Math.max(0, count - 5);
    const logoOffset = isStacked ? 0 : Math.min(60, baseline * 25);   
    const recordOffset = isStacked ? 0 : Math.min(20, baseline * 2);

    setLayout({
      gap,
      cardHeight: rawCardHeight,
      scale,
      isStacked,
      logoOffset,
      recordOffset,
      ready: true,
    });
    
    try { onGapChange && onGapChange(Math.round(gap)); } catch {}
  }, [games.length, onGapChange]);

  React.useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => recomputeLayout();
    recomputeLayout();
    
    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(() => recomputeLayout());
    if (shellRef.current) observer.observe(shellRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [recomputeLayout]);

  const focusTeam = React.useCallback(
    (teamAbbr?: string, fallbackName?: string) => {
      if (!onTeamFocus) return;
      onTeamFocus({ teamAbbr, teamName: fallbackName });
    },
    [onTeamFocus]
  );

  const formatRecord = (rec: string) => rec.replace('-', ' - ');

  const getProviderStyle = (provider: string) => {
    const p = provider.toLowerCase();
    const base = "shadow-sm border-0"; 
    if (p.includes('prime')) return `${base} bg-[#00A8E1] text-white`;
    if (p.includes('peacock')) return `${base} bg-white text-black`;
    if (p.includes('espn')) return `${base} bg-[#CC0000] text-white`;
    if (p.includes('abc')) return `${base} bg-black text-white border border-white/20`;
    if (p.includes('tnt')) return `${base} bg-black text-white border border-white/20`;
    if (p.includes('nba')) return `${base} bg-black text-white border border-white/20`;
    return 'bg-muted text-muted-foreground';
  };

  if (!scheduleData) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (games.length === 0) {
    if (favoriteTeamIds.length === 0) {
      return <div className="text-sm text-muted-foreground">No favorite teams selected</div>;
    }
    return <div className="text-sm text-muted-foreground">No games today for favorited teams</div>;
  }

  const { gap, cardHeight, scale, isStacked, logoOffset, recordOffset, ready } = layout;

  const logoSize = Math.round(80 * scale);
  const scoreSize = Math.round(32 * scale);
  const timeSize = Math.round(20 * scale);
  const recordSize = Math.max(12, Math.round(12 * scale));
  const padding = Math.max(8, Math.round(15 * scale));
  const scoreColWidth = Math.max(140, Math.round(200 * scale));

  return (
    <div ref={shellRef} className="flex-1 min-h-0 w-full h-full overflow-hidden">
      <div
        className="flex flex-col h-full w-full"
        style={{
          gap: `${gap}px`,
          paddingTop: `${gap}px`,
          paddingBottom: `${gap}px`,
          opacity: ready ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out',
        }}
      >
        {games.map((g) => {
          let awayAbbr = (g as any).away as string | undefined;
          let homeAbbr = (g as any).home as string | undefined;
          let awayName: string | undefined;
          let homeName: string | undefined;
          if ((!awayAbbr || !homeAbbr) && g.matchup) {
            const parts = g.matchup.split('@');
            awayName = parts[0]?.trim();
            homeName = parts[1]?.trim();
            const a = awayName ? (teamAbbreviations as any)[awayName] : undefined;
            const h = homeName ? (teamAbbreviations as any)[homeName] : undefined;
            if (a) awayAbbr = a;
            if (h) homeAbbr = h;
          }
          const normalizedAwayName = awayName || (awayAbbr ? abbreviationToTeamName[awayAbbr] : undefined);
          const normalizedHomeName = homeName || (homeAbbr ? abbreviationToTeamName[homeAbbr] : undefined);
          const awayLogo = awayAbbr ? logoMap[awayAbbr] : undefined;
          const homeLogo = homeAbbr ? logoMap[homeAbbr] : undefined;
          const awayRecord = awayAbbr ? recordMap[awayAbbr] : undefined;
          const homeRecord = homeAbbr ? recordMap[homeAbbr] : undefined;
          const rawAway = (g as any).away_score;
          const rawHome = (g as any).home_score;
          const aScore = rawAway != null ? Number(rawAway) : NaN;
          const hScore = rawHome != null ? Number(rawHome) : NaN;
          const hasScores = Number.isFinite(aScore) && Number.isFinite(hScore);
          const awayWin = hasScores ? aScore >= hScore : false;
          const homeWin = hasScores ? hScore >= aScore : false;
          const statusText = String((g as any).status || '').toLowerCase();
          const isFinal = statusText.includes('final') || Boolean((g as any).winner);
          const isLive = statusText.includes('live') || statusText.includes('in progress');
          const awayScoreClass = isFinal ? (awayWin ? 'text-white' : 'text-white/50') : 'text-white';
          const homeScoreClass = isFinal ? (homeWin ? 'text-white' : 'text-white/50') : 'text-white';
          const providers: string[] = Array.isArray((g as any).tv_providers) ? ((g as any).tv_providers as string[]).filter(Boolean) : [];
          
          const normalizedAwayAbbr = (awayAbbr || '').toUpperCase();
          const normalizedHomeAbbr = (homeAbbr || '').toUpperCase();
          const awayTeamObj = normalizedAwayAbbr ? abbrToTeamMap[normalizedAwayAbbr] : undefined;
          const homeTeamObj = normalizedHomeAbbr ? abbrToTeamMap[normalizedHomeAbbr] : undefined;
          const awayFavorite = !!(awayTeamObj && favoriteTeamSet.has(awayTeamObj.TEAM_ID));
          const homeFavorite = !!(homeTeamObj && favoriteTeamSet.has(homeTeamObj.TEAM_ID));

          return (
            <Card
              key={g.game_id || `${g.matchup}-${g.date}`}
              className="relative overflow-hidden transition-all duration-300 bg-card border flex flex-col shrink-0"
              style={{
                height: `${cardHeight}px`,
                padding: `0 ${padding}px`,
              }}
            >
               <div className="absolute top-2 left-2 z-20 flex items-center gap-1">
                  {isLive && (
                     <Badge className="bg-red-600 text-white font-bold px-2 py-0.5 text-[9px] tracking-wide rounded-full shadow-sm border-0">LIVE</Badge>
                  )}
                  {providers.length > 0 && providers.slice(0, 2).map(p => (
                     <span key={p} className={`text-[9px] px-2 py-0.5 rounded-full font-bold tracking-wider ${getProviderStyle(p)}`}>
                       {p}
                     </span>
                  ))}
               </div>

              <div className="flex-1 flex items-center justify-between w-full h-full relative z-10">
                
                {/* --- Left Team (Away) --- */}
                <div className="flex flex-col items-center justify-center flex-1 h-full">
                  {awayLogo && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        focusTeam(awayAbbr, normalizedAwayName);
                      }}
                      className="relative focus:outline-none group flex flex-col items-center justify-center"
                      title={normalizedAwayName || awayAbbr}
                    >
                      <div 
                         style={{ width: logoSize, height: logoSize, maxWidth: '100%', maxHeight: '100%', transform: `translateX(-${logoOffset}px)` }} 
                         className="relative transition-transform duration-300"
                      >
                        <img
                          src={awayLogo}
                          alt={awayAbbr}
                          className={`w-full h-full object-contain transition-opacity duration-300 ${isFinal && !awayWin ? 'opacity-50' : 'opacity-100'}`}
                          style={isFinal && awayWin ? { filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.6))' } : undefined}
                        />
                      </div>
                      
                      {awayRecord && (
                        <span
                          className={`
                            whitespace-nowrap text-white/80 font-bold drop-shadow-md transition-all duration-300
                            ${isStacked 
                              ? "mt-1" 
                              : "absolute left-full top-1/2 ml-4" // Removed -translate-y-1/2 from class, handling it in style
                            }
                          `}
                          style={{ 
                             fontSize: recordSize,
                             // Combine X offset and Y centering here
                             transform: isStacked ? 'none' : `translate(-${recordOffset}px, -50%)`
                          }}
                        >
                          ({formatRecord(awayRecord)})
                        </span>
                      )}
                    </button>
                  )}
                </div>

                {/* --- Center Score / Time --- */}
                <div className="flex flex-col items-center justify-center shrink-0 z-10" style={{ width: scoreColWidth }}>
                  {hasScores ? (
                    <div className="font-extrabold tracking-wide flex items-center justify-center gap-3" style={{ fontSize: scoreSize }}>
                      <span className={awayScoreClass}>{aScore}</span>
                      <span className="text-muted-foreground/50 text-[0.8em]">-</span>
                      <span className={homeScoreClass}>{hScore}</span>
                    </div>
                  ) : (
                    <div className="font-bold text-center leading-tight" style={{ fontSize: timeSize }}>
                      {g.time || 'TBA'}
                    </div>
                  )}
                  
                  {providers.length === 0 && (g as any).tv && (
                     <div className="mt-1 max-w-[140px]">
                        <span className="text-[10px] text-muted-foreground truncate max-w-full font-medium">{(g as any).tv}</span>
                     </div>
                  )}
                </div>

                {/* --- Right Team (Home) --- */}
                <div className="flex flex-col items-center justify-center flex-1 h-full">
                  {homeLogo && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        focusTeam(homeAbbr, normalizedHomeName);
                      }}
                      className="relative focus:outline-none group flex flex-col items-center justify-center"
                      title={normalizedHomeName || homeAbbr}
                    >
                      <div 
                         style={{ width: logoSize, height: logoSize, maxWidth: '100%', maxHeight: '100%', transform: `translateX(${logoOffset}px)` }} 
                         className="relative transition-transform duration-300"
                      >
                        <img
                          src={homeLogo}
                          alt={homeAbbr}
                          className={`w-full h-full object-contain transition-opacity duration-300 ${isFinal && !homeWin ? 'opacity-50' : 'opacity-100'}`}
                          style={isFinal && homeWin ? { filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.6))' } : undefined}
                        />
                      </div>

                       {homeRecord && (
                        <span
                          className={`
                            whitespace-nowrap text-white/80 font-bold drop-shadow-md transition-all duration-300
                            ${isStacked 
                              ? "mt-1"
                              : "absolute right-full top-1/2 mr-4" // Removed -translate-y-1/2 from class
                            }
                          `}
                          style={{ 
                             fontSize: recordSize,
                             // Combine X offset and Y centering here
                             transform: isStacked ? 'none' : `translate(${recordOffset}px, -50%)` 
                          }}
                        >
                          ({formatRecord(homeRecord)})
                        </span>
                      )}
                    </button>
                  )}
                </div>

              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
// ============================
// 🧍 PlayerCard Component
// Displays individual player stats
// ============================

const PlayerCard = React.memo(({ player, index }: { player: Player; index: number }) => (
  <Card
    className="overflow-hidden transition-all duration-300 bg-card/50 backdrop-blur-0 md:backdrop-blur-sm will-change-transform"
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
));

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
  "DEF": 'Defensive rating',
  "BPI": 'ESPN Basketball Power Index',
  "PBPI": 'Projected BPI',
  "OREB" : 'Offensive Rebounds',
  "DREB" : 'Defensive Rebounds',
  "3PM" : 'Three pointers made',
  "FTM" : 'Free throws made'
  

};


const StatRow = ({
  label,
  value,
  highlight,
  dense = false,
}: {
  label: string;
  value: string | number;
  highlight?: 'high' | 'low' | 'neutral' | 'best';
  dense?: boolean;
}) => {
  const colorClass =
    highlight === 'best'
      ? 'text-yellow-300'
      : highlight === 'high'
      ? 'text-green-400 font-semibold'
      : highlight === 'low'
      ? 'text-red-400 font-semibold'
      : 'text-foreground';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center text-sm cursor-help text-left ${dense ? 'gap-[4rem]' : 'gap-[0.5rem]'}`}>
            <span className={`text-muted-foreground ${dense ? 'w-[4.5rem]' : 'w-16'} text-left`}>{label}</span>
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
// Schedule View Component (Next 7 Days)
// ============================

const ScheduleView = ({ scheduleData }: { scheduleData: NBAScheduleData | null }) => {
  const days = useMemo(() => {
    const arr: { key: string; label: string; date: Date }[] = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setHours(0, 0, 0, 0);
      d.setDate(today.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = d.toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
      });
      arr.push({ key, label, date: d });
    }
    return arr;
  }, []);

  const gamesByDate = useMemo(() => {
    const map: Record<string, ScheduleGameAny[]> = {};
    const gamesArr: ScheduleGameAny[] = Array.isArray(scheduleData)
      ? (scheduleData as ScheduleGameAny[])
      : (scheduleData?.games || []);

    for (const g of gamesArr) {
      const k = ((g.date as string) || '').slice(0, 10);
      if (!k) continue;
      if (!map[k]) map[k] = [];
      map[k].push(g);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    }
    return map;
  }, [scheduleData]);

  if (!scheduleData) {
    return <div className="text-sm text-muted-foreground">Loading schedule…</div>;
  }

  const logos: Record<string, string> = Array.isArray(scheduleData)
    ? {}
    : (scheduleData?.teams || {});

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-4 min-w-max">
        {days.map((d) => {
          const games = gamesByDate[d.key] || [];
          return (
            <Card key={d.key} className="w-72 shrink-0 bg-card/60 backdrop-blur border">
              <CardHeader className="py-3">
                <CardTitle className="text-base font-semibold">{d.label}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {games.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center">No games</div>
                ) : (
                  <div className="divide-y">
                    {games.map((g) => (
                      <div key={g.game_id} className="flex items-center justify-between gap-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            {/* If we have home/away abbrevs, show logos; else show matchup text */}
                            {g.away && g.home ? (
                              <>
                                {logos[g.away] && (
                                  <img src={logos[g.away]} alt={g.away} className="h-5 w-5 rounded-sm object-contain" loading="lazy" width="20" height="20" />
                                )}
                                <span className="text-sm font-semibold">{g.away}</span>
                                <span className="text-xs text-muted-foreground">@</span>
                                {logos[g.home] && (
                                  <img src={logos[g.home]} alt={g.home} className="h-5 w-5 rounded-sm object-contain" loading="lazy" width="20" height="20" />
                                )}
                                <span className="text-sm font-semibold">{g.home}</span>
                              </>
                            ) : (
                              <span className="text-sm font-semibold">
                                {g.matchup || 'Matchup TBA'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-medium">{g.time || 'TBA'}</div>
                          {(g.tv || (g.tv_providers && g.tv_providers.length)) && (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                              {g.tv || (g.tv_providers || []).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

// Compact, arrow-controlled view
const ScheduleViewV2 = ({ scheduleData, logoMap, onGameClick }: { scheduleData: NBAScheduleData | null, logoMap: Record<string, string>, onGameClick?: (gameId: string) => void }) => {
  // Build games grouped by date from the provided schedule
  const gamesByDate = useMemo(() => {
    const map: Record<string, ScheduleGameAny[]> = {};
    const gamesArr: ScheduleGameAny[] = Array.isArray(scheduleData)
      ? (scheduleData as ScheduleGameAny[])
      : (scheduleData?.games || []);

    for (const g of gamesArr) {
      const k = ((g.date as string) || '').slice(0, 10);
      if (!k) continue;
      if (!map[k]) map[k] = [];
      map[k].push(g);
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return map;
  }, [scheduleData]);


  // All available date keys sorted ascending
  const dateKeys = useMemo(() => Object.keys(gamesByDate).sort(), [gamesByDate]);

  // Pick initial index near today
  const todayKey = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const initialIndex = useMemo(() => {
    if (dateKeys.length === 0) return 0;
    // Find first date >= today
    const idx = dateKeys.findIndex((k) => k >= todayKey);
    if (idx >= 0) return idx;
    // Otherwise, jump to last available date
    return dateKeys.length - 1;
  }, [dateKeys, todayKey]);

  const [index, setIndex] = React.useState<number>(initialIndex);
  useEffect(() => { setIndex(initialIndex); }, [initialIndex]);

  if (!scheduleData) return <div className="text-sm text-muted-foreground">Loading schedule…</div>;
  const logos: Record<string, string> = Array.isArray(scheduleData) ? {} : (scheduleData?.teams || {});

  // Helper to format date labels from YYYY-MM-DD
  const formatLabel = (key: string) => {
    const [y, m, d] = key.split('-').map((s) => parseInt(s, 10));
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (dateKeys.length === 0) return <div className="text-sm text-muted-foreground">No scheduled games available.</div>;


  const clamp = (n: number) => Math.max(0, Math.min(dateKeys.length - 1, n));
  const currentKey = dateKeys[clamp(index)];
  const games = gamesByDate[currentKey] || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setIndex((i) => clamp(i - 1))} disabled={index <= 0} className="rounded-full">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-lg font-semibold">{formatLabel(currentKey)}</div>
        <Button variant="ghost" size="icon" onClick={() => setIndex((i) => clamp(i + 1))} disabled={index >= dateKeys.length - 1} className="rounded-full">
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {games.length === 0 ? (
        <Card className="bg-card/60 backdrop-blur-sm border">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">No games</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 auto-rows-fr w-full pb-16">
          {games.map((g) => {
            // Derive home/away abbreviations and logos
            let awayAbbr = (g as any).away as string | undefined;
            let homeAbbr = (g as any).home as string | undefined;
            if ((!awayAbbr || !homeAbbr) && g.matchup) {
              const parts = g.matchup.split('@');
              const awayName = parts[0]?.trim();
              const homeName = parts[1]?.trim();
              const a = awayName ? (teamAbbreviations as any)[awayName] : undefined;
              const h = homeName ? (teamAbbreviations as any)[homeName] : undefined;
              if (a) awayAbbr = a;
              if (h) homeAbbr = h;
            }
            const awayLogo = awayAbbr ? logoMap[awayAbbr] : undefined;
            const homeLogo = homeAbbr ? logoMap[homeAbbr] : undefined;
            const rawAway = (g as any).away_score;
            const rawHome = (g as any).home_score;
            const aScore = rawAway != null ? Number(rawAway) : NaN;
            const hScore = rawHome != null ? Number(rawHome) : NaN;
            const hasScores = Number.isFinite(aScore) && Number.isFinite(hScore);
            const awayWin = hasScores ? aScore >= hScore : false;
            const homeWin = hasScores ? hScore >= aScore : false;
            const statusText = String((g as any).status || '').toLowerCase();
            const isFinal = statusText.includes('final') || Boolean((g as any).winner);
            const isLiveGame = statusText.includes('live') || statusText.includes('in progress');
            const awayScoreClass = isFinal ? (aScore >= hScore ? 'text-white' : 'text-white/50') : 'text-white';
            const homeScoreClass = isFinal ? (hScore >= aScore ? 'text-white' : 'text-white/50') : 'text-white';
            const timeFont = 18;

            // Normalize TV providers to an array of names
            const providers: string[] = Array.isArray((g as any).tv_providers)
              ? ((g as any).tv_providers as string[]).filter(Boolean)
              : (g as any).tv
                ? String((g as any).tv)
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [];

            const awayName = g.matchup ? g.matchup.split('@')[0]?.trim() : undefined;
            const homeName = g.matchup ? g.matchup.split('@')[1]?.trim() : undefined;

            // Get team colors for vertical split with gradient
            const awayColor = awayAbbr && teamGradientColors[awayAbbr]?.start || '#1e40af';
            const homeColor = homeAbbr && teamGradientColors[homeAbbr]?.start || '#dc2626';

            // Determine if we should show team names based on card count
            const showTeamNames = games.length <= 6;

            return (
              <Card 
                key={g.game_id} 
                className="relative overflow-hidden transition-all duration-300 border p-2 flex flex-col h-full container cursor-pointer hover:ring-2 hover:ring-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('Card clicked, game_id:', g.game_id);
                  if (g.game_id && onGameClick) {
                    console.log('Calling onGameClick with:', g.game_id);
                    onGameClick(g.game_id);
                  }
                }}
              >
                {/* Pulsing red dot for live games */}
                {isLiveGame && (
                  <>
                    <style>
                      {`
                        @keyframes pulse {
                          0%, 100% {
                            opacity: 1;
                            transform: scale(1);
                          }
                          50% {
                            opacity: 0.6;
                            transform: scale(1.1);
                          }
                        }
                      `}
                    </style>
                    <div 
                      className="absolute top-2 left-2 z-10 sched-live-dot"
                      style={{
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        boxShadow: '0 0 6px rgba(255, 255, 255, 0.8), 0 0 12px rgba(255, 255, 255, 0.4)',
                        animation: 'pulse 1.5s ease-in-out infinite'
                      }}
                    />
                  </>
                )}
                {/* Vertical gradient from away team color to home team color - tighter blend in center */}
                <div 
                  className="absolute inset-0" 
                  style={{
                    background: `linear-gradient(to right, ${awayColor} 0%, ${awayColor} 20%, ${homeColor} 80%, ${homeColor} 100%)`
                  }}
                />
                {/* Semi-transparent overlay for better text readability */}
                <div className="absolute inset-0 bg-black/40" />
                
                {/* TV Badges top-right */}
                {providers.length > 0 && (
                  <div className="absolute top-1 right-1 flex flex-wrap justify-end gap-1 max-w-[200px] z-10">
                    {providers.map((p) => {
                      const name = String(p).toLowerCase();
                      let style: React.CSSProperties | undefined;
                      if (name.includes('prime')) {
                        style = { backgroundColor: '#00A8E1', color: '#ffffff' };
                      } else if (name.includes('peacock')) {
                        style = { backgroundColor: '#FFFFFF', color: '#000000' };
                      } else if (name.includes('espn')) {
                        style = { backgroundColor: '#C8102E', color: '#ffffff' };
                      }
                      return (
                        <Badge key={p} className="font-semibold" style={{ ...style, fontSize: "clamp(0.5rem, 1.8cqi, 0.6rem)", padding: "clamp(1px, 0.4cqi, 2px) clamp(3px, 1.2cqi, 6px)" }}>
                          {p}
                        </Badge>
                      );
                    })}
                  </div>
                )}

                <style>{`.sched-logo { width: 7cqi; height: 7cqi; } @media (max-width: 1023px) { .sched-logo { width: 10cqi; height: 10cqi; } }.sched-live-dot { width: 1.5cqi; height: 1.5cqi; } @media (min-width: 1024px) { .sched-live-dot { width: 1cqi; height: 1cqi; } }`}</style>
                <CardContent className="relative z-10 py-0 flex flex-col h-full">
                  {/* Main content - vertically centered */}
                  <div className="flex-1 flex items-center py-1">
                    <div className="grid grid-cols-3 items-center w-full" style={{ gap: "1cqi" }}>
                      {/* Away side */}
                      <div className="flex flex-col items-center justify-center gap-1">
                        {awayLogo && (
                          <img
                            src={awayLogo}
                            alt={awayAbbr || 'Away'}
                            className={`sched-logo rounded-sm ${isFinal ? (awayWin ? 'opacity-100' : 'opacity-40') : ''}`}
                            style={{
                              objectFit: 'contain',
                              ...(isFinal && awayWin ? { filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(255,255,255,0.6))' } : {})
                            }}
                            loading="lazy"
                          />
                        )}
                      </div>

                      {/* Center time or score */}
                      <div className="flex items-center justify-center">
                        {hasScores ? (
                          <div className="font-extrabold tracking-wide flex items-center justify-center" style={{ fontSize: "clamp(1rem, 3.5cqi, 1.5rem)" }}>
                            <span className={awayScoreClass}>{aScore}</span>
                            <span className="text-white" style={{ margin: "0 0.6cqi" }}>-</span>
                            <span className={homeScoreClass}>{hScore}</span>
                          </div>
                        ) : (
                          <div className="font-bold text-white" style={{ fontSize: "clamp(0.75rem, 2.8cqi, 1.1rem)" }}>
                            {g.time || 'TBA'}
                          </div>
                        )}
                      </div>

                      {/* Home side */}
                      <div className="flex flex-col items-center justify-center gap-1">
                        {homeLogo && (
                          <img
                            src={homeLogo}
                            alt={homeAbbr || 'Home'}
                            className={`sched-logo rounded-sm ${isFinal ? (homeWin ? 'opacity-100' : 'opacity-40') : ''}`}
                            style={{
                              objectFit: 'contain',
                              ...(isFinal && homeWin ? { filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(255,255,255,0.6))' } : {})
                            }}
                            loading="lazy"
                          />
                        )}
                      </div>
                    </div>
                  </div>

              </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};




// ============================
// 🧑‍🤝‍🧑 PlayerModal Component
type TeamModalStatGroup = {
  title: string;
  stats: Array<{ key: keyof NBATeam; label?: string }>;
};

const TEAM_MODAL_STAT_GROUPS: TeamModalStatGroup[] = [
  {
    title: 'Record & Efficiency',
    stats: [
      { key: 'GP' },
      { key: 'WIN_PCT' },
      { key: 'MIN' },
      { key: 'PLUS_MINUS' },
      { key: 'W_PCT_RANK' },
      { key: 'PTS'},
      { key: 'FGM' },
      { key: 'FGA' },
      { key: 'FG_PCT' },
      { key: 'FG3M' },
      { key: 'FG3A' },
      { key: 'FG3_PCT' },
      { key: 'FTM' },
      { key: 'FTA' },
    ],
  },
  {
    title: 'Shooting & Rebounding',
    stats: [
      { key: 'FT_PCT' },
      { key: 'REB' },
      { key: 'OREB' },
      { key: 'DREB' },
      { key: 'AST' },
      { key: 'TOV' },
      { key: 'PF' },
      { key: 'PFD' },
      { key: 'STL' },
      { key: 'BLK' },
      { key: 'BLKA' },
      { key: 'bpi', label: 'BPI'  },
      { key: 'off', label: 'OFF'   },
      { key: 'def', label: 'DEF'   },
    ],
  },
  {
    title: 'Rankings (Part 1)',
    stats: [
      { key: 'pbpi', label: 'PBPI'   },
      { key: 'GP_RANK' },
      { key: 'W_RANK' },
      { key: 'L_RANK' },
      { key: 'MIN_RANK' },
      { key: 'FGM_RANK' },
      { key: 'FGA_RANK' },
      { key: 'FG_PCT_RANK' },
      { key: 'FG3M_RANK' },
      { key: 'FG3A_RANK' },
      { key: 'FG3_PCT_RANK' },
      { key: 'FTM_RANK' },
      { key: 'FTA_RANK' },
      { key: 'FT_PCT_RANK' },
    ],
  },
  {
    title: 'Rankings (Part 2)',
    stats: [
      { key: 'OREB_RANK' },
      { key: 'DREB_RANK' },
      { key: 'REB_RANK' },
      { key: 'AST_RANK' },
      { key: 'TOV_RANK' },
      { key: 'STL_RANK' },
      { key: 'BLK_RANK' },
      { key: 'BLKA_RANK' },
      { key: 'PF_RANK' },
      { key: 'PFD_RANK' },
      { key: 'PTS_RANK' },
      { key: 'PLUS_MINUS_RANK', label: '+/- Rank'  },
    ],
  },
];

const TEAM_MODAL_PERCENT_STATS = new Set<keyof NBATeam>([
  'WIN_PCT',
  'W_PCT',
  'FG_PCT',
  'FG3_PCT',
  'FT_PCT',
]);

const TEAM_MODAL_RANK_STATS = new Set<keyof NBATeam>([
  'GP_RANK',
  'W_RANK',
  'L_RANK',
  'W_PCT_RANK',
  'MIN_RANK',
  'FGM_RANK',
  'FGA_RANK',
  'FG_PCT_RANK',
  'FG3M_RANK',
  'FG3A_RANK',
  'FG3_PCT_RANK',
  'FTM_RANK',
  'FTA_RANK',
  'FT_PCT_RANK',
  'OREB_RANK',
  'DREB_RANK',
  'REB_RANK',
  'AST_RANK',
  'TOV_RANK',
  'STL_RANK',
  'BLK_RANK',
  'BLKA_RANK',
  'PF_RANK',
  'PFD_RANK',
  'PTS_RANK',
  'PLUS_MINUS_RANK',
]);

const TEAM_MODAL_STATS = TEAM_MODAL_STAT_GROUPS.flatMap((group) => group.stats);
const TEAM_MODAL_STAT_COLUMNS = (() => {
  const columnCount = 4;
  const perColumn = Math.ceil(TEAM_MODAL_STATS.length / columnCount);
  return Array.from({ length: columnCount }, (_, index) =>
    TEAM_MODAL_STATS.slice(index * perColumn, (index + 1) * perColumn),
  );
})();

const LOWER_IS_BETTER_TEAM_STATS: Set<keyof NBATeam> = new Set<keyof NBATeam>([
  'TOV',
  'PF',
  'BLKA',
]);

const NO_HIGHLIGHT_STATS: Set<keyof NBATeam> = new Set<keyof NBATeam>([
  'GP',
]);

const isRankStatKey = (key: keyof NBATeam) =>
  TEAM_MODAL_RANK_STATS.has(key) ||
  key === 'rank';

const determineTeamStatHighlight = (
  team: NBATeam,
  key: keyof NBATeam,
  leagueAverages: LeagueAverageMap | null,
  allTeams: NBATeam[],
): 'high' | 'low' | 'neutral' | 'best' => {
  const rawValue = (team as any)[key];
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) return 'neutral';
  if (NO_HIGHLIGHT_STATS.has(key)) return 'neutral';

  if (isRankStatKey(key)) {
    const rankValue = Math.round(numericValue);
    if (rankValue === 1) return 'best';
    const totalTeams = allTeams.length || 30;
    const midpoint = Math.ceil(totalTeams / 2);
    return rankValue <= midpoint ? 'high' : 'low';
  }

  try {
    const values = allTeams
      .map((t) => Number((t as any)[key]))
      .filter((v) => Number.isFinite(v));
    if (values.length > 0) {
      const best = LOWER_IS_BETTER_TEAM_STATS.has(key) ? Math.min(...values) : Math.max(...values);
      if (Math.abs(numericValue - best) < 1e-6) return 'best';
    }
  } catch {}

  if (!leagueAverages) return 'neutral';
  const avgValue = Number((leagueAverages as any)?.[key]);
  if (!Number.isFinite(avgValue)) return 'neutral';
  const diff = numericValue - avgValue;
  if (Math.abs(diff) < 0.01) return 'neutral';
  if (LOWER_IS_BETTER_TEAM_STATS.has(key)) {
    return diff < 0 ? 'high' : 'low';
  }
  return diff > 0 ? 'high' : 'low';
};

const formatTeamModalStatValue = (team: NBATeam, key: keyof NBATeam) => {
  const rawValue = (team as any)[key];
  if (rawValue === null || rawValue === undefined || rawValue === '') return '-';
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) return String(rawValue);
  if (TEAM_MODAL_PERCENT_STATS.has(key)) {
    return `${(numeric * 100).toFixed(1)}%`;
  }
  if (TEAM_MODAL_RANK_STATS.has(key) || key === 'rank') {
    return `# ${Math.round(numeric)}`;
  }
  return Number.isInteger(numeric) ? numeric.toFixed(0) : numeric.toFixed(1);
};

type ModalTab = 'stats' | 'roster' | 'matchups';
const MODAL_TAB_CONFIG: { key: ModalTab; label: string }[] = [
  { key: 'stats', label: 'Full Stats' },
  { key: 'roster', label: 'Roster' },
  { key: 'matchups', label: 'Schedule' },
];

// Displays a team's full roster in a modal
// ============================

const getPlayerValueScore = (p: Player) => {
  const fgm = p.FG_PCT * p.FGA;
  const ftm = p.FT_PCT * p.FTA;
  const fgMisses = p.FGA - fgm;
  const ftMisses = p.FTA - ftm;

  const rawScore =
    1.0 * p.PTS +
    0.8 * p.AST +
    0.6 * p.REB +
    1.0 * p.STL +
    0.8 * p.BLK -
    1.0 * p.TOV -
    0.7 * fgMisses -
    0.5 * ftMisses;

  const normalized = ((rawScore + 20) / 69) * 100;
  return Math.max(0, Math.min(100, Number(normalized.toFixed(1))));
};




const PlayerModal = ({
  team,
  nbaPlayerData,
  scheduleData,
  logoMap,
  leagueAverages,
  allTeams,
  onClose,
}: {
  team: NBATeam;
  nbaPlayerData: Record<string, Player[]>;
  scheduleData: NBAScheduleData | null;
  logoMap: Record<string, string>;
  leagueAverages: LeagueAverageMap | null;
  allTeams?: NBATeam[];
  onClose: () => void;
}) => {
  const players: Player[] = nbaPlayerData[team.TEAM_ID.toString()] || [];
  const sortedPlayers = React.useMemo(() => {
    return [...players].sort((a, b) => getPlayerValueScore(b) - getPlayerValueScore(a));
  }, [players]);
  const [modalTab, setModalTab] = useState<ModalTab>('stats');
  const [highlightedMatchupId, setHighlightedMatchupId] = useState<string | null>(null);
  const teamAbbrRaw = teamAbbreviations[team.TEAM_NAME] || (team as any).TEAM_ABBREVIATION || 'UNK';
  const teamAbbr = (teamAbbrRaw || 'UNK').toUpperCase();
  const teamLogo = team.LOGO_URL || logoMap[teamAbbr];
  const navPrimary = teamColors[teamAbbr]?.primary || '#1e40af';
  const navSecondary = teamColors[teamAbbr]?.secondary || '#b91c1c';
  const recordLabel = `${team.W}-${team.L}`;
  const bpiRankLabel = (team as any).bpirank ?? '—';
  const getGameTimestamp = (game: ScheduleGameAny) => {
    if (game.date) {
      const ts = Date.parse(game.date as string);
      if (!Number.isNaN(ts)) return ts;
    }
    return 0;
  };

  const modalTeams = allTeams && allTeams.length ? allTeams : ALL_TEAMS_CACHE;
  const getModalStatHighlight = React.useCallback(
    (key: keyof NBATeam) => determineTeamStatHighlight(team, key, leagueAverages, modalTeams),
    [team, leagueAverages, modalTeams],
  );

  const teamMatchups = React.useMemo(() => {
    if (!scheduleData) return [] as Array<
      ScheduleGameAny & ResolvedGameTeams & { isHome: boolean }
    >;
    const gamesArr: ScheduleGameAny[] = Array.isArray(scheduleData)
      ? (scheduleData as ScheduleGameAny[])
      : (scheduleData?.games || []);
    const matches = gamesArr
      .map((g) => {
        const teams = resolveMatchupTeams(g);
        return { ...g, ...teams };
      })
      .filter((g) => {
        const home = (g as any).homeAbbr || '';
        const away = (g as any).awayAbbr || '';
        return home === teamAbbr || away === teamAbbr;
      })
      .map((g) => ({
        ...g,
        isHome: ((g as any).homeAbbr || '') === teamAbbr,
      }))
      .sort((a, b) => getGameTimestamp(a) - getGameTimestamp(b));
    return matches;
  }, [scheduleData, teamAbbr]);

  const teamMatchupsWithRecord = React.useMemo(() => {
    let wins = 0;
    let losses = 0;
    let ties = 0;
    return teamMatchups.map((game) => {
      const teamScore = Number(game.isHome ? (game as any).home_score : (game as any).away_score);
      const opponentScore = Number(game.isHome ? (game as any).away_score : (game as any).home_score);
      let outcome: 'W' | 'L' | 'T' | null = null;
      if (Number.isFinite(teamScore) && Number.isFinite(opponentScore)) {
        if (teamScore > opponentScore) {
          wins += 1;
          outcome = 'W';
        } else if (teamScore < opponentScore) {
          losses += 1;
          outcome = 'L';
        } else {
          ties += 1;
          outcome = 'T';
        }
      }
      const baseRecord = `${wins}-${losses}`;
      const recordLabel = ties > 0 ? `${baseRecord}-${ties}` : baseRecord;
      return { ...game, teamScore, opponentScore, outcome, recordLabel };
    });
  }, [teamMatchups]);

  const latestCompletedMatchupId = React.useMemo(() => {
    const now = Date.now();
    // Find the most recent game that has a score AND is in the past
    for (let i = teamMatchupsWithRecord.length - 1; i >= 0; i -= 1) {
      const game = teamMatchupsWithRecord[i];
      const gameTimestamp = getGameTimestamp(game);
      // Only consider games that:
      // 1. Have an outcome (have been played)
      // 2. Are in the past (timestamp < now)
      if (game.outcome && gameTimestamp > 0 && gameTimestamp < now) {
        return `matchup-${game.game_id}`;
      }
    }
    return null;
  }, [teamMatchupsWithRecord]);

  const scrollToLatestMatchup = React.useCallback(() => {
    if (!latestCompletedMatchupId) return;
    setHighlightedMatchupId(latestCompletedMatchupId);
    try {
      const el = document.getElementById(latestCompletedMatchupId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch {}
  }, [latestCompletedMatchupId]);

  useEffect(() => {
    if (!highlightedMatchupId) return;
    const timer = setTimeout(() => setHighlightedMatchupId(null), 3500);
    return () => clearTimeout(timer);
  }, [highlightedMatchupId]);


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
const teamStatLeaders = React.useMemo<StatLeaderMap>(() => {
  const leaderMap: StatLeaderMap = {};
  const epsilon = 0.01;
  PLAYER_STAT_KEYS.forEach((key) => {
    let bestValue: number | null = null;
    let leaderIds: number[] = [];
    players.forEach((p) => {
      const value = Number((p as any)[key]);
      if (!Number.isFinite(value)) return;
      if (bestValue === null) {
        bestValue = value;
        leaderIds = [p.PLAYER_ID];
        return;
      }
      const better = PLAYER_LOWER_IS_BETTER.has(key)
        ? value < bestValue - epsilon
        : value > bestValue + epsilon;
      if (better) {
        bestValue = value;
        leaderIds = [p.PLAYER_ID];
        return;
      }
      if (Math.abs(value - bestValue) <= epsilon) {
        leaderIds.push(p.PLAYER_ID);
      }
    });
    if (bestValue !== null && leaderIds.length > 0) {
      leaderMap[key] = { value: bestValue, playerIds: leaderIds };
    }
  });
  return leaderMap;
}, [players]);

  // ???? Highlight player stat vs. team average
const getTeamHighlight = (player: Player, key: keyof Player) => {
  const leaderEntry = teamStatLeaders[key];
  if (leaderEntry?.playerIds.includes(player.PLAYER_ID)) {
    return 'best';
  }
  if (!teamAverages) return 'neutral';

  const playerValue = Number((player as any)[key]);
  const avgValue = Number((teamAverages as any)[key]);
  if (isNaN(playerValue) || isNaN(avgValue)) return 'neutral';

  const diff = playerValue - avgValue;
  if (Math.abs(diff) < 0.01) return 'neutral';

  // dYY? Stats where lower is better
  if (PLAYER_LOWER_IS_BETTER.has(key)) {
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
        className="relative bg-background rounded-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden border"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'scaleIn 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-6 flex flex-wrap items-center gap-4 z-10">
          <div className="flex-1 min-h-0 flex items-center gap-3">
            {teamLogo && (
              <img
                src={teamLogo}
                alt={`${team.TEAM_NAME} logo`}
                className="w-10 h-10 rounded-md object-contain"
                loading="lazy"
              />
            )}
            <h2 className="text-3xl font-bold">{team.TEAM_NAME}</h2>
          </div>
          <div className="flex items-center gap-6 ml-auto text-right text-white/90">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Record</p>
              <p className="text-lg font-semibold text-white">{recordLabel}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">BPI Rank</p>
              <p className="text-lg font-semibold text-white">{bpiRankLabel}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-accent rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Roster / Matchups */}
        <div className={`p-6 ${modalTab === 'stats' ? 'overflow-y-hidden' : 'overflow-y-auto'} max-h-[calc(90vh-140px)] space-y-4`}>
          <div className="w-full">
            <div className="inline-flex w-full items-center justify-center rounded-full bg-muted/40 p-1 shadow-inner backdrop-blur-sm">
              {MODAL_TAB_CONFIG.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`relative flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 ${
                    modalTab === tab.key
                      ? 'text-white shadow-md'
                      : 'text-muted-foreground hover:scale-[1.05] active:scale-95'
                  }`}
                  onClick={() => setModalTab(tab.key)}
                  style={
                    modalTab === tab.key
                      ? {
                          backgroundImage: `linear-gradient(120deg, ${navSecondary}, ${navPrimary})`,
                        }
                      : undefined
                  }
                >
                  <span>{tab.label}</span>
                  <span
                    className={`pointer-events-none absolute inset-0 rounded-full bg-white/10 transition-all duration-300 ${
                      modalTab === tab.key ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                    }`}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          </div>
          {modalTab === 'stats' && (
            <div className="relative rounded-xl overflow-hidden">
              <div
                className="relative rounded-xl overflow-hidden"
                style={{
                  backgroundImage: `linear-gradient(300deg, ${
                    teamGradientColors[teamAbbr]?.start || '#1e40af'
                  }, ${teamGradientColors[teamAbbr]?.end || '#dc2626'})`,
                  padding: '3px',
                }}
              >
                <div
                  className="absolute inset-1 rounded-xl"
                  style={{ backgroundColor: '#1d1d1dff', opacity: 1 }}
                  aria-hidden
                />
                <div className="relative z-10 p-4 text-white">
                  <Card
                    className="overflow-hidden transition-all duration-300 bg-card/50 backdrop-blur-sm border-1"
                    style={{ backgroundColor: '#0000004c', opacity: 1 }}
                  >
                    <CardContent className="pt-6 pb-6 max-h-[70vh] overflow-y-auto">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4 xl:gap-x-10">
                        {TEAM_MODAL_STAT_COLUMNS.map((column, colIndex) => (
                          <div key={`modal-col-${colIndex}`} className="space-y-3">
                            {column.map((stat) => (
                              <StatRow
                                key={`modal-${stat.key}`}
                                label={stat.label ?? stat.key}
                                value={formatTeamModalStatValue(team, stat.key)}
                                highlight={getModalStatHighlight(stat.key)}
                                dense
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {modalTab === 'roster' && (
            <>
              {sortedPlayers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedPlayers.map((player, index) => {
                    const primary = teamColors[player.TEAM_ABBREVIATION]?.primary || '#1e40af';
                    const secondary = teamColors[player.TEAM_ABBREVIATION]?.secondary || '#b91c1c';
                    return (
                      <div
                        key={player.PLAYER_ID}
                        className="relative rounded-xl overflow-hidden"
                        style={{
                          backgroundImage: `linear-gradient(300deg, ${primary}, ${secondary})`,
                          padding: '3px',
                          animation: `slideUp 0.4s ease-out ${index * 0.05}s both`,
                        }}
                      >
                        <div
                          className="absolute inset-1 rounded-xl"
                          style={{ backgroundColor: '#1f1f1fff', opacity: 1 }}
                          aria-hidden
                        />
                        <div className="relative z-10 p-4 text-white">
                          <div className="flex items-center gap-2 mb-4">
                            {logoMap[player.TEAM_ABBREVIATION] && (
                              <img
                                src={logoMap[player.TEAM_ABBREVIATION]}
                                alt={`${player.TEAM_ABBREVIATION} logo`}
                                className="w-8 h-8 rounded-sm object-contain"
                                loading="lazy"
                                width={32}
                                height={32}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-bold truncate">{player.PLAYER_NAME}</h3>
                            </div>
                            <Badge
                              className="ml-auto text-xs font-semibold mt-1 bg-white text-black hover:bg-white hover:text-black flex-shrink-0"
                              style={{ letterSpacing: '0.3px', padding: '0.25rem 0.5rem' }}
                            >
                              Value {getPlayerValueScore(player).toFixed(1)}
                            </Badge>
                          </div>

                          <Card
                            className="overflow-hidden transition-all duration-300 bg-card/50 backdrop-blur-sm border-1 h-full"
                            style={{ backgroundColor: '#0000004c', opacity: 1 }}
                          >
                            <CardHeader className="pb-0" />
                            <CardContent>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <StatRow label="GP" value={player.GP.toFixed(0)} />
                                  <StatRow label="MIN" value={player.MIN.toFixed(1)} highlight={getTeamHighlight(player, 'MIN')} />
                                  <StatRow label="PPG" value={player.PTS.toFixed(1)} highlight={getTeamHighlight(player, 'PTS')} />
                                  <StatRow label="REB" value={player.REB.toFixed(1)} highlight={getTeamHighlight(player, 'REB')} />
                                  <StatRow label="AST" value={player.AST.toFixed(1)} highlight={getTeamHighlight(player, 'AST')} />
                                  <StatRow label="STL" value={player.STL.toFixed(1)} highlight={getTeamHighlight(player, 'STL')} />
                                  <StatRow label="BLK" value={player.BLK.toFixed(1)} highlight={getTeamHighlight(player, 'BLK')} />
                                </div>
                                <div className="space-y-2">
                                  <StatRow label="TOV" value={player.TOV.toFixed(1)} highlight={getTeamHighlight(player, 'TOV')} />
                                  <StatRow label="FGA" value={player.FGA.toFixed(1)} highlight={getTeamHighlight(player, 'FGA')} />
                                  <StatRow label="FG%" value={`${(player.FG_PCT * 100).toFixed(1)}%`} highlight={getTeamHighlight(player, 'FG_PCT')} />
                                  <StatRow label="3PA" value={player.FG3A.toFixed(1)} highlight={getTeamHighlight(player, 'FG3A')} />
                                  <StatRow label="3P%" value={`${(player.FG3_PCT * 100).toFixed(1)}%`} highlight={getTeamHighlight(player, 'FG3_PCT')} />
                                  <StatRow label="FTA" value={player.FTA.toFixed(1)} highlight={getTeamHighlight(player, 'FTA')} />
                                  <StatRow label="FT%" value={`${(player.FT_PCT * 100).toFixed(1)}%`} highlight={getTeamHighlight(player, 'FT_PCT')} />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No player data available for this team</div>
              )}
            </>
          )}
          {modalTab === 'matchups' && (
            <>
              <div className="flex items-center justify-between mb-4 gap-4">

                {latestCompletedMatchupId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={scrollToLatestMatchup}
                    className="
                      rounded-full px-2 py-2 text-[12px] font-semibold tracking-wide
                      text-black bg-white
                      hover:bg-white hover:text-black hover:scale-[1.05]
                      transition-all duration-300
                      focus:outline-none focus-visible:outline-none focus:ring-0 focus:ring-offset-0
                    "
                  >
                    Jump to latest game
                  </Button>
                )}
              </div>
              {!scheduleData ? (
                <div className="text-sm text-muted-foreground py-6 text-center">Schedule data unavailable.</div>
              ) : teamMatchupsWithRecord.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">No games found for this team.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {teamMatchupsWithRecord.map((game) => {
                    const cardId = `matchup-${game.game_id}`;
                    const homeAbbrResolved = (game as any).homeAbbr;
                    const awayAbbrResolved = (game as any).awayAbbr;
                    const homeLogo = homeAbbrResolved ? logoMap[homeAbbrResolved] : undefined;
                    const awayLogo = awayAbbrResolved ? logoMap[awayAbbrResolved] : undefined;
                    const homeName = (game as any).homeName || homeAbbrResolved || 'Home';
                    const awayName = (game as any).awayName || awayAbbrResolved || 'Away';
                    const rawHome = (game as any).home_score;
                    const rawAway = (game as any).away_score;
                    const homeScore = rawHome != null ? Number(rawHome) : NaN;
                    const awayScore = rawAway != null ? Number(rawAway) : NaN;
                    const hasScore = Number.isFinite(homeScore) && Number.isFinite(awayScore);
                    const homeWin = hasScore ? homeScore >= awayScore : false;
                    const awayWin = hasScore ? awayScore >= homeScore : false;
                    const statusText = String((game as any).status || '').toLowerCase();
                    const isFinal = statusText.includes('final') || Boolean((game as any).winner);
                    const isLive = (statusText.includes('live') || statusText.includes('in progress')) && !isFinal;
                    const providers: string[] = Array.isArray((game as any).tv_providers)
                      ? ((game as any).tv_providers as string[]).filter(Boolean)
                      : (game as any).tv
                        ? String((game as any).tv)
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                        : [];
                    const dateLabel = (() => {
                      if (!game.date) return 'Date TBA';
                      const dt = new Date(game.date);
                      if (Number.isNaN(dt.getTime())) return game.date;
                      dt.setDate(dt.getDate() + 1);
                      return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                    })();
                    const matchupLabel = `${awayAbbrResolved || 'Away'} @ ${homeAbbrResolved || 'Home'}`;
                    return (
                      <Card
                        key={`${game.game_id}-${matchupLabel}`}
                        id={cardId}
                        className={`relative overflow-hidden transition-all duration-300 bg-card border p-2 ${
                          highlightedMatchupId === cardId ? 'ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.45)]' : ''
                        }`}
                      >
                        {/* TV badges */}
                        {providers.length > 0 && (
                          <div className="absolute top-1 right-1 flex flex-wrap justify-end gap-1 max-w-[200px]">
                            {providers.map((p) => {
                              const name = String(p).toLowerCase();
                              let style: React.CSSProperties | undefined;
                              if (name.includes('prime')) {
                                style = { backgroundColor: '#00A8E1', color: '#ffffff' };
                              } else if (name.includes('peacock')) {
                                style = { backgroundColor: '#FFFFFF', color: '#000000' };
                              } else if (name.includes('espn')) {
                                style = { backgroundColor: '#C8102E', color: '#ffffff' };
                              }
                              return (
                                <Badge key={p} className="text-[9px] font-semibold px-1.5 py-0.5" style={style}>
                                  {p}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                        <CardContent className="pt-2 text-white space-y-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center justify-center flex-1 self-stretch translate-y-[15px]">
                              {awayLogo && (
                                <img
                                  src={awayLogo}
                                  alt={awayAbbrResolved || 'Away'}
                                  className={`h-10 w-10 rounded-sm object-contain ${
                                    isFinal ? (awayWin ? 'opacity-100' : 'opacity-40') : ''
                                  }`}
                                  style={
                                    isFinal && awayWin
                                      ? { filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8)) drop-shadow(0 0 10px rgba(255,255,255,0.5))' }
                                      : undefined
                                  }
                                  loading="lazy"
                                />
                              )}
                            </div>

                            <div className="flex flex-col items-center justify-center gap-1 px-2 min-w-[120px] self-stretch">
                              <div className="text-[11px] text-muted-foreground translate-y-[-10px]">{dateLabel}</div>
                              {isLive && (
                                <Badge className="bg-red-600 text-white animate-pulse font-bold px-3 py-0.5 text-[10px]">
                                  LIVE
                                </Badge>
                              )}
                              {hasScore ? (
                                <div className="text-2xl font-black tracking-wide">
                                  <span className={awayWin ? 'text-white' : 'text-white/40'}>{awayScore}</span>
                                  <span className="mx-2 text-muted-foreground">-</span>
                                  <span className={homeWin ? 'text-white' : 'text-white/40'}>{homeScore}</span>
                                </div>
                              ) : (
                                <div className="text-lg font-bold">{game.time || 'TBA'}</div>
                              )}
                            </div>

                            <div className="flex items-center justify-center flex-1 self-stretch translate-y-[12px]">
                              {homeLogo && (
                                <img
                                  src={homeLogo}
                                  alt={homeAbbrResolved || 'Home'}
                                  className={`h-10 w-10 rounded-sm object-contain ${
                                    isFinal ? (homeWin ? 'opacity-100' : 'opacity-40') : ''
                                  }`}
                                  style={
                                    isFinal && homeWin
                                      ? { filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8)) drop-shadow(0 0 10px rgba(255,255,255,0.5))' }
                                      : undefined
                                  }
                                  loading="lazy"
                                />
                              )}
                            </div>
                          </div>

                          <div className="text-[10px] text-muted-foreground text-center translate-y-[20px]">
                            {game.location || (game.tv || (game.tv_providers || []).join(', ')) || 'Venue TBA'}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
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
  allTeams,
  isFavorite = false,
  onToggleFavorite,
}: {
  team: NBATeam;
  onClick?: () => void;
  leagueAverages: any;
  allTeams?: NBATeam[];
  isFavorite?: boolean;
  onToggleFavorite?: (team: NBATeam) => void;
}) => {
  const teamsForBest = allTeams ?? ALL_TEAMS_CACHE;
  const teamAbbr = teamAbbreviations[team.TEAM_NAME] || 'UNK';
  const teamColor = teamColors[teamAbbr];
  const winPercentage = (team.WIN_PCT * 100).toFixed(1);

// Helper to determine stat color vs league average
const getHighlight = (statKey: TeamStatKey) => {
    const value = Number((team as any)[statKey]);
    const avgValue = Number((leagueAverages as any)?.[statKey]);
    const diff = value - avgValue;
  
  // 🔍 Detailed debug for TOV
  if (statKey === 'TOV') {
    console.log('TOV Debug:', {
      statKey,
      teamValue: (team as any)[statKey],
      leagueAvg: (leagueAverages as any)[statKey],
      diff: diff,
      absCheck: Math.abs(diff) < 0.01,
      setHas: new Set<TeamStatKey>(['TOV']).has(statKey),
      expectedResult: diff < 0 ? 'high (green)' : 'low (red)'
    });
  }
  
  // Gold highlight if best in league (handles lower-is-better like TOV)
  try {
    const epsilon = 1e-6;
    const values = teamsForBest
      .map((t) => Number((t as any)[statKey]))
      .filter((v) => Number.isFinite(v));
    const lowerIsBetterSet = new Set([
      'TOV',       // turnovers
      'PF',        // personal fouls (if you track it)
      'FGA_MISS',  // hypothetical example
      'FTA_MISS',  // hypothetical example
    ]);
    if (values.length > 0 && Number.isFinite(value)) {
      const best = lowerIsBetterSet.has(statKey as any) ? Math.min(...values) : Math.max(...values);
      if (Math.abs(value - best) < epsilon) return 'best';
    }
  } catch {}

  if (!Number.isFinite(avgValue)) return 'neutral';
  if (Math.abs(diff) < 0.01) return 'neutral';
  
  // 🧮 Stats where lower is better
  const lowerIsBetter = new Set([
    'TOV',       // turnovers
    'PF',        // personal fouls (if you track it)
    'FGA_MISS',  // hypothetical example
    'FTA_MISS',  // hypothetical example
  ]);
  
    if (lowerIsBetter.has(statKey)) {
      // Flip the logic – lower = high (good)
      return diff < 0 ? 'high' : 'low';
    }
    return diff > 0 ? 'high' : 'low';
  };

  // Highlight helper for advanced BPI metrics
  const getBpiHighlight = (key: 'bpi' | 'off' | 'def' | 'pbpi'): 'high' | 'low' | 'neutral' | 'best' => {
    const teamValue = Number((team as any)[key]);
    const avgValue = Number((leagueAverages as any)?.[key]);
    if (!Number.isFinite(teamValue)) return 'neutral';
    const diff = teamValue - avgValue;
    // Gold highlight if best team value in league for this metric
    try {
      const epsilon = 1e-6;
      const values = teamsForBest
        .map((t) => Number((t as any)[key]))
        .filter((v) => Number.isFinite(v));
      if (values.length > 0) {
        const best = Math.max(...values);
        if (Math.abs(teamValue - best) < epsilon) return 'best';
      }
    } catch {}
    if (!Number.isFinite(avgValue)) return 'neutral';
    if (Math.abs(diff) < 0.01) return 'neutral';
    // Higher is better for DEF and other BPI metrics
    return diff > 0 ? 'high' : 'low';
  };



return (
  <div
    className="relative rounded-xl overflow-hidden"
    style={{
      backgroundImage: `linear-gradient(300deg, ${
        teamGradientColors[teamAbbr]?.start || '#1e40af'
      }, ${teamGradientColors[teamAbbr]?.end || '#dc2626'})`,
      padding: '3px',
    }}
  >
    {/* === Dark overlay over the gradient === */}
    <div
      className="absolute inset-1 rounded-xl"
      style={{
        backgroundColor: '#1d1d1dff',
        opacity: 1,
      }}
      aria-hidden
    />

    {/* === Foreground content (sits above overlay) === */}
    <div className="relative z-10 p-4 text-white">
      {/* === Team header on top of gradient === */}
      <div className="flex items-center gap-2 mb-3">
        {team.LOGO_URL && (
          <img
            src={team.LOGO_URL}
            alt={`${team.TEAM_NAME} logo`}
            className="w-8 h-8 rounded-sm"
          />
        )}
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-lg font-bold truncate">{team.TEAM_NAME}</h3>
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onToggleFavorite(team);
              }}
              className={`p-1 rounded-full transition-colors ${
                isFavorite ? 'text-yellow-300' : 'text-white/40 hover:text-white/70'
              }`}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={isFavorite}
            >
              <Star
                className="w-4 h-4"
                fill={isFavorite ? '#fbbf24' : 'transparent'}
                strokeWidth={isFavorite ? 0 : 2}
              />
            </button>
          )}
        </div>
        <Badge
          className="ml-auto border-0 text-white font-semibold"
          style={{
            backgroundImage:
              team.W >= team.L
                ? 'linear-gradient(90deg, #ffffffff, #ffffffff)'
                : 'linear-gradient(90deg, #000000ff, #000000ff)',
            color: team.W >= team.L ? '#2b2b2bff' : '#ffffffff',
            padding: '0.25rem 0.6rem',
            borderRadius: '0.4rem',
            letterSpacing: '0.5px',
            textShadow: '0 1px 2px rgba(0,0,0,0.4)',
          }}
        >
          {team.W} - {team.L}
        </Badge>
      </div>

      {/* === White stats card === */}
 
      <Card
        onClick={onClick}
        className={`overflow-hidden transition-all duration-300 bg-card/50 backdrop-blur-sm border-1 h-full ${
          onClick ? 'cursor-pointer' : ''
        }`}
        style={{
        backgroundColor: '#0000004c',
        opacity: 1,
      }}
 
      >
        <CardHeader className="pb-0">
          
        </CardHeader>

        <CardContent>
          {/* 4-column stat grid to reduce height */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <StatRow label="Win " value={`${winPercentage}%`} highlight={getHighlight('WIN_PCT')} />
              <StatRow label="PPG" value={team.PTS.toFixed(1)} highlight={getHighlight('PTS')} />
              <StatRow label="RPG" value={team.REB.toFixed(1)} highlight={getHighlight('REB')} />
              <StatRow label="FT%" value={`${(team.FT_PCT * 100).toFixed(1)}%`} highlight={getHighlight('FT_PCT')} />
            </div>
            <div className="space-y-2">
              <StatRow label="TOV" value={team.TOV.toFixed(1)} highlight={getHighlight('TOV')} />
              <StatRow label="OREB" value={team.OREB.toFixed(1)} highlight={getHighlight('OREB')} />
              <StatRow label="DREB" value={team.DREB.toFixed(1)} highlight={getHighlight('DREB')} />
              <StatRow label="STL" value={team.STL.toFixed(1)} highlight={getHighlight('STL')} />
            </div>
            <div className="space-y-2">
              <StatRow label="BLK" value={team.BLK.toFixed(1)} highlight={getHighlight('BLK')} />
              <StatRow label="FG%" value={`${(team.FG_PCT * 100).toFixed(1)}%`} highlight={getHighlight('FG_PCT')} />
              <StatRow label="3P%" value={`${(team.FG3_PCT * 100).toFixed(1)}%`} highlight={getHighlight('FG3_PCT')} />
              <StatRow label="BPI" value={typeof (team as any).bpi === 'number' ? (team as any).bpi.toFixed(1) : ((team as any).bpi ?? '-')}
                highlight={getBpiHighlight('bpi')}
              />
            </div>
            <div className="space-y-2">
              <StatRow label="OFF" value={typeof (team as any).off === 'number' ? (team as any).off.toFixed(1) : ((team as any).off ?? '-')}
                highlight={getBpiHighlight('off')}
              />
              <StatRow label="DEF" value={typeof (team as any).def === 'number' ? (team as any).def.toFixed(1) : ((team as any).def ?? '-')}
                highlight={getBpiHighlight('def')}
              />
              <StatRow label="PBPI" value={typeof (team as any).pbpi === 'number' ? (team as any).pbpi.toFixed(1) : ((team as any).pbpi ?? '-')}
                highlight={getBpiHighlight('pbpi')}
              />
              <StatRow label="BPI RK" value={(team as any).bpirank ?? '-'} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
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
  const [nbaPlayerData, setNbaPlayerData] = useState<Record<string, Player[]>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [nbaTeams, setNbaTeams] = useState<NBATeam[]>([]);
  const [selectedConference, setSelectedConference] = useState<'all' | 'Eastern' | 'Western'>('all');
  const [activeTab, setActiveTab] = useState<string>('schedule'); // Change this to: 'dashboard', 'all', 'top-scorers', or 'schedule'
  const [selectedTeam, setSelectedTeam] = useState<NBATeam | null>(null);
  // Separate selection for All Teams detail pane to avoid opening roster modal
  const [selectedTeamAll, setSelectedTeamAll] = useState<NBATeam | null>(null);
  const [espnGameId, setEspnGameId] = useState<string | null>(null); // For ESPN iframe modal
  const [favoriteTeamIds, setFavoriteTeamIds] = useState<number[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = window.localStorage.getItem(FAVORITE_TEAMS_STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((value): value is number => Number.isFinite(value));
      }
    } catch {}
    return [];
  });
  const [teamFilters, setTeamFilters] = useState<Record<TeamFilterKey, string>>(() => getInitialTeamFilters());
  const [sortField, setSortField] = useState<TeamSortField>('WIN_PCT');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [scheduleData, setScheduleData] = useState<NBAScheduleData | null>(null);
  const logosScrollRef = useRef<HTMLDivElement | null>(null);
  const dashboardTeamRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const dashboardHighlightTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dashboardHighlightTeamId, setDashboardHighlightTeamId] = useState<number | null>(null);
  const [focusedAllTeamPlayer, setFocusedAllTeamPlayer] = useState<Player | null>(null);
  const toggleFavoriteTeam = React.useCallback((team: NBATeam) => {
    setFavoriteTeamIds((prev) => {
      const exists = prev.includes(team.TEAM_ID);
      return exists ? prev.filter((id) => id !== team.TEAM_ID) : [...prev, team.TEAM_ID];
    });
  }, []);
  const hasActiveTeamFilters = React.useMemo(
    () => TEAM_FILTER_FIELDS.some(({ key }) => {
      const raw = teamFilters[key];
      return typeof raw === 'string' && raw.trim().length > 0;
    }),
    [teamFilters],
  );
  const applyTeamFilters = useCallback(
    (team: NBATeam) => TEAM_FILTER_FIELDS.every(({ key, type }) => {
      const raw = teamFilters[key];
      if (!raw || raw.trim() === '') return true;
      const threshold = Number(raw);
      if (!Number.isFinite(threshold)) return true;
      let teamValue = Number((team as any)[key]);
      if (!Number.isFinite(teamValue)) return false;
      if (type === 'percent') {
        teamValue *= 100;
      }
      return teamValue >= threshold;
    }),
    [teamFilters],
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(FAVORITE_TEAMS_STORAGE_KEY, JSON.stringify(favoriteTeamIds));
    } catch {}
  }, [favoriteTeamIds]);
  // League-wide extrema for radar normalization (memoized for smooth animation)
  const radarMetricKeys = ['pts', 'reb', 'threes', 'ftm', 'blk', 'bpi', 'off', 'def', 'pbpi'] as const;
  type RadarMetricKey = (typeof radarMetricKeys)[number];
  const teamMaxima = useMemo(() => {
    const extremes = {
      max: {} as Record<RadarMetricKey, number>,
      min: {} as Record<RadarMetricKey, number>,
    };
    radarMetricKeys.forEach((key) => {
      extremes.max[key] = -Infinity;
      extremes.min[key] = Infinity;
    });
    nbaTeams.forEach((t) => {
      const values: Record<RadarMetricKey, number> = {
        pts: Number((t as any).PTS || 0),
        reb: Number((t as any).REB || 0),
        threes: Number((t as any).FG3M || 0),
        ftm: Number((t as any).FTM || 0),
        blk: Number((t as any).BLK || 0),
        bpi: Number((t as any).bpi || 0),
        off: Number((t as any).off || 0),
        def: Number((t as any).def || 0),
        pbpi: Number((t as any).pbpi || 0),
      };
      radarMetricKeys.forEach((key) => {
        const val = values[key];
        extremes.max[key] = Math.max(extremes.max[key], val);
        extremes.min[key] = Math.min(extremes.min[key], val);
      });
    });
    radarMetricKeys.forEach((key) => {
      if (!Number.isFinite(extremes.max[key])) extremes.max[key] = 0;
      if (!Number.isFinite(extremes.min[key])) extremes.min[key] = extremes.max[key];
    });
    return extremes;
  }, [nbaTeams]);
  // Lock page scroll while on NBA page; sections manage their own scroll
  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevDoc = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody || '';
      document.documentElement.style.overflow = prevDoc || '';
    };
  }, []);

  // Memoized sorted teams to avoid sorting on every render
const sortedTeams = useMemo(() => {
    const list = [...nbaTeams];
    const dir = sortOrder === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const av = (a as any)[sortField];
      const bv = (b as any)[sortField];
      return (av - bv) * dir;
    });
    return list;
  }, [nbaTeams, sortField, sortOrder]);
  const filteredTeams = useMemo(() => sortedTeams.filter(applyTeamFilters), [sortedTeams, applyTeamFilters]);
  const filterSignature = useMemo(
    () => JSON.stringify({ filters: teamFilters, sortField, sortOrder }),
    [teamFilters, sortField, sortOrder],
  );
  const lastFilterSignatureRef = useRef(filterSignature);
  useEffect(() => {
    const signatureChanged = filterSignature !== lastFilterSignatureRef.current;
    if (!filteredTeams.length) {
      if (selectedTeamAll) setSelectedTeamAll(null);
    } else if (
      signatureChanged ||
      !selectedTeamAll ||
      !filteredTeams.some((t) => selectedTeamAll && t.TEAM_ID === selectedTeamAll.TEAM_ID)
    ) {
      setSelectedTeamAll(filteredTeams[0]);
    }
    lastFilterSignatureRef.current = filterSignature;
  }, [filteredTeams, filterSignature, selectedTeamAll]);

const fetchData = async () => {
  try {
    setLoading(true);
    console.log('Fetching NBA data...');
    
    // Fetch team data with cache-busting timestamp
    const teamResponse = await fetch('/data/espn_NBA_team_stats.json?' + Date.now());
    console.log('Team response:', teamResponse.ok);
    if (!teamResponse.ok) throw new Error('Failed to fetch team data');
    const teamData = await teamResponse.json();
    console.log('Team data loaded:', teamData.length);
    
    // Fetch player data
    const playerResponse = await fetch('/data/espn_NBA_player_stats.json?' + Date.now());
    console.log('Player response:', playerResponse.ok);
    if (!playerResponse.ok) throw new Error('Failed to fetch player data');
    const playerData = await playerResponse.json();
    console.log('Player data loaded:', Object.keys(playerData).length);
    
    // Map team data with conference + division
    const teamsWithConference = teamData.map((team: NBATeam) => ({
      ...team,
      conference: teamConferences[team.TEAM_NAME]?.conference || 'Unknown',
      division: teamConferences[team.TEAM_NAME]?.division || 'Unknown',
    }));
    
    setNbaTeams(teamsWithConference);
    ALL_TEAMS_CACHE = teamsWithConference;
    setNbaPlayerData(playerData);

    // Fetch schedule data (initial load only; polling handled separately)
    try {
      const schedResp = await fetch('/data/nba_schedule.json', { cache: 'no-cache' });
      if (schedResp.ok) {
        const schedJson = (await schedResp.json()) as NBAScheduleData;
        setScheduleData(schedJson);
      } else {
        console.warn('Failed to fetch nba_schedule.json');
      }
    } catch (e) {
      console.warn('Schedule fetch error', e);
    }
    setLastUpdate(new Date());
    setLoading(false);
    console.log('Data loaded successfully!');
  } catch (error) {
    console.error('Error fetching NBA data:', error);
    setLoading(false);
    alert('Failed to load NBA data. Check console for details.');
  }
};


  // Map team data with conference + division
  // Initial load
useEffect(() => {
  fetchData();
}, []);

// Auto-refresh teams/players periodically (decoupled from schedule)
useEffect(() => {
  if (!autoRefresh) return;

  const interval = setInterval(() => {
    try {
      if (typeof document !== 'undefined' && document.hidden) return;
    } catch {}
    fetchData();
  }, 30000);

  return () => clearInterval(interval);
}, [autoRefresh]);

// Lightweight schedule-only polling with adaptive interval
useEffect(() => {
  let cancelled = false;
  if (!autoRefresh) return;

  const fetchScheduleOnly = async () => {
    try {
      if (typeof document !== 'undefined' && document.hidden) return;
      const resp = await fetch('/data/nba_schedule.json', { cache: 'no-cache' });
      if (!resp.ok) return;
      const text = await resp.text();
      if (cancelled) return;
      const next = JSON.parse(text) as NBAScheduleData;
      const currentText = JSON.stringify(scheduleData ?? null);
      if (text !== currentText) setScheduleData(next);
    } catch {}
  };

  const computeInterval = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayKey = `${y}-${m}-${d}`;
    const gamesArr: any[] = Array.isArray(scheduleData)
      ? (scheduleData as any[])
      : ((scheduleData as any)?.games || []);
    const todays = gamesArr.filter((g) => String(g.date || '').slice(0, 10) === todayKey);
    const anyLive = todays.some((g) => !(g.home_score && g.away_score));
    return anyLive ? 3000 : 60000;
  };

  const tick = () => fetchScheduleOnly();
  const id = setInterval(tick, computeInterval());
  tick();
  return () => { cancelled = true; clearInterval(id); };
}, [autoRefresh, scheduleData]);

// Refresh schedule immediately on tab visibility
useEffect(() => {
  const onVis = () => {
    if (document.visibilityState === 'visible') {
      fetch('/data/nba_schedule.json', { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setScheduleData(d))
        .catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', onVis);
  return () => document.removeEventListener('visibilitychange', onVis);
}, []);


  // Compute league averages
// Compute league averages
const leagueAverages = React.useMemo<LeagueAverageMap>(() => {
  if (nbaTeams.length === 0) return createLeagueAverageSeed();
  const totals = nbaTeams.reduce<LeagueAverageMap>(
    (acc, t) => {
      acc.WIN_PCT += t.WIN_PCT;
      acc.PTS += t.PTS;
      acc.REB += t.REB;
      acc.AST += t.AST;
      acc.FG_PCT += t.FG_PCT;
      acc.FG3_PCT += t.FG3_PCT;
      acc.FT_PCT += t.FT_PCT;
      acc.W_PCT += t.W_PCT;
      acc.MIN += t.MIN;
      acc.FGM += t.FGM;
      acc.FGA += t.FGA;
      acc.FG3M += t.FG3M;
      acc.FG3A += t.FG3A;
      acc.FTM += t.FTM;
      acc.FTA += t.FTA;
      acc.OREB += t.OREB;
      acc.DREB += t.DREB;
      acc.TOV += t.TOV;
      acc.STL += t.STL;
      acc.BLK += t.BLK;
      acc.BLKA += t.BLKA;
      acc.PF += t.PF;
      acc.PFD += t.PFD;
      acc.PLUS_MINUS += t.PLUS_MINUS;
      // Advanced metrics may be present on team objects
      acc.bpi += Number((t as any).bpi ?? 0);
      acc.off += Number((t as any).off ?? 0);
      acc.def += Number((t as any).def ?? 0);
      acc.pbpi += Number((t as any).pbpi ?? 0);
      return acc;
    },
    createLeagueAverageSeed()
  );
  const n = nbaTeams.length;
  return {
    WIN_PCT: totals.WIN_PCT / n,
    PTS: totals.PTS / n,
    REB: totals.REB / n,
    AST: totals.AST / n,
    FG_PCT: totals.FG_PCT / n,
    FG3_PCT: totals.FG3_PCT / n,
    FT_PCT: totals.FT_PCT / n,
    W_PCT: totals.W_PCT / n,
    MIN: totals.MIN / n,
    FGM: totals.FGM / n,
    FGA: totals.FGA / n,
    FG3M: totals.FG3M / n,
    FG3A: totals.FG3A / n,
    FTM: totals.FTM / n,
    FTA: totals.FTA / n,
    OREB: totals.OREB / n,
    DREB: totals.DREB / n,
    TOV: totals.TOV / n,
    STL: totals.STL / n,
    BLK: totals.BLK / n,
    BLKA: totals.BLKA / n,
    PF: totals.PF / n,
    PFD: totals.PFD / n,
    PLUS_MINUS: totals.PLUS_MINUS / n,
    // Advanced metrics
    bpi: totals.bpi / n,
    off: totals.off / n,
    def: totals.def / n,
    pbpi: totals.pbpi / n,
  };
}, [nbaTeams]);


// Compute league averages for player stats (PTS, REB, AST, FG%, 3P%, FT%)
// Compute league averages for ALL player stats
type PlayerAverages = {
  PTS: number; REB: number; AST: number; STL: number; BLK: number;
  FG_PCT: number; FG3_PCT: number; FT_PCT: number;
  GP: number; MIN: number; TOV: number; FGA: number; FG3A: number; FTA: number;
};

const allPlayers = React.useMemo(() => {
  return Object.values(nbaPlayerData).flat() as Player[];
}, [nbaPlayerData]);

const playerAverages = React.useMemo<PlayerAverages | null>(() => {
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
}, [allPlayers]);

const leagueStatLeaders = React.useMemo<StatLeaderMap>(() => {
  const leaderMap: StatLeaderMap = {};
  const epsilon = 0.01;
  PLAYER_STAT_KEYS.forEach((key) => {
    let bestValue: number | null = null;
    let leaderIds: number[] = [];
    allPlayers.forEach((p) => {
      const value = Number((p as any)[key]);
      if (!Number.isFinite(value)) return;
      if (bestValue === null) {
        bestValue = value;
        leaderIds = [p.PLAYER_ID];
        return;
      }
      const better = PLAYER_LOWER_IS_BETTER.has(key)
        ? value < bestValue - epsilon
        : value > bestValue + epsilon;
      if (better) {
        bestValue = value;
        leaderIds = [p.PLAYER_ID];
        return;
      }
      if (Math.abs(value - bestValue) <= epsilon) {
        leaderIds.push(p.PLAYER_ID);
      }
    });
    if (bestValue !== null && leaderIds.length > 0) {
      leaderMap[key] = { value: bestValue, playerIds: leaderIds };
    }
  });
  return leaderMap;
}, [allPlayers]);

// Map team abbreviation to logo URL for quick lookup in player cards
const abbrToLogo = React.useMemo(() => {
  const map: Record<string, string> = {};
  nbaTeams.forEach((t) => {
    const abbr = teamAbbreviations[t.TEAM_NAME];
    if (abbr && t.LOGO_URL) map[abbr] = t.LOGO_URL;
  });
  return map;
}, [nbaTeams]);

// Map team abbreviation to record string (W-L)
const abbrToRecord = React.useMemo(() => {
  const map: Record<string, string> = {};
  nbaTeams.forEach((t) => {
    const abbr = teamAbbreviations[t.TEAM_NAME];
    if (abbr) map[abbr] = `${t.W}-${t.L}`;
  });
  return map;
}, [nbaTeams]);

const abbrToTeamMap = React.useMemo(() => {
  const map: Record<string, NBATeam> = {};
  nbaTeams.forEach((t) => {
    const abbr = teamAbbreviations[t.TEAM_NAME];
    if (abbr) map[abbr.toUpperCase()] = t;
  });
  return map;
}, [nbaTeams]);




const getPlayerHighlight = (player: Player, key: keyof Player) => {
  const leaderEntry = leagueStatLeaders[key];
  if (leaderEntry?.playerIds.includes(player.PLAYER_ID)) {
    return 'best';
  }
  if (!playerAverages) return 'neutral';

  const playerValue = Number((player as any)[key]);
  const avgValue = Number((playerAverages as any)[key]);

  if (isNaN(playerValue) || isNaN(avgValue)) return 'neutral';

  const diff = playerValue - avgValue;
  if (Math.abs(diff) < 0.01) return 'neutral';

  // mark which stats should be “lower is better”
  if (PLAYER_LOWER_IS_BETTER.has(key)) {
    return diff < 0 ? 'high' : 'low';
  }
  return diff > 0 ? 'high' : 'low';
};

const getLeagueHighlight = (
  player: Player,
  key: keyof Player,
  leagueAverages: LeagueAverageMap | null
) => {
  if (!leagueAverages || !(key in leagueAverages)) return 'neutral';

  const playerValue = Number((player as any)[key]);
  const avgValue = Number((leagueAverages as any)[key]);
  if (isNaN(playerValue) || isNaN(avgValue)) return 'neutral';

  const diff = playerValue - avgValue;
  if (Math.abs(diff) < 0.01) return 'neutral';

  const lowerIsBetter = new Set(['TOV']);
  if (lowerIsBetter.has(key)) {
    return diff < 0 ? 'high' : 'low';
  }

  return diff > 0 ? 'high' : 'low';
};





type PlayerSortField =
  | 'VALUE_SCORE'
  | 'PTS'
  | 'REB'
  | 'AST'
  | 'STL'
  | 'BLK'
  | 'GP'
  | 'MIN'
  | 'TOV'
  | 'FGA'
  | 'FG_PCT'
  | 'FG3A'
  | 'FG3_PCT'
  | 'FTA'
  | 'FT_PCT';

const TOP_PLAYER_SORT_OPTIONS: Array<[PlayerSortField, string]> = [
  ['VALUE_SCORE', 'Value Score'],
  ['PTS', 'PTS'],
  ['REB', 'REB'],
  ['AST', 'AST'],
  ['STL', 'STL'],
  ['BLK', 'BLK'],
  ['GP', 'GP'],
  ['MIN', 'MIN'],
  ['TOV', 'TOV'],
  ['FGA', 'FGA'],
  ['FG_PCT', 'FG%'],
  ['FG3A', '3PA'],
  ['FG3_PCT', '3P%'],
  ['FTA', 'FTA'],
  ['FT_PCT', 'FT%'],
];

const [playerSortField, setPlayerSortField] = useState<PlayerSortField>('VALUE_SCORE');











const getPlayerStat = (p: Player, field: PlayerSortField): number => {
  switch (field) {
    case 'VALUE_SCORE': return getPlayerValueScore(p);
    case 'GP': return p.GP;
    case 'MIN': return p.MIN;
    case 'PTS': return p.PTS;
    case 'REB': return p.REB;
    case 'AST': return p.AST;
    case 'STL': return p.STL;
    case 'BLK': return p.BLK;
    case 'TOV': return p.TOV;
    case 'FGA': return p.FGA;
    case 'FG3A': return p.FG3A;
    case 'FTA': return p.FTA;
    case 'FG_PCT': return p.FG_PCT;
    case 'FG3_PCT': return p.FG3_PCT;
    case 'FT_PCT': return p.FT_PCT;
  }
};

// Memoize sorted players to avoid recalculating on every render
const sortedTopPlayers = React.useMemo(() => {
  return Object.values(nbaPlayerData)
    .flat()
    .sort(
      (a: Player, b: Player) =>
        getPlayerStat(b, playerSortField) - getPlayerStat(a, playerSortField)
    )
    .slice(0, 50);
}, [nbaPlayerData, playerSortField]); // ✅ added nbaPlayerData

// Memoize player value scores to avoid recalculating
const playerValueScores = React.useMemo(() => {
  const scores = new Map<number, number>();
  sortedTopPlayers.forEach((player) => {
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

  const dashboardTeamList = React.useMemo(() => {
    return [...nbaTeams].sort((a, b) => {
      const diff = b.WIN_PCT - a.WIN_PCT;
      return Math.abs(diff) < 1e-6 ? b.W - a.W : diff;
    });
  }, [nbaTeams]);

  const dashboardPlayerList = React.useMemo(() => {
    return Object.values(nbaPlayerData)
      .flat()
      .filter((p: Player) => Number.isFinite(p.PTS) && Number.isFinite(p.MIN))
      .sort((a: Player, b: Player) => getPlayerValueScore(b) - getPlayerValueScore(a))
      .slice(0, 50);
  }, [nbaPlayerData]);

  const handleDashboardTeamFocus = React.useCallback(
    ({ teamName, teamAbbr }: { teamName?: string; teamAbbr?: string }) => {
      const normalizedName = teamName?.trim().toLowerCase();
      const normalizedAbbr = teamAbbr?.trim().toUpperCase();
      const target = dashboardTeamList.find((t) => {
        const teamAbbr = ((t as any).TEAM_ABBREVIATION || teamAbbreviations[t.TEAM_NAME] || '').toUpperCase();
        return (
          (normalizedName && t.TEAM_NAME.toLowerCase() === normalizedName) ||
          (normalizedAbbr && teamAbbr === normalizedAbbr)
        );
      });
      if (!target) return;
      const node = dashboardTeamRefs.current[target.TEAM_ID];
      if (!node) return;
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setDashboardHighlightTeamId(target.TEAM_ID);
      if (dashboardHighlightTimeout.current) clearTimeout(dashboardHighlightTimeout.current);
      dashboardHighlightTimeout.current = setTimeout(() => {
        setDashboardHighlightTeamId(null);
      }, 1500);
    },
    [dashboardTeamList]
  );

useEffect(() => {
  if (logosScrollRef.current) {
    logosScrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
  }
}, [sortField, sortOrder]);

useEffect(() => {
  return () => {
    if (dashboardHighlightTimeout.current) {
      clearTimeout(dashboardHighlightTimeout.current);
    }
  };
}, []);




  
  // ============================
  // 🧭 Render
  // ============================
  return (
    <PageLayout theme="nba">
      <div className="flex justify-end">
      </div>
      {/* Tabs for Dashboard / All / East / West / Scorers / Schedule */}
      <Tabs
        theme="nba"
        value={activeTab}
        className="w-full"
        onValueChange={(v) => {
          setActiveTab(v);
          if (v === 'all' || v === 'Eastern' || v === 'Western') {
            setSelectedConference(v as any);
          }
        }}
      >
<TabsList className="grid py-2 px-2 w-full grid-cols-5 max-w-none mb-4 pl-28 gap-2 -mt-1">
    <TabsTrigger value="schedule">Scoreboard</TabsTrigger>
  <TabsTrigger value="standings">Standings</TabsTrigger>
  <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
  <TabsTrigger value="all">Team Stats</TabsTrigger>
  <TabsTrigger value="top-scorers">Top Players</TabsTrigger>
</TabsList>

<TabsContent value="dashboard">
  {/* === Outer Grid === */}
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(103vh-135px)] overflow-hidden -mt-0">
    
    {/* === LEFT COLUMN (2 equal static cards) === */}
    <div className="flex flex-col gap-4 lg:col-span-7 h-full overflow-hidden">
      {/* Top Teams */}
      <Card className="bg-card border w-full flex-1 min-h-0 flex flex-col overflow-hidden">
        <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden p-1">
          <div className="mb-5 px-1 flex-shrink-0">
            {/* Header content here if needed */}
          </div>
          <div className="flex-1 min-h-0 px-4 pb-4 overflow-y-auto">
            {(() => {
              const list = dashboardTeamList;
              return list.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {list.map((t) => (
                    <DashboardTeamMiniCard
                      key={t.TEAM_ID}
                      team={t}
                      highlight={dashboardHighlightTeamId === t.TEAM_ID}
                      onClick={() => setSelectedTeam(t)}
                      ref={(el) => {
                        if (el) {
                          dashboardTeamRefs.current[t.TEAM_ID] = el;
                        } else {
                          delete dashboardTeamRefs.current[t.TEAM_ID];
                        }
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-4">No team data</div>
              );
            })()}
          </div>
        </CardContent>
      </Card>
      
      {/* Top Players */}
      <Card className="bg-card border w-full flex-1 min-h-0 flex flex-col overflow-hidden">
        <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden p-1">
          <div className="mb-5 px-1 flex-shrink-0">
            {/* Header content here if needed */}
          </div>
          <div className="flex-1 min-h-0 px-4 pb-4 overflow-y-auto">
            {(() => {
              const list = dashboardPlayerList;
              return list.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {list.map((p, idx) => (
                    <DashboardPlayerMiniCard key={p.PLAYER_ID} player={p} logoMap={abbrToLogo} rank={idx + 1} />
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-4">No player data</div>
              );
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
    
    {/* Right column */}
    <div className="lg:col-span-5 h-full overflow-hidden">
      <Card className="bg-card border w-full h-full flex flex-col overflow-hidden">
        <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden py-0 px-3">
          <DashboardTodaySchedule
            scheduleData={scheduleData}
            logoMap={abbrToLogo}
            recordMap={abbrToRecord}
            onTeamFocus={handleDashboardTeamFocus}
            favoriteTeamIds={favoriteTeamIds}
            abbrToTeamMap={abbrToTeamMap}
          />
        </CardContent>
      </Card>
    </div>
  </div>
</TabsContent>



        {/* === Sort Controls === */}
<TabsContent value="all">

 {/* === Sort Controls (All Teams view) === */}
<div className="flex flex-wrap items-center justify-between mb-6 gap-3 px-2">
  {/* === Sort Dropdown === */}
  <div className="flex items-center gap-3">
    <label className="text-sm font-semibold text-white/80">Sort by:</label>

    <Select onValueChange={(v) => setSortField(v as typeof sortField)} value={sortField}>
      <SelectTrigger
        className="
  w-[150px] rounded-full px-4 py-2 text-sm font-semibold text-black
  bg-white
  hover:scale-[1.05]
  transition-all duration-300
  focus:outline-none focus-visible:outline-none focus:ring-0 focus:ring-offset-0
  focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:ring-0 data-[state=open]:ring-offset-0
"

      >
        <SelectValue placeholder="Select stat" />
      </SelectTrigger>

      <SelectContent
        className="
          rounded-xl border-0 backdrop-blur-lg bg-[#1c1c1cff]/90
          text-white"
      >
        <div className="grid grid-cols-3 gap-1 max-h-[260px] overflow-y-auto pr-1">
          {[
            ['WIN_PCT', 'Win %'],
            ['PTS', 'PPG'],
            ['REB', 'RPG'],
            ['FG_PCT', 'FG%'],
            ['FG3_PCT', '3P%'],
            ['FT_PCT', 'FT%'],
            ['TOV', 'TOV'],
            ['OREB', 'OREB'],
            ['DREB', 'DREB'],
            ['STL', 'STL'],
            ['BLK', 'BLK'],
            ['bpi', 'BPI'],
            ['off', 'OFF'],
            ['def', 'DEF'],
            ['pbpi', 'PBPI'],
          ].map(([value, label]) => (
            <SelectItem
              key={value}
              value={value as TeamSortField}
              className="cursor-pointer w-full justify-center text-center rounded-full px-4 py-2 text-sm font-semibold hover:bg-gradient-to-r hover:from-red-500 hover:to-purple-500 hover:text-white data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-red-500 data-[state=checked]:to-purple-500 data-[state=checked]:text-white transition-all duration-200 [&_[data-radix-select-item-indicator]]:hidden [&>span:first-child]:hidden"
            >
              {label}
            </SelectItem>
          ))}
        </div>
      </SelectContent>
    </Select>
  </div>

  {/* === Ascending / Descending Button === */}
 <Button
  variant="ghost"
  size="sm"
  onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
  className={`
    rounded-full px-4 py-2 text-sm font-semibold text-black
    bg-white
    hover:bg-white hover:text-black
    hover:scale-[1.05]
    transition-all duration-300
    focus:outline-none focus-visible:outline-none focus:ring-0 focus:ring-offset-0
  `}
>
  {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
</Button>

</div>


  {/* === Teams Sidebar + Detail Pane === */}
  {(() => {
    const teams = filteredTeams;
    if (teams.length === 0) {
      return (
        <div className="text-sm text-muted-foreground px-2 py-10">
          No teams match the current filters.
        </div>
      );
    }
    const currentTeam = selectedTeamAll && teams.some((t) => t.TEAM_ID === selectedTeamAll.TEAM_ID)
      ? selectedTeamAll
      : teams[0];
    const teamPlayers: Player[] = currentTeam ? (nbaPlayerData[currentTeam.TEAM_ID.toString()] || []) : [];
    const topTeamPlayers = [...teamPlayers]
      .sort((a, b) => getPlayerValueScore(b) - getPlayerValueScore(a));

    // Teammate averages for roster highlighting (All Teams tab)
    const teamAveragesAll = (() => {
      if (!teamPlayers.length) return null as any;
      const totals = teamPlayers.reduce(
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
          TOV: 0, FGA: 0, FG3A: 0, FTA: 0, FG_PCT: 0, FG3_PCT: 0, FT_PCT: 0,
        }
      );
      const n = teamPlayers.length;
      const avg: any = {};
      for (const k in totals) avg[k] = (totals as any)[k] / n;
      return avg as typeof totals;
    })();

    const getTeammateHighlight = (
      player: Player,
      key: keyof NonNullable<typeof teamAveragesAll>
    ): 'high' | 'low' | 'neutral' => {
      if (!teamAveragesAll) return 'neutral';
      const playerValue = Number((player as any)[key]);
      const avgValue = Number((teamAveragesAll as any)[key]);
      if (!Number.isFinite(playerValue) || !Number.isFinite(avgValue)) return 'neutral';
      const diff = playerValue - avgValue;
      if (Math.abs(diff) < 0.01) return 'neutral';
      const lowerIsBetter = new Set<keyof NonNullable<typeof teamAveragesAll>>(['TOV']);
      if (lowerIsBetter.has(key)) return diff < 0 ? 'high' : 'low';
      return diff > 0 ? 'high' : 'low';
    };

    return (
    <div className="flex flex-row gap-4 h-[85vh] overflow-hidden">
        {/* Left: logos as rounded-square buttons */}
        <div
          ref={logosScrollRef}
          className="w-20 md:w-40 xl:w-64 md:xl:w-72 lg:xl:w-80 shrink-0 overflow-y-auto no-scrollbar max-h-[85vh] pr-1 pt-0 pb-7 snap-y snap-mandatory"
          style={{ scrollPaddingTop: '24px', scrollPaddingBottom: '24px' }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {teams.map((t) => {
              const isActive = currentTeam && t.TEAM_ID === currentTeam.TEAM_ID;
              return (
                <button
                  key={t.TEAM_ID}
                  onClick={() => setSelectedTeamAll(t)}
                  className={`relative w-full aspect-square rounded-xl overflow-hidden bg-card/70 flex items-center justify-center transition-all duration-200 snap-start focus:outline-none focus-visible:outline-none active:outline-none`}
                  style={
                    isActive
                      ? {
                          border: '3px solid white',
                          boxShadow: '0 0 20px rgba(255,255,255,0.6)',
                        }
                      : {
                          border: '1px solid rgba(255,255,255,0.1)',
                        }
                  }
                  title={t.TEAM_NAME}
                >
                  {t.LOGO_URL ? (
                    <img
                      src={t.LOGO_URL}
                      alt={`${t.TEAM_NAME} logo`}
                      className="w-4/5 h-4/5 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground px-2 text-center">{t.TEAM_NAME}</span>
                  )}
                </button>
              );
            })}
          </div>

        </div>

        {/* Right: wide team card + players; parent does not scroll; inner players list scrolls */}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col gap-5 pr-0">
          {currentTeam && (() => {
            const teamAbbr = teamAbbreviations[currentTeam.TEAM_NAME] || 'UNK';
            const primaryColor = teamColors[teamAbbr]?.primary || '#4f46e5';
            const secondaryColor = teamColors[teamAbbr]?.secondary || '#4f46e5';
            const doughnutData = {
              labels: [],
              datasets: [
                {
                  data: [currentTeam.W, currentTeam.L],
                  backgroundColor: [primaryColor, '#4b5563'],
                  borderWidth: 0,
                },
              ],
            };
          const doughnutOptions: any = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '55%',
  responsiveAnimationDuration: 0,
  animation: {
    animateRotate: true,
    animateScale: false,
    duration: 180, easing: 'easeOutQuart',
  },
  transitions: {
    show: {
      animations: {
        circumference: { duration: 180, easing: 'easeOutQuart' },
        rotation: { duration: 180, easing: 'easeOutQuart' },
      },
    },
    hide: {
      animations: {
        circumference: { duration: 120, easing: 'easeInCubic' },
        rotation: { duration: 120, easing: 'easeInCubic' },
      },
    },
  },
  plugins: {
    legend: {
      position: 'bottom',
      labels: { color: 'currentColor', boxWidth: 10 },
    },
    tooltip: { enabled: true },
  },
};

            // Radar (spider) chart data and options
            const radarMetrics = [
              { label: 'PPG', key: 'pts', value: Number(currentTeam.PTS || 0) },
              { label: 'RPG', key: 'reb', value: Number(currentTeam.REB || 0) },
              { label: '3PM', key: 'threes', value: Number(currentTeam.FG3M || 0) },
              { label: 'FTM', key: 'ftm', value: Number(currentTeam.FTM || 0) },
              { label: 'BLK', key: 'blk', value: Number(currentTeam.BLK || 0) },
              { label: 'BPI', key: 'bpi', value: Number((currentTeam as any).bpi || 0) },
              { label: 'OFF', key: 'off', value: Number((currentTeam as any).off || 0) },
              { label: 'DEF', key: 'def', value: Number((currentTeam as any).def || 0) },
              { label: 'PBPI', key: 'pbpi', value: Number((currentTeam as any).pbpi || 0) },
            ] as { label: string; key: RadarMetricKey; value: number }[];
            const normalizeMetric = (value: number, key: RadarMetricKey) => {
              const maxVal = teamMaxima.max[key];
              const minVal = teamMaxima.min[key];
              if (!Number.isFinite(maxVal) || !Number.isFinite(minVal)) return 0;
              if (Math.abs(maxVal - minVal) < 1e-6) return 50;
              return ((value - minVal) / (maxVal - minVal)) * 100;
            };
            const radarLabels = radarMetrics.map((metric) => metric.label);
            const normalizedValues = radarMetrics.map((metric) =>
              normalizeMetric(metric.value, metric.key)
            );
            const bgColor = secondaryColor && secondaryColor.length === 7 ? `${secondaryColor}55` : primaryColor;
            const radarData = {
              labels: radarLabels,
              datasets: [
                {
                  id: 'teamRadar',
                  label: currentTeam.TEAM_NAME,
                  data: normalizedValues,
                  backgroundColor: bgColor,
                  borderColor: secondaryColor,
                  pointBackgroundColor: secondaryColor,
                  pointBorderColor: '#fff',
                  borderWidth: 2,
                  tension: 0,
                },
              ],
            } as any;
            const radarOptions: any = {
              responsive: true,
              maintainAspectRatio: false,
              animation: { duration: 200, easing: 'easeOutQuart' },
              animations: { 
                numbers: { type: 'number', duration: 200, easing: 'easeOutQuart' },
                x: { duration: 200, easing: 'easeOutQuart' },
                y: { duration: 200, easing: 'easeOutQuart' },
              },
              transitions: { active: { animation: { duration: 200, easing: 'easeOutQuart' } } },
              plugins: { legend: { display: false }, tooltip: { enabled: true } },
              elements: { line: { tension: 0 } },
              scales: {
                r: {
                  suggestedMin: 0,
                  suggestedMax: 100,
                  angleLines: { color: 'rgba(255,255,255,0.1)' },
                  grid: { color: 'rgba(255,255,255,0.1)' },
                  pointLabels: { color: 'currentColor', font: { size: 10 } },
                  ticks: { display: false },
                },
              },
            };
            return (
              <div className="w-full flex flex-wrap gap-4 items-start">
                {/* Team card - fixed width, no shrinking */}
                <div className="w-full min-w-[450px] max-w-[550px] shrink-0">
                  <TeamCard
                    team={{ ...currentTeam, rank: (teams.findIndex((tt) => tt.TEAM_ID === currentTeam.TEAM_ID) + 1) || 1 }}
                    leagueAverages={leagueAverages}
                    allTeams={nbaTeams}
                    onClick={() => setSelectedTeam(currentTeam)}
                    isFavorite={favoriteTeamIds.includes(currentTeam.TEAM_ID)}
                    onToggleFavorite={toggleFavoriteTeam}
                  />
                </div>
                {/* Doughnut chart - flexible width, smaller min to stay with team card */}
                <div className="flex-1 min-w-[280px] max-w-[405px]">
                  <Card className="bg-transparent border-none w-full h-[235px] overflow-hidden">
                    <CardHeader className="py-2 px-3">
                    </CardHeader>
                    <CardContent className="h-[220px] p-1">
                      <Doughnut data={doughnutData} options={doughnutOptions} />
                    </CardContent>
                  </Card>
                </div>
                {/* Radar chart - flexible width */}
                <div className="flex-1 min-w-[280px] max-w-[342px]">
                  <Card className="bg-transparent border-none w-full h-[235px] overflow-hidden">
                    <CardContent className="h-[220px] p-1">
                      <Radar data={radarData} options={radarOptions} datasetIdKey="id" updateMode="active" />
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })()}

          {/* Players list (scrollable with snap, no rank number) */}
          <div className="flex-1 min-h-0 flex flex-col">
            {topTeamPlayers.length ? (
              <div
                className="flex-1 min-h-0 overflow-y-auto no-scrollbar snap-y snap-mandatory pt-0 pb-8"
                style={{ scrollPaddingTop: '16px', scrollPaddingBottom: '16px' }}
              >
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                  {topTeamPlayers.map((p) => {
                    const primary = teamColors[p.TEAM_ABBREVIATION]?.primary || '#1e40af';
                    const secondary = teamColors[p.TEAM_ABBREVIATION]?.secondary || '#dc2626';
                    return (
                      <div
                        key={p.PLAYER_ID}
                        className="relative rounded-xl overflow-hidden snap-start"
                        style={{
                          backgroundImage: `linear-gradient(300deg, ${primary}, ${secondary})`,
                          padding: '3px',
                          scrollMarginTop: '16px',
                          scrollMarginBottom: '16px',
                        }}
                      >
                        <div
                          className="absolute inset-1 rounded-xl"
                          style={{ backgroundColor: '#1f1f1f', opacity: 1 }}
                          aria-hidden
                        />
                        <div className="relative z-10 rounded-[16px] bg-[#111]/85 p-3 text-white">
                          <div className="flex items-center gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{p.PLAYER_NAME}</div>
                            </div>
                            <Badge className="ml-auto text-[10px] font-semibold bg-white text-black hover:bg-white hover:text-black">
                              Value {getPlayerValueScore(p).toFixed(1)}
                            </Badge>
                          </div>
                          {/* Key stats (match previous fields) */}
                          <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                            <div className="bg-background/40 rounded px-2 py-1 text-center">
                              <div className="text-muted-foreground">PPG</div>
                              <div className={`${getTeammateHighlight(p,'PTS')==='high' ? 'text-green-400 font-semibold' : getTeammateHighlight(p,'PTS')==='low' ? 'text-red-400 font-semibold' : 'font-semibold'}`}>{p.PTS.toFixed(1)}</div>
                            </div>
                            <div className="bg-background/40 rounded px-2 py-1 text-center">
                              <div className="text-muted-foreground">RPG</div>
                              <div className={`${getTeammateHighlight(p,'REB')==='high' ? 'text-green-400 font-semibold' : getTeammateHighlight(p,'REB')==='low' ? 'text-red-400 font-semibold' : 'font-semibold'}`}>{p.REB.toFixed(1)}</div>
                            </div>
                            <div className="bg-background/40 rounded px-2 py-1 text-center">
                              <div className="text-muted-foreground">APG</div>
                              <div className={`${getTeammateHighlight(p,'AST')==='high' ? 'text-green-400 font-semibold' : getTeammateHighlight(p,'AST')==='low' ? 'text-red-400 font-semibold' : 'font-semibold'}`}>{p.AST.toFixed(1)}</div>
                            </div>
                            <div className="bg-background/40 rounded px-2 py-1 text-center">
                              <div className="text-muted-foreground">FG%</div>
                              <div className={`${getTeammateHighlight(p,'FG_PCT')==='high' ? 'text-green-400 font-semibold' : getTeammateHighlight(p,'FG_PCT')==='low' ? 'text-red-400 font-semibold' : 'font-semibold'}`}>{(p.FG_PCT * 100).toFixed(1)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground px-1">No player data for this team</div>
            )}
          </div>
        </div>
      </div>
    );
  })()}
</TabsContent>


{/* === Schedule === */}
<TabsContent value="schedule" className="max-h-[100vh] overflow-y-auto no-scrollbar pb-16 pr-2">
  <ScheduleViewV2 scheduleData={scheduleData} logoMap={abbrToLogo} onGameClick={(gameId) => setEspnGameId(gameId)} />
</TabsContent>

{/* === Standings === */}
<TabsContent value="standings" className="max-h-[100vh] overflow-y-auto no-scrollbar pb-32 pr-2">
  <div className="grid grid-cols-2 gap-4">
    {/* Western Conference */}
    <div>
      <h2 className="text-xl mb-3 text-white text-center">WESTERN CONFERENCE</h2>
      <div className="grid grid-cols-1 gap-3">
        {nbaTeams
          .filter(team => teamConferences[team.TEAM_NAME]?.conference === 'Western')
          .sort((a, b) => b.W - a.W)
          .map((team, index) => {
            const teamAbbr = teamAbbreviations[team.TEAM_NAME] || 'UNK';
            const primaryColor = teamColors[teamAbbr]?.primary || '#4f46e5';
            const secondaryColor = teamColors[teamAbbr]?.secondary || '#dc2626';
            
            return (
              <div
                key={team.TEAM_ID}
                className="relative rounded-xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-all duration-200"
                onClick={() => setSelectedTeam(team)}
                style={{
                  backgroundImage: `linear-gradient(90deg, ${primaryColor}33 0%, ${primaryColor}33 60%, ${secondaryColor}33 100%)`,
                  animation: `slideUp 0.4s ease-out ${index * 0.05}s both`,
                }}
              >
                {/* Card content */}
                <div className="relative z-10 flex items-center justify-between px-3 py-3 h-20">
                  {/* Team Logo - Large on left */}
                  {team.LOGO_URL && (
                    <img
                      src={team.LOGO_URL}
                      alt={`${team.TEAM_NAME} logo`}
                      className="h-40 w-40 object-contain"
                      loading="lazy"
                    />
                  )}
                  
                  {/* Right side - Ranking and Record */}
                  <div className="flex flex-col items-end justify-between h-16">
                    {/* Ranking number at top */}
                    <div 
                      className="text-lg font-black text-white"
                      style={{ lineHeight: '1' }}
                    >
                      #{index + 1}
                    </div>
                    
                    {/* Record at bottom */}
                    <div 
                      className="text-4xl font-bold text-white"
                      style={{ lineHeight: '1' }}
                    >
                      {team.W} - {team.L}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>

    {/* Eastern Conference */}
    <div>
      <h2 className="text-xl mb-3 text-white text-center">EASTERN CONFERENCE</h2>
      <div className="grid grid-cols-1 gap-3">
        {nbaTeams
          .filter(team => teamConferences[team.TEAM_NAME]?.conference === 'Eastern')
          .sort((a, b) => b.W - a.W)
          .map((team, index) => {
            const teamAbbr = teamAbbreviations[team.TEAM_NAME] || 'UNK';
            const primaryColor = teamColors[teamAbbr]?.primary || '#4f46e5';
            const secondaryColor = teamColors[teamAbbr]?.secondary || '#dc2626';
            
            return (
              <div
                key={team.TEAM_ID}
                className="relative rounded-xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-all duration-200"
                onClick={() => setSelectedTeam(team)}
                style={{
                  backgroundImage: `linear-gradient(90deg, ${primaryColor}33 0%, ${primaryColor}33 60%, ${secondaryColor}33 100%)`,
                  animation: `slideUp 0.4s ease-out ${index * 0.05}s both`,
                }}
              >
                {/* Card content */}
                <div className="relative z-10 flex items-center justify-between px-3 py-3 h-20">
                  {/* Team Logo - Large on left */}
                  {team.LOGO_URL && (
                    <img
                      src={team.LOGO_URL}
                      alt={`${team.TEAM_NAME} logo`}
                      className="h-40 w-40 object-contain"
                      loading="lazy"
                    />
                  )}
                  
                  {/* Right side - Ranking and Record */}
                  <div className="flex flex-col items-end justify-between h-16">
                    {/* Ranking number at top */}
                    <div 
                      className="text-lg font-black text-white"
                      style={{ lineHeight: '1' }}
                    >
                      #{index + 1}
                    </div>
                    
                    {/* Record at bottom */}
                    <div 
                      className="text-4xl font-bold text-white"
                      style={{ lineHeight: '1' }}
                    >
                      {team.W} - {team.L}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  </div>
</TabsContent>

{/* === Top Players === */}
<TabsContent value="top-scorers" className="max-h-[100vh] overflow-y-auto no-scrollbar pb-12 pr-2">

  {/* === Filter Controls === */}
<div className="flex flex-wrap items-center justify-between mb-5 gap-5">
  <div className="flex items-center gap-2">
    <label  className="text-sm font-semibold text-white/80">Rank by:</label>


    <div className="flex items-center gap-2">
      {/* Dropdown */}
      <Select onValueChange={(v) => setPlayerSortField(v as PlayerSortField)} value={playerSortField}>
        <SelectTrigger
          className="
            rounded-full px-4 py-2 text-sm font-semibold text-black
            bg-white
            hover:scale-[1.05]
            transition-all duration-300
            focus:outline-none focus-visible:outline-none focus:ring-0 focus:ring-offset-0
          "
        >
          <SelectValue placeholder="Select stat" />
        </SelectTrigger>
        <SelectContent
          className="
            rounded-xl border-0 backdrop-blur-lg bg-[#1c1c1cff]/90
            text-white
          "
        >
          <div className="grid grid-cols-3 gap-1 max-h-[260px] overflow-y-auto pr-1">
            {TOP_PLAYER_SORT_OPTIONS.map(([value, label]) => (
              <SelectItem
                key={value}
                value={value}
                className="cursor-pointer w-full justify-center text-center rounded-full px-4 py-2 text-sm font-semibold hover:bg-gradient-to-r hover:from-red-500 hover:to-purple-500 hover:text-white data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-red-500 data-[state=checked]:to-purple-500 data-[state=checked]:text-white transition-all duration-200 [&_[data-radix-select-item-indicator]]:hidden [&>span:first-child]:hidden"
              >
                {label}
              </SelectItem>
            ))}
          </div>
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
  
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-16">
  {sortedTopPlayers.map((player: Player, index) => (
      <div
        key={player.PLAYER_ID}
        className="relative rounded-xl overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(300deg, ${
            teamColors[player.TEAM_ABBREVIATION]?.primary || '#1e40af'
          }, ${teamColors[player.TEAM_ABBREVIATION]?.secondary || '#dc2626'})`,
          padding: '3px',
          animation: `slideUp 0.4s ease-out ${index * 0.05}s both`,
        }}
      >
        <div
          className="absolute inset-1 rounded-xl"
          style={{ backgroundColor: '#1f1f1fff', opacity: 1 }}
          aria-hidden
        />

        <div className="relative z-10 p-4 text-white">
          {/* Header with team logo and player name */}
          <div className="flex items-center gap-2 mb-4">
            {abbrToLogo[player.TEAM_ABBREVIATION] && (
              <img
                src={abbrToLogo[player.TEAM_ABBREVIATION]}
                alt={`${player.TEAM_ABBREVIATION} logo`}
                className="w-8 h-8 rounded-sm"
                loading="lazy"
                width={32}
                height={32}
              />
            )}
            <h3 className="text-lg font-bold">#{index + 1} {player.PLAYER_NAME}</h3>

            {/* Stat badge on the right */}
            <Badge
              className="ml-auto text-xs font-semibold mt-1 bg-white text-black hover:bg-white hover:text-black"
              style={{ letterSpacing: '0.3px', padding: '0.25rem 0.5rem' }}
            >
              {playerSortField === 'VALUE_SCORE'
                ? `Value: ${getPlayerValueScore(player).toFixed(1)}`
                : `${playerSortField.replace('_', ' ')}: ${getPlayerStat(player, playerSortField).toFixed(1)}`}
            </Badge>
          </div>

          {/* Inner stats card to match TeamCard style */}
          <Card
            className="overflow-hidden transition-all duration-300 bg-card/50 backdrop-blur-sm border-1 h-full"
            style={{ backgroundColor: '#0000004c', opacity: 1 }}
          >
            <CardHeader className="pb-0"></CardHeader>
            <CardContent>
              {/* Grid of Player Stats with Tooltips */}
              <div className="grid grid-cols-2 gap-4">
                {/* Left column */}
                <div className="space-y-2">
                  <StatRow label="GP" value={player.GP.toFixed(0)} />
                  <StatRow label="MIN" value={player.MIN.toFixed(1)} highlight={getPlayerHighlight(player, 'MIN')} />
                  <StatRow label="PPG" value={player.PTS.toFixed(1)} highlight={getPlayerHighlight(player, 'PTS')} />
                  <StatRow label="REB" value={player.REB.toFixed(1)} highlight={getPlayerHighlight(player, 'REB')} />
                  <StatRow label="AST" value={player.AST.toFixed(1)} highlight={getPlayerHighlight(player, 'AST')} />
                  <StatRow label="STL" value={player.STL.toFixed(1)} highlight={getPlayerHighlight(player, 'STL')} />
                  <StatRow label="BLK" value={player.BLK.toFixed(1)} highlight={getPlayerHighlight(player, 'BLK')} />
                </div>

                {/* Right column */}
                <div className="space-y-2">
                  <StatRow label="TOV" value={player.TOV.toFixed(1)} highlight={getPlayerHighlight(player, 'TOV')} />
                  <StatRow label="FGA" value={player.FGA.toFixed(1)} highlight={getPlayerHighlight(player, 'FGA')} />
                  <StatRow label="FG%" value={`${(player.FG_PCT * 100).toFixed(1)}%`} highlight={getPlayerHighlight(player, 'FG_PCT')} />
                  <StatRow label="3PA" value={player.FG3A.toFixed(1)} highlight={getPlayerHighlight(player, 'FG3A')} />
                  <StatRow label="3P%" value={`${(player.FG3_PCT * 100).toFixed(1)}%`} highlight={getPlayerHighlight(player, 'FG3_PCT')} />
                  <StatRow label="FTA" value={player.FTA.toFixed(1)} highlight={getPlayerHighlight(player, 'FTA')} />
                  <StatRow label="FT%" value={`${(player.FT_PCT * 100).toFixed(1)}%`} highlight={getPlayerHighlight(player, 'FT_PCT')} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    ))}
</div>
</TabsContent>


      </Tabs>

      {/* Player Modal */}
{selectedTeam && (
  <PlayerModal
    team={selectedTeam}
    nbaPlayerData={nbaPlayerData} // ✅ pass player data
    scheduleData={scheduleData}
    logoMap={abbrToLogo}
    leagueAverages={leagueAverages}
    allTeams={nbaTeams}
    onClose={() => setSelectedTeam(null)}
  />
)}

{/* ESPN Game Iframe Modal */}
{espnGameId && (
  <div 
    className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
    onClick={() => {
      console.log('Overlay clicked, closing modal');
      setEspnGameId(null);
    }}
    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
  >
    {console.log('ESPN Modal rendering with game ID:', espnGameId)}
    <div 
      className="relative bg-zinc-900 rounded-2xl w-full max-w-[95vw] h-[95vh] flex flex-col shadow-2xl border border-white/10"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-end p-3 border-b border-white/10 bg-transparent">
        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Open in new tab button */}
          <button
            onClick={() => window.open(`https://www.espn.com/nba/boxscore/_/gameId/${espnGameId}#gamepackage-box-score`, '_blank', 'noopener,noreferrer')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            title="Open in new tab"
          >
            Open in ESPN
          </button>
        
          {/* Close button */}
          <button
            onClick={() => {
              console.log('Close button clicked');
              setEspnGameId(null);
            }}
            className="bg-red-600 hover:bg-red-700 text-white rounded-lg p-2 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Iframe Container */}
      <div className="flex-1 overflow-hidden bg-white rounded-b-2xl">
        <iframe
          ref={(iframe) => {
            if (iframe) {
              iframe.onload = () => {
                try {
                  // Wait a bit for content to load, then scroll
                  setTimeout(() => {
                    if (iframe.contentWindow) {
                      // Scroll down 500 pixels (adjust this number as needed)
                      iframe.contentWindow.scrollTo({
                        top: 500,
                        behavior: 'smooth'
                      });
                    }
                  }, 1000); // Wait 1 second after load
                } catch (e) {
                  console.log('Could not scroll iframe (cross-origin restriction):', e);
                }
              };
            }
          }}
          src={`https://www.espn.com/nba/boxscore/_/gameId/${espnGameId}#gamepackage-box-score`}
          className="w-full h-full border-0"
          title="ESPN Game Details"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
          style={{
            backgroundColor: 'white'
          }}
        />
      </div>
    </div>
  </div>
)}




    </PageLayout>
  );
};

export default NBA;