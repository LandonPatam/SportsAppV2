import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sun, Moon, ChevronLeft, ChevronRight, X } from 'lucide-react';
// Charts (match NBA page approach)
import { Chart as ChartJS, ArcElement, Tooltip as ChartJSTooltip, Legend as ChartJSLegend, RadialLinearScale, PointElement, LineElement, Filler, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Chart as ChartComponent, Doughnut, Radar } from 'react-chartjs-2';
// Data now loaded dynamically from public/data/nfl_site_nfl_standings.json
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Register Chart.js elements once
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, ChartJSTooltip, ChartJSLegend, RadialLinearScale, PointElement, LineElement, Filler);

const teamLogoCache: Record<string, HTMLImageElement> = {};

const teamLogoAxisPlugin = {
  id: 'teamLogoAxisPlugin',
  afterDatasetsDraw: (chart: ChartJS, _args: unknown, pluginOptions: { logos?: string[]; size?: number; offset?: number } = {}) => {
    const logos = pluginOptions.logos ?? [];
    if (!logos.length) return;

    const yScale = chart.scales?.y;
    const chartArea = chart.chartArea;
    if (!yScale || !chartArea) return;

    const ctx = chart.ctx;
    const size = pluginOptions.size ?? 36;
    const offset = pluginOptions.offset ?? 14;

    logos.forEach((logoSrc, index) => {
      if (!logoSrc) return;

      let logoImage = teamLogoCache[logoSrc];
      if (!logoImage) {
        logoImage = new Image();
        logoImage.src = logoSrc;
        logoImage.onload = () => chart.draw();
        teamLogoCache[logoSrc] = logoImage;
      }

      if (!logoImage.complete) return;

      const centerY = yScale.getPixelForTick(index);
      if (Number.isNaN(centerY)) return;

      const drawX = Math.max(chartArea.left - offset - size, 0);
      const drawY = centerY - size / 2;

      ctx.save();
      ctx.beginPath();
      const radius = size / 2;
      ctx.arc(drawX + radius, centerY, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(logoImage, drawX, drawY, size, size);
      ctx.restore();
    });
  },
};

ChartJS.register(teamLogoAxisPlugin);


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
  Home?: string;
  Road?: string;
  Div?: string;
  DivPct?: string;
  Conf?: string;
  ConfPct?: string;
  NonConf?: string;
  Strk?: string;
  Last5?: string;
  fpi?: number;
  fpirank?: number;
  logo?: string;
  link?: string;
}

// ============================
// Schedule Types (NFL)
// ============================

interface NFLScheduleGame {
  game_id: string;
  date?: string;      // 'YYYY-MM-DD'
  time?: string;      // '4:25 PM'
  tv?: string;        // optional, not used by our JSON
  tv_providers?: string[];
  home?: string;      // optional team abbreviation
  away?: string;      // optional team abbreviation
  matchup?: string;   // 'Away Team @ Home Team'
  location?: string;
  game_link?: string;
  status?: string;    // scheduled | live | final
  home_score?: number;
  away_score?: number;
  period?: number;    // quarter (1-4, or 5 for OT)
  clock?: string;     // e.g. "2:35"
  ts_utc?: number;    // kickoff timestamp (UTC) for reliable sorting
}

type NFLScheduleData = NFLScheduleGame[];

type SortField =
  | 'WIN_PCT'
  | 'PF'
  | 'PA'
  | 'PD'
  | 'PPG'
  | 'EPA_OFF'
  | 'EPA_DEF'
  | 'EPA_ST'
  | 'FPI'
  | 'FPI_RANK'
  | 'STREAK';

const TEAM_SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'WIN_PCT', label: 'Win %' },
  { value: 'PF', label: 'Points For' },
  { value: 'PA', label: 'Points Against' },
  { value: 'PD', label: 'Point Diff' },
  { value: 'PPG', label: 'Points Per Game' },
  { value: 'EPA_OFF', label: 'EPA Offense' },
  { value: 'EPA_DEF', label: 'EPA Defense' },
  { value: 'EPA_ST', label: 'EPA Special Teams' },
  { value: 'FPI', label: 'FPI' },
  { value: 'FPI_RANK', label: 'FPI Rank' },
  { value: 'STREAK', label: 'Win Streak' },
];

/* ============================================================================
 * TEAM COLORS CONFIGURATION
 * NFL team primary and secondary colors for badges
 * ============================================================================ */

const teamColors: Record<string, { primary: string; secondary: string }> = {
  'Buffalo Bills': { primary: '#00276aff', secondary: '#ea002fff' },
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
  'Kansas City Chiefs': { primary: '#E31837', secondary: '#ffffffff' },
  'Las Vegas Raiders': { primary: '#000000', secondary: '#A5ACAF' },
  'Los Angeles Chargers': { primary: '#005ed0ff', secondary: '#FFC20E' },
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
  'Seattle Seahawks': { primary: '#69BE28', secondary: '#002244' },
};

// Gradient color pairs for border effect (start = primary-ish, end = secondary-ish)
const teamGradientColors: Record<string, { start: string; end: string }> = {
  'Buffalo Bills': { start: '#00276a', end: '#ea002f' },
  'Miami Dolphins': { start: '#008E97', end: '#FC4C02' },
  'New England Patriots': { start: '#002244', end: '#C60C30' },
  'New York Jets': { start: '#125740', end: '#FFFFFF' },
  'Baltimore Ravens': { start: '#241773', end: '#9E7C0C' },
  'Cincinnati Bengals': { start: '#FB4F14', end: '#000000' },
  'Cleveland Browns': { start: '#311D00', end: '#FF3C00' },
  'Pittsburgh Steelers': { start: '#FFB612', end: '#101820' },
  'Houston Texans': { start: '#03202F', end: '#A71930' },
  'Indianapolis Colts': { start: '#002C5F', end: '#A2AAAD' },
  'Jacksonville Jaguars': { start: '#006778', end: '#D7A22A' },
  'Tennessee Titans': { start: '#4B92DB', end: '#C8102E' },
  'Denver Broncos': { start: '#FB4F14', end: '#002244' },
  'Kansas City Chiefs': { start: '#E31837', end: '#ffffff' },
  'Las Vegas Raiders': { start: '#000000', end: '#A5ACAF' },
  'Los Angeles Chargers': { start: '#005ed0', end: '#FFC20E' },
  'Dallas Cowboys': { start: '#041E42', end: '#869397' },
  'New York Giants': { start: '#0B2265', end: '#A71930' },
  'Philadelphia Eagles': { start: '#004C54', end: '#A5ACAF' },
  'Washington Commanders': { start: '#5A1414', end: '#FFB612' },
  'Chicago Bears': { start: '#0B162A', end: '#C83803' },
  'Detroit Lions': { start: '#0076B6', end: '#B0B7BC' },
  'Green Bay Packers': { start: '#203731', end: '#FFB612' },
  'Minnesota Vikings': { start: '#4F2683', end: '#FFC62F' },
  'Atlanta Falcons': { start: '#A71930', end: '#000000' },
  'Carolina Panthers': { start: '#0085CA', end: '#101820' },
  'New Orleans Saints': { start: '#D3BC8D', end: '#101820' },
  'Tampa Bay Buccaneers': { start: '#D50A0A', end: '#FF7900' },
  'Arizona Cardinals': { start: '#97233F', end: '#000000' },
  'Los Angeles Rams': { start: '#003594', end: '#FFA300' },
  'San Francisco 49ers': { start: '#AA0000', end: '#B3995D' },
  'Seattle Seahawks': { start: '#69BE28', end: '#002244' },
};

// Utility: convert hex color to rgba string with given alpha
const toRGBA = (hex: string, alpha: number) => {
  try {
    const h = (hex || '').trim();
    if (!h.startsWith('#')) return hex;
    const clean = h.replace('#', '');
    let r = 0, g = 0, b = 0;
    if (clean.length === 3) {
      r = parseInt(clean[0] + clean[0], 16);
      g = parseInt(clean[1] + clean[1], 16);
      b = parseInt(clean[2] + clean[2], 16);
    } else if (clean.length === 6 || clean.length === 8) {
      r = parseInt(clean.substring(0, 2), 16);
      g = parseInt(clean.substring(2, 4), 16);
      b = parseInt(clean.substring(4, 6), 16);
    } else {
      return hex;
    }
    const a = Math.max(0, Math.min(1, alpha));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  } catch {
    return hex;
  }
};

/* ============================================================================
 * TEAM ABBREVIATIONS
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
  'NFC' : 'NFC',
  'AFC' : 'AFC'
};

const abbreviationToTeamName: Record<string, string> = Object.fromEntries(
  Object.entries(teamAbbreviations).map(([name, abbr]) => [abbr, name])
);

// Build logo map once teams are loaded: ABBR -> logo URL
const useAbbrToLogo = (teams: NFLTeam[]) => {
  return useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of teams) {
      const abbr = (teamAbbreviations as any)[t.name];
      if (abbr && t.logo) map[abbr] = t.logo;
    }
    return map;
  }, [teams]);
};

/* ============================================================================
 * DARK MODE TOGGLE COMPONENT
 * ============================================================================ */

const DarkModeToggle = () => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored === 'dark' || (!stored && prefersDark);
    setDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

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
  PF: 'Points For',
  PA: 'Points Against',
  PD: 'Point Differential',
  PPG: 'Points Per Game',
  D: 'Record within divisional games',
  C: 'Record within conference games',
  Streak: 'Current win/loss streak ',
  FPI: 'ESPN Football Power Index',
  'OFF': 'Offensive Contribution',
  'DEF': 'Defensive Contribution',
  'ST': 'Special Teams Contribution',
};

type BestMetricKey =
  | 'WIN_PCT'
  | 'PPG'
  | 'PF'
  | 'PA'
  | 'EPA_OFF'
  | 'EPA_DEF'
  | 'EPA_ST'
  | 'FPI'
  | 'FPI_RANK'
  | 'STREAK';

const BEST_METRIC_KEYS: ReadonlyArray<BestMetricKey> = [
  'WIN_PCT',
  'PPG',
  'PF',
  'PA',
  'EPA_OFF',
  'EPA_DEF',
  'EPA_ST',
  'FPI',
  'FPI_RANK',
  'STREAK',
] as const;

const isBestMetricKey = (key: string): key is BestMetricKey =>
  (BEST_METRIC_KEYS as readonly string[]).includes(key);

const parseStreakValue = (streak?: string | null) => {
  if (!streak) return null;
  const cleaned = streak.replace(/\s+/g, '').toUpperCase();
  const direct = cleaned.match(/^([WL])(\d+)$/);
  const reversed = cleaned.match(/^(\d+)([WL])$/);
  const match = direct || reversed;
  if (!match) return null;
  const letter = direct ? direct[1] : reversed ? reversed[2] : null;
  const numStr = direct ? direct[2] : reversed ? reversed[1] : null;
  if (!letter || !numStr) return null;
  const num = parseInt(numStr, 10);
  if (!Number.isFinite(num)) return null;
  return letter.toUpperCase() === 'W' ? num : -num;
};

const StatRow = ({
  label,
  value,
  highlight,
  bold = false,
}: {
  label: string;
  value: string | number;
  highlight?: 'high' | 'low' | 'neutral' | 'best';
  bold?: boolean;
}) => {
  const colorClass =
    highlight === 'best'
      ? 'text-yellow-300 font-semibold'
      : highlight === 'high'
      ? 'text-green-400 font-semibold'
      : highlight === 'low'
      ? 'text-red-400 font-semibold'
      : 'text-foreground';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex justify-left gap-3 text-sm cursor-help whitespace-nowrap">
            <span className={`text-muted-foreground ${bold ? 'font-bold' : ''}`}>{label}</span>
            <span className={`${colorClass} ${bold ? 'font-bold' : ''}`}>{value}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          <p>{statDescriptions[label] || 'Stat description unavailable'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};


/* ============================================================================
 * TEAM CARD COMPONENT — NBA-style gradient border + dark fill
 * ============================================================================ */


const TeamCard = ({
  team,
  leagueAverages,
  conferenceAverages,
  allTeams,
  compact = false,
}: {
  team: NFLTeam;
  leagueAverages: any;
  conferenceAverages: Record<string, { divPct: number; confPct: number; last5Pct: number }>;
  allTeams?: NFLTeam[];
  compact?: boolean;
}) => {
  const totalGames = team.wins + team.losses + team.ties;
  const teamColor = teamColors[team.name] || { primary: '#1e40af', secondary: '#dc2626' };
  const gradientColors = teamGradientColors[team.name] || { start: teamColor.primary, end: teamColor.secondary };

  const bestMetricMap = React.useMemo<Record<BestMetricKey, { value: number; lowerBetter?: boolean }>>(() => {
    const base: Record<BestMetricKey, { value: number; lowerBetter?: boolean }> = {
      WIN_PCT: { value: -Infinity },
      PPG: { value: -Infinity },
      PF: { value: -Infinity },
      PA: { value: Infinity, lowerBetter: true },
      EPA_OFF: { value: -Infinity },
      EPA_DEF: { value: -Infinity },
      EPA_ST: { value: -Infinity },
      FPI: { value: -Infinity },
      FPI_RANK: { value: Infinity, lowerBetter: true },
      STREAK: { value: -Infinity },
    };
    const source = allTeams && allTeams.length ? allTeams : null;
    if (!source) return base;
    const update = (key: BestMetricKey, val: number | null | undefined) => {
      if (!Number.isFinite(val)) return;
      const entry = base[key];
      if (!entry) return;
      if (entry.lowerBetter) {
        if (val < entry.value) entry.value = val;
      } else if (val > entry.value) {
        entry.value = val;
      }
    };
    for (const t of source) {
      const gamesPlayed = (t.wins || 0) + (t.losses || 0) + (t.ties || 0);
      update('WIN_PCT', Number(t.win_pct));
      update('PPG', gamesPlayed > 0 ? Number(t.points_for || 0) / gamesPlayed : null);
      update('PF', Number(t.points_for));
      update('PA', Number(t.points_against));
      update('EPA_OFF', Number((t as any).epa_offense));
      update('EPA_DEF', Number((t as any).epa_defense));
      update('EPA_ST', Number((t as any).epa_special));
      update('FPI', Number((t as any).fpi));
      update('FPI_RANK', Number((t as any).fpirank));
      const streakVal = parseStreakValue((t as any).Strk);
      if (streakVal && streakVal > 0) update('STREAK', streakVal);
    }
    return base;
  }, [allTeams]);

  const leagueBestHighlight = React.useCallback(
    (key: BestMetricKey, value?: number | null) => {
      if (!Number.isFinite(value)) return undefined;
      const entry = bestMetricMap[key];
      if (!entry || !Number.isFinite(entry.value)) return undefined;
      const epsilon = entry.lowerBetter ? 0.5 : 0.01;
      return Math.abs((value as number) - entry.value) < epsilon ? 'best' : undefined;
    },
    [bestMetricMap],
  );

  const getHighlight = (
    key:
      | 'WIN_PCT' | 'PF' | 'PA' | 'PD' | 'PPG'
      | 'PASS_YDS' | 'PASS_TD' | 'PASS_INT' | 'PASS_RATE'
      | 'PASS_CMP_PCT' | 'PASS_YPA' | 'PASS_1ST' | 'PASS_SACKS'
      | 'FPI' | 'EPA_OFF' | 'EPA_DEF' | 'EPA_ST'
  ) => {
    if (!leagueAverages) return undefined;
    let teamValue: number = 0;
    switch (key) {
      case 'WIN_PCT': teamValue = team.win_pct; break;
      case 'PF': teamValue = team.points_for; break;
      case 'PA': teamValue = team.points_against; break;
      case 'PD': teamValue = team.point_diff; break;
      case 'PPG': teamValue = (totalGames > 0 ? team.points_for / totalGames : 0); break;
      case 'PASS_YDS': teamValue = Number((team as any).pass_yds); break;
      case 'PASS_TD': teamValue = Number((team as any).pass_td); break;
      case 'PASS_INT': teamValue = Number((team as any).pass_int); break;
      case 'PASS_RATE': teamValue = Number((team as any).pass_rate); break;
      case 'PASS_CMP_PCT': teamValue = Number((team as any).pass_cmp_pct); break;
      case 'PASS_YPA': teamValue = Number((team as any).pass_yds_per_att); break;
      case 'PASS_1ST': teamValue = Number((team as any).pass_first_downs); break;
      case 'PASS_SACKS': teamValue = Number((team as any).pass_sacks); break;
      case 'FPI': teamValue = Number((team as any).fpi); break;
      case 'EPA_OFF': teamValue = Number((team as any).epa_offense); break;
      case 'EPA_DEF': teamValue = Number((team as any).epa_defense); break;
      case 'EPA_ST': teamValue = Number((team as any).epa_special); break;
    }

    const bestHit = isBestMetricKey(key) ? leagueBestHighlight(key, teamValue) : undefined;
    if (bestHit) return bestHit;

    const leagueValue = Number((leagueAverages as any)[key] ?? 0);
    const diff = teamValue - leagueValue;
    if (Math.abs(diff) < 0.01) return 'neutral';

    const lowerBetter = new Set<string>(['PA', 'PASS_INT', 'PASS_SACKS']);
    if (lowerBetter.has(key)) return diff < 0 ? 'high' : 'low';
    return diff > 0 ? 'high' : 'low';
  };

  const parseRecordPct = (rec?: string | null) => {
    if (!rec) return null;
    const parts = rec.split('-').map((n) => parseInt(n, 10));
    if (parts.some((n) => Number.isNaN(n))) return null;
    const wins = parts[0] ?? 0;
    const losses = parts[1] ?? 0;
    const ties = parts[2] ?? 0;
    const total = wins + losses + ties;
    if (total === 0) return null;
    return (wins + 0.5 * ties) / total;
  };

  const getConfHighlight = (key: 'DIV' | 'CONF' | 'LAST5') => {
    const conf = team.conference;
    const confAvg = conferenceAverages?.[conf];
    if (!confAvg) return undefined;

    let teamPct: number | null = null;
    let avg: number | null = null;
    if (key === 'DIV') {
      teamPct = parseRecordPct(team.Div);
      avg = confAvg.divPct;
    } else if (key === 'CONF') {
      teamPct = parseRecordPct(team.Conf);
      avg = confAvg.confPct;
    } else if (key === 'LAST5') {
      teamPct = parseRecordPct(team.Last5);
      avg = confAvg.last5Pct;
    }

    if (teamPct == null || avg == null) return 'neutral';
    const diff = teamPct - avg;
    if (Math.abs(diff) < 0.01) return 'neutral';
    return diff > 0 ? 'high' : 'low';
  };

  // ── Compact variant (used in AFC/NFC division tabs) ──
  if (compact) {
    return (
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(300deg, ${gradientColors.start}, ${gradientColors.end})`,
          padding: '3px',
        }}
      >
        <div
          className="absolute inset-1 rounded-xl"
          style={{ backgroundColor: '#141414' }}
          aria-hidden
        />
        <div className="relative z-10 text-white p-2">
          <div className="flex items-center gap-2">
            {team.logo && (
              <img
                src={team.logo}
                alt={`${team.name} logo`}
                className="w-12 h-12 rounded-sm flex-shrink-0"
              />
            )}
            <h3 className="text-lg font-bold truncate flex-1 min-w-0">{team.name}</h3>
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              <div className="text-xl font-bold whitespace-nowrap">
                #{(team as any).rank || '—'}
              </div>
              <div className="text-xl font-bold whitespace-nowrap">
                {team.wins}-{team.losses}{team.ties > 0 ? `-${team.ties}` : ''}
              </div>
            </div>
          </div>

          <Card
            className="overflow-hidden transition-all duration-300 bg-card/50 backdrop-blur-sm border-1 h-full"
            style={{
            backgroundColor: '#0000004c',
            opacity: 1,
          }}
          >
            <CardHeader className="pb-0">
            </CardHeader>

            <CardContent>
              {(() => {
                const fpi = Number((team as any).fpi ?? NaN);
                const epaOff = Number((team as any).epa_offense ?? NaN);
                const epaDef = Number((team as any).epa_defense ?? NaN);
                const epaST = Number((team as any).epa_special ?? NaN);
                const ppg = totalGames > 0 ? (team.points_for / totalGames) : 0;
                const streakVal = parseStreakValue(team.Strk);
                const fpiRank = Number((team as any).fpirank);
                const items: { label: string; value: string | number; highlight?: 'high' | 'low' | 'neutral' | 'best' }[] = [
                  { label: 'Win %', value: `${(team.win_pct * 100).toFixed(1)}%`, highlight: getHighlight('WIN_PCT') },
                  { label: 'PPG', value: ppg.toFixed(1), highlight: getHighlight('PPG') },
                  { label: 'FPI', value: Number.isFinite(fpi) ? fpi.toFixed(1) : '-', highlight: getHighlight('FPI') },
                  {
                    label: 'Streak',
                    value: team.Strk || '-',
                    highlight: streakVal && streakVal > 0 ? leagueBestHighlight('STREAK', streakVal) : undefined,
                  },
                  { label: 'PA', value: team.points_against, highlight: getHighlight('PA') },
                  { label: 'OFF', value: Number.isFinite(epaOff) ? epaOff.toFixed(1) : '-', highlight: getHighlight('EPA_OFF') },
                  { label: 'D', value: team.Div || '-' , highlight: getConfHighlight('DIV') },
                  { label: 'PF', value: team.points_for, highlight: getHighlight('PF') },
                  { label: 'DEF', value: Number.isFinite(epaDef) ? epaDef.toFixed(1) : '-', highlight: getHighlight('EPA_DEF') },
                  { label: 'C', value: team.Conf || '-', highlight: getConfHighlight('CONF') },
                  {
                    label: 'FPI Rank',
                    value: Number.isFinite(fpiRank) ? `${fpiRank}` : '—',
                    highlight: leagueBestHighlight('FPI_RANK', Number.isFinite(fpiRank) ? fpiRank : null),
                  },
                  { label: 'ST', value: Number.isFinite(epaST) ? epaST.toFixed(1) : '-', highlight: getHighlight('EPA_ST') },
                ];

                return (
                  <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                    {items.map((it) => (
                      <StatRow key={it.label} label={it.label} value={it.value} highlight={it.highlight as any} bold />
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Full variant (used in Team Stats tab) — NBA style ──
  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(300deg, ${gradientColors.start}, ${gradientColors.end})`,
        padding: '3px',
      }}
    >
      {/* Dark inner fill — creates the gradient border illusion */}
      <div
        className="absolute inset-1 rounded-xl"
        style={{ backgroundColor: '#141414' }}
        aria-hidden
      />

      {/* Foreground content */}
      <div className="relative z-10 p-4 text-white">
        {/* Rank badge top-right */}
        <div className="absolute top-4 right-4 text-2xl font-bold text-white">
          #{(team as any).rank || '—'}
        </div>

        {/* Team header */}
        <div className="flex items-center gap-2 mb-3 relative">
          {team.logo && (
            <img
              src={team.logo}
              alt={`${team.name} logo`}
              className="w-16 h-16 rounded-sm"
            />
          )}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h3 className="text-2xl font-bold truncate">{team.name}</h3>
          </div>
          <div className="absolute bottom-0 right-0 text-3xl font-bold text-white">
            {team.wins}-{team.losses}
            {team.ties > 0 ? `-${team.ties}` : ''}
          </div>
        </div>

        {/* Stats inner card — dark semi-transparent like NBA */}
        <Card
          className="overflow-hidden transition-all duration-300 bg-card/50 backdrop-blur-sm border-1 h-full"
          style={{ backgroundColor: '#0000004c', opacity: 1 }}
        >
          <CardHeader className="pb-0" />

          <CardContent>
            {(() => {
              const fpi = Number((team as any).fpi ?? NaN);
              const epaOff = Number((team as any).epa_offense ?? NaN);
              const epaDef = Number((team as any).epa_defense ?? NaN);
              const epaST = Number((team as any).epa_special ?? NaN);
              const ppg = totalGames > 0 ? (team.points_for / totalGames) : 0;
              const streakVal = parseStreakValue(team.Strk);

              const fpiRank = Number((team as any).fpirank);
              const items: { label: string; value: string | number; highlight?: 'high' | 'low' | 'neutral' | 'best' }[] = [
                { label: 'Win %', value: `${(team.win_pct * 100).toFixed(1)}%`, highlight: getHighlight('WIN_PCT') },
                { label: 'PPG', value: ppg.toFixed(1), highlight: getHighlight('PPG') },
                { label: 'FPI', value: Number.isFinite(fpi) ? fpi.toFixed(1) : '-', highlight: getHighlight('FPI') },
                {
                  label: 'Streak',
                  value: team.Strk || '-',
                  highlight: streakVal && streakVal > 0 ? leagueBestHighlight('STREAK', streakVal) : undefined,
                },
                { label: 'PA', value: team.points_against, highlight: getHighlight('PA') },
                { label: 'OFF', value: Number.isFinite(epaOff) ? epaOff.toFixed(1) : '-', highlight: getHighlight('EPA_OFF') },
                { label: 'D', value: team.Div || '-' , highlight: getConfHighlight('DIV') },
                { label: 'PF', value: team.points_for, highlight: getHighlight('PF') },
                { label: 'DEF', value: Number.isFinite(epaDef) ? epaDef.toFixed(1) : '-', highlight: getHighlight('EPA_DEF') },
                { label: 'C', value: team.Conf || '-', highlight: getConfHighlight('CONF') },
                {
                  label: 'FPI Rank',
                  value: Number.isFinite(fpiRank) ? `${fpiRank}` : '—',
                  highlight: leagueBestHighlight('FPI_RANK', Number.isFinite(fpiRank) ? fpiRank : null),
                },
                { label: 'ST', value: Number.isFinite(epaST) ? epaST.toFixed(1) : '-', highlight: getHighlight('EPA_ST') },
              ];

              return (
                <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                  {items.map((it) => (
                    <StatRow key={it.label} label={it.label} value={it.value} highlight={it.highlight as any} bold />
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};


/* ============================================================================
 * MAIN NFL COMPONENT
 * ============================================================================ */

const NFL = () => {
  const [teams, setTeams] = useState<NFLTeam[]>([]);
  const [scheduleData, setScheduleData] = useState<NFLScheduleData | null>(null);
  const [sortField, setSortField] = useState<SortField>('WIN_PCT');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTeamAll, setSelectedTeamAll] = useState<NFLTeam | null>(null);
  const [rosterByTeam, setRosterByTeam] = useState<Record<string, any[]>>({});
  const [espnGameId, setEspnGameId] = useState<string | null>(null);

  const radarExtrema = useMemo(() => {
    const init = {
      winPct: { min: Infinity, max: -Infinity },
      pf: { min: Infinity, max: -Infinity },
      pa: { min: Infinity, max: -Infinity },
      ppg: { min: Infinity, max: -Infinity },
      fpi: { min: Infinity, max: -Infinity },
      epaOff: { min: Infinity, max: -Infinity },
      epaDef: { min: Infinity, max: -Infinity },
      epaST: { min: Infinity, max: -Infinity },
    } as const;
    const acc: any = JSON.parse(JSON.stringify(init));
    for (const t of teams) {
      const games = (t.wins || 0) + (t.losses || 0) + (t.ties || 0);
      const vals = {
        winPct: Number(t.win_pct || 0),
        pf: Number(t.points_for || 0),
        pa: Number(t.points_against || 0),
        ppg: games > 0 ? Number(t.points_for || 0) / games : 0,
        fpi: Number((t as any).fpi || 0),
        epaOff: Number((t as any).epa_offense || 0),
        epaDef: Number((t as any).epa_defense || 0),
        epaST: Number((t as any).epa_special || 0),
      };
      for (const k of Object.keys(vals)) {
        const v = (vals as any)[k];
        if (!Number.isFinite(v)) continue;
        acc[k].min = Math.min(acc[k].min, v);
        acc[k].max = Math.max(acc[k].max, v);
      }
    }
    for (const k of Object.keys(acc)) {
      if (!Number.isFinite(acc[k].min) || !Number.isFinite(acc[k].max) || acc[k].max <= acc[k].min) {
        acc[k].min = 0;
        acc[k].max = 1;
      }
    }
    return acc as {
      winPct: { min: number; max: number };
      pf: { min: number; max: number };
      pa: { min: number; max: number };
      ppg: { min: number; max: number };
      fpi: { min: number; max: number };
      epaOff: { min: number; max: number };
      epaDef: { min: number; max: number };
      epaST: { min: number; max: number };
    };
  }, [teams]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev || 'unset';
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const bust = () => `?_=${Date.now()}`;
    const load = async () => {
      try {
        const res = await fetch(`/data/nfl_site_nfl_standings.json${bust()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (alive && Array.isArray(data)) setTeams(data as NFLTeam[]);
      } catch {}
    };
    load();
    const id = setInterval(load, 20000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    let alive = true;
    const bust = () => `?_=${Date.now()}`;
    const load = async () => {
      try {
        const res = await fetch(`/data/nfl_schedule.json${bust()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const text = await res.text();
        if (!alive) return;
        let next: NFLScheduleData;
        try { next = JSON.parse(text) as NFLScheduleData; } catch { return; }
        setScheduleData((prev) => {
          const prevText = JSON.stringify(prev ?? null);
          return prevText === text ? prev : next;
        });
      } catch {}
    };
    load();
    const id = setInterval(load, 30000);
    const vis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', vis);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, []);

  useEffect(() => {
    let alive = true;
    const bust = () => `?_=${Date.now()}`;
    const load = async () => {
      try {
        const res = await fetch(`/data/nfl_roster.json${bust()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (alive && json && typeof json === 'object') setRosterByTeam(json as Record<string, any[]>);
      } catch {}
    };
    load();
    const id = setInterval(load, 60000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const getTeamStat = (t: NFLTeam, field: SortField) => {
    const total = t.wins + t.losses + t.ties;
    switch (field) {
      case 'WIN_PCT': return t.win_pct;
      case 'PF': return t.points_for;
      case 'PA': return t.points_against;
      case 'PD': return t.point_diff;
      case 'PPG': return total > 0 ? t.points_for / total : 0;
      case 'EPA_OFF': return Number((t as any).epa_offense) || 0;
      case 'EPA_DEF': return Number((t as any).epa_defense) || 0;
      case 'EPA_ST': return Number((t as any).epa_special) || 0;
      case 'FPI': return Number((t as any).fpi) || 0;
      case 'FPI_RANK': {
        const rank = Number((t as any).fpirank);
        return Number.isFinite(rank) ? -rank : Number.NEGATIVE_INFINITY;
      }
      case 'STREAK': {
        const val = parseStreakValue(t.Strk);
        return typeof val === 'number' && Number.isFinite(val) ? val : 0;
      }
      default: return 0;
    }
  };

  const sortTeamsDynamic = (list: NFLTeam[]) => {
    const sorted = [...list].sort((a, b) => getTeamStat(b, sortField) - getTeamStat(a, sortField));
    return sortOrder === 'asc' ? sorted.reverse() : sorted;
  };

  const orderedTeams = useMemo(() => sortTeamsDynamic(teams), [teams, sortField, sortOrder]);
  const selectionSignature = useMemo(
    () => JSON.stringify({ sortField, sortOrder }),
    [sortField, sortOrder],
  );
  const lastSelectionSignatureRef = useRef(selectionSignature);

  useEffect(() => {
    const signatureChanged = selectionSignature !== lastSelectionSignatureRef.current;
    if (!orderedTeams.length) {
      if (selectedTeamAll) setSelectedTeamAll(null);
    } else if (
      signatureChanged ||
      !selectedTeamAll ||
      !orderedTeams.some((t) => t.name === selectedTeamAll.name)
    ) {
      setSelectedTeamAll(orderedTeams[0]);
    }
    lastSelectionSignatureRef.current = selectionSignature;
  }, [orderedTeams, selectionSignature, selectedTeamAll]);

  const leagueAverages = React.useMemo(() => {
    if (teams.length === 0) return null as null | Record<string, number>;
    const totals = teams.reduce(
      (acc, t: any) => {
        const games = t.wins + t.losses + t.ties;
        acc.WIN_PCT += t.win_pct;
        acc.PF += t.points_for;
        acc.PA += t.points_against;
        acc.PD += t.point_diff;
        acc.PPG_SUM += games > 0 ? t.points_for / games : 0;
        const add = (keySum: string, keyCnt: string, v: any) => {
          const n = Number(v);
          if (Number.isFinite(n)) { acc[keySum] += n; acc[keyCnt] += 1; }
        };
        add('PASS_YDS_SUM', 'PASS_YDS_CNT', t.pass_yds);
        add('PASS_TD_SUM', 'PASS_TD_CNT', t.pass_td);
        add('PASS_INT_SUM', 'PASS_INT_CNT', t.pass_int);
        add('PASS_RATE_SUM', 'PASS_RATE_CNT', t.pass_rate);
        add('PASS_CMP_PCT_SUM', 'PASS_CMP_PCT_CNT', t.pass_cmp_pct);
        add('PASS_YPA_SUM', 'PASS_YPA_CNT', t.pass_yds_per_att);
        add('PASS_1ST_SUM', 'PASS_1ST_CNT', t.pass_first_downs);
        add('PASS_SACKS_SUM', 'PASS_SACKS_CNT', t.pass_sacks);
        add('FPI_SUM', 'FPI_CNT', t.fpi);
        add('EPA_OFF_SUM', 'EPA_OFF_CNT', t.epa_offense);
        add('EPA_DEF_SUM', 'EPA_DEF_CNT', t.epa_defense);
        add('EPA_ST_SUM', 'EPA_ST_CNT', t.epa_special);
        return acc;
      },
      {
        WIN_PCT: 0, PF: 0, PA: 0, PD: 0, PPG_SUM: 0,
        PASS_YDS_SUM: 0, PASS_YDS_CNT: 0,
        PASS_TD_SUM: 0, PASS_TD_CNT: 0,
        PASS_INT_SUM: 0, PASS_INT_CNT: 0,
        PASS_RATE_SUM: 0, PASS_RATE_CNT: 0,
        PASS_CMP_PCT_SUM: 0, PASS_CMP_PCT_CNT: 0,
        PASS_YPA_SUM: 0, PASS_YPA_CNT: 0,
        PASS_1ST_SUM: 0, PASS_1ST_CNT: 0,
        PASS_SACKS_SUM: 0, PASS_SACKS_CNT: 0,
        FPI_SUM: 0, FPI_CNT: 0,
        EPA_OFF_SUM: 0, EPA_OFF_CNT: 0,
        EPA_DEF_SUM: 0, EPA_DEF_CNT: 0,
        EPA_ST_SUM: 0, EPA_ST_CNT: 0,
      } as any
    );
    const n = teams.length;
    const avg = (sum: number, cnt: number, def = 0) => (cnt > 0 ? sum / cnt : def);
    return {
      WIN_PCT: totals.WIN_PCT / n,
      PF: totals.PF / n,
      PA: totals.PA / n,
      PD: totals.PD / n,
      PPG: totals.PPG_SUM / n,
      PASS_YDS: avg(totals.PASS_YDS_SUM, totals.PASS_YDS_CNT),
      PASS_TD: avg(totals.PASS_TD_SUM, totals.PASS_TD_CNT),
      PASS_INT: avg(totals.PASS_INT_SUM, totals.PASS_INT_CNT),
      PASS_RATE: avg(totals.PASS_RATE_SUM, totals.PASS_RATE_CNT),
      PASS_CMP_PCT: avg(totals.PASS_CMP_PCT_SUM, totals.PASS_CMP_PCT_CNT),
      PASS_YPA: avg(totals.PASS_YPA_SUM, totals.PASS_YPA_CNT),
      PASS_1ST: avg(totals.PASS_1ST_SUM, totals.PASS_1ST_CNT),
      PASS_SACKS: avg(totals.PASS_SACKS_SUM, totals.PASS_SACKS_CNT),
      FPI: avg(totals.FPI_SUM, totals.FPI_CNT),
      EPA_OFF: avg(totals.EPA_OFF_SUM, totals.EPA_OFF_CNT),
      EPA_DEF: avg(totals.EPA_DEF_SUM, totals.EPA_DEF_CNT),
      EPA_ST: avg(totals.EPA_ST_SUM, totals.EPA_ST_CNT),
    } as any;
  }, [teams]);

  const winRateSortedTeams = React.useMemo(() => {
    return [...teams]
      .map((team) => ({
        team,
        winPct: Number.isFinite(team.win_pct) ? Number(team.win_pct) : 0,
      }))
      .sort((a, b) => {
        if (b.winPct !== a.winPct) return b.winPct - a.winPct;
        const winsDiff = (b.team.wins ?? 0) - (a.team.wins ?? 0);
        if (winsDiff !== 0) return winsDiff;
        return (b.team.point_diff ?? 0) - (a.team.point_diff ?? 0);
      })
      .map((entry) => entry.team);
  }, [teams]);

  const fpiSortedTeams = React.useMemo(() => {
    return [...teams]
      .map((team) => {
        const fpi = Number(team.fpi);
        const rank = Number(team.fpirank);
        return {
          team,
          fpiValue: Number.isFinite(fpi) ? fpi : -Infinity,
          rankValue: Number.isFinite(rank) ? rank : Infinity,
        };
      })
      .sort((a, b) => {
        if (b.fpiValue !== a.fpiValue) return b.fpiValue - a.fpiValue;
        if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
        const winDiff = (b.team.win_pct ?? 0) - (a.team.win_pct ?? 0);
        if (Math.abs(winDiff) > 1e-6) return winDiff;
        return (b.team.wins ?? 0) - (a.team.wins ?? 0);
      })
      .map((entry) => entry.team);
  }, [teams]);

  const conferenceAverages = React.useMemo(() => {
    const buckets: Record<string, { divPctSum: number; confPctSum: number; last5PctSum: number; countDiv: number; countConf: number; countL5: number }> = {};
    const parseRecordPct = (rec?: string | null) => {
      if (!rec) return null as number | null;
      const parts = rec.split('-').map((n) => parseInt(n, 10));
      if (parts.some((n) => Number.isNaN(n))) return null;
      const wins = parts[0] ?? 0;
      const losses = parts[1] ?? 0;
      const ties = parts[2] ?? 0;
      const total = wins + losses + ties;
      if (total === 0) return null;
      return (wins + 0.5 * ties) / total;
    };

    teams.forEach((t) => {
      const key = t.conference;
      if (!buckets[key]) {
        buckets[key] = { divPctSum: 0, confPctSum: 0, last5PctSum: 0, countDiv: 0, countConf: 0, countL5: 0 };
      }
      const divPct = parseRecordPct(t.Div ?? (t as any).DivPct);
      if (divPct != null) { buckets[key].divPctSum += divPct; buckets[key].countDiv++; }
      const confPct = parseRecordPct(t.Conf ?? (t as any).ConfPct);
      if (confPct != null) { buckets[key].confPctSum += confPct; buckets[key].countConf++; }
      const last5Pct = parseRecordPct(t.Last5);
      if (last5Pct != null) { buckets[key].last5PctSum += last5Pct; buckets[key].countL5++; }
    });

    const result: Record<string, { divPct: number; confPct: number; last5Pct: number }> = {};
    Object.entries(buckets).forEach(([conf, v]) => {
      result[conf] = {
        divPct: v.countDiv ? v.divPctSum / v.countDiv : 0,
        confPct: v.countConf ? v.confPctSum / v.countConf : 0,
        last5Pct: v.countL5 ? v.last5PctSum / v.countL5 : 0,
      };
    });
    return result;
  }, [teams]);

  const abbrToLogo = useAbbrToLogo(teams);
  const abbrToRecord = useMemo(() => {
    const map: Record<string, string> = {};
    teams.forEach((t) => {
      const abbr = (teamAbbreviations as any)[t.name];
      if (!abbr) return;
      map[abbr] = `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ''}`;
    });
    return map;
  }, [teams]);
  const abbrToTeamMap = useMemo(() => {
    const map: Record<string, NFLTeam> = {};
    teams.forEach((t) => {
      const abbr = (teamAbbreviations as any)[t.name];
      if (abbr) map[abbr] = t;
    });
    return map;
  }, [teams]);

  const [activeTab, setActiveTab] = useState<string>('schedule');
  const [scheduleOnly, setScheduleOnly] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 900;
  });

  useEffect(() => {
    const handleResize = () => {
      setScheduleOnly(window.innerWidth < 900);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (scheduleOnly) {
      setActiveTab('schedule');
    }
  }, [scheduleOnly]);

  return (
    <PageLayout theme="nfl">
      <div className="flex justify-end">
      </div>

      <Tabs
        theme="nfl"
        value={activeTab}
        className="w-full min-h-0"
        onValueChange={(v) => setActiveTab(v)}
      >
        {!scheduleOnly && (
  <TabsList className="grid py-2 px-2 w-full grid-cols-4 max-w-none mb-4 gap-2 -mt-1 -ml-2 pl-32">
            <TabsTrigger value="schedule">Scoreboard</TabsTrigger>
            <TabsTrigger value="all">Team Stats</TabsTrigger>
            <TabsTrigger value="AFC">AFC</TabsTrigger>
            <TabsTrigger value="NFC">NFC</TabsTrigger>
          </TabsList>
        )}

        {!scheduleOnly && (
        <TabsContent value="dashboard">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(103vh-135px)] overflow-hidden -mt-0">
            <div className="lg:col-span-7 flex flex-col gap-4 h-full overflow-hidden">
              <Card className="bg-card border w-full flex-1 min-h-0 flex flex-col overflow-hidden">
                <CardHeader className="px-4 py-3">
                </CardHeader>
                <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden px-4 pb-4">
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {winRateSortedTeams.map((team) => (
                          <NFLTeamMiniCard
                            key={`${team.name}-win`}
                            team={team}
                          />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border w-full flex-1 min-h-0 flex flex-col overflow-hidden">
                <CardHeader className="px-4 py-3">
                </CardHeader>
                <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden px-4 pb-4">
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {fpiSortedTeams.map((team, idx) => {
                        const fpi = Number.isFinite(Number(team.fpi)) ? Number(team.fpi).toFixed(1) : null;
                        return (
                          <NFLTeamMiniCard
                            key={`${team.name}-fpi`}
                            team={team}
                            badgeText={`${idx + 1}`}
                            statBadgeText={fpi ? `FPI ${fpi}` : undefined}
                          />
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

    <div className="lg:col-span-5 h-full overflow-hidden">
      <Card className="bg-card border w-full h-full flex flex-col overflow-hidden">
                <CardHeader className="p-0" />
                <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden py-0 px-3">
                  <DashboardTodayScheduleNFL
                    scheduleData={scheduleData}
                    logoMap={abbrToLogo}
                    recordMap={abbrToRecord}
                    abbrToTeamMap={abbrToTeamMap}
                    onGameClick={(gameId) => setEspnGameId(gameId)}
                  />
                </CardContent>
              </Card>
              {teams.length > 0 }
            </div>
          </div>
        </TabsContent>
        )}

        {!scheduleOnly && (
        <TabsContent value="all">
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
          {TEAM_SORT_OPTIONS.map(({ value, label }) => (
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

          <div className="flex-1 min-h-0">
            {(() => {
              const currentTeam = selectedTeamAll || orderedTeams[0];
              return (
                <div className="flex flex-row gap-4 h-[85vh] overflow-hidden">
                <div
                  className="w-20 md:w-40 xl:w-64 md:xl:w-72 lg:xl:w-80 shrink-0 overflow-y-auto no-scrollbar max-h-[85vh] pr-1 pt-0 pb-7 snap-y snap-mandatory"
                  style={{ scrollPaddingTop: '24px', scrollPaddingBottom: '24px' }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {orderedTeams.map((t) => {
                      const isActive = currentTeam && t.name === currentTeam.name;
                      return (
                        <button
                          key={t.name}
                          onClick={() => setSelectedTeamAll(t)}
                          className={`relative w-full aspect-square rounded-xl overflow-hidden bg-card/70 flex items-center justify-center transition-all duration-200 snap-start`}
                          style={
                            isActive
                              ? {
                                  border: '3px solid white',
                                  boxShadow: '0 0 20px rgba(255,255,255,0.6), inset 0 0 0 1px rgba(255,255,255,0.3)',
                                }
                              : {
                                  border: '1px solid rgba(255,255,255,0.1)',
                                }
                          }
                          title={t.name}
                        >
                          {t.logo ? (
                            <img
                              src={t.logo}
                              alt={`${t.name} logo`}
                              className="w-4/5 h-4/5 object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground px-2 text-center">{t.name}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1 min-h-0 min-w-0 overflow-y-auto no-scrollbar flex flex-col gap-5 pr-0 pb-24">
                  {currentTeam && (
                    <div className="w-full flex flex-wrap gap-4 items-start">
                      <div className="w-full min-w-[550px] max-w-[800px] shrink-0">
                        <TeamCard
                          key={currentTeam.name}
                          team={{ ...currentTeam, rank: (orderedTeams.findIndex((t) => t.name === currentTeam.name) + 1) || 1 }}
                          leagueAverages={leagueAverages}
                          conferenceAverages={conferenceAverages}
                          allTeams={teams}
                        />
                      </div>
                      <div className="flex-1 min-w-[280px] max-w-[405px]">
                        <Card className="bg-transparent border-none w-full h-[235px] overflow-hidden">
                          <CardHeader className="py-2 px-3">
                          </CardHeader>
                          <CardContent className="h-[220px] p-1">
                            <Doughnut
                              data={(() => {
                                const wins = Number(currentTeam.wins || 0);
                                const losses = Number(currentTeam.losses || 0) + Number(currentTeam.ties || 0);
                                const colors = teamColors[currentTeam.name] || { primary: '#3b82f6', secondary: '#64748b' };
                                return {
                                  labels: [],
                                  datasets: [
                                    {
                                      data: [wins, losses],
                                      backgroundColor: [colors.primary, '#4b5563'],
                                      borderWidth: 0,
                                    },
                                  ],
                                } as any;
                              })()}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                cutout: '55%',
                                responsiveAnimationDuration: 0,
                                animation: { animateRotate: true, animateScale: false, duration: 180, easing: 'easeOutQuart' },
                                plugins: {
                                  legend: { position: 'bottom', labels: { color: 'currentColor', boxWidth: 10 } },
                                  tooltip: { enabled: true },
                                },
                              }}
                            />
                          </CardContent>
                        </Card>
                      </div>
                      <div className="flex-1 min-w-[280px] max-w-[342px]">
                        <Card className="bg-transparent border-none w-full h-[235px] overflow-hidden">
                          <CardContent className="h-[220px] p-1">
                            <Radar
                              data={(() => {
                                const games = (currentTeam.wins || 0) + (currentTeam.losses || 0) + (currentTeam.ties || 0);
                                const winPct = Number(currentTeam.win_pct || 0);
                                const pf = Number(currentTeam.points_for || 0);
                                const pa = Number(currentTeam.points_against || 0);
                                const ppg = games > 0 ? pf / games : 0;
                                const fpi = Number((currentTeam as any).fpi || 0);
                                const epaOff = Number((currentTeam as any).epa_offense || 0);
                                const epaDef = Number((currentTeam as any).epa_defense || 0);
                                const epaST = Number((currentTeam as any).epa_special || 0);
                                const labels = ['Win%', 'PF', 'PA', 'PPG', 'FPI', 'EPA Off', 'EPA Def', 'EPA ST'];
                                const ex = radarExtrema;
                                const raw = [winPct, pf, pa, ppg, fpi, epaOff, epaDef, epaST];
                                const mins = [ex.winPct.min, ex.pf.min, ex.pa.min, ex.ppg.min, ex.fpi.min, ex.epaOff.min, ex.epaDef.min, ex.epaST.min];
                                const maxs = [ex.winPct.max, ex.pf.max, ex.pa.max, ex.ppg.max, ex.fpi.max, ex.epaOff.max, ex.epaDef.max, ex.epaST.max];
                                const norm = (v: number, mn: number, mx: number) => {
                                  if (!Number.isFinite(v) || !Number.isFinite(mn) || !Number.isFinite(mx)) return 0;
                                  if (Math.abs(mx - mn) < 1e-6) return 50;
                                  return ((v - mn) / (mx - mn)) * 100;
                                };
                                const vals = raw.map((v, i) => norm(v, mins[i], maxs[i]));
                                const colors = teamColors[currentTeam.name] || { primary: '#3b82f6', secondary: '#64748b' };
                                const cleanSecondary = colors.secondary.length === 9 && colors.secondary.startsWith('#') 
                                  ? colors.secondary.substring(0, 7) 
                                  : colors.secondary;
                                const bg = `${cleanSecondary}55`;
                                return {
                                  labels,
                                  datasets: [
                                    {
                                      id: 'teamRadar',
                                      label: currentTeam.name,
                                      data: vals,
                                      backgroundColor: bg,
                                      borderColor: colors.secondary,
                                      pointBackgroundColor: colors.secondary,
                                      pointBorderColor: '#fff',
                                      borderWidth: 2,
                                      tension: 0,
                                    },
                                  ],
                                } as any;
                              })()}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                animation: { duration: 200, easing: 'easeOutQuart' },
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
                              }}
                              datasetIdKey="id"
                              updateMode="active"
                            />
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 flex flex-col">
                    {currentTeam && (
                      <div
                        className="snap-y snap-mandatory pt-0 pb-24"
                        style={{ scrollPaddingTop: '16px', scrollPaddingBottom: '16px' }}
                      >
                        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                          <NFLRosterList teamName={currentTeam.name} rosterByTeam={rosterByTeam} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              );
            })()}
          </div>
        </TabsContent>
        )}

        {!scheduleOnly && ['AFC', 'NFC'].map((conference) => {
          const conferenceTeams = teams
            .filter((team) => team.conference === conference)
            .sort((a, b) => b.wins - a.wins);
          
          return (
          <TabsContent
            key={conference}
            value={conference}
            className="space-y-4 min-h-0 max-h-[calc(100vh-90px)] overflow-y-auto pr-1 pb-8 no-scrollbar"
          >
            {['East', 'North', 'South', 'West'].map((division) => {
              const divisionTeams = teams
                .filter((team) => team.conference === conference)
                .filter((team) => team.division.endsWith(division))
                .sort((a, b) => b.wins - a.wins);

              if (divisionTeams.length === 0) return null;

              return (
                <div key={`${conference}-${division}`} className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 text-white">
                    {conference} {division}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {divisionTeams.map((team) => {
                      const conferenceRank = conferenceTeams.findIndex((t) => t.name === team.name) + 1;
                      return (
                        <TeamCard
                          key={team.name}
                          team={{ ...team, rank: conferenceRank }}
                          leagueAverages={leagueAverages}
                          conferenceAverages={conferenceAverages}
                          allTeams={teams}
                          compact={true}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </TabsContent>
          );
        })}

        {/* Schedule Tab */}
        <TabsContent
          value="schedule"
          className={scheduleOnly ? 'max-h-[100vh] overflow-y-auto pr-2 pb-16' : 'max-h-[100vh] overflow-y-auto no-scrollbar pr-2 pb-16'}
        >
          <ScheduleNFLViewV2
            scheduleData={scheduleData}
            logoMap={abbrToLogo}
            recordMap={abbrToRecord}
            onGameClick={(gameId) => setEspnGameId(gameId)}
          />
        </TabsContent>
      </Tabs>

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
      <div className="flex items-center justify-end p-3 border-b border-white/10 bg-transparent">
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open(`https://www.espn.com/nfl/boxscore/_/gameId/${espnGameId}`, '_blank', 'noopener,noreferrer')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Open in ESPN
          </button>
          <button
            onClick={() => setEspnGameId(null)}
            className="bg-red-600 hover:bg-red-700 text-white rounded-lg p-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden bg-white rounded-b-2xl">
        <iframe
          ref={(iframe) => {
            if (iframe) {
              iframe.onload = () => {
                try {
                  setTimeout(() => {
                    if (iframe.contentWindow) {
                      iframe.contentWindow.scrollTo({ top: 500, behavior: 'smooth' });
                    }
                  }, 1000);
                } catch (e) {}
              };
            }
          }}
          src={`https://www.espn.com/nfl/boxscore/_/gameId/${espnGameId}`}
          className="w-full h-full border-0"
          title="ESPN Game Details"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
          style={{ backgroundColor: 'white' }}
        />
      </div>
    </div>
  </div>
)}

    </PageLayout>
  );
};

export default NFL;

/* Compact roster list for All Teams panel */
const NFLRosterList = ({ teamName, rosterByTeam }: { teamName: string; rosterByTeam: Record<string, any[]> }) => {
  const players = useMemo(() => {
    const arr = ((rosterByTeam?.[teamName] || []) as any[]) || [];
    const seen = new Set<string>();
    const out: any[] = [];
    for (const p of arr) {
      const key = (p && (p as any).profile_link)
        ? String((p as any).profile_link)
        : `${p?.name || p?.shortName || ''}|${p?.position || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  }, [teamName, rosterByTeam]);
  if (!players || players.length === 0) {
    return <div className="text-sm text-muted-foreground py-4">No roster data</div>;
  }
  return (
    <>
      {players.map((p, idx) => (
        <PlayerCardNFL
          key={(p.profile_link || p.name || 'player') + idx}
          player={p}
          index={idx}
          teamName={teamName}
        />
      ))}
    </>
  );
};

const PlayerCardNFL = React.memo(({ player, index, teamName }: { player: any; index: number; teamName?: string }) => {
  const name = player?.name || player?.shortName || 'Player';
  const posRaw = (player?.position || '').toString();
  const pos = posRaw.toUpperCase();
  const teamColorPrimary = teamName ? (teamColors[teamName]?.primary || '#1e40af') : '#1e40af';
  const teamColorSecondary = teamName ? (teamColors[teamName]?.secondary || '#dc2626') : '#dc2626';

  const posColor: Record<string, { bg: string; color?: string }> = {
    'QB': { bg: '#2563eb' },
    'RB': { bg: '#16a34a' },
    'WR': { bg: '#f59e0b' },
    'TE': { bg: '#a855f7' },
    'OL': { bg: '#6b7280' },
    'DL': { bg: '#ef4444' },
    'LB': { bg: '#f97316' },
    'CB': { bg: '#0ea5e9' },
    'S':  { bg: '#14b8a6' },
    'K':  { bg: '#84cc16' },
    'P':  { bg: '#22c55e' },
  };
  const badgeSty: React.CSSProperties = {
    backgroundColor: (posColor[pos]?.bg) || '#334155',
    color: (posColor[pos]?.color) || '#ffffff',
  };

  return (
    <div
      className="relative rounded-xl overflow-hidden snap-start"
      style={{
        backgroundImage: `linear-gradient(300deg, ${teamColorPrimary}, ${teamColorSecondary})`,
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
            <div className="text-sm font-semibold truncate">{name}</div>
          </div>
          {pos && (
            <Badge className="ml-auto text-[10px] font-semibold" style={badgeSty}>
              {pos}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
});


/* ============================================================================
 * NFL Schedule View V2 — with team records + live quarter/clock
 * ============================================================================ */
const NFLTeamMiniCard = ({
  team,
  rank,
  highlightLabel,
  highlightValue,
  badgeText,
  statBadgeText,
}: {
  team: NFLTeam;
  rank?: number;
  highlightLabel?: string;
  highlightValue?: string;
  badgeText?: string;
  statBadgeText?: string;
}) => {
  const abbr = (teamAbbreviations as any)[team.name] || 'UNK';
  const colors = teamColors[team.name] || { primary: '#222', secondary: '#555' };
  const record = `${team.wins} - ${team.losses}${team.ties ? ` - ${team.ties}` : ''}`;
  const primaryBadgeText = badgeText ?? record;
  return (
    <div className="relative rounded-xl overflow-hidden border border-[1px]">
      <div className="absolute inset-0.5 rounded-lg" style={{ backgroundColor: '#1414146f' }} aria-hidden />
      <div className="relative z-10 flex flex-col gap-2 p-3 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {team.logo && (
            <img
              src={team.logo}
              alt={`${team.name} logo`}
              className="w-7 h-7 rounded-sm object-contain"
              loading="lazy"
              width={32}
              height={32}
            />
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{team.name}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {statBadgeText && (
              <Badge className="text-xs font-semibold bg-white/80 text-black hover:bg-white hover:text-black">
                {statBadgeText}
              </Badge>
            )}
            <Badge className="text-sm font-semibold bg-white text-black hover:bg-white hover:text-black">
              {primaryBadgeText}
            </Badge>
          </div>
        </div>
        {highlightLabel && highlightValue && (
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-white/60">
            <span>{highlightLabel}</span>
            <span className="text-white text-sm font-semibold normal-case">{highlightValue}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/* Dashboard today schedule */
const DashboardTodayScheduleNFL = ({
  scheduleData,
  logoMap,
  recordMap = {},
  abbrToTeamMap = {},
  onGameClick,
}: {
  scheduleData: NFLScheduleData | null;
  logoMap: Record<string, string>;
  recordMap?: Record<string, string>;
  abbrToTeamMap?: Record<string, NFLTeam>;
  onGameClick?: (gameId: string) => void;
}) => {
  const todayKey = React.useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const { games, effectiveDateKey } = React.useMemo(() => {
    if (!scheduleData) return { games: [] as NFLScheduleGame[], effectiveDateKey: null as string | null };
    const arr: NFLScheduleGame[] = Array.isArray(scheduleData) ? (scheduleData as NFLScheduleGame[]) : [];
    const byDate: Record<string, NFLScheduleGame[]> = {};
    arr.forEach((g) => {
      const key = String(g.date || '').slice(0, 10);
      if (!key) return;
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(g);
    });
    const keys = Object.keys(byDate).sort();
    const todayGames = byDate[todayKey];
    if (todayGames?.length) return { games: todayGames, effectiveDateKey: todayKey };
    const futureKey = keys.find((key) => key > todayKey && byDate[key]?.length);
    if (futureKey) return { games: byDate[futureKey], effectiveDateKey: futureKey };
    return { games: [] as NFLScheduleGame[], effectiveDateKey: null as string | null };
  }, [scheduleData, todayKey]);

  const shellRef = React.useRef<HTMLDivElement>(null);
  const [layout, setLayout] = React.useState(() => ({ gap: 12, cardHeight: 120, scale: 1, ready: false }));

  const recomputeLayout = React.useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    const available = rect.height;
    if (!available || !Number.isFinite(available)) return;
    const totalGames = Math.max(1, games.length);
    let gap = Math.max(2, Math.min(8, (available / (totalGames + 0.25)) * 0.25));
    const gapBudget = gap * (totalGames + 1);
    const maxGapBudget = available * 0.2;
    if (gapBudget > maxGapBudget && maxGapBudget > 0) gap = maxGapBudget / (totalGames + 1);
    const usable = Math.max(0, available - gap * (totalGames + 1));
    const perCard = totalGames > 0 ? usable / totalGames : available;
    const BASE_CARD = 105;
    const scale = Math.max(0.6, Math.min(1.4, perCard / BASE_CARD));
    setLayout((prev) => {
      const next = { gap, cardHeight: perCard, scale, ready: true };
      if (Math.abs(prev.gap - next.gap) < 0.25 && Math.abs(prev.cardHeight - next.cardHeight) < 0.5 && Math.abs(prev.scale - next.scale) < 0.01 && prev.ready === next.ready) return prev;
      return next;
    });
  }, [games.length]);

  React.useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    recomputeLayout();
    window.addEventListener('resize', recomputeLayout);
    let observer: ResizeObserver | null = null;
    if ('ResizeObserver' in window && shellRef.current) {
      observer = new ResizeObserver(() => recomputeLayout());
      observer.observe(shellRef.current);
    }
    return () => { window.removeEventListener('resize', recomputeLayout); observer?.disconnect(); };
  }, [recomputeLayout]);

  const formatRecord = React.useCallback((value?: string) => {
    if (!value) return undefined;
    return value.replace(/-/g, ' - ');
  }, []);

  if (!scheduleData) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (games.length === 0) return <div className="text-sm text-muted-foreground">No upcoming games</div>;

  const gap = layout.gap;
  const scale = layout.scale;

  return (
    <div ref={shellRef} className="flex-1 min-h-0 w-full h-full overflow-hidden">
      <div className="grid grid-cols-1 h-full items-start content-start" style={{ rowGap: gap, paddingTop: gap, paddingBottom: gap, height: '100%', opacity: layout.ready ? 1 : 0, transition: 'opacity 140ms ease-out' }}>
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
          const normalizedAwayAbbr = (awayAbbr || '').toUpperCase();
          const normalizedHomeAbbr = (homeAbbr || '').toUpperCase();
          const normalizedAwayName = awayName || (normalizedAwayAbbr ? abbrToTeamMap[normalizedAwayAbbr]?.name || abbreviationToTeamName[normalizedAwayAbbr] : undefined);
          const normalizedHomeName = homeName || (normalizedHomeAbbr ? abbrToTeamMap[normalizedHomeAbbr]?.name || abbreviationToTeamName[normalizedHomeAbbr] : undefined);
          const awayLogo = normalizedAwayAbbr ? logoMap[normalizedAwayAbbr] : undefined;
          const homeLogo = normalizedHomeAbbr ? logoMap[normalizedHomeAbbr] : undefined;
          const awayRecord = normalizedAwayAbbr ? recordMap[normalizedAwayAbbr] : undefined;
          const homeRecord = normalizedHomeAbbr ? recordMap[normalizedHomeAbbr] : undefined;
          const aScore = Number(g.away_score);
          const hScore = Number(g.home_score);
          const hasScores = Number.isFinite(aScore) && Number.isFinite(hScore);
          const statusText = String(g.status || '').toLowerCase();
          const isFinal = statusText.includes('final') || statusText === 'f' || Boolean((g as any).winner);
          const isLive = statusText.includes('live') || statusText.includes('in progress');
          const showScore = (hasScores && (aScore !== 0 || hScore !== 0)) || isFinal || isLive;
          const awayWin = showScore ? aScore >= hScore : false;
          const homeWin = showScore ? hScore >= aScore : false;

          const cardPadding = Math.max(6, Math.round(10 * scale));
          const logoSize = Math.max(30, Math.round(72 * scale));
          const scoreFont = Math.max(20, Math.round(32 * scale));
          const timeFont = Math.max(14, Math.round(22 * scale));
          const contentPad = Math.max(4, Math.round(8 * scale));
          const contentSkew = Math.max(2, Math.round(4 * scale));
          const topPad = Math.max(0, contentPad - 2 * contentSkew);
          const bottomPad = contentPad + 2 * contentSkew;
          const cardHeight = layout.cardHeight > 0 ? layout.cardHeight : undefined;
          const recordFont = Math.max(10, Math.round(17 * scale));
          const recordOffset = Math.max(12, Math.round(45 * scale));
          const compactRecordLayout = games.length <= 2;

          return (
            <Card
              key={g.game_id || `${g.matchup}-${g.date}`}
              className="relative overflow-hidden transition-all duration-300 bg-card border flex flex-col cursor-pointer hover:ring-2 hover:ring-white/20"
              style={{ padding: cardPadding, height: cardHeight ? `${cardHeight}px` : undefined, minHeight: 0 }}
              onClick={() => { if (g.game_id && onGameClick) onGameClick(g.game_id); }}
            >
              <CardContent className="p-0 flex-1 flex flex-col" style={{ paddingTop: topPad, paddingBottom: bottomPad }}>
                <div className="grid items-center h-full min-h-0" style={{ gridTemplateColumns: `1fr minmax(${Math.max(140, Math.round(180 * scale))}px, auto) 1fr`, columnGap: Math.max(18, Math.round(26 * scale)) }}>
                  {/* Away side */}
                  <div className="flex flex-col items-center justify-center">
                    {awayLogo && (
                      <div className="rounded-sm relative overflow-visible" style={{ width: logoSize, height: logoSize }} title={normalizedAwayName || awayAbbr || 'Away team'}>
                        <img
                          src={awayLogo}
                          alt={awayAbbr || 'Away'}
                          className={`rounded-sm object-contain ${isFinal ? (awayWin ? 'opacity-100' : 'opacity-40') : ''}`}
                          style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1, filter: isFinal && awayWin ? 'drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(255, 255, 255, 0.6))' : undefined }}
                          loading="lazy"
                          width={64}
                          height={64}
                        />
                        {awayRecord && (
                          <span
                            className={`${compactRecordLayout ? 'relative block text-center mt-1 text-white/80 font-semibold' : 'absolute left-full top-1/2 -translate-y-1/2 whitespace-nowrap text-white/90 font-semibold'} drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]`}
                            style={compactRecordLayout ? { fontSize: recordFont } : { fontSize: recordFont, marginLeft: recordOffset }}
                          >
                            ({formatRecord(awayRecord)})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Center */}
                  <div className="text-center">
                    {isLive ? (
                      <Badge className="bg-red-600 text-white animate-pulse font-bold px-3 py-1 text-xs">LIVE</Badge>
                    ) : showScore ? (
                      <div className="font-extrabold tracking-wide" style={{ fontSize: scoreFont }}>
                        <span className={awayWin ? 'text-white' : 'text-white/50'}>{aScore}</span>
                        <span className="mx-2 text-muted-foreground">-</span>
                        <span className={homeWin ? 'text-white' : 'text-white/50'}>{hScore}</span>
                      </div>
                    ) : (
                      <div className="font-bold" style={{ fontSize: timeFont }}>{g.time || 'TBA'}</div>
                    )}
                    {g.tv && (
                      <div className="text-[10px] text-muted-foreground truncate mx-auto" style={{ maxWidth: Math.round(120 * scale) }}>{String(g.tv)}</div>
                    )}
                  </div>

                  {/* Home side */}
                  <div className="flex flex-col items-center justify-center">
                    {homeLogo && (
                      <div className="rounded-sm relative overflow-visible" style={{ width: logoSize, height: logoSize }} title={normalizedHomeName || homeAbbr || 'Home team'}>
                        <img
                          src={homeLogo}
                          alt={homeAbbr || 'Home'}
                          className={`rounded-sm object-contain ${isFinal ? (homeWin ? 'opacity-100' : 'opacity-40') : ''}`}
                          style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1, filter: isFinal && homeWin ? 'drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(255, 255, 255, 0.6))' : undefined }}
                          loading="lazy"
                          width={64}
                          height={64}
                        />
                        {homeRecord && (
                          <span
                            className={`${compactRecordLayout ? 'relative block text-center mt-1 text-white/80 font-semibold' : 'absolute right-full top-1/2 -translate-y-1/2 whitespace-nowrap text-white/90 font-semibold text-right'} drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]`}
                            style={compactRecordLayout ? { fontSize: recordFont } : { fontSize: recordFont, marginRight: recordOffset }}
                          >
                            ({formatRecord(homeRecord)})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

const ScheduleNFLViewV2 = ({
  scheduleData,
  logoMap,
  recordMap = {},
  onGameClick,
}: {
  scheduleData: NFLScheduleData | null;
  logoMap: Record<string, string>;
  recordMap?: Record<string, string>;
  onGameClick?: (gameId: string) => void;
}) => {
  const gamesByDate = useMemo(() => {
    const map: Record<string, NFLScheduleGame[]> = {};
    const arr: NFLScheduleGame[] = Array.isArray(scheduleData) ? (scheduleData as NFLScheduleGame[]) : [];
    for (const g of arr) {
      const k = String(g.date || '').slice(0, 10);
      if (!k) continue;
      if (!map[k]) map[k] = [];
      map[k].push(g);
    }
    const timeToMinutes = (t?: string) => {
      const s = String(t || '').trim();
      if (!s || s.toUpperCase() === 'TBA') return Number.MAX_SAFE_INTEGER;
      const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!m) return Number.MAX_SAFE_INTEGER - 1;
      let hh = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      const ap = m[3].toUpperCase();
      if (hh === 12) hh = 0;
      if (ap === 'PM') hh += 12;
      return hh * 60 + mm;
    };
    Object.keys(map).forEach((k) => map[k].sort((a, b) => {
      const ta = Number((a as any).ts_utc || 0);
      const tb = Number((b as any).ts_utc || 0);
      if (ta > 0 || tb > 0) return ta - tb;
      return timeToMinutes(a.time) - timeToMinutes(b.time);
    }));
    return map;
  }, [scheduleData]);

  const dateKeys = useMemo(() => Object.keys(gamesByDate).sort(), [gamesByDate]);
  const formatLabel = (key: string) => {
    const [y, m, d] = key.split('-').map((s) => parseInt(s, 10));
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };
  const todayKey = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);
  const initialIndex = useMemo(() => {
    if (dateKeys.length === 0) return 0;
    const idx = dateKeys.findIndex((k) => k >= todayKey);
    return idx >= 0 ? idx : (dateKeys.length - 1);
  }, [dateKeys, todayKey]);
  const [index, setIndex] = React.useState<number>(initialIndex);
  useEffect(() => { setIndex(initialIndex); }, [initialIndex]);

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
            const awayRecord = awayAbbr ? recordMap[awayAbbr] : undefined;
            const homeRecord = homeAbbr ? recordMap[homeAbbr] : undefined;
            const aScore = Number(g.away_score);
            const hScore = Number(g.home_score);
            const hasScores = Number.isFinite(aScore) && Number.isFinite(hScore);
            const awayWin = hasScores ? aScore >= hScore : false;
            const homeWin = hasScores ? hScore >= aScore : false;
            const isFinal = String(g.status || '').toLowerCase().includes('final') || Boolean((g as any).winner);
            const isLiveGame = String(g.status || '').toLowerCase().includes('live');
            const period = (g as any).period;
            const clock = (g as any).clock;

            const providers: string[] = Array.isArray(g.tv_providers)
              ? (g.tv_providers as string[]).filter(Boolean)
              : g.tv
              ? String(g.tv).split(',').map((s) => s.trim()).filter(Boolean)
              : [];

            const awayTeamName = g.matchup ? g.matchup.split('@')[0]?.trim() : undefined;
            const homeTeamName = g.matchup ? g.matchup.split('@')[1]?.trim() : undefined;
            const awayColor = awayTeamName && teamColors[awayTeamName]?.primary || '#1e40af';
            const homeColor = homeTeamName && teamColors[homeTeamName]?.primary || '#dc2626';

            return (
              <Card 
                key={g.game_id} 
                className="relative overflow-hidden transition-all duration-300 border p-2 flex flex-col h-full container cursor-pointer hover:ring-2 hover:ring-white/20 rounded-2xl"
                onClick={() => {
                  if (g.game_id && onGameClick) onGameClick(g.game_id);
                  else if (g.game_link) window.open(g.game_link, '_blank', 'noopener,noreferrer');
                }}
              >
                {/* Live pulse dot */}
                {isLiveGame && (
                  <>
                    <style>{`@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.1); } }`}</style>
                    <div className="absolute top-2 left-2 z-10 sched-live-dot" style={{ borderRadius: '50%', backgroundColor: '#ffffff', boxShadow: '0 0 6px rgba(255,255,255,0.8), 0 0 12px rgba(255,255,255,0.4)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  </>
                )}
                
                {/* Team color gradient background */}
                <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${awayColor} 0%, ${awayColor} 20%, ${homeColor} 80%, ${homeColor} 100%)` }} />
                <div className="absolute inset-0 bg-black/40" />

                {/* TV Badges */}
                {providers.length > 0 && (
                  <div className="absolute top-1 right-1 flex flex-wrap justify-end gap-1 max-w-[200px] z-10">
                    {providers.map((p) => {
                      const name = String(p).toLowerCase();
                      let style: React.CSSProperties | undefined;
                      if (name.includes('prime')) style = { backgroundColor: '#00A8E1', color: '#ffffff' };
                      else if (name.includes('peacock')) style = { backgroundColor: '#FFFFFF', color: '#000000' };
                      else if (name.includes('espn')) style = { backgroundColor: '#C8102E', color: '#ffffff' };
                      else if (name.includes('nfl') || name.includes('network')) style = { backgroundColor: '#013369', color: '#ffffff' };
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
                  <div className="flex-1 flex items-center py-1">
                    <div className="grid grid-cols-3 items-center w-full" style={{ gap: "1cqi" }}>
                      {/* Away team */}
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        {awayLogo && (
                          <img
                            src={awayLogo}
                            alt={awayAbbr || 'Away'}
                            className={`sched-logo rounded-sm ${isFinal ? (awayWin ? 'opacity-100' : 'opacity-40') : ''}`}
                            style={{ objectFit: 'contain', ...(isFinal && awayWin ? { filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(255,255,255,0.6))' } : {}) }}
                            loading="lazy"
                          />
                        )}
                        {/* Record under away logo */}
                        {awayRecord && (
                          <span className="whitespace-nowrap text-white/80 font-bold drop-shadow-md" style={{ fontSize: "clamp(0.6rem, 2.2cqi, 0.75rem)" }}>
                            ({awayRecord.replace(/-/g, ' - ')})
                          </span>
                        )}
                      </div>

                      {/* Center: score / time / live */}
                      <div className="flex items-center justify-center">
                        {(() => {
                          const s = String(g.status || '').toLowerCase();
                          if (s === 'final') {
                            return (
                              <div className="font-extrabold tracking-wide flex items-center justify-center" style={{ fontSize: "clamp(1.125rem, 4cqi, 1.75rem)" }}>
                                <span className={awayWin ? 'text-white' : 'text-white/50'}>{aScore}</span>
                                <span className="text-white" style={{ margin: "0 0.6cqi" }}>-</span>
                                <span className={homeWin ? 'text-white' : 'text-white/50'}>{hScore}</span>
                              </div>
                            );
                          }
                          if (s.includes('live')) {
                            return (
                              <div className="flex flex-col items-center gap-0.5">
                                <Badge className="bg-red-600 text-white animate-pulse font-bold px-2.5 py-0.5 text-[10px]">LIVE</Badge>
                                {/* Quarter + clock */}
                                {(period || clock) && (
                                  <span className="text-white/90 font-bold" style={{ fontSize: "clamp(0.5rem, 1.8cqi, 0.65rem)" }}>
                                    {period ? `Q${period}` : ''}{period && clock ? ' · ' : ''}{clock || ''}
                                  </span>
                                )}
                              </div>
                            );
                          }
                          return (
                            <div className="font-bold text-white" style={{ fontSize: "clamp(0.875rem, 3.2cqi, 1.3rem)" }}>
                              {g.time || 'TBA'}
                            </div>
                          );
                        })()}
                        {g.tv && providers.length === 0 && (
                          <div className="text-white/70 truncate mx-auto max-w-[140px] mt-1" style={{ fontSize: "clamp(0.5rem, 1.5cqi, 0.625rem)" }}>{String(g.tv)}</div>
                        )}
                      </div>

                      {/* Home team */}
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        {homeLogo && (
                          <img
                            src={homeLogo}
                            alt={homeAbbr || 'Home'}
                            className={`sched-logo rounded-sm ${isFinal ? (homeWin ? 'opacity-100' : 'opacity-40') : ''}`}
                            style={{ objectFit: 'contain', ...(isFinal && homeWin ? { filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(255,255,255,0.6))' } : {}) }}
                            loading="lazy"
                          />
                        )}
                        {/* Record under home logo */}
                        {homeRecord && (
                          <span className="whitespace-nowrap text-white/80 font-bold drop-shadow-md" style={{ fontSize: "clamp(0.6rem, 2.2cqi, 0.75rem)" }}>
                            ({homeRecord.replace(/-/g, ' - ')})
                          </span>
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