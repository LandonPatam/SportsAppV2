// ============================
// 🏀 NBA Dashboard
// Displays NBA team standings and top player stats
// ============================

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { PageNavbar } from '@/components/layout/PageNavbar';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tabs, TabsContent,
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

// ── Module-level data cache ──────────────────────────────────────────────────
// Persists across tab switches (component unmount/remount) so the page renders
// instantly with stale data while the background refresh completes silently.
let _cachedTeams: NBATeam[] | null = null;
let _cachedPlayers: Record<string, Player[]> | null = null;
let _cachedSchedule: NBAScheduleData | null = null;
// ────────────────────────────────────────────────────────────────────────────

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
  period?: number;        // quarter/period number (1-4, or 5+ for OT)
  clock?: string;         // remaining time in period (e.g., "10.0")
  is_playoff?: boolean;
  series_note?: string;   // e.g., 'Eastern Conference First Round - Game 5'
  series_game_number?: number;
}

type NBAScheduleData =
  | { teams?: Record<string, string>; games?: ScheduleGameAny[] }
  | ScheduleGameAny[];

function parseScore(value: unknown): number {
  if (value === null || value === undefined || value === '') return Number.NaN;
  const score = Number(value);
  return Number.isFinite(score) ? score : Number.NaN;
}

interface NBASeasonOption {
  id: string;
  label: string;
  start_year: number;
  schedule: string;
  team_stats: string;
  player_stats: string;
}

interface NBASeasonManifest {
  current: string;
  seasons: NBASeasonOption[];
}

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
  UTA: { primary: '#753BBD', secondary: '#ffffff' }, // Purple, White
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
  'ATL': { start: '#E03A3E', end: '#C1D32F' },
  'BOS': { start: '#007A33', end: '#ffffff' },
  'BKN': { start: '#000000', end: '#FFFFFF' },
  'CHA': { start: '#1D1160', end: '#00788C' },
  'CHI': { start: '#CE1141', end: '#000000' },
  'CLE': { start: '#860038', end: '#FDBB30' },
  'DAL': { start: '#00538C', end: '#002B5E' },
  'DEN': { start: '#0E2240', end: '#FEC524' },
  'DET': { start: '#C8102E', end: '#1D42BA' },
  'GSW': { start: '#1D428A', end: '#FFC72C' },
  'HOU': { start: '#CE1141', end: '#000000' },
  'IND': { start: '#002D62', end: '#FDBB30' },
  'LAC': { start: '#090941', end: '#ffffff' },
  'LAL': { start: '#552583', end: '#FDB927' },
  'MEM': { start: '#5D76A9', end: '#12173F' },
  'MIA': { start: '#98002E', end: '#F9A01B' },
  'MIL': { start: '#00471B', end: '#EEE1C6' },
  'MIN': { start: '#0C2340', end: '#236192' },
  'NOP': { start: '#0C2340', end: '#C8102E' },
  'NYK': { start: '#006BB6', end: '#F58426' },
  'OKC': { start: '#007AC1', end: '#EF3B24' },
  'ORL': { start: '#0077C0', end: '#C4CED4' },
  'PHI': { start: '#ED184C', end: '#012B5C' },
  'PHX': { start: '#1D1160', end: '#E56020' },
  'POR': { start: '#E03A3E', end: '#000000' },
  'SAC': { start: '#5A2D81', end: '#63727A' },
  'SAS': { start: '#C4CED4', end: '#000000' },
  'TOR': { start: '#CE1141', end: '#000000' },
  'UTA': { start: '#270063', end: '#ffffff' },
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

// Compute current win/loss streak for each team from schedule results.
// Returns a map of abbr -> { type: 'W' | 'L', count: number }
// Compute current win/loss streak for each team from schedule results.
const computeStreakMap = (scheduleData: NBAScheduleData | null): Record<string, { type: 'W' | 'L'; count: number }> => {
  if (!scheduleData) return {};
  const gamesArr: ScheduleGameAny[] = Array.isArray(scheduleData)
    ? (scheduleData as ScheduleGameAny[])
    : (scheduleData.games || []);

  const finished = gamesArr.filter((g) => {
    const status = String((g as any).status || '').toLowerCase();
    const isFinal = status.includes('final') || Boolean((g as any).winner);
    const aScore = parseScore((g as any).away_score);
    const hScore = parseScore((g as any).home_score);
    return isFinal && Number.isFinite(aScore) && Number.isFinite(hScore);
  });

  finished.sort((a, b) => (String(a.date || '')).localeCompare(String(b.date || '')));

  const teamResults: Record<string, ('W' | 'L')[]> = {};
  for (const g of finished) {
    let awayAbbr = (g as any).away as string | undefined;
    let homeAbbr = (g as any).home as string | undefined;
    if ((!awayAbbr || !homeAbbr) && g.matchup) {
      const parts = g.matchup.split('@');
      const an = parts[0]?.trim();
      const hn = parts[1]?.trim();
      if (an) awayAbbr = (teamAbbreviations as any)[an] ?? awayAbbr;
      if (hn) homeAbbr = (teamAbbreviations as any)[hn] ?? homeAbbr;
    }
    if (!awayAbbr || !homeAbbr) continue;
    const aScore = parseScore((g as any).away_score);
    const hScore = parseScore((g as any).home_score);
    const awayWon = aScore > hScore;
    const awayKey = awayAbbr.toUpperCase();
    const homeKey = homeAbbr.toUpperCase();
    if (!teamResults[awayKey]) teamResults[awayKey] = [];
    if (!teamResults[homeKey]) teamResults[homeKey] = [];
    teamResults[awayKey].push(awayWon ? 'W' : 'L');
    teamResults[homeKey].push(awayWon ? 'L' : 'W');
  }

  const streakMap: Record<string, { type: 'W' | 'L'; count: number }> = {};
  for (const [abbr, results] of Object.entries(teamResults)) {
    if (results.length === 0) continue;
    const last = results[results.length - 1];
    let count = 0;
    for (let i = results.length - 1; i >= 0 && results[i] === last; i--) count++;
    streakMap[abbr] = { type: last, count };
  }
  return streakMap;
};

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
  streakMap = {},
  onGapChange,
  onTeamFocus,
  favoriteTeamIds = [],
  abbrToTeamMap = {},
}: {
  scheduleData: NBAScheduleData | null;
  logoMap: Record<string, string>;
  recordMap: Record<string, string>;
  streakMap?: Record<string, { type: 'W' | 'L'; count: number }>;
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

  if (!scheduleData) return <div className="text-sm text-muted-foreground"></div>;
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

          // Streak data
          const awayStreak = normalizedAwayAbbr ? streakMap[normalizedAwayAbbr] : undefined;
          const homeStreak = normalizedHomeAbbr ? streakMap[normalizedHomeAbbr] : undefined;

          // Get team gradient colors for background
          const awayColor = awayAbbr && teamGradientColors[awayAbbr]?.start || '#f8f8f8';
          const homeColor = homeAbbr && teamGradientColors[homeAbbr]?.start || '#dc2626';

          return (
            <Card
              key={g.game_id || `${g.matchup}-${g.date}`}
              className="relative overflow-hidden transition-all duration-300 bg-card border flex flex-col shrink-0"
              style={{
                height: `${cardHeight}px`,
                padding: `0 ${padding}px`,
              }}
            >
              {/* Gradient background from away team color to home team color */}
              <div 
                className="absolute inset-0" 
                style={{
                  background: `linear-gradient(to right, ${awayColor} 0%, ${awayColor} 20%, ${homeColor} 80%, ${homeColor} 100%)`
                }}
              />
              {/* Semi-transparent overlay for better text readability */}
              <div className="absolute inset-0 bg-black/40" />
              
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
                              ? "mt-1 flex items-center justify-center gap-1" 
                              : "absolute left-full top-1/2 ml-4 flex items-center gap-1"
                            }
                          `}
                          style={{ 
                             fontSize: recordSize,
                             transform: isStacked ? 'none' : `translate(-${recordOffset}px, -50%)`
                          }}
                        >
                          {awayStreak && awayStreak.count >= 3 && (
                            <span style={{ color: awayStreak.type === 'W' ? '#4ade80' : '#f87171', fontWeight: 800 }}>
                              {awayStreak.count}
                            </span>
                          )}
                          <span>({formatRecord(awayRecord)})</span>
                          {awayStreak && (
                            <span style={{ color: awayStreak.type === 'W' ? '#4ade80' : '#f87171', fontWeight: 800 }}>
                              {awayStreak.type === 'W' ? '↑' : '↓'}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  )}
                </div>

                {/* --- Center Score / Time --- */}
                <div className="flex items-center justify-center shrink-0 z-10 relative" style={{ width: scoreColWidth }}>
                  {hasScores ? (
                    <>
                      <div className="font-extrabold tracking-wide flex items-center justify-center gap-3" style={{ fontSize: scoreSize }}>
                        <span className={awayScoreClass}>{aScore}</span>
                        <span className="text-muted-foreground/50 text-[0.8em]">-</span>
                        <span className={homeScoreClass}>{hScore}</span>
                      </div>
                      {/* Show quarter and time for live games - positioned absolutely below score */}
                      {isLive && (g.period || g.clock) && (
                        <div className="absolute top-full text-white/90 font-semibold text-center whitespace-nowrap mt-1" style={{ fontSize: Math.max(10, scoreSize * 0.5) }}>
                          {(() => {
                            const parts: string[] = [];
                            
                            // Format period/quarter
                            if (g.period) {
                              const period = Number(g.period);
                              if (period <= 4) {
                                parts.push(`Q${period}`);
                              } else {
                                // Overtime
                                const otNum = period - 4;
                                parts.push(otNum === 1 ? 'OT' : `${otNum}OT`);
                              }
                            }
                            
                            // Add clock time
                            if (g.clock) {
                              parts.push(String(g.clock));
                            }
                            
                            return parts.length > 0 ? parts.join(' • ') : 'LIVE';
                          })()}
                        </div>
                      )}
                    </>
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
                              ? "mt-1 flex items-center justify-center gap-1"
                              : "absolute right-full top-1/2 mr-4 flex items-center gap-1"
                            }
                          `}
                          style={{ 
                             fontSize: recordSize,
                             transform: isStacked ? 'none' : `translate(${recordOffset}px, -50%)` 
                          }}
                        >
                          {homeStreak && homeStreak.count >= 3 && (
                            <span style={{ color: homeStreak.type === 'W' ? '#4ade80' : '#f87171', fontWeight: 800 }}>
                              {homeStreak.count}
                            </span>
                          )}
                          <span>({formatRecord(homeRecord)})</span>
                          {homeStreak && (
                            <span style={{ color: homeStreak.type === 'W' ? '#4ade80' : '#f87171', fontWeight: 800 }}>
                              {homeStreak.type === 'W' ? '↑' : '↓'}
                            </span>
                          )}
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
  bold = false,
  noProvider = false,
}: {
  label: string;
  value: string | number;
  highlight?: 'high' | 'low' | 'neutral' | 'best';
  dense?: boolean;
  bold?: boolean;
  noProvider?: boolean;
}) => {
  const colorClass =
    highlight === 'best'
      ? 'text-yellow-300'
      : highlight === 'high'
      ? 'text-green-400 font-semibold'
      : highlight === 'low'
      ? 'text-red-400 font-semibold'
      : 'text-foreground';

  const inner = (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center text-sm cursor-help text-left ${dense ? 'gap-[4rem]' : 'gap-[0.5rem]'}`}>
          <span className={`text-muted-foreground ${dense ? 'w-[4.5rem]' : 'w-16'} text-left ${bold ? 'font-bold' : ''}`}>{label}</span>
          <span className={`${colorClass} ${bold ? 'font-bold' : ''}`}>{value}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" align="center">
        <p>{statDescriptions[label] || 'Stat description unavailable'}</p>
      </TooltipContent>
    </Tooltip>
  );

  if (noProvider) return inner;
  return <TooltipProvider>{inner}</TooltipProvider>;
};


// ============================
// 🗓️ ScheduleViewV2 Component
// Arrow-controlled schedule grouped by date with live scores, TV badges, and ESPN modal support
// ============================

// Compact, arrow-controlled view
const ScheduleViewV2 = ({ scheduleData, logoMap, recordMap = {}, streakMap = {}, onGameClick, isMobile = false }: { scheduleData: NBAScheduleData | null, logoMap: Record<string, string>, recordMap?: Record<string, string>, streakMap?: Record<string, { type: 'W' | 'L'; count: number }>, onGameClick?: (gameId: string) => void, isMobile?: boolean }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pages = ['/nba', '/f1', '/nfl'] as const;
  const currentPageIdx = pages.findIndex(p => location.pathname.startsWith(p));
  const cycleToNextPage = () => navigate(pages[(currentPageIdx === -1 ? 0 : currentPageIdx + 1) % pages.length]);

  const gamesArr = useMemo<ScheduleGameAny[]>(() =>
    Array.isArray(scheduleData)
      ? (scheduleData as ScheduleGameAny[])
      : (scheduleData?.games || [])
  , [scheduleData]);

  // Map round+team-pair key → { teamName: wins } for playoff series.
  // Keyed by round prefix (e.g. "East Semifinals") + sorted team names so the
  // same two teams meeting in different rounds don't bleed into each other.
  const seriesRecordMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const g of gamesArr) {
      if (!g.is_playoff) continue;
      const winner = (g as any).winner as string | undefined;
      if (!winner) continue;
      const away = g.matchup?.split('@')[0]?.trim();
      const home = g.matchup?.split('@')[1]?.trim();
      if (!away || !home) continue;
      const round = g.series_note?.split(' - ')[0]?.trim() ?? '';
      const key = [round, ...[away, home].sort()].join('|');
      if (!map[key]) map[key] = {};
      map[key][winner] = (map[key][winner] || 0) + 1;
    }
    return map;
  }, [gamesArr]);

  // Set of series keys (round+team-pair) where one team has 4 wins (series over).
  const decidedSeries = useMemo(() => {
    const decided = new Set<string>();
    for (const [key, wins] of Object.entries(seriesRecordMap)) {
      if (Object.values(wins).some(w => w >= 4)) decided.add(key);
    }
    return decided;
  }, [seriesRecordMap]);

  // Build games grouped by date, excluding future games for decided series.
  const gamesByDate = useMemo(() => {
    const map: Record<string, ScheduleGameAny[]> = {};
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    for (const g of gamesArr) {
      const k = ((g.date as string) || '').slice(0, 10);
      if (!k) continue;

      // Hide any unplayed game belonging to a series that's already been decided.
      if (g.is_playoff && !(g as any).winner) {
        const away = g.matchup?.split('@')[0]?.trim();
        const home = g.matchup?.split('@')[1]?.trim();
        if (away && home) {
          const round = g.series_note?.split(' - ')[0]?.trim() ?? '';
          const key = [round, ...[away, home].sort()].join('|');
          if (decidedSeries.has(key)) continue;
        }
      }

      if (!map[k]) map[k] = [];
      map[k].push(g);
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return map;
  }, [gamesArr, decidedSeries]);


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

  const calendarRef = React.useRef<HTMLDivElement>(null);
  const [showCalendar, setShowCalendar] = React.useState(false);
  const [calendarMonth, setCalendarMonth] = React.useState<{ year: number; month: number } | null>(null);
  const [calendarPosition, setCalendarPosition] = React.useState<{ top: number; right: number }>({ top: 0, right: 0 });

  // Close calendar on outside click
  useEffect(() => {
    if (!showCalendar) return;
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCalendar]);

  if (!scheduleData) return <div className="text-sm text-muted-foreground"></div>;
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

  const gameDateSet = new Set(dateKeys);

  // Open calendar to the month of the current date
  const openCalendar = () => {
    const [y, m] = currentKey.split('-').map(Number);
    const rect = calendarRef.current?.getBoundingClientRect();
    if (rect) {
      setCalendarPosition({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }
    setCalendarMonth({ year: y, month: m });
    setShowCalendar(true);
  };

  // Build calendar grid for a given month
  const buildCalendarGrid = (year: number, month: number) => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return cells;
  };

  const handleCalendarDayClick = (key: string) => {
    if (!gameDateSet.has(key)) return;
    const idx = dateKeys.indexOf(key);
    if (idx >= 0) setIndex(idx);
    setShowCalendar(false);
  };

  const calGrid = calendarMonth ? buildCalendarGrid(calendarMonth.year, calendarMonth.month) : [];
  const calMonthLabel = calendarMonth
    ? new Date(calendarMonth.year, calendarMonth.month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className={isMobile ? 'flex flex-col flex-1 overflow-hidden' : 'space-y-4'}>
      {!isMobile && (
      <div className="relative flex items-center gap-3 justify-center">
        <Button variant="ghost" size="icon" onClick={() => setIndex((i) => clamp(i - 1))} disabled={index <= 0} className="rounded-full hover:bg-white/10">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-lg font-black tracking-wide text-white">{formatLabel(currentKey)}</div>
        <Button variant="ghost" size="icon" onClick={() => setIndex((i) => clamp(i + 1))} disabled={index >= dateKeys.length - 1} className="rounded-full hover:bg-white/10">
          <ChevronRight className="w-5 h-5" />
        </Button>

        {/* Custom calendar picker */}
        <div className="absolute right-0" ref={calendarRef}>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-transparent"
            onClick={openCalendar}
            aria-label="Pick a date"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </Button>

          {showCalendar && calendarMonth && (
            <div
              className="fixed z-50 rounded-xl border border-white/10 shadow-2xl p-4 w-72"
              style={{ backgroundColor: '#1a1a1a', top: calendarPosition.top, right: calendarPosition.right }}
            >
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-3">
                <button
                  className="p-1 rounded-full hover:bg-white/10 transition-colors text-white/70 hover:text-white"
                  onClick={() => setCalendarMonth(({ year: y, month: m }) => {
                    const d = new Date(y, m - 2, 1);
                    return { year: d.getFullYear(), month: d.getMonth() + 1 };
                  })}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-black text-white tracking-wide">{calMonthLabel}</span>
                <button
                  className="p-1 rounded-full hover:bg-white/10 transition-colors text-white/70 hover:text-white"
                  onClick={() => setCalendarMonth(({ year: y, month: m }) => {
                    const d = new Date(y, m, 1);
                    return { year: d.getFullYear(), month: d.getMonth() + 1 };
                  })}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-0.5">
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
                  <div key={d} className="text-center text-[10px] font-black tracking-wide text-white/30 py-0.5">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {calGrid.map((key, i) => {
                  if (!key) return <div key={`empty-${i}`} />;
                  const hasGames = gameDateSet.has(key);
                  const isSelected = key === currentKey;
                  const isToday = key === todayKey;
                  const dayNum = parseInt(key.split('-')[2], 10);
                  return (
                    <button
                      key={key}
                      onClick={() => handleCalendarDayClick(key)}
                      disabled={!hasGames}
                      className={`
                        relative flex items-center justify-center rounded-lg text-xs font-black tabular-nums h-[32px] w-full transition-all duration-150
                        ${isSelected
                          ? 'bg-white text-black shadow-lg'
                          : hasGames
                          ? 'text-white hover:bg-white/15 cursor-pointer'
                          : 'text-white/20 cursor-default'}
                      `}
                    >
                      {dayNum}
                      {/* Dot indicator for today */}
                      {isToday && !isSelected && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/70" />
                      )}
                      {isToday && isSelected && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-black" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      <div className={isMobile ? 'flex-1 overflow-y-auto no-scrollbar pb-4 pr-2' : undefined}>
      {games.length === 0 ? (
        <Card className="bg-card/60 backdrop-blur-sm border">
          <CardContent className="py-8 text-center text-sm font-black tracking-wide text-muted-foreground">No games</CardContent>
        </Card>
      ) : (
        <div key={currentKey} className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'} gap-2 sm:gap-3 auto-rows-fr w-full pb-16`}>
          {games.map((g, index) => {
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
            const awayColor = awayAbbr && teamGradientColors[awayAbbr]?.start || '#37fff5';
            const homeColor = homeAbbr && teamGradientColors[homeAbbr]?.start || '#4d20c7';

            // Determine if we should show team names based on card count
            const showTeamNames = games.length <= 6;

            // Mobile-specific sizing
            const logoSize = isMobile ? '13cqi' : undefined;
            const scoreFontSize = isMobile ? 'clamp(1.5rem, 7cqi, 2.2rem)' : 'clamp(1.125rem, 4cqi, 1.75rem)';
            const timeFontSize = isMobile ? 'clamp(0.85rem, 5cqi, 1.6rem)' : 'clamp(0.875rem, 3.2cqi, 1.3rem)';
            const recordFontSize = isMobile ? 'clamp(0.65rem, 2.5cqi, 0.8rem)' : 'clamp(0.6rem, 2.2cqi, 0.75rem)';
            const liveFontSize = isMobile ? 'clamp(0.75rem, 3cqi, 0.95rem)' : 'clamp(0.65rem, 2.5cqi, 0.85rem)';

            const awayNormAbbr = (awayAbbr || '').toUpperCase();
            const homeNormAbbr = (homeAbbr || '').toUpperCase();
            const awayDisplayRecord = awayAbbr ? recordMap[awayAbbr] : undefined;
            const homeDisplayRecord = homeAbbr ? recordMap[homeAbbr] : undefined;
            const awayDisplayStreak = streakMap[awayNormAbbr] ?? null;
            const homeDisplayStreak = streakMap[homeNormAbbr] ?? null;

            const isPlayoff = !!g.is_playoff;
            const seriesNote = g.series_note;
            const seriesRound = seriesNote?.split(' - ')[0]?.trim() ?? '';
            const seriesWins = isPlayoff && awayName && homeName
              ? seriesRecordMap[[seriesRound, ...[awayName, homeName].sort()].join('|')] || {}
              : null;
            const awaySeriesWins = seriesWins && awayName ? (seriesWins[awayName] || 0) : 0;
            const homeSeriesWins = seriesWins && homeName ? (seriesWins[homeName] || 0) : 0;

            return (
              <Card 
                key={g.game_id} 
                className="relative overflow-hidden transition-all duration-300 border p-2 flex flex-col h-full container cursor-pointer hover:ring-2 hover:ring-white/20 rounded-2xl"
                style={{ animation: `slideUp 0.4s ease-out ${index * 0.05}s both` }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (g.game_id && onGameClick) {
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
                {/* Gradient background */}
                <div 
                  className="absolute inset-0" 
                  style={{
                    background: `linear-gradient(to right, ${awayColor} 0%, ${awayColor} 20%, ${homeColor} 80%, ${homeColor} 100%)`
                  }}
                />
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
                      } else if (name.includes('abc')) {
                        style = { backgroundColor: '#000000', color: '#ffffff' };
                      }
                      return (
                        <Badge key={p} className="font-black tracking-wide" style={{ ...style, fontSize: "clamp(0.5rem, 1.8cqi, 0.6rem)", padding: "clamp(1px, 0.4cqi, 2px) clamp(3px, 1.2cqi, 6px)" }}>
                          {p}
                        </Badge>
                      );
                    })}
                  </div>
                )}

                <style>{`.sched-logo { width: 7cqi; height: 7cqi; } @media (max-width: 1023px) { .sched-logo { width: 10cqi; height: 10cqi; } }.sched-live-dot { width: 1.5cqi; height: 1.5cqi; } @media (min-width: 1024px) { .sched-live-dot { width: 1cqi; height: 1cqi; } } @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                {isPlayoff && seriesNote && (
                  <div className="absolute left-0 right-0 text-white/50 font-black tracking-wide truncate text-center px-2 z-20" style={{ top: '2px', fontSize: recordFontSize }}>
                    {seriesNote.replace(/\s*if necessary/i, '*')}
                  </div>
                )}
                <CardContent className="relative z-10 py-0 flex flex-col h-full">
                  <div className="flex-1 flex items-center py-1">
                    <div className="grid grid-cols-3 items-center w-full" style={{ gap: "1cqi" }}>
                      {/* Away side */}
                      <div className="flex flex-col items-center justify-center gap-1">
                        {awayLogo && (
                          <>
                            <img
                              src={awayLogo}
                              alt={awayAbbr || 'Away'}
                              className={`rounded-sm ${isMobile ? '' : 'sched-logo'} ${isFinal ? (awayWin ? 'opacity-100' : 'opacity-40') : ''}`}
                              style={{
                                objectFit: 'contain',
                                ...(logoSize ? { width: logoSize, height: logoSize } : {}),
                                ...(isFinal && awayWin ? { filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(255,255,255,0.6))' } : {})
                              }}
                              loading="eager"
                            />
                            {isPlayoff && seriesWins ? (
                              <div className="relative text-white/80 font-black text-center tabular-nums" style={{ fontSize: recordFontSize }}>
                                {awayDisplayStreak && awayDisplayStreak.count >= 3 && (
                                  <span className="absolute right-full pr-1" style={{ color: awayDisplayStreak.type === 'W' ? '#4ade80' : '#f87171', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                    {awayDisplayStreak.count}
                                  </span>
                                )}
                                <span>( {awaySeriesWins} - {homeSeriesWins} )</span>
                                {awayDisplayStreak && (
                                  <span className="absolute left-full pl-1" style={{ color: awayDisplayStreak.type === 'W' ? '#4ade80' : '#f87171', fontWeight: 800 }}>
                                    {awayDisplayStreak.type === 'W' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            ) : awayAbbr && awayDisplayRecord && (
                              <div className="relative text-white/80 font-black text-center tabular-nums" style={{ fontSize: recordFontSize }}>
                                {awayDisplayStreak && awayDisplayStreak.count >= 3 && (
                                  <span className="absolute right-full pr-1" style={{ color: awayDisplayStreak.type === 'W' ? '#4ade80' : '#f87171', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                    {awayDisplayStreak.count}
                                  </span>
                                )}
                                <span>( {awayDisplayRecord.replace(/-/g, ' - ')} )</span>
                                {awayDisplayStreak && (
                                  <span className="absolute left-full pl-1" style={{ color: awayDisplayStreak.type === 'W' ? '#4ade80' : '#f87171', fontWeight: 800 }}>
                                    {awayDisplayStreak.type === 'W' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Center time or score */}
                      <div className="flex items-center justify-center relative">
                        {hasScores ? (
                          <>
                            <div className="font-black tracking-wide flex items-center justify-center tabular-nums" style={{ fontSize: scoreFontSize }}>
                              <span className={awayScoreClass}>{aScore}</span>
                              <span className="text-white" style={{ margin: "0 0.6cqi" }}>-</span>
                              <span className={homeScoreClass}>{hScore}</span>
                            </div>
                            {isLiveGame && (g.period || g.clock) && (
                              <div className="absolute top-full text-white/90 font-black tracking-wide text-center whitespace-nowrap" style={{ fontSize: liveFontSize, marginTop: "0.2cqi" }}>
                                {(() => {
                                  const parts: string[] = [];
                                  if (g.period) {
                                    const period = Number(g.period);
                                    if (period <= 4) {
                                      parts.push(`Q${period}`);
                                    } else {
                                      const otNum = period - 4;
                                      parts.push(otNum === 1 ? 'OT' : `${otNum}OT`);
                                    }
                                  }
                                  if (g.clock) {
                                    parts.push(String(g.clock));
                                  }
                                  return parts.length > 0 ? parts.join(' • ') : 'LIVE';
                                })()}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="font-black tracking-wide text-white whitespace-nowrap" style={{ fontSize: timeFontSize }}>
                            {g.time || 'TBA'}
                          </div>
                        )}
                      </div>

                      {/* Home side */}
                      <div className="flex flex-col items-center justify-center gap-1">
                        {homeLogo && (
                          <>
                            <img
                              src={homeLogo}
                              alt={homeAbbr || 'Home'}
                              className={`rounded-sm ${isMobile ? '' : 'sched-logo'} ${isFinal ? (homeWin ? 'opacity-100' : 'opacity-40') : ''}`}
                              style={{
                                objectFit: 'contain',
                                ...(logoSize ? { width: logoSize, height: logoSize } : {}),
                                ...(isFinal && homeWin ? { filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(255,255,255,0.6))' } : {})
                              }}
                              loading="eager"
                            />
                            {isPlayoff && seriesWins ? (
                              <div className="relative text-white/80 font-black text-center tabular-nums" style={{ fontSize: recordFontSize }}>
                                {homeDisplayStreak && homeDisplayStreak.count >= 3 && (
                                  <span className="absolute right-full pr-1" style={{ color: homeDisplayStreak.type === 'W' ? '#4ade80' : '#f87171', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                    {homeDisplayStreak.count}
                                  </span>
                                )}
                                <span>( {homeSeriesWins} - {awaySeriesWins} )</span>
                                {homeDisplayStreak && (
                                  <span className="absolute left-full pl-1" style={{ color: homeDisplayStreak.type === 'W' ? '#4ade80' : '#f87171', fontWeight: 800 }}>
                                    {homeDisplayStreak.type === 'W' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            ) : homeAbbr && homeDisplayRecord && (
                              <div className="relative text-white/80 font-black text-center tabular-nums" style={{ fontSize: recordFontSize }}>
                                {homeDisplayStreak && homeDisplayStreak.count >= 3 && (
                                  <span className="absolute right-full pr-1" style={{ color: homeDisplayStreak.type === 'W' ? '#4ade80' : '#f87171', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                    {homeDisplayStreak.count}
                                  </span>
                                )}
                                <span>( {homeDisplayRecord.replace(/-/g, ' - ')} )</span>
                                {homeDisplayStreak && (
                                  <span className="absolute left-full pl-1" style={{ color: homeDisplayStreak.type === 'W' ? '#4ade80' : '#f87171', fontWeight: 800 }}>
                                    {homeDisplayStreak.type === 'W' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            )}
                          </>
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

      {isMobile && (
        <div className="px-4 pb-px pt-2">
          <div
            className="flex items-center rounded-[28px] overflow-hidden"
            style={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
          >
            <button
              onClick={() => setIndex(i => clamp(i - 1))}
              disabled={index <= 0}
              className="flex-1 flex items-center justify-center h-16 disabled:opacity-30 active:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={cycleToNextPage}
              className="flex-[2] flex flex-col items-center justify-center h-16 border-x border-white/10 active:bg-white/10 transition-colors"
            >
              <span className="text-white font-black text-base tracking-wider">NBA</span>
              <span className="text-white/40 text-[11px] font-black tracking-wide mt-0.5">{formatLabel(currentKey)}</span>
            </button>
            <button
              onClick={() => setIndex(i => clamp(i + 1))}
              disabled={index >= dateKeys.length - 1}
              className="flex-1 flex items-center justify-center h-16 disabled:opacity-30 active:bg-white/10 transition-colors"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

type PlayoffRoundKey = 'first' | 'semis' | 'finals' | 'nbaFinals';

interface PlayoffSeries {
  id: string;
  conference: 'West' | 'East' | 'NBA';
  round: PlayoffRoundKey;
  roundLabel: string;
  teams: string[];
  wins: Record<string, number>;
  winner?: string;
  lastDate: string;
}

const getPlayoffRoundInfo = (note?: string): { conference: 'West' | 'East' | 'NBA'; round: PlayoffRoundKey; label: string } | null => {
  const text = (note || '').toLowerCase();
  if (!text || text.includes('cup') || text.includes('all-star')) return null;
  if (text.includes('nba finals')) return { conference: 'NBA', round: 'nbaFinals', label: 'NBA Finals' };
  if (text.includes('west 1st round')) return { conference: 'West', round: 'first', label: '1st Round' };
  if (text.includes('east 1st round')) return { conference: 'East', round: 'first', label: '1st Round' };
  if (text.includes('west semifinals')) return { conference: 'West', round: 'semis', label: 'Semifinals' };
  if (text.includes('east semifinals')) return { conference: 'East', round: 'semis', label: 'Semifinals' };
  if (text.includes('west finals')) return { conference: 'West', round: 'finals', label: 'Conference Finals' };
  if (text.includes('east finals')) return { conference: 'East', round: 'finals', label: 'Conference Finals' };
  return null;
};

const buildPlayoffSeries = (scheduleData: NBAScheduleData | null): PlayoffSeries[] => {
  const games = Array.isArray(scheduleData)
    ? (scheduleData as ScheduleGameAny[])
    : (scheduleData?.games || []);
  const seriesMap: Record<string, PlayoffSeries> = {};

  games.forEach((game) => {
    if (!game.is_playoff || !game.matchup) return;
    const roundInfo = getPlayoffRoundInfo(game.series_note);
    if (!roundInfo) return;
    const parts = game.matchup.split('@').map((part) => part.trim()).filter(Boolean);
    if (parts.length !== 2) return;
    const pair = [...parts].sort();
    const id = [roundInfo.conference, roundInfo.round, ...pair].join('|');
    if (!seriesMap[id]) {
      seriesMap[id] = {
        id,
        conference: roundInfo.conference,
        round: roundInfo.round,
        roundLabel: roundInfo.label,
        teams: pair,
        wins: {},
        lastDate: game.date || '',
      };
    }

    const series = seriesMap[id];
    series.lastDate = [series.lastDate, game.date || ''].sort().pop() || series.lastDate;
    const winner = (game as any).winner as string | undefined;
    if (winner) {
      series.wins[winner] = (series.wins[winner] || 0) + 1;
      if (!series.winner || series.wins[winner] > (series.wins[series.winner] || 0)) {
        series.winner = winner;
      }
    }
  });

  return Object.values(seriesMap).sort((a, b) => {
    const roundOrder: Record<PlayoffRoundKey, number> = { first: 1, semis: 2, finals: 3, nbaFinals: 4 };
    return roundOrder[a.round] - roundOrder[b.round] || a.lastDate.localeCompare(b.lastDate);
  });
};

const getPlayoffSeriesLeader = (series?: PlayoffSeries): string | undefined => {
  if (!series) return undefined;
  if (series.winner) return series.winner;
  return [...series.teams].sort((a, b) => (series.wins[b] || 0) - (series.wins[a] || 0) || a.localeCompare(b))[0];
};

const getPlayoffTeamAbbr = (teamName?: string): string => (teamName ? teamAbbreviations[teamName] || teamName.slice(0, 3).toUpperCase() : 'TBD');
const PLAYOFF_CARD_WIDTH = 300;
const PLAYOFF_CARD_HEIGHT = 76;
const PLAYOFF_CARD_MID = PLAYOFF_CARD_HEIGHT / 2;

const orderFirstRoundBySemis = (firstRound: PlayoffSeries[], semis: PlayoffSeries[]): PlayoffSeries[] => {
  const ordered: PlayoffSeries[] = [];
  const used = new Set<string>();

  semis.forEach((semi) => {
    semi.teams.forEach((teamName) => {
      const matchingFirst = firstRound.find((seriesItem) => (
        !used.has(seriesItem.id)
        && (seriesItem.teams.includes(teamName) || getPlayoffSeriesLeader(seriesItem) === teamName)
      ));
      if (matchingFirst) {
        ordered.push(matchingFirst);
        used.add(matchingFirst.id);
      }
    });
  });

  firstRound.forEach((seriesItem) => {
    if (!used.has(seriesItem.id)) ordered.push(seriesItem);
  });

  return ordered;
};

const PlayoffTeamPill = ({
  teamName,
  wins,
  winner,
  logoMap,
  side,
  muted = false,
}: {
  teamName?: string;
  wins?: number;
  winner?: boolean;
  logoMap: Record<string, string>;
  side: 'west' | 'east' | 'center';
  muted?: boolean;
}) => {
  const abbr = getPlayoffTeamAbbr(teamName);
  const colors = teamColors[abbr] || { primary: '#27272a', secondary: '#52525b' };
  const logo = logoMap[abbr];

  return (
    <div
      className={`relative z-20 flex items-center overflow-hidden border border-white/15 shadow-lg ${muted ? 'opacity-55' : 'opacity-100'}`}
      style={{
        width: PLAYOFF_CARD_WIDTH,
        height: PLAYOFF_CARD_HEIGHT,
        backgroundColor: colors.primary,
        boxShadow: winner ? `0 0 0 1px ${colors.secondary}99 inset, 0 7px 16px rgba(0,0,0,0.38)` : '0 7px 16px rgba(0,0,0,0.30)',
      }}
    >
      {(side === 'east' || side === 'center') && (
        <div className="flex h-full w-32 shrink-0 items-center justify-center">
          {logo ? <img src={logo} alt="" className="h-36 w-36 object-contain" loading="lazy" /> : <span className="text-lg font-black text-white">{abbr}</span>}
        </div>
      )}
      <div className={`min-w-0 flex-1 px-2 ${side === 'west' ? 'text-left' : 'text-right'}`}>
        <div className="truncate text-[22px] font-black uppercase leading-none text-white drop-shadow">{abbr}</div>
      </div>
      {typeof wins === 'number' && (
        <div className="w-10 shrink-0 text-center text-[22px] font-black tabular-nums text-white/90">{wins}</div>
      )}
      {side === 'west' && (
        <div className="flex h-full w-32 shrink-0 items-center justify-center">
          {logo ? <img src={logo} alt="" className="h-36 w-36 object-contain" loading="lazy" /> : <span className="text-lg font-black text-white">{abbr}</span>}
        </div>
      )}
    </div>
  );
};

const PlayoffTeamRow = ({ teamName, wins, winner, logoMap }: { teamName: string; wins: number; winner: boolean; logoMap: Record<string, string> }) => {
  const abbr = teamAbbreviations[teamName] || 'UNK';
  const colors = teamColors[abbr] || { primary: '#27272a', secondary: '#52525b' };
  const logo = logoMap[abbr];

  return (
    <div
      className={`flex h-12 items-center overflow-hidden rounded-sm border ${winner ? 'border-white/35' : 'border-white/10'} shadow-md`}
      style={{
        backgroundColor: colors.primary,
        opacity: winner ? 1 : 0.78,
        boxShadow: winner ? `0 0 0 1px ${colors.secondary}66 inset, 0 8px 18px rgba(0,0,0,0.35)` : undefined,
      }}
    >
      <div className="flex h-full w-16 shrink-0 items-center justify-center">
        {logo ? <img src={logo} alt="" className="h-14 w-14 object-contain" /> : <span className="text-[10px] font-black text-white">{abbr}</span>}
      </div>
      <div className="min-w-0 flex-1 px-2">
        <div className="truncate text-sm font-black uppercase leading-none text-white drop-shadow">{abbr}</div>
      </div>
      <div className="w-9 shrink-0 text-center text-base font-black tabular-nums text-white drop-shadow">{wins}</div>
    </div>
  );
};

const PlayoffSeriesCard = ({ series, logoMap, connector = 'none' }: { series: PlayoffSeries; logoMap: Record<string, string>; connector?: 'none' | 'left' | 'right' | 'both' }) => {
  const teams = [...series.teams].sort((a, b) => (series.wins[b] || 0) - (series.wins[a] || 0) || a.localeCompare(b));
  const showLeft = connector === 'left' || connector === 'both';
  const showRight = connector === 'right' || connector === 'both';
  return (
    <div className="relative min-w-[208px] p-1">
      {showLeft && <div className="absolute left-[-24px] top-1/2 h-px w-6 bg-white/25" />}
      {showRight && <div className="absolute right-[-24px] top-1/2 h-px w-6 bg-white/25" />}
      {(series.round === 'semis' || series.round === 'finals') && (
        <div
          className={`absolute top-1/2 h-[132px] w-px -translate-y-1/2 bg-white/20 ${
            showLeft ? 'left-[-24px]' : showRight ? 'right-[-24px]' : 'hidden'
          }`}
        />
      )}
      <div className="space-y-2">
        {teams.map((teamName) => (
          <PlayoffTeamRow
            key={teamName}
            teamName={teamName}
            wins={series.wins[teamName] || 0}
            winner={series.winner === teamName}
            logoMap={logoMap}
          />
        ))}
      </div>
    </div>
  );
};

const PlayoffBracketView = ({ scheduleData, logoMap, seasonLabel }: { scheduleData: NBAScheduleData | null; logoMap: Record<string, string>; seasonLabel?: string }) => {
  const series = useMemo(() => buildPlayoffSeries(scheduleData), [scheduleData]);
  const bracketContainerRef = useRef<HTMLDivElement | null>(null);
  const [bracketScale, setBracketScale] = useState(0.85);
  const [compactBracket, setCompactBracket] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 1500 : false);
  const [compactOffsetX, setCompactOffsetX] = useState(0);
  const byConference = (conference: 'West' | 'East', round: PlayoffRoundKey) =>
    series.filter((item) => item.conference === conference && item.round === round);
  const finals = series.find((item) => item.conference === 'NBA' && item.round === 'nbaFinals');
  const bracketBaseWidth = 2520;
  const bracketBaseHeight = 1040;
  const compactBracketBaseWidth = 1284;
  const compactBracketBaseHeight = 1340;

  useLayoutEffect(() => {
    const node = bracketContainerRef.current;
    if (!node) return;

    const updateScale = () => {
      const availableWidth = Math.max(320, node.clientWidth - 8);
      const availableHeight = Math.max(420, node.clientHeight - 16);
      const compact = availableWidth < 1500;
      setCompactBracket(compact);
      const nextScale = compact
        ? Math.min(0.85, availableWidth / compactBracketBaseWidth, availableHeight / compactBracketBaseHeight)
        : Math.min(0.85, availableWidth / bracketBaseWidth);
      const resolvedScale = Math.max(0.48, Number(nextScale.toFixed(3)));
      setBracketScale(resolvedScale);
      setCompactOffsetX(compact ? Math.max(0, (availableWidth - compactBracketBaseWidth * resolvedScale) / 2) : 0);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    window.addEventListener('resize', updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [seasonLabel, series.length]);

  if (!series.length) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-sm font-bold text-white/45">
        No playoff bracket data for this season yet.
      </div>
    );
  }

  const lineStyle = 'absolute z-10';
  const lineColor = 'rgba(255,255,255,0.42)';
  const firstTops = [12, 122, 260, 370, 508, 618, 756, 866];
  const semiTops = [
    ((12 + PLAYOFF_CARD_MID + 122 + PLAYOFF_CARD_MID) / 2) - PLAYOFF_CARD_MID,
    ((260 + PLAYOFF_CARD_MID + 370 + PLAYOFF_CARD_MID) / 2) - PLAYOFF_CARD_MID,
    ((508 + PLAYOFF_CARD_MID + 618 + PLAYOFF_CARD_MID) / 2) - PLAYOFF_CARD_MID,
    ((756 + PLAYOFF_CARD_MID + 866 + PLAYOFF_CARD_MID) / 2) - PLAYOFF_CARD_MID,
  ];
  const confFinalTops = [
    ((semiTops[0] + PLAYOFF_CARD_MID + semiTops[1] + PLAYOFF_CARD_MID) / 2) - PLAYOFF_CARD_MID,
    ((semiTops[2] + PLAYOFF_CARD_MID + semiTops[3] + PLAYOFF_CARD_MID) / 2) - PLAYOFF_CARD_MID,
  ];
  const confFinalUpperCenter = confFinalTops[0] + PLAYOFF_CARD_MID;
  const confFinalLowerCenter = confFinalTops[1] + PLAYOFF_CARD_MID;
  const finalsVerticalGap = (confFinalLowerCenter - confFinalUpperCenter) / 3;
  const finalsWestCenterY = confFinalUpperCenter + finalsVerticalGap;
  const finalsEastCenterY = confFinalUpperCenter + finalsVerticalGap * 2;
  const finalsWestTop = finalsWestCenterY - PLAYOFF_CARD_MID;
  const finalsEastTop = finalsEastCenterY - PLAYOFF_CARD_MID;

  const ConferenceBracket = ({ conference }: { conference: 'West' | 'East' }) => {
    const isWest = conference === 'West';
    const semis = byConference(conference, 'semis').slice(0, 2);
    const first = orderFirstRoundBySemis(byConference(conference, 'first'), semis).slice(0, 4);
    const confFinal = byConference(conference, 'finals')[0];
    const conferenceWinner = getPlayoffSeriesLeader(confFinal);
    const side = isWest ? 'west' : 'east';
    const x = isWest ? { first: 0, semi: 330, final: 660, v1: 318, v2: 648 } : { first: 660, semi: 330, final: 0, v1: 648, v2: 318 };
    const from = (left: number, top: number, width: number) => ({ left, top, width });
    const hLine = (key: string, left: number, top: number, width: number, highlighted = false) => <div key={key} className={lineStyle} style={{ ...from(left, top, width), height: 2, backgroundColor: highlighted ? '#ffffff' : lineColor }} />;
    const vLine = (key: string, left: number, top: number, height: number, highlighted = false) => <div key={key} className={lineStyle} style={{ left, top, height, width: 2, backgroundColor: highlighted ? '#ffffff' : lineColor }} />;
    const teamSlot = (teamName: string | undefined, seriesItem: PlayoffSeries | undefined, top: number, left: number, index: number) => (
      <PlayoffTeamPill
        key={`${conference}-${left}-${top}-${teamName || index}`}
        teamName={teamName}
        wins={teamName && seriesItem ? seriesItem.wins[teamName] || 0 : undefined}
        winner={!!teamName && seriesItem?.winner === teamName}
        muted={!teamName}
        logoMap={logoMap}
        side={side}
      />
    );

    const firstTeams = first.flatMap((item) => item.teams);
    const semiTeams = semis.flatMap((item) => item.teams.length ? item.teams : [getPlayoffSeriesLeader(first[0]), getPlayoffSeriesLeader(first[1])]).slice(0, 4);
    const semiWinners = semis.map((item) => getPlayoffSeriesLeader(item)).filter(Boolean) as string[];
    const finalTeams = confFinal?.teams.length
      ? [
          ...semiWinners.filter((teamName) => confFinal.teams.includes(teamName)),
          ...confFinal.teams.filter((teamName) => !semiWinners.includes(teamName)),
        ].slice(0, 2)
      : semiWinners;

    return (
      <div className="relative h-[1020px] w-[960px] shrink-0">
        <h2 className="absolute left-0 right-0 top-[-76px] z-30 text-center text-2xl font-black uppercase leading-none text-white">{isWest ? 'Western Conference' : 'Eastern Conference'}</h2>

        {firstTops.map((top, index) => {
          const seriesItem = first[Math.floor(index / 2)];
          const teamName = firstTeams[index];
          return (
            <div key={`${conference}-first-${index}`} style={{ position: 'absolute', top, left: x.first }}>
              {teamSlot(teamName, seriesItem, top, x.first, index)}
            </div>
          );
        })}

        {semiTops.map((top, index) => {
          const seriesItem = semis[Math.floor(index / 2)];
          const teamName = semiTeams[index] || getPlayoffSeriesLeader(first[index]);
          return (
            <div key={`${conference}-semi-${index}`} style={{ position: 'absolute', top, left: x.semi }}>
              {teamSlot(teamName, seriesItem, top, x.semi, index)}
            </div>
          );
        })}

        {confFinalTops.map((top, index) => {
          const teamName = finalTeams[index] || getPlayoffSeriesLeader(semis[index]);
          return (
            <div key={`${conference}-final-${index}`} style={{ position: 'absolute', top, left: x.final }}>
              {teamSlot(teamName, confFinal, top, x.final, index)}
            </div>
          );
        })}

        {[0, 1, 2, 3].map((pairIndex) => {
          const seriesItem = first[pairIndex];
          const advancingTeam = getPlayoffSeriesLeader(seriesItem);
          const isWinnerPath = !!advancingTeam && advancingTeam === conferenceWinner;
          const target = semiTops[pairIndex] + PLAYOFF_CARD_MID;
          const cardEdge = isWest ? x.first + PLAYOFF_CARD_WIDTH : x.first;
          const semiEdge = isWest ? x.semi : x.semi + PLAYOFF_CARD_WIDTH;
          const left = Math.min(cardEdge, semiEdge);
          return hLine(`${conference}-r1-out-${pairIndex}`, left, target, Math.abs(semiEdge - cardEdge), isWinnerPath);
        })}

        {[0, 1].map((pairIndex) => {
          const topTeam = semiTeams[pairIndex * 2];
          const bottomTeam = semiTeams[pairIndex * 2 + 1];
          const winnerTeam = getPlayoffSeriesLeader(semis[pairIndex]);
          const isWinnerPath = !!winnerTeam && winnerTeam === conferenceWinner;
          const topCardBottom = semiTops[pairIndex * 2] + PLAYOFF_CARD_HEIGHT;
          const bottomCardTop = semiTops[pairIndex * 2 + 1];
          const target = confFinalTops[pairIndex] + PLAYOFF_CARD_MID;
          const cardCenter = x.semi + PLAYOFF_CARD_WIDTH / 2;
          const finalEdge = isWest ? x.final : x.final + PLAYOFF_CARD_WIDTH;
          const left = Math.min(cardCenter, finalEdge);
          const upperPath = isWinnerPath && winnerTeam === topTeam;
          const lowerPath = isWinnerPath && winnerTeam === bottomTeam;
          return [
            vLine(`${conference}-r2-v-upper-${pairIndex}`, cardCenter, topCardBottom, target - topCardBottom, upperPath),
            vLine(`${conference}-r2-v-lower-${pairIndex}`, cardCenter, target, bottomCardTop - target, lowerPath),
            hLine(`${conference}-r2-out-${pairIndex}`, left, target, Math.abs(finalEdge - cardCenter), isWinnerPath),
          ];
        })}

        {(() => {
          const isWinnerPath = !!conferenceWinner && finalsTeams.includes(conferenceWinner);
          const upperFinalTeam = finalTeams[0];
          const lowerFinalTeam = finalTeams[1];
          const topCardBottom = confFinalTops[0] + PLAYOFF_CARD_HEIGHT;
          const bottomCardTop = confFinalTops[1];
          const cardCenter = x.final + PLAYOFF_CARD_WIDTH / 2;
          const boundaryX = isWest ? 960 : 0;
          const left = Math.min(cardCenter, boundaryX);
          const targetY = isWest ? finalsWestCenterY : finalsEastCenterY;
          const upperPath = isWinnerPath && conferenceWinner === upperFinalTeam;
          const lowerPath = isWinnerPath && conferenceWinner === lowerFinalTeam;
          return [
            vLine(`${conference}-finals-feed-v-upper`, cardCenter, topCardBottom, targetY - topCardBottom, upperPath),
            vLine(`${conference}-finals-feed-v-lower`, cardCenter, targetY, bottomCardTop - targetY, lowerPath),
            hLine(`${conference}-finals-feed-out`, left, targetY, Math.abs(boundaryX - cardCenter), isWinnerPath),
          ];
        })()}
      </div>
    );
  };

  const compactPairX = [0, 328, 656, 984];
  const compactRoundFinalX = [164, 820];
  const getOrderedConferenceFinalTeams = (conference: 'West' | 'East') => {
    const semis = byConference(conference, 'semis').slice(0, 2);
    const confFinal = byConference(conference, 'finals')[0];
    const semiWinners = semis.map((item) => getPlayoffSeriesLeader(item)).filter(Boolean) as string[];
    return confFinal?.teams.length
      ? [
          ...semiWinners.filter((teamName) => confFinal.teams.includes(teamName)),
          ...confFinal.teams.filter((teamName) => !semiWinners.includes(teamName)),
        ].slice(0, 2)
      : semiWinners;
  };

  const CompactConferenceBracket = ({ conference }: { conference: 'West' | 'East' }) => {
    const isWest = conference === 'West';
    const semis = byConference(conference, 'semis').slice(0, 2);
    const first = orderFirstRoundBySemis(byConference(conference, 'first'), semis).slice(0, 4);
    const confFinal = byConference(conference, 'finals')[0];
    const conferenceWinner = getPlayoffSeriesLeader(confFinal);
    const side = isWest ? 'west' : 'east';
    const firstTeams = first.flatMap((item) => item.teams);
    const semiTeams = semis.flatMap((item) => item.teams.length ? item.teams : [getPlayoffSeriesLeader(first[0]), getPlayoffSeriesLeader(first[1])]).slice(0, 4);
    const semiWinners = semis.map((item) => getPlayoffSeriesLeader(item)).filter(Boolean) as string[];
    const finalTeams = confFinal?.teams.length
      ? [
          ...semiWinners.filter((teamName) => confFinal.teams.includes(teamName)),
          ...confFinal.teams.filter((teamName) => !semiWinners.includes(teamName)),
        ].slice(0, 2)
      : semiWinners;
    const y = isWest
      ? { first: 0, semi: 210, final: 360 }
      : { final: 0, semi: 170, first: 330 };
    const compactPairGap = 98;
    const hLineCompact = (key: string, left: number, top: number, width: number, highlighted = false) => (
      <div key={key} className={lineStyle} style={{ left, top, width, height: 2, backgroundColor: highlighted ? '#ffffff' : lineColor }} />
    );
    const vLineCompact = (key: string, left: number, top: number, height: number, highlighted = false) => (
      <div key={key} className={lineStyle} style={{ left, top, height, width: 2, backgroundColor: highlighted ? '#ffffff' : lineColor }} />
    );

    return (
      <div className="relative h-[430px] w-[1284px]">
        {first.map((seriesItem, pairIndex) => {
          const teams = seriesItem.teams;
          return teams.map((teamName, teamIndex) => (
            <div key={`${conference}-compact-first-${teamName}`} className="absolute z-20" style={{ left: compactPairX[pairIndex], top: y.first + teamIndex * compactPairGap }}>
              <PlayoffTeamPill
                teamName={teamName}
                wins={seriesItem.wins[teamName] || 0}
                winner={seriesItem.winner === teamName}
                logoMap={logoMap}
                side={side}
              />
            </div>
          ));
        })}

        {semiTops.slice(0, 4).map((_, index) => {
          const seriesItem = semis[Math.floor(index / 2)];
          const teamName = semiTeams[index] || getPlayoffSeriesLeader(first[index]);
          return (
            <div key={`${conference}-compact-semi-${teamName || index}`} className="absolute z-20" style={{ left: compactPairX[index], top: y.semi }}>
              <PlayoffTeamPill
                teamName={teamName}
                wins={teamName && seriesItem ? seriesItem.wins[teamName] || 0 : undefined}
                winner={!!teamName && seriesItem?.winner === teamName}
                muted={!teamName}
                logoMap={logoMap}
                side={side}
              />
            </div>
          );
        })}

        {finalTeams.slice(0, 2).map((teamName, index) => (
          <div key={`${conference}-compact-final-${teamName || index}`} className="absolute z-20" style={{ left: compactRoundFinalX[index], top: y.final }}>
            <PlayoffTeamPill
              teamName={teamName}
              wins={teamName && confFinal ? confFinal.wins[teamName] || 0 : undefined}
              winner={!!teamName && confFinal?.winner === teamName}
              muted={!teamName}
              logoMap={logoMap}
              side={side}
            />
          </div>
        ))}

        {first.map((seriesItem, pairIndex) => {
          const advancingTeam = getPlayoffSeriesLeader(seriesItem);
          const isWinnerPath = !!advancingTeam && advancingTeam === conferenceWinner;
          const x = compactPairX[pairIndex] + PLAYOFF_CARD_WIDTH / 2;
          const firstMid = y.first + PLAYOFF_CARD_HEIGHT + ((compactPairGap - PLAYOFF_CARD_HEIGHT) / 2);
          const semiMid = y.semi + PLAYOFF_CARD_MID;
          const top = Math.min(firstMid, semiMid);
          return vLineCompact(`${conference}-compact-r1-${pairIndex}`, x, top, Math.abs(semiMid - firstMid), isWinnerPath);
        })}

        {[0, 1].map((pairIndex) => {
          const topTeam = semiTeams[pairIndex * 2];
          const bottomTeam = semiTeams[pairIndex * 2 + 1];
          const winnerTeam = getPlayoffSeriesLeader(semis[pairIndex]);
          const isWinnerPath = !!winnerTeam && winnerTeam === conferenceWinner;
          const leftCardCenter = compactPairX[pairIndex * 2] + PLAYOFF_CARD_WIDTH / 2;
          const rightCardCenter = compactPairX[pairIndex * 2 + 1] + PLAYOFF_CARD_WIDTH / 2;
          const targetX = compactRoundFinalX[pairIndex] + PLAYOFF_CARD_WIDTH / 2;
          const joinY = isWest ? y.semi + PLAYOFF_CARD_HEIGHT + 34 : y.semi - 34;
          const semiCenterY = y.semi + PLAYOFF_CARD_MID;
          const finalCenterY = y.final + PLAYOFF_CARD_MID;
          return [
            vLineCompact(`${conference}-compact-r2-left-${pairIndex}`, leftCardCenter, Math.min(semiCenterY, joinY), Math.abs(joinY - semiCenterY), isWinnerPath && winnerTeam === topTeam),
            vLineCompact(`${conference}-compact-r2-right-${pairIndex}`, rightCardCenter, Math.min(semiCenterY, joinY), Math.abs(joinY - semiCenterY), isWinnerPath && winnerTeam === bottomTeam),
            hLineCompact(`${conference}-compact-r2-join-${pairIndex}`, Math.min(leftCardCenter, rightCardCenter), joinY, Math.abs(rightCardCenter - leftCardCenter), isWinnerPath),
            vLineCompact(`${conference}-compact-r2-out-${pairIndex}`, targetX, Math.min(joinY, finalCenterY), Math.abs(finalCenterY - joinY), isWinnerPath),
          ];
        })}
      </div>
    );
  };

  const westFinalTeam = getPlayoffSeriesLeader(byConference('West', 'finals')[0]);
  const eastFinalTeam = getPlayoffSeriesLeader(byConference('East', 'finals')[0]);
  const finalsTeams = finals?.teams || [];
  const westFinalsTeam = westFinalTeam && finalsTeams.includes(westFinalTeam) ? westFinalTeam : westFinalTeam || finalsTeams[0];
  const eastFinalsTeam = eastFinalTeam && finalsTeams.includes(eastFinalTeam) ? eastFinalTeam : eastFinalTeam || finalsTeams.find((team) => team !== westFinalsTeam);
  const compactFinalCardCenterX = compactBracketBaseWidth / 2;
  const compactFinalCardX = compactFinalCardCenterX - PLAYOFF_CARD_WIDTH / 2;
  const compactWestFinalTeams = getOrderedConferenceFinalTeams('West');
  const compactEastFinalTeams = getOrderedConferenceFinalTeams('East');
  const compactWestWinnerIndex = Math.max(0, compactWestFinalTeams.indexOf(westFinalTeam || ''));
  const compactEastWinnerIndex = Math.max(0, compactEastFinalTeams.indexOf(eastFinalTeam || ''));
  const compactWestWinnerCenterX = compactRoundFinalX[compactWestWinnerIndex] + PLAYOFF_CARD_WIDTH / 2;
  const compactEastWinnerCenterX = compactRoundFinalX[compactEastWinnerIndex] + PLAYOFF_CARD_WIDTH / 2;
  const compactLaneHeight = 200;
  const compactConferenceHeight = 430;
  const compactStackGap = 80;
  const compactWestFinalTopY = 4;
  const compactEastFinalTopY = compactLaneHeight - 4 - PLAYOFF_CARD_HEIGHT;
  const compactEastFinalBottomY = compactEastFinalTopY + PLAYOFF_CARD_HEIGHT;
  const compactWestWinnerCardBottomY = 360 + PLAYOFF_CARD_HEIGHT - compactConferenceHeight - compactStackGap;
  const compactEastWinnerCardTopY = compactLaneHeight + compactStackGap;
  const compactWestConnectorY = Math.round((compactWestWinnerCardBottomY + compactWestFinalTopY) / 2);
  const compactEastConnectorY = Math.round((compactEastFinalBottomY + compactEastWinnerCardTopY) / 2);
  return (
    <div ref={bracketContainerRef} className="h-[calc(100vh-5rem)] overflow-hidden pb-0 pr-2">
      {compactBracket ? (
        <div
          className="relative ml-0 mt-8 overflow-visible"
          style={{ width: compactBracketBaseWidth * bracketScale, height: compactBracketBaseHeight * bracketScale }}
        >
          <div
            className="relative flex w-[1284px] flex-col items-center gap-20"
            style={{ transform: `translateX(${compactOffsetX}px) scale(${bracketScale})`, transformOrigin: 'top left' }}
          >
            <CompactConferenceBracket conference="West" />
            <div className="relative h-[200px] w-[1284px]">
              <div
                className="absolute w-0.5"
                style={{
                  left: compactWestWinnerCenterX,
                  top: compactWestWinnerCardBottomY,
                  height: Math.abs(compactWestConnectorY - compactWestWinnerCardBottomY),
                  backgroundColor: westFinalsTeam ? '#ffffff' : lineColor,
                }}
              />
              <div
                className="absolute h-0.5"
                style={{
                  top: compactWestConnectorY,
                  left: Math.min(compactWestWinnerCenterX, compactFinalCardCenterX),
                  width: Math.abs(compactFinalCardCenterX - compactWestWinnerCenterX),
                  backgroundColor: westFinalsTeam ? '#ffffff' : lineColor,
                }}
              />
              <div
                className="absolute w-0.5"
                style={{
                  left: compactFinalCardCenterX,
                  top: compactWestConnectorY,
                  height: Math.abs(compactWestFinalTopY - compactWestConnectorY),
                  backgroundColor: westFinalsTeam ? '#ffffff' : lineColor,
                }}
              />
              <div
                className="absolute w-0.5"
                style={{
                  left: compactFinalCardCenterX,
                  top: compactEastFinalBottomY,
                  height: Math.abs(compactEastConnectorY - compactEastFinalBottomY),
                  backgroundColor: eastFinalsTeam ? '#ffffff' : lineColor,
                }}
              />
              <div
                className="absolute h-0.5"
                style={{
                  top: compactEastConnectorY,
                  left: Math.min(compactEastWinnerCenterX, compactFinalCardCenterX),
                  width: Math.abs(compactFinalCardCenterX - compactEastWinnerCenterX),
                  backgroundColor: eastFinalsTeam ? '#ffffff' : lineColor,
                }}
              />
              <div
                className="absolute w-0.5"
                style={{
                  left: compactEastWinnerCenterX,
                  top: compactEastConnectorY,
                  height: Math.abs(compactEastWinnerCardTopY - compactEastConnectorY),
                  backgroundColor: eastFinalsTeam ? '#ffffff' : lineColor,
                }}
              />
              <div className="absolute top-4 z-30" style={{ left: compactFinalCardX }}>
                <PlayoffTeamPill
                  teamName={westFinalsTeam}
                  wins={westFinalsTeam && finals ? finals.wins[westFinalsTeam] || 0 : undefined}
                  winner={!!westFinalsTeam && finals?.winner === westFinalsTeam}
                  muted={!westFinalsTeam}
                  logoMap={logoMap}
                  side="west"
                />
              </div>
              <div className="absolute bottom-4 z-30" style={{ left: compactFinalCardX }}>
                <PlayoffTeamPill
                  teamName={eastFinalsTeam}
                  wins={eastFinalsTeam && finals ? finals.wins[eastFinalsTeam] || 0 : undefined}
                  winner={!!eastFinalsTeam && finals?.winner === eastFinalsTeam}
                  muted={!eastFinalsTeam}
                  logoMap={logoMap}
                  side="east"
                />
              </div>
            </div>
            <CompactConferenceBracket conference="East" />
          </div>
        </div>
      ) : (
        <div
          className="playoff-bracket-fit relative mx-auto mt-24 overflow-visible"
          style={{ width: bracketBaseWidth * bracketScale, height: bracketBaseHeight * bracketScale }}
        >
          <div
            className="playoff-bracket-board relative w-[2520px] p-4 pr-6"
            style={{ transform: `scale(${bracketScale})`, transformOrigin: 'top left' }}
          >
            <div className="relative grid min-h-[calc(100vh-150px)] grid-cols-[960px_560px_960px] items-center gap-3">
              <ConferenceBracket conference="West" />
              <div className="relative h-[1020px]">
                <div className="absolute left-0 h-0.5 w-[128px]" style={{ top: finalsWestCenterY, backgroundColor: lineColor }} />
                <div className="absolute right-0 h-0.5 w-[128px]" style={{ top: finalsEastCenterY, backgroundColor: lineColor }} />

                <div className="absolute left-1/2 z-30 -translate-x-1/2" style={{ top: finalsWestTop }}>
                  <PlayoffTeamPill
                    teamName={westFinalsTeam}
                    wins={westFinalsTeam && finals ? finals.wins[westFinalsTeam] || 0 : undefined}
                    winner={!!westFinalsTeam && finals?.winner === westFinalsTeam}
                    muted={!westFinalsTeam}
                    logoMap={logoMap}
                    side="west"
                  />
                </div>
                <div className="absolute left-1/2 z-30 -translate-x-1/2" style={{ top: finalsEastTop }}>
                  <PlayoffTeamPill
                    teamName={eastFinalsTeam}
                    wins={eastFinalsTeam && finals ? finals.wins[eastFinalsTeam] || 0 : undefined}
                    winner={!!eastFinalsTeam && finals?.winner === eastFinalsTeam}
                    muted={!eastFinalsTeam}
                    logoMap={logoMap}
                    side="east"
                  />
                </div>
              </div>
              <ConferenceBracket conference="East" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};




// ============================
// 🧑‍🤝‍🧑 PlayerModal Component
// Full-screen overlay modal opened when a team is clicked.
// Contains three tabs:
//   - Full Stats: all team stat groups with color-coded highlights vs league average
//   - Roster: player cards sorted by Value Score with per-game stats
//   - Schedule: full season schedule with outcomes, running record, and "Jump to latest" button
// ============================
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
      const teamScore = parseScore(game.isHome ? (game as any).home_score : (game as any).away_score);
      const opponentScore = parseScore(game.isHome ? (game as any).away_score : (game as any).home_score);
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
        <div className="sticky top-0 bg-background border-b p-3 flex flex-wrap items-center gap-4 z-10">
          <div className="flex-1 min-h-0 flex items-center gap-3">
            {teamLogo && (
              <img
                src={teamLogo}
                alt={`${team.TEAM_NAME} logo`}
                className="w-20 h-20 rounded-md object-contain"
                loading="lazy"
              />
            )}
            <h2 className="text-3xl font-bold">{team.TEAM_NAME}</h2>
          </div>
          <div className="flex items-center gap-6 ml-auto text-right text-white/90">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60 font-bold">Record</p>
              <p className="text-lg font-bold text-white">{recordLabel}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60 font-bold">BPI Rank</p>
              <p className="text-lg font-bold text-white">{bpiRankLabel}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-accent rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs Navigation - Sticky */}
        <div className="sticky top-[88px] bg-background border-b px-6 py-3 z-10">
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
        </div>

        {/* Tab Content - Fixed height so modal doesn't resize between tabs */}
        <div className="p-6 overflow-y-auto h-[calc(90vh-200px)] space-y-4">
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
                    <CardContent className="pt-4 pb-4 max-h-[70vh] overflow-y-auto">
                      <div className="grid grid-cols-4 gap-x-3 gap-y-8">
                        {TEAM_MODAL_STAT_COLUMNS.map((column, colIndex) => (
                          <div key={`modal-col-${colIndex}`} className="space-y-4">
                            {column.map((stat) => (
                              <StatRow
                                key={`modal-${stat.key}`}
                                label={stat.label ?? stat.key}
                                value={formatTeamModalStatValue(team, stat.key)}
                                highlight={getModalStatHighlight(stat.key)}
                                dense
                                bold
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
                          style={{ backgroundColor: '#141414', opacity: 1 }}
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
                                  <StatRow label="GP" value={player.GP.toFixed(0)} bold />
                                  <StatRow label="MIN" value={player.MIN.toFixed(1)} highlight={getTeamHighlight(player, 'MIN')} bold />
                                  <StatRow label="PPG" value={player.PTS.toFixed(1)} highlight={getTeamHighlight(player, 'PTS')} bold />
                                  <StatRow label="REB" value={player.REB.toFixed(1)} highlight={getTeamHighlight(player, 'REB')} bold />
                                  <StatRow label="AST" value={player.AST.toFixed(1)} highlight={getTeamHighlight(player, 'AST')} bold />
                                  <StatRow label="STL" value={player.STL.toFixed(1)} highlight={getTeamHighlight(player, 'STL')} bold />
                                  <StatRow label="BLK" value={player.BLK.toFixed(1)} highlight={getTeamHighlight(player, 'BLK')} bold />
                                </div>
                                <div className="space-y-2">
                                  <StatRow label="TOV" value={player.TOV.toFixed(1)} highlight={getTeamHighlight(player, 'TOV')} bold />
                                  <StatRow label="FGA" value={player.FGA.toFixed(1)} highlight={getTeamHighlight(player, 'FGA')} bold />
                                  <StatRow label="FG%" value={`${(player.FG_PCT * 100).toFixed(1)}%`} highlight={getTeamHighlight(player, 'FG_PCT')} bold />
                                  <StatRow label="3PA" value={player.FG3A.toFixed(1)} highlight={getTeamHighlight(player, 'FG3A')} bold />
                                  <StatRow label="3P%" value={`${(player.FG3_PCT * 100).toFixed(1)}%`} highlight={getTeamHighlight(player, 'FG3_PCT')} bold />
                                  <StatRow label="FTA" value={player.FTA.toFixed(1)} highlight={getTeamHighlight(player, 'FTA')} bold />
                                  <StatRow label="FT%" value={`${(player.FT_PCT * 100).toFixed(1)}%`} highlight={getTeamHighlight(player, 'FT_PCT')} bold />
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
                        className={`relative overflow-hidden transition-all duration-300 bg-card p-2 ${
                          highlightedMatchupId === cardId ? 'ring-4 ring-white border-2 border-white shadow-[0_0_20px_rgba(255,255,255,0.6)]' : 'border'
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
                              } else if (name.includes('abc')) {
                                style = { backgroundColor: '#000000', color: '#ffffff' };
                              }
                              return (
                                <Badge key={p} className="text-[9px] font-semibold px-1.5 py-0.5" style={style}>
                                  {p}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                        <CardContent className="py-1 px-2 text-white space-y-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center justify-center flex-1">
                              {awayLogo && (
                                <img
                                  src={awayLogo}
                                  alt={awayAbbrResolved || 'Away'}
                                  className={`rounded-sm object-contain ${
                                    isFinal ? (awayWin ? 'opacity-100' : 'opacity-40') : ''
                                  }`}
                                  style={{
                                    width: 96, height: 96,
                                    ...(isFinal && awayWin
                                      ? { filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8)) drop-shadow(0 0 10px rgba(255,255,255,0.5))' }
                                      : undefined)
                                  }}
                                  loading="lazy"
                                />
                              )}
                            </div>

                            <div className="flex flex-col items-center justify-center gap-1 px-2 min-w-[120px]">
                              <div className="text-[11px] text-muted-foreground font-bold">{dateLabel}</div>
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

                            <div className="flex items-center justify-center flex-1">
                              {homeLogo && (
                                <img
                                  src={homeLogo}
                                  alt={homeAbbrResolved || 'Home'}
                                  className={`rounded-sm object-contain ${
                                    isFinal ? (homeWin ? 'opacity-100' : 'opacity-40') : ''
                                  }`}
                                  style={{
                                    width: 96, height: 96,
                                    ...(isFinal && homeWin
                                      ? { filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8)) drop-shadow(0 0 10px rgba(255,255,255,0.5))' }
                                      : undefined)
                                  }}
                                  loading="lazy"
                                />
                              )}
                            </div>
                          </div>

                          <div className="text-[10px] text-muted-foreground text-center mt-1 font-bold">
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



  const accent = teamGradientColors[teamAbbr]?.start || teamColor?.primary || '#1e40af';

return (
  <div
    className={`group relative overflow-hidden rounded-2xl border border-white/10 transition-all duration-200 ${
      onClick ? 'cursor-pointer hover:scale-[1.01]' : ''
    }`}
    style={{
      background: 'linear-gradient(135deg, #171717 0%, #0f0f0f 100%)',
      boxShadow: '0 14px 34px rgba(0,0,0,0.24)',
    }}
    onClick={onClick}
  >
    <div
      className="absolute left-0 top-0 h-[82px]"
      style={{
        width: 82,
        background: `linear-gradient(135deg, ${accent} 0%, ${accent} 56%, transparent 57%)`,
      }}
    />
    <div
      className="absolute font-black italic leading-none select-none"
      style={{
        left: 8,
        top: 4,
        color: 'rgba(255,255,255,0.92)',
        fontSize: 56,
        letterSpacing: 0,
      }}
    >
      {team.rank}
    </div>

    <div className="relative z-10 p-4 text-white">
      <div className="flex items-center gap-4 min-h-[82px]">
        <div className="w-[48px] shrink-0" />
        {team.LOGO_URL && (
          <img
            src={team.LOGO_URL}
            alt={`${team.TEAM_NAME} logo`}
            className="h-20 w-20 shrink-0 object-contain"
            loading="lazy"
          />
        )}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h3 className="truncate text-2xl font-black uppercase leading-none text-white">{team.TEAM_NAME}</h3>
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onToggleFavorite(team);
              }}
              className={`shrink-0 rounded-full p-1 transition-colors ${
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
        <div className="flex shrink-0 items-end gap-1">
          <span className="text-4xl font-black text-white leading-none tabular-nums">{team.W}-{team.L}</span>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.28)' }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-3">
            <StatRow label="Win " value={`${winPercentage}%`} highlight={getHighlight('WIN_PCT')} bold />
            <StatRow label="PPG" value={team.PTS.toFixed(1)} highlight={getHighlight('PTS')} bold />
            <StatRow label="RPG" value={team.REB.toFixed(1)} highlight={getHighlight('REB')} bold />
            <StatRow label="FT%" value={`${(team.FT_PCT * 100).toFixed(1)}%`} highlight={getHighlight('FT_PCT')} bold />
          </div>
          <div className="space-y-3">
            <StatRow label="TOV" value={team.TOV.toFixed(1)} highlight={getHighlight('TOV')} bold />
            <StatRow label="OREB" value={team.OREB.toFixed(1)} highlight={getHighlight('OREB')} bold />
            <StatRow label="DREB" value={team.DREB.toFixed(1)} highlight={getHighlight('DREB')} bold />
            <StatRow label="STL" value={team.STL.toFixed(1)} highlight={getHighlight('STL')} bold />
          </div>
          <div className="space-y-3">
            <StatRow label="BLK" value={team.BLK.toFixed(1)} highlight={getHighlight('BLK')} bold />
            <StatRow label="FG%" value={`${(team.FG_PCT * 100).toFixed(1)}%`} highlight={getHighlight('FG_PCT')} bold />
            <StatRow label="3P%" value={`${(team.FG3_PCT * 100).toFixed(1)}%`} highlight={getHighlight('FG3_PCT')} bold />
            <StatRow label="BPI" value={typeof (team as any).bpi === 'number' ? (team as any).bpi.toFixed(1) : ((team as any).bpi ?? '-')}
              highlight={getBpiHighlight('bpi')}
              bold
            />
          </div>
          <div className="space-y-3">
            <StatRow label="OFF" value={typeof (team as any).off === 'number' ? (team as any).off.toFixed(1) : ((team as any).off ?? '-')}
              highlight={getBpiHighlight('off')}
              bold
            />
            <StatRow label="DEF" value={typeof (team as any).def === 'number' ? (team as any).def.toFixed(1) : ((team as any).def ?? '-')}
              highlight={getBpiHighlight('def')}
              bold
            />
            <StatRow label="PBPI" value={typeof (team as any).pbpi === 'number' ? (team as any).pbpi.toFixed(1) : ((team as any).pbpi ?? '-')}
              highlight={getBpiHighlight('pbpi')}
              bold
            />
            <StatRow label="BPI RK" value={(team as any).bpirank ?? '-'} bold />
          </div>
        </div>
      </div>
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
  const [nbaSeasons, setNbaSeasons] = useState<NBASeasonOption[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [nbaPlayerData, setNbaPlayerData] = useState<Record<string, Player[]>>(() => _cachedPlayers ?? {});
  const [loading, setLoading] = useState(() => _cachedTeams === null); // only show loading spinner on true first load
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [nbaTeams, setNbaTeams] = useState<NBATeam[]>(() => _cachedTeams ?? []);
  const [activeTab, setActiveTab] = useState<string>('schedule'); // Change this to: 'dashboard', 'all', 'top-scorers', or 'schedule'
  const [playoffsRevealKey, setPlayoffsRevealKey] = useState(0);
  const handleTabChange = useCallback((value: string) => {
    React.startTransition(() => {
      setActiveTab(value);
      if (value === 'playoffs') {
        setPlayoffsRevealKey((key) => key + 1);
      }
    });
  }, []);

  // Portrait mobile detection — only affects mobile layout, never touches desktop
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 && window.innerHeight > window.innerWidth
  );
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640 && window.innerHeight > window.innerWidth);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);
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
  const [scheduleData, setScheduleData] = useState<NBAScheduleData | null>(() => _cachedSchedule);
  const selectedSeason = useMemo(
    () => nbaSeasons.find((season) => season.id === selectedSeasonId) || nbaSeasons[0] || null,
    [nbaSeasons, selectedSeasonId],
  );
  const [compactNavSeason, setCompactNavSeason] = useState(false);
  const compactSeasonLabel = useMemo(() => {
    const label = selectedSeason?.label || 'Season';
    const match = label.match(/^20(\d{2})-(\d{2})$/);
    return match ? `${match[1]}-${match[2]}` : label;
  }, [selectedSeason?.label]);
  const logosScrollRef = useRef<HTMLDivElement | null>(null);
  const dashboardTeamRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const dashboardHighlightTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dashboardHighlightTeamId, setDashboardHighlightTeamId] = useState<number | null>(null);
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
    
    // Safe JSON fetch helper — returns null if response is partial/corrupt
    const safeFetchJson = async (url: string, options?: RequestInit) => {
      const resp = await fetch(url, options);
      if (!resp.ok) return null;
      const text = await resp.text();
      try {
        return { data: JSON.parse(text), text };
      } catch {
        console.warn(`Skipping corrupt JSON from ${url} — will retry next cycle`);
        return null;
      }
    };

    // Fetch all 3 endpoints in parallel — team/player use HTTP cache (they rarely change)
    const manifestResult = await safeFetchJson('/data/nba_seasons.json', { cache: 'no-cache' });
    const fallbackSeason: NBASeasonOption = {
      id: 'latest',
      label: 'Latest',
      start_year: 0,
      schedule: 'nba_schedule.json',
      team_stats: 'espn_NBA_team_stats.json',
      player_stats: 'espn_NBA_player_stats.json',
    };
    const manifest = manifestResult?.data as NBASeasonManifest | undefined;
    const seasons = Array.isArray(manifest?.seasons) && manifest!.seasons.length
      ? [...manifest!.seasons].sort((a, b) => Number(b.start_year || 0) - Number(a.start_year || 0))
      : [fallbackSeason];
    const nextSelectedId = selectedSeasonId || manifest?.current || seasons[0].id;
    const seasonFiles = seasons.find((season) => season.id === nextSelectedId) || seasons[0];

    setNbaSeasons(seasons);
    if (!selectedSeasonId || !seasons.some((season) => season.id === selectedSeasonId)) {
      setSelectedSeasonId(seasonFiles.id);
    }

    const [teamResult, playerResult, schedResult] = await Promise.all([
      safeFetchJson(`/data/${seasonFiles.team_stats}`, { cache: 'no-cache' }),
      safeFetchJson(`/data/${seasonFiles.player_stats}`, { cache: 'no-cache' }),
      safeFetchJson(`/data/${seasonFiles.schedule}`, { cache: 'no-cache' }),
    ]);

    if (teamResult) {
      const teamsWithConference = teamResult.data.map((team: NBATeam) => ({
        ...team,
        conference: teamConferences[team.TEAM_NAME]?.conference || 'Unknown',
        division: teamConferences[team.TEAM_NAME]?.division || 'Unknown',
      }));
      _cachedTeams = teamsWithConference;
      ALL_TEAMS_CACHE = teamsWithConference;
      setNbaTeams(teamsWithConference);
    }

    if (playerResult) {
      _cachedPlayers = playerResult.data;
      setNbaPlayerData(playerResult.data);
    }

    if (schedResult) {
      const schedJson = schedResult.data as NBAScheduleData;
      _cachedSchedule = schedJson;
      setScheduleData(schedJson);
    }

    setLastUpdate(new Date());
    setLoading(false);
  } catch (error) {
    console.error('Error fetching NBA data:', error);
    setLoading(false);
  }
};


  // Initial load
useEffect(() => {
  fetchData();
}, [selectedSeasonId]);

useEffect(() => {
  if (typeof window === 'undefined') return;
  const updateCompactNavSeason = () => setCompactNavSeason(window.innerWidth < 1500);
  updateCompactNavSeason();
  window.addEventListener('resize', updateCompactNavSeason);
  return () => window.removeEventListener('resize', updateCompactNavSeason);
}, []);

// Auto-refresh teams/players every 5 minutes (not 30s — no need to hammer the server)
useEffect(() => {
  if (!autoRefresh) return;
  const interval = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    fetchData();
  }, 5 * 60 * 1000);
  return () => clearInterval(interval);
}, [autoRefresh, selectedSeasonId]);

// Lightweight schedule-only polling
// - Every 30s if there are live games, every 5 min otherwise
// - Silently skips corrupt/partial JSON (mid-write race condition)
useEffect(() => {
  let cancelled = false;
  if (!autoRefresh) return;

  const fetchScheduleOnly = async () => {
    try {
      if (typeof document !== 'undefined' && document.hidden) return;
      const scheduleFile = selectedSeason?.schedule || 'nba_schedule.json';
      const resp = await fetch(`/data/${scheduleFile}?_=` + Date.now(), { cache: 'no-store' });
      if (!resp.ok || cancelled) return;
      const text = await resp.text();
      if (cancelled) return;
      // Validate JSON before applying — silently drop partial writes
      let next: NBAScheduleData;
      try {
        next = JSON.parse(text) as NBAScheduleData;
      } catch {
        return; // mid-write race — skip this cycle
      }
      setScheduleData((prev) => {
        const prevText = JSON.stringify(prev ?? null);
        if (prevText === text) return prev;
        _cachedSchedule = next;
        return next;
      });
    } catch {}
  };

  // Determine poll interval based on whether any game is currently live
  const getLiveGames = () => {
    try {
      const gamesArr: ScheduleGameAny[] = Array.isArray(scheduleData)
        ? (scheduleData as ScheduleGameAny[])
        : ((scheduleData as any)?.games || []);
      return gamesArr.some((g: any) => g.status === 'live');
    } catch { return false; }
  };

  let id: ReturnType<typeof setInterval>;
  const start = () => {
    const hasLive = getLiveGames();
    const interval = hasLive ? 30_000 : 5 * 60_000;
    id = setInterval(() => {
      if (cancelled) return;
      fetchScheduleOnly();
      // Re-evaluate interval each cycle
      clearInterval(id);
      if (!cancelled) start();
    }, interval);
  };

  fetchScheduleOnly();
  start();

  const vis = () => {
    if (document.visibilityState === 'visible') fetchScheduleOnly();
  };
  document.addEventListener('visibilitychange', vis);

  return () => {
    cancelled = true;
    clearInterval(id);
    document.removeEventListener('visibilitychange', vis);
  };
}, [autoRefresh, scheduleData, selectedSeason?.schedule]);


// Compute league averages for ALL team stats
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

// Official NBA full-season attempt thresholds for percentage stats.
// Scaled dynamically by season progress (maxGP / 82) so the bar rises
// as the season goes on — matching how stats.nba.com qualifies leaders.
const PLAYER_PCT_QUALIFIERS: Partial<Record<keyof Player, { attemptField: keyof Player; fullSeasonThreshold: number }>> = {
  FG_PCT:  { attemptField: 'FGA',  fullSeasonThreshold: 300 },
  FG3_PCT: { attemptField: 'FG3A', fullSeasonThreshold: 82  },
  FT_PCT:  { attemptField: 'FTA',  fullSeasonThreshold: 125 },
};

const _maxGP = allPlayers.length > 0
  ? allPlayers.reduce((max, p) => Math.max(max, p.GP), 0)
  : 82;
const _seasonProgress = Math.min(_maxGP / 82, 1);

const meetsQualifier = (p: Player, field: keyof Player): boolean => {
  const q = PLAYER_PCT_QUALIFIERS[field];
  if (!q) return true;
  const totalAttempts = (p as any)[q.attemptField] * p.GP;
  return totalAttempts >= q.fullSeasonThreshold * _seasonProgress;
};

const leagueStatLeaders = React.useMemo<StatLeaderMap>(() => {
  const leaderMap: StatLeaderMap = {};
  const epsilon = 0.01;
  PLAYER_STAT_KEYS.forEach((key) => {
    let bestValue: number | null = null;
    let leaderIds: number[] = [];
    allPlayers.forEach((p) => {
      if (!meetsQualifier(p, key)) return;
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
  // Preload all logos into browser cache as soon as we have them
  Object.values(map).forEach((url) => {
    const img = new Image();
    img.src = url;
  });
  return map;
}, [nbaTeams]);

// Map team abbreviation to record string (W-L)
const abbrToRecord = React.useMemo(() => {
  const map: Record<string, string> = {};
  nbaTeams.forEach((t) => {
    const abbr = teamAbbreviations[t.TEAM_NAME];
    if (abbr) map[abbr] = `${t.W} - ${t.L}`;
  });
  return map;
}, [nbaTeams]);

// Map team abbreviation to current streak (computed from schedule results)
const abbrToStreakMap = React.useMemo(() => computeStreakMap(scheduleData), [scheduleData]);

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
    .filter((p: Player) => meetsQualifier(p, playerSortField as keyof Player))
    .sort(
      (a: Player, b: Player) =>
        getPlayerStat(b, playerSortField) - getPlayerStat(a, playerSortField)
    )
    .slice(0, 50);
}, [nbaPlayerData, playerSortField]);

// Pre-compute valueScore + highlights per player so the render reads plain values
// instead of calling getPlayerValueScore/getPlayerHighlight 650+ times inline.
const sortedTopPlayersWithMeta = React.useMemo(() => {
  return sortedTopPlayers.map(player => {
    const highlights: Partial<Record<keyof Player, 'best' | 'high' | 'low' | 'neutral'>> = {};
    for (const key of PLAYER_STAT_KEYS) {
      highlights[key] = getPlayerHighlight(player, key);
    }
    return { player, valueScore: getPlayerValueScore(player), highlights };
  });
}, [sortedTopPlayers, leagueStatLeaders, playerAverages]);













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
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes playoffsReveal { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
        .nba-playoffs-reveal { animation: playoffsReveal 0.45s ease-out both; will-change: opacity, transform; }
      `}</style>
      <div className="flex justify-end">
      </div>
      {/* Tabs for Dashboard / All / East / West / Scorers / Schedule */}
      <Tabs
        theme="nba"
        value={isMobile ? 'schedule' : activeTab}
        className="w-full"
        onValueChange={(v) => {
          if (!isMobile) handleTabChange(v);
        }}
      >
  {/* ========================
      Navigation Tab Bar — hidden on mobile (scoreboard-only on mobile)
  ======================== */}
  {!isMobile && (
    <PageNavbar
      tabs={[
        { value: 'schedule',    label: 'Scoreboard'  },
        { value: 'playoffs',    label: 'Playoffs'    },
        { value: 'standings',   label: 'Standings'   },
        { value: 'all',         label: 'Team Stats'  },
        { value: 'top-scorers', label: 'Top Players' },
      ]}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      afterTabsSlot={!compactNavSeason ? (
        <Select value={selectedSeasonId} onValueChange={(value) => setSelectedSeasonId(value)}>
          <SelectTrigger className="h-10 w-[130px] shrink-0 rounded-full border-white/10 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur hover:bg-white/15">
            {selectedSeason?.label || 'Season'}
          </SelectTrigger>
          <SelectContent className="min-w-[130px] rounded-2xl border-white/10 bg-[#171717]/95 p-1 text-white">
            {nbaSeasons.map((season) => (
              <SelectItem key={season.id} value={season.id} className="cursor-pointer rounded-full py-2 pl-8 pr-3">
                {season.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      rightSlot={compactNavSeason ? (
        <Select value={selectedSeasonId} onValueChange={(value) => setSelectedSeasonId(value)}>
          <SelectTrigger className="h-10 w-[70px] shrink-0 rounded-full border-white/10 bg-white/10 px-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/15 [&>svg]:hidden">
            {compactSeasonLabel}
          </SelectTrigger>
          <SelectContent className="min-w-[130px] rounded-2xl border-white/10 bg-[#171717]/95 p-1 text-white">
            {nbaSeasons.map((season) => (
              <SelectItem key={season.id} value={season.id} className="cursor-pointer rounded-full py-2 pl-8 pr-3">
                {season.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    />
  )}




        {/* === Sort Controls === */}
{/* ========================
    PAGE: Team Stats
    - Sort controls: stat dropdown + asc/desc toggle
    - Left sidebar: team logo grid (click to select)
    - Right pane: selected team card + W/L doughnut + radar chart + player roster cards
======================== */}
<TabsContent value="all">

 {/* === Sort Controls (stat dropdown + asc/desc toggle) === */}
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
              className="cursor-pointer w-full justify-center text-center rounded-full px-4 py-2 text-sm font-semibold hover:bg-gradient-to-r hover:from-[#4c1d95] hover:to-[#2dd4bf] hover:text-white data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#4c1d95] data-[state=checked]:to-[#2dd4bf] data-[state=checked]:text-white transition-all duration-200 [&_[data-radix-select-item-indicator]]:hidden [&>span:first-child]:hidden"
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


  {/* === Team Logo Sidebar + Team Detail Pane === */}
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
        {/* Left: scrollable grid of team logo buttons — click to select a team */}
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

        {/* Right: selected team card, W/L doughnut chart, radar chart, then player roster cards */}
        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto no-scrollbar flex flex-col gap-5 pr-0 pb-4">
          {currentTeam && (() => {
            const teamAbbr = teamAbbreviations[currentTeam.TEAM_NAME] || 'UNK';
            const primaryColor = teamGradientColors[teamAbbr]?.start || '#4f46e5';
            const secondaryColor = teamGradientColors[teamAbbr]?.end || '#4f46e5';
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
              { label: 'OFF', key: 'off', value: Number((currentTeam as any).off || 0) },
              { label: 'DEF', key: 'def', value: Number((currentTeam as any).def || 0) },
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
                  pointLabels: {
                    color: '#ffffff',
                    backdropColor: 'transparent',
                    padding: 8,
                    font: { size: 11, weight: 'bold' },
                  },
                  ticks: { display: false },
                },
              },
            };
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1rem', alignItems: 'start' }}>
                {/* Team card — fills its grid cell */}
                <div style={{ animation: 'slideUp 0.4s ease-out 0s both' }}>
                  <TeamCard
                    key={currentTeam.TEAM_ID}
                    team={{ ...currentTeam, rank: (teams.findIndex((tt) => tt.TEAM_ID === currentTeam.TEAM_ID) + 1) || 1 }}
                    leagueAverages={leagueAverages}
                    allTeams={nbaTeams}
                    onClick={() => setSelectedTeam(currentTeam)}
                    isFavorite={favoriteTeamIds.includes(currentTeam.TEAM_ID)}
                    onToggleFavorite={toggleFavoriteTeam}
                  />
                </div>
                {/* Both charts side-by-side in second cell */}
                <div className="flex gap-3" style={{ animation: 'slideUp 0.4s ease-out 0.05s both' }}>
                  <div className="flex-1">
                    <Card className="bg-transparent border-none w-full h-[235px] overflow-hidden">
                      <CardContent className="h-[235px] p-1">
                        <Doughnut data={doughnutData} options={doughnutOptions} />
                      </CardContent>
                    </Card>
                  </div>
                  <div className="flex-1">
                    <Card className="bg-transparent border-none w-full h-[235px] overflow-hidden">
                      <CardContent className="h-[235px] p-1">
                        <Radar data={radarData} options={radarOptions} datasetIdKey="id" updateMode="active" />
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Players list (no independent scroll, uses parent scroll) */}
          <div className="flex-1 flex flex-col">
            {topTeamPlayers.length ? (
              <div
                className="snap-y snap-mandatory pt-0 pb-4"
                style={{ scrollPaddingTop: '16px', scrollPaddingBottom: '16px' }}
              >
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
                  {topTeamPlayers.map((p, pIdx) => {
                    const primary = teamGradientColors[p.TEAM_ABBREVIATION]?.start || '#1e40af';
                    return (
                      <div
                        key={p.PLAYER_ID}
                        className="group relative rounded-2xl overflow-hidden snap-start border border-white/10 transition-all duration-200 hover:scale-[1.01]"
                        style={{
                          background: 'linear-gradient(135deg, #171717 0%, #0f0f0f 100%)',
                          boxShadow: '0 14px 34px rgba(0,0,0,0.24)',
                          scrollMarginTop: '16px',
                          scrollMarginBottom: '16px',
                          animation: `slideUp 0.4s ease-out ${pIdx * 0.05}s both`,
                        }}
                      >
                        <div
                          className="absolute left-0 top-0 h-[64px]"
                          style={{
                            width: 62,
                            background: `linear-gradient(135deg, ${primary} 0%, ${primary} 56%, transparent 57%)`,
                          }}
                        />
                        <div
                          className="absolute font-black italic leading-none select-none"
                          style={{
                            left: 7,
                            top: 4,
                            color: 'rgba(255,255,255,0.92)',
                            fontSize: 40,
                            letterSpacing: 0,
                          }}
                        >
                          {pIdx + 1}
                        </div>

                        <div className="relative z-10 px-3 py-2 text-white">
                          <div className="flex items-center gap-3 min-h-[42px]">
                            <div className="w-[38px] shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-base font-black uppercase leading-none text-white">{p.PLAYER_NAME}</div>
                            </div>
                            <div className="flex shrink-0 items-end gap-1">
                              <span className="text-xl font-black text-white leading-none tabular-nums">{getPlayerValueScore(p).toFixed(1)}</span>
                            </div>
                          </div>
                          {/* Key stats (match previous fields) */}
                          <div className="mt-2 grid grid-cols-4 gap-1.5 text-xs">
                            <div className="rounded-md bg-white/[0.04] px-2 py-0.5 text-center">
                              <div className="font-bold text-white/40">PPG</div>
                              <div className={`font-bold ${getTeammateHighlight(p,'PTS')==='high' ? 'text-green-400' : getTeammateHighlight(p,'PTS')==='low' ? 'text-red-400' : ''}`}>{p.PTS.toFixed(1)}</div>
                            </div>
                            <div className="rounded-md bg-white/[0.04] px-2 py-0.5 text-center">
                              <div className="font-bold text-white/40">RPG</div>
                              <div className={`font-bold ${getTeammateHighlight(p,'REB')==='high' ? 'text-green-400' : getTeammateHighlight(p,'REB')==='low' ? 'text-red-400' : ''}`}>{p.REB.toFixed(1)}</div>
                            </div>
                            <div className="rounded-md bg-white/[0.04] px-2 py-0.5 text-center">
                              <div className="font-bold text-white/40">APG</div>
                              <div className={`font-bold ${getTeammateHighlight(p,'AST')==='high' ? 'text-green-400' : getTeammateHighlight(p,'AST')==='low' ? 'text-red-400' : ''}`}>{p.AST.toFixed(1)}</div>
                            </div>
                            <div className="rounded-md bg-white/[0.04] px-2 py-0.5 text-center">
                              <div className="font-bold text-white/40">FG%</div>
                              <div className={`font-bold ${getTeammateHighlight(p,'FG_PCT')==='high' ? 'text-green-400' : getTeammateHighlight(p,'FG_PCT')==='low' ? 'text-red-400' : ''}`}>{(p.FG_PCT * 100).toFixed(1)}</div>
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


{/* ========================
    PAGE: Scoreboard
    - Date navigation (prev/next arrows)
    - Game cards grid: away team logo | score or tip-off time | home team logo
    - Live game dot indicator, TV provider badges
    - Click a game card to open ESPN box score in an iframe modal
======================== */}
<TabsContent value="schedule" className={isMobile ? 'mt-0 h-[100dvh] flex flex-col overflow-hidden' : 'max-h-[100vh] overflow-y-auto no-scrollbar pb-16 pr-2'}>
  <ScheduleViewV2 scheduleData={scheduleData} logoMap={abbrToLogo} recordMap={abbrToRecord} streakMap={abbrToStreakMap} onGameClick={(gameId) => setEspnGameId(gameId)} isMobile={isMobile} />
</TabsContent>

<TabsContent value="playoffs" className="mt-0">
  <div key={`playoffs-reveal-${playoffsRevealKey}`} className="nba-playoffs-reveal">
    <PlayoffBracketView scheduleData={scheduleData} logoMap={abbrToLogo} seasonLabel={selectedSeason?.label} />
  </div>
</TabsContent>

{/* ========================
    PAGE: Standings
    - Two-column layout: Western Conference (left) | Eastern Conference (right)
    - Teams ranked by wins, showing rank number, record, and team logo
    - Click a team card to open the PlayerModal (full stats + roster + schedule)
======================== */}
<TabsContent value="standings" className="max-h-[100vh] overflow-y-auto no-scrollbar pb-32 pr-2">
  <div className="grid grid-cols-2 gap-4">
    {/* Western Conference */}
    <div>
      <h2 className="text-xl mb-3 font-black uppercase tracking-wide text-white text-center">WESTERN CONFERENCE</h2>
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
                  backgroundImage: `linear-gradient(-90deg, ${primaryColor}95 0%, ${primaryColor}45 20%, transparent 85%)`,
                  animation: `slideUp 0.4s ease-out ${index * 0.05}s both`,
                }}
              >
                {/* Card content */}
                <div className="relative z-10 flex items-center justify-between px-3 py-3 h-20">
                  {/* Left side - Ranking and Record */}
                  <div className="flex flex-col items-start justify-between h-16">
                    {/* Ranking number at top */}
                    <div
                      className="text-lg font-black text-white"
                      style={{ lineHeight: '1', letterSpacing: 0 }}
                    >
                      #{index + 1}
                    </div>

                    {/* Record at bottom */}
                    <div 
                      className="text-4xl font-black text-white tabular-nums"
                      style={{ lineHeight: '1', letterSpacing: 0 }}
                    >
                      {team.W} - {team.L}
                    </div>
                  </div>
                  
                  {/* Team Logo - Large on right */}
                  {team.LOGO_URL && (
                    <img
                      src={team.LOGO_URL}
                      alt={`${team.TEAM_NAME} logo`}
                      className="h-40 w-40 object-contain"
                      loading="lazy"
                    />
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>

    {/* Eastern Conference */}
    <div>
      <h2 className="text-xl mb-3 font-black uppercase tracking-wide text-white text-center">EASTERN CONFERENCE</h2>
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
                  backgroundImage: `linear-gradient(90deg, ${primaryColor}95 0%, ${primaryColor}45 20%, transparent 85%)`,
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
                      style={{ lineHeight: '1', letterSpacing: 0 }}
                    >
                      #{index + 1}
                    </div>

                    {/* Record at bottom */}
                    <div 
                      className="text-4xl font-black text-white tabular-nums"
                      style={{ lineHeight: '1', letterSpacing: 0 }}
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

{/* ========================
    PAGE: Top Players
    - Rank-by dropdown (Value Score, PTS, REB, AST, STL, BLK, etc.)
    - Grid of top 50 player cards (4 per row on large screens)
    - Each card: team logo, player name, ranked stat badge, full per-game stats (left/right columns)
    - Stats color-coded green (above league avg), red (below), gold (league leader)
======================== */}
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
                className="cursor-pointer w-full justify-center text-center rounded-full px-4 py-2 text-sm font-semibold hover:bg-gradient-to-r hover:from-[#4c1d95] hover:to-[#2dd4bf] hover:text-white data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#4c1d95] data-[state=checked]:to-[#2dd4bf] data-[state=checked]:text-white transition-all duration-200 [&_[data-radix-select-item-indicator]]:hidden [&>span:first-child]:hidden"
              >
                {label}
              </SelectItem>
            ))}
          </div>
        </SelectContent>
      </Select>

      {/* Tooltip only shows when Value Score is selected */}
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



  {/* === Player Grid === */}

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-16">
  {sortedTopPlayersWithMeta.map(({ player, valueScore, highlights }, index) => {
    const primary = teamColors[player.TEAM_ABBREVIATION]?.primary || '#1e40af';
    const rankedValue = playerSortField === 'VALUE_SCORE'
      ? valueScore.toFixed(1)
      : getPlayerStat(player, playerSortField).toFixed(1);
    const rankedLabel = playerSortField === 'VALUE_SCORE'
      ? 'VALUE'
      : playerSortField.replace('_', ' ');

    return (
      <div
        key={`${player.PLAYER_ID}-${playerSortField}`}
        className="group relative overflow-hidden rounded-2xl border border-white/10 transition-all duration-200 hover:scale-[1.01]"
        style={{
          background: 'linear-gradient(135deg, #171717 0%, #0f0f0f 100%)',
          boxShadow: '0 14px 34px rgba(0,0,0,0.24)',
          animation: `slideUp 0.4s ease-out ${index * 0.05}s both`,
        }}
      >
        <div
          className="absolute left-0 top-0 h-[70px]"
          style={{
            width: 66,
            background: `linear-gradient(135deg, ${primary} 0%, ${primary} 56%, transparent 57%)`,
          }}
        />
        <div
          className="absolute font-black italic leading-none select-none"
          style={{
            left: 8,
            top: 3,
            color: 'rgba(255,255,255,0.92)',
            fontSize: 52,
            letterSpacing: 0,
          }}
        >
          {index + 1}
        </div>

        <div className="relative z-10 px-4 py-3 text-white">
          {/* Header with team logo and player name */}
          <div className="flex items-center gap-3 mb-3 min-h-[48px]">
            <div className="w-[58px] shrink-0" />
            {abbrToLogo[player.TEAM_ABBREVIATION] && (
              <img
                src={abbrToLogo[player.TEAM_ABBREVIATION]}
                alt={`${player.TEAM_ABBREVIATION} logo`}
                className="h-11 w-11 shrink-0 object-contain"
                loading="lazy"
              />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-black uppercase leading-none text-white">{player.PLAYER_NAME}</h3>
            </div>
            <div className="flex shrink-0 flex-col items-end leading-none">
              <span className="text-3xl font-black text-white tabular-nums">{rankedValue}</span>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-wide text-white/45">{rankedLabel}</span>
            </div>
          </div>

          {/* Stats grid — plain divs, no Radix overhead */}
          <div className="rounded-xl border border-white/10 p-3" style={{ backgroundColor: 'rgba(0,0,0,0.28)' }}>
            <div className="grid grid-cols-2 gap-x-4">
              <div className="space-y-1.5">
                {([
                  ['GP',  player.GP.toFixed(0),                        undefined       ],
                  ['MIN', player.MIN.toFixed(1),                        highlights.MIN  ],
                  ['PPG', player.PTS.toFixed(1),                        highlights.PTS  ],
                  ['REB', player.REB.toFixed(1),                        highlights.REB  ],
                  ['AST', player.AST.toFixed(1),                        highlights.AST  ],
                  ['STL', player.STL.toFixed(1),                        highlights.STL  ],
                  ['BLK', player.BLK.toFixed(1),                        highlights.BLK  ],
                ] as [string, string, string | undefined][]).map(([lbl, val, hl]) => (
                  <div key={lbl} className="flex items-center gap-8 text-sm">
                    <span className="text-white/40 w-10 font-bold">{lbl}</span>
                    <span className={hl === 'best' ? 'text-yellow-300 font-bold' : hl === 'high' ? 'text-green-400 font-bold' : hl === 'low' ? 'text-red-400 font-bold' : 'text-white font-bold'}>{val}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                {([
                  ['TOV', player.TOV.toFixed(1),                        highlights.TOV     ],
                  ['FGA', player.FGA.toFixed(1),                        highlights.FGA     ],
                  ['FG%', (player.FG_PCT * 100).toFixed(1) + '%',       highlights.FG_PCT  ],
                  ['3PA', player.FG3A.toFixed(1),                       highlights.FG3A    ],
                  ['3P%', (player.FG3_PCT * 100).toFixed(1) + '%',      highlights.FG3_PCT ],
                  ['FTA', player.FTA.toFixed(1),                        highlights.FTA     ],
                  ['FT%', (player.FT_PCT * 100).toFixed(1) + '%',       highlights.FT_PCT  ],
                ] as [string, string, string | undefined][]).map(([lbl, val, hl]) => (
                  <div key={lbl} className="flex items-center gap-8 text-sm">
                    <span className="text-white/40 w-10 font-bold">{lbl}</span>
                    <span className={hl === 'best' ? 'text-yellow-300 font-bold' : hl === 'high' ? 'text-green-400 font-bold' : hl === 'low' ? 'text-red-400 font-bold' : 'text-white font-bold'}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  })}
</div>
</TabsContent>


      </Tabs>

      {/* Player Modal — opened when a team card is clicked from Standings, Team Stats, or Dashboard */}
{selectedTeam && (
  <PlayerModal
    team={selectedTeam}
    nbaPlayerData={nbaPlayerData}
    scheduleData={scheduleData}
    logoMap={abbrToLogo}
    leagueAverages={leagueAverages}
    allTeams={nbaTeams}
    onClose={() => setSelectedTeam(null)}
  />
)}

{/* ESPN Game Iframe Modal — opened when a game card is clicked on the Scoreboard tab */}
{espnGameId && (
  <div 
    className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
    onClick={() => setEspnGameId(null)}
    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
  >
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
            onClick={() => setEspnGameId(null)}
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

