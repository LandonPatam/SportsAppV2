import React, { useState, useEffect, useMemo } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sun, Moon, ChevronLeft, ChevronRight } from 'lucide-react';
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
  ts_utc?: number;    // kickoff timestamp (UTC) for reliable sorting
}

type NFLScheduleData = NFLScheduleGame[];

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
  'Seattle Seahawks': { primary: '#002244', secondary: '#69BE28' },
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
      // ignore existing alpha in 8-digit hex; we use provided alpha
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
  // Core
  'Win %': 'Team win percentage (wins + 0.5 × ties) / total games',
  PF: 'Points For — total points the team has scored',
  PA: 'Points Against — total points the team has allowed',
  PD: 'Point Differential — PF minus PA',
  PPG: 'Points Per Game — PF divided by games played',

  // Records
  Division: 'Record within divisional games (W-L or W-L-T)',
  Conference: 'Record within conference games (W-L or W-L-T)',
  Streak: 'Current win/loss streak (e.g., 3W or 2L)',

  // Analytics
  FPI: 'ESPN Football Power Index — team rating (higher is better)',
  'EPA Off': 'Expected Points Added by offense — per-play team efficiency (higher is better)',
  'EPA Def': 'Expected Points Added allowed by defense — defensive efficiency (lower is better)',
  'EPA ST': 'Expected Points Added by special teams — ST efficiency (higher is better)',
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
          <div className="flex justify-left gap-3 text-sm cursor-help whitespace-nowrap">
            <span className="text-muted-foreground">{label}</span>
            <span className={colorClass}>{value}</span>
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
 * TEAM CARD COMPONENT
 * Displays individual NFL team statistics and record
 * ============================================================================ */


const TeamCard = ({
  team,
  onClick,
  leagueAverages,
  conferenceAverages,
}: {
  team: NFLTeam;
  onClick?: () => void;
  leagueAverages: any;
  conferenceAverages: Record<string, { divPct: number; confPct: number; last5Pct: number }>;
}) => {
  const totalGames = team.wins + team.losses + team.ties;
  const teamColor = teamColors[team.name] || { primary: '#1e40af', secondary: '#dc2626' };
  const teamAbbr = teamAbbreviations[team.name] || '';

  // Compare stat vs league average to determine highlight
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

    const leagueValue = Number((leagueAverages as any)[key] ?? 0);
    const diff = teamValue - leagueValue;
    if (Math.abs(diff) < 0.01) return 'neutral';

    // Keys where lower is better
    const lowerBetter = new Set<string>(['PA', 'PASS_INT', 'PASS_SACKS']);
    if (lowerBetter.has(key)) return diff < 0 ? 'high' : 'low';
    return diff > 0 ? 'high' : 'low';
  };

  // Helpers to parse record strings like "3-2" or "3-1-1"
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

  // Conference-based highlights for Division, Conference, Last5 (compare within same conference)
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

  return (
    <div
      className="relative rounded-xl shadow-lg overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(-200deg, ${teamColor.primary}, ${teamColor.secondary})`,
        padding: '3px',
      }}
    >
      {/* === Dark overlay over gradient === */}
      <div
        className="absolute inset-1 rounded-xl"
        style={{
          backgroundColor: '#1d1d1dff',
          opacity: 1,
        }}
        aria-hidden
      />

      {/* === Foreground content === */}
      <div className="relative z-10 p-4 text-white">
        
        {/* === Team header === */}
        <div className="flex items-center gap-2 mb-3">
          {team.logo && (
            <img
              src={team.logo}
              alt={`${team.name} logo`}
              className="w-7 h-7 rounded-sm"
            />
          )}

          <h3 className="text-lg font-bold">{team.name}</h3>

          {/* Win/Loss Badge */}
          <Badge
            className="ml-auto border-0 text-white font-semibold shadow-sm"
            style={{
              backgroundImage:
                team.win_pct >= 0.5
                  ? 'linear-gradient(90deg, #ffffffff, #ffffffff)' // 🟢 winning gradient
                  : 'linear-gradient(90deg, #000000ff, #000000ff)', // 🔴 losing gradient
              color: team.win_pct >= 0.5 ? '#2b2b2bff' : '#ffffffff',
              padding: '0.25rem 0.6rem',
              borderRadius: '0.4rem',
              letterSpacing: '0.5px',
              textShadow: '0 1px 2px rgba(0,0,0,0.4)',
            }}
          >
            {team.wins}-{team.losses}
            {team.ties > 0 ? `-${team.ties}` : ''}
          </Badge>
        </div>

        {/* === White stats card === */}
        <Card
          onClick={onClick}
          className={`overflow-hidden transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm border-1 h-full ${
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
            {/* Team statistics grid (4 columns of StatRow like NBA style) */}
            {(() => {
              const fpi = Number((team as any).fpi ?? NaN);
              const epaOff = Number((team as any).epa_offense ?? NaN);
              const epaDef = Number((team as any).epa_defense ?? NaN);
              const epaST = Number((team as any).epa_special ?? NaN);
              const ppg = totalGames > 0 ? (team.points_for / totalGames) : 0;

              // Arrange 4 rows, 3 columns. Third column shows EPA Def, EPA ST, and Streak.
              const items: { label: string; value: string | number; highlight?: 'high' | 'low' | 'neutral' }[] = [
                // Row 1
                { label: 'Win %', value: `${(team.win_pct * 100).toFixed(1)}%`, highlight: getHighlight('WIN_PCT') },
                { label: 'PPG', value: ppg.toFixed(1), highlight: getHighlight('PPG') },
                { label: 'EPA Def', value: Number.isFinite(epaDef) ? epaDef.toFixed(1) : '-', highlight: getHighlight('EPA_DEF') },
                // Row 2
                { label: 'PF', value: team.points_for, highlight: getHighlight('PF') },
                { label: 'PA', value: team.points_against, highlight: getHighlight('PA') },
                { label: 'EPA ST', value: Number.isFinite(epaST) ? epaST.toFixed(1) : '-', highlight: getHighlight('EPA_ST') },
                // Row 3 (Division + Conference on the same row)
                { label: 'Division', value: team.Div || '-' , highlight: getConfHighlight('DIV') },
                { label: 'EPA Off', value: Number.isFinite(epaOff) ? epaOff.toFixed(1) : '-', highlight: getHighlight('EPA_OFF') },
                { label: 'Streak', value: team.Strk || '-' },
                // Row 4
                { label: 'FPI', value: Number.isFinite(fpi) ? fpi.toFixed(1) : '-', highlight: getHighlight('FPI') },
                { label: 'Conference', value: team.Conf || '-', highlight: getConfHighlight('CONF') },
                // Leave last cell empty implicitly (grid will just not render a 12th item)
              ];

              return (
                <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                  {items.map((it) => (
                    <StatRow key={it.label} label={it.label} value={it.value} highlight={it.highlight as any} />
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
  const [sortField, setSortField] = useState<'WIN_PCT' | 'PF' | 'PA' | 'PD' | 'PPG'>('WIN_PCT');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTeamAll, setSelectedTeamAll] = useState<NFLTeam | null>(null);
  const [rosterByTeam, setRosterByTeam] = useState<Record<string, any[]>>({});

  // League-wide extrema for radar normalization (Win%, PF, PA, PPG, FPI, EPA Off/Def/ST)
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
    // Fallbacks if empty
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

  // Disable page scrolling while on NFL page; restore on unmount
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev || 'unset';
    };
  }, []);

  // Load from public/data and refresh periodically
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

  // Load schedule JSON (poll lightly when page visible)
  useEffect(() => {
    let alive = true;
    const bust = () => `?_=${Date.now()}`;
    const load = async () => {
      try {
        const res = await fetch(`/data/nfl_schedule.json${bust()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const text = await res.text();
        if (!alive) return;
        const next = JSON.parse(text) as NFLScheduleData;
        setScheduleData((prev) => {
          const prevText = JSON.stringify(prev ?? null);
          return prevText === text ? prev : next;
        });
      } catch {}
    };
    load();
    const id = setInterval(load, 30000);
    // refresh on visibility
    const vis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', vis);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, []);

  // Load roster by team name from public/data/nfl_roster.json
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

  // Extract numeric stat for sorting
  const getTeamStat = (t: NFLTeam, field: 'WIN_PCT' | 'PF' | 'PA' | 'PD' | 'PPG') => {
    switch (field) {
      case 'WIN_PCT': return t.win_pct;
      case 'PF': return t.points_for;
      case 'PA': return t.points_against;
      case 'PD': return t.point_diff;
      case 'PPG': {
        const total = t.wins + t.losses + t.ties;
        return total > 0 ? t.points_for / total : 0;
      }
    }
  };

  // Dynamic sorter using selected field and order
  const sortTeamsDynamic = (list: NFLTeam[]) => {
    const sorted = [...list].sort((a, b) => getTeamStat(b, sortField) - getTeamStat(a, sortField));
    return sortOrder === 'asc' ? sorted.reverse() : sorted;
  };

  // League averages for highlighting
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
        // passing metrics (if present)
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
        // new metrics
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

  // Conference-level averages for Division, Conference, Last 5 (within conference)
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
      if (divPct != null) {
        buckets[key].divPctSum += divPct;
        buckets[key].countDiv++;
      }
      const confPct = parseRecordPct(t.Conf ?? (t as any).ConfPct);
      if (confPct != null) {
        buckets[key].confPctSum += confPct;
        buckets[key].countConf++;
      }
      const last5Pct = parseRecordPct(t.Last5);
      if (last5Pct != null) {
        buckets[key].last5PctSum += last5Pct;
        buckets[key].countL5++;
      }
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

  return (
    <PageLayout>
      {/* Dark mode toggle */}
      <div className="flex justify-end">
      </div>

      <Tabs defaultValue="dashboard" className="w-full min-h-0">
        <TabsList className="grid w-full grid-cols-5 mb-6 max-w-none">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="all">All Teams</TabsTrigger>
          <TabsTrigger value="AFC">AFC</TabsTrigger>
          <TabsTrigger value="NFC">NFC</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        {/* Dashboard: Win% & FPI stacks + schedule */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(103vh-135px)] overflow-hidden -mt-0">
            {/* Left column: ranked team stacks similar to NBA layout */}
            <div className="lg:col-span-7 flex flex-col gap-4 h-full overflow-hidden">
              <Card className="bg-card border w-full flex-1 min-h-0 flex flex-col overflow-hidden">
                <CardHeader className="px-4 py-3">
                </CardHeader>
                <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden px-4 pb-4">
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {winRateSortedTeams.map((team) => {
                        return <NFLTeamMiniCard key={`${team.name}-win`} team={team} />;
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border w-full flex-1 min-h-0 flex flex-col overflow-hidden">
                <CardHeader className="px-4 py-3">
                </CardHeader>
                <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden px-2 pb-4">
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

            {/* Right column: today's schedule + strength chart */}
    <div className="lg:col-span-5 h-full overflow-hidden">
      <Card className="bg-card border w-full h-full flex flex-col overflow-hidden">
                <CardHeader className="p-0" />
                <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden py-3 px-3">
                  <DashboardTodayScheduleNFL
                    scheduleData={scheduleData}
                    logoMap={abbrToLogo}
                    recordMap={abbrToRecord}
                    abbrToTeamMap={abbrToTeamMap}
                  />
                </CardContent>
              </Card>
              {teams.length > 0 }
            </div>
          </div>
        </TabsContent>

        {/* All Teams Tab with Sort Controls + Sidebar layout (like NBA) */}
        <TabsContent value="all">
          <div className="flex flex-wrap items-center justify-between mb-6 gap-3 px-2">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-white/80">Sort by:</label>
              <Select onValueChange={(v) => setSortField(v as typeof sortField)} value={sortField}>
                <SelectTrigger className={`
  w-[150px]
  rounded-full px-4 py-2 text-sm font-semibold text-black
  bg-white
  shadow-md shadow-black/40
  hover:scale-[1.05]
  transition-all duration-300
`}>
                  <SelectValue placeholder="Select stat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WIN_PCT">Win %</SelectItem>
                  <SelectItem value="PF">Points For (PF)</SelectItem>
                  <SelectItem value="PA">Points Against (PA)</SelectItem>
                  <SelectItem value="PD">Point Diff (PD)</SelectItem>
                  <SelectItem value="PPG">Points Per Game (PPG)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className={`
  rounded-full px-4 py-2 text-sm font-semibold text-black
  bg-white
  shadow-md shadow-black/40
  hover:scale-[1.05]
  transition-all duration-300
`}
              >
              {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
            </Button>
          </div>

          {(() => {
            const ordered = sortTeamsDynamic(teams);
            const currentTeam = selectedTeamAll || ordered[0];
            return (
              <div className="flex flex-col xl:flex-row gap-4 h-[100vh] overflow-hidden">
                {/* Left: team logos grid */}
                <div className="w-64 md:w-72 lg:w-80 shrink-0 overflow-y-auto no-scrollbar pr-1 pt-0 pb-6">
                  <div className="grid grid-cols-3 gap-3">
                    {ordered.map((t) => {
                      const isActive = currentTeam && t.name === currentTeam.name;
                      return (
                        <button
                          key={t.name}
                          onClick={() => setSelectedTeamAll(t)}
                          className={`relative w-full aspect-square rounded-xl overflow-hidden bg-card/70 flex items-center justify-center border ${
                            isActive ? 'ring-2 ring-inset ring-white/80 border-transparent' : 'border-white/10'
                          }`}
                          title={t.name}
                        >
                          {t.logo ? (
                            <img src={t.logo} alt={`${t.name} logo`} className="w-3/5 h-3/5 object-contain" loading="lazy" />
                          ) : (
                            <span className="text-xs text-muted-foreground px-2 text-center">{t.name}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Big team card + roster (roster spans full right width under the card) */}
                <div className="flex-1 min-h-0 overflow-hidden flex flex-row gap-4 w-0 pr-0 items-stretch">
                  {currentTeam && (
                    <div className="w-full flex flex-col gap-4 min-w-0 min-h-0">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div>
                          <TeamCard
                            key={currentTeam.name}
                            team={currentTeam}
                            leagueAverages={leagueAverages}
                            conferenceAverages={conferenceAverages}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <Card className="bg-transparent backdrop-blur-sm border-none h-[50px]">
                            <CardHeader className="py-2">
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div style={{ height: 200 }}>
                                <Doughnut
                                  data={(() => {
                                    const wins = Number(currentTeam.wins || 0);
                                    const losses = Number(currentTeam.losses || 0) + Number(currentTeam.ties || 0);
                                    const colors = teamColors[currentTeam.name] || { primary: '#3b82f6', secondary: '#64748b' };
                                    return {
                                      labels: ['Wins', 'Losses'],
                                      datasets: [
                                        {
                                          data: [wins, losses],
                                          backgroundColor: [colors.primary, '#4b5563'],
                                          borderColor: [colors.primary, '#4b5563'],
                                          borderWidth: 1,
                                        },
                                      ],
                                      } as any;
                                  })()}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    animation: { animateRotate: true, animateScale: true },
                                    plugins: { legend: { display: false, position: 'bottom' } },
                                  }}
                                />
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-transparent backdrop-blur-sm border-none h-[100px]">
                            <CardHeader className="py-0">
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div style={{ height: 220 }}>
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
                                    const norm = (v: number, mn: number, mx: number) => (Number.isFinite(v) && Number.isFinite(mn) && Number.isFinite(mx) && mx > mn) ? (v - mn) / (mx - mn) : 0;
                                    const vals = raw.map((v, i) => norm(v, mins[i], maxs[i]));
                                    const colors = teamColors[currentTeam.name] || { primary: '#3b82f6', secondary: '#64748b' };
                                    const bg = toRGBA(colors.secondary, 0.25);
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
                                        },
                                      ],
                                      } as any;
                                  })()}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    scales: {
                                      r: {
                                        beginAtZero: true,
                                        suggestedMin: 0,
                                        suggestedMax: 1,
                                        ticks: { display: false, stepSize: 0.2 },
                                        grid: { color: 'rgba(255,255,255,0.1)' },
                                        angleLines: { color: 'rgba(255,255,255,0.1)' },
                                        pointLabels: { color: 'rgba(255,255,255,0.7)', font: { size: 10 } },
                                      },
                                    },
                                    plugins: { legend: { display: false } },
                                    animation: { duration: 600, easing: 'easeOutQuart' },
                                  }}
                                  datasetIdKey="id"
                                  updateMode="active"
                                />
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 w-full">
                        <NFLRosterList teamName={currentTeam.name} rosterByTeam={rosterByTeam} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </TabsContent>

        {/* AFC and NFC Conference Tabs */}
        {['AFC', 'NFC'].map((conference) => (
          <TabsContent
            key={conference}
            value={conference}
            className="space-y-4 min-h-0 max-h-[calc(100vh-90px)] overflow-y-auto pr-1 pb-8 no-scrollbar"
          >
            
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {divisionTeams.map((team) => (
                      <TeamCard
                        key={team.name}
                        team={team}
                        leagueAverages={leagueAverages}
                        conferenceAverages={conferenceAverages}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </TabsContent>
        ))}

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="max-h-[100vh] overflow-y-auto no-scrollbar pr-2 pb-4">
          <ScheduleNFLViewV2 scheduleData={scheduleData} logoMap={abbrToLogo} />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
};

export default NFL;

/* Compact roster list for All Teams panel (like NBA) */
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
    <div className="min-h-0 h-full overflow-y-auto no-scrollbar pr-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-1">
        {players.map((p, idx) => (
          <PlayerCardNFL key={(p.profile_link || p.name || 'player') + idx} player={p} index={idx} />
        ))}
      </div>
    </div>
  );
};

const PlayerCardNFL = React.memo(({ player, index }: { player: any; index: number }) => {
  const name = player?.name || player?.shortName || 'Player';
  const posRaw = (player?.position || '').toString();
  const head = player?.headshot || '';
  const pos = posRaw.toUpperCase();
  const posColor: Record<string, { bg: string; color?: string }> = {
    'QB': { bg: '#2563eb' },     // blue
    'RB': { bg: '#16a34a' },     // green
    'WR': { bg: '#f59e0b' },     // amber
    'TE': { bg: '#a855f7' },     // purple
    'OL': { bg: '#6b7280' },     // gray
    'DL': { bg: '#ef4444' },     // red
    'LB': { bg: '#f97316' },     // orange
    'CB': { bg: '#0ea5e9' },     // sky
    'S':  { bg: '#14b8a6' },     // teal
    'K':  { bg: '#84cc16' },     // lime
    'P':  { bg: '#22c55e' },     // emerald
  };
  const badgeSty: React.CSSProperties = {
    backgroundColor: (posColor[pos]?.bg) || '#334155',
    color: (posColor[pos]?.color) || '#ffffff',
  };

  return (
    <Card
      className="overflow-hidden bg-card/50 backdrop-blur-0 md:backdrop-blur-sm"
    >
      <CardHeader className="py-5 pb-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-0 min-w-0">
            <div className="min-w-0">
              <CardTitle className="text-[15px] font-semibold truncate">{name}</CardTitle>
            </div>
          </div>
          {pos && (
            <Badge className="text-[10px] font-semibold px-3 py-1" style={badgeSty}>{pos}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-1 pb-0"><div className="text-[10px] text-muted-foreground">&nbsp;</div></CardContent>
    </Card>
  );
});

/* ============================================================================
 * NFL Schedule View V2 (arrow-controlled, single day)
 * Matches NBA Schedule tab behavior
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
  const record = `${team.wins}-${team.losses}${team.ties ? `-${team.ties}` : ''}`;
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

/* Compact today-only schedule list for dashboard (mirrors NBA dashboard style) */
const DashboardTodayScheduleNFL = ({
  scheduleData,
  logoMap,
}: {
  scheduleData: NFLScheduleData | null;
  logoMap: Record<string, string>;
}) => {
  const todayKey = React.useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const gamesByDate = React.useMemo(() => {
    if (!scheduleData) return {} as Record<string, NFLScheduleGame[]>;
    const arr: NFLScheduleGame[] = Array.isArray(scheduleData) ? (scheduleData as NFLScheduleGame[]) : [];
    const map: Record<string, NFLScheduleGame[]> = {};
    for (const g of arr) {
      const key = String(g.date || '').slice(0, 10);
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(g);
    }
    Object.values(map).forEach((list) =>
      list.sort(
        (a, b) =>
          Number(a.ts_utc || 0) - Number(b.ts_utc || 0) ||
          String(a.time || '').localeCompare(String(b.time || ''))
      )
    );
    return map;
  }, [scheduleData]);

  const dateKeys = React.useMemo(() => Object.keys(gamesByDate).sort(), [gamesByDate]);

  const activeDateKey = React.useMemo(() => {
    if (!dateKeys.length) return null;
    if (gamesByDate[todayKey]?.length) return todayKey;
    const nextKey = dateKeys.find((key) => key > todayKey);
    return nextKey ?? null;
  }, [dateKeys, gamesByDate, todayKey]);

  const games = activeDateKey ? gamesByDate[activeDateKey] || [] : [];

  const shellRef = React.useRef<HTMLDivElement>(null);
  const [layout, setLayout] = React.useState(() => ({
    gap: 8,
    cardHeight: 72,
    scale: 1,
    ready: false,
  }));

  const recomputeLayout = React.useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    const available = rect.height;
    if (!Number.isFinite(available) || available <= 0) return;
    const totalGames = Math.max(1, games.length);
    let gap = Math.max(2, Math.min(10, (available / (totalGames + 0.5)) * 0.25));
    const spacingBudget = gap * (totalGames + 1);
    const maxSpacing = available * 0.22;
    if (spacingBudget > maxSpacing && maxSpacing > 0) {
      gap = maxSpacing / (totalGames + 1);
    }
    const usable = Math.max(0, available - gap * (totalGames + 1));
    const perCard = totalGames > 0 ? usable / totalGames : available;
    const BASE_CARD = 76;
    const scale = Math.max(0.65, Math.min(1.35, perCard / BASE_CARD));
    setLayout((prev) => {
      const next = { gap, cardHeight: perCard, scale, ready: true };
      if (
        Math.abs(prev.gap - next.gap) < 0.2 &&
        Math.abs(prev.cardHeight - next.cardHeight) < 0.5 &&
        Math.abs(prev.scale - next.scale) < 0.01 &&
        prev.ready === next.ready
      ) {
        return prev;
      }
      return next;
    });
  }, [games.length]);

  React.useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const handle = () => recomputeLayout();
    recomputeLayout();
    window.addEventListener('resize', handle);
    window.addEventListener('orientationchange', handle as any);
    let observer: ResizeObserver | null = null;
    if ('ResizeObserver' in window && shellRef.current) {
      observer = new ResizeObserver(() => recomputeLayout());
      observer.observe(shellRef.current);
    }
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('orientationchange', handle as any);
      observer?.disconnect();
    };
  }, [recomputeLayout]);

  if (!scheduleData) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!activeDateKey || games.length === 0) return <div className="text-sm text-muted-foreground">No schedule data</div>;

  return (
    <div ref={shellRef} className="flex-1 min-h-0 w-full h-full overflow-hidden">
      <div
        className="grid grid-cols-1 h-full"
        style={{
          rowGap: layout.gap,
          paddingTop: layout.gap,
          paddingBottom: layout.gap,
          height: '100%',
          opacity: layout.ready ? 1 : 0,
          transition: 'opacity 140ms ease-out',
        }}
      >
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
          const aScore = Number(g.away_score);
          const hScore = Number(g.home_score);
          const hasScores = Number.isFinite(aScore) && Number.isFinite(hScore);
          const awayWin = hasScores ? aScore >= hScore : false;
          const homeWin = hasScores ? hScore >= aScore : false;

          const status = String(g.status || '').toLowerCase();
          const isFinal = status === 'final' || status.includes('final');
          const isLive = status.includes('live');

          const cardPadding = Math.max(6, Math.round(10 * layout.scale));
          const cardHeight = layout.cardHeight > 0 ? layout.cardHeight : undefined;
          const logoSize = Math.max(30, Math.round(52 * layout.scale));
          const scoreFont = Math.max(18, Math.round(24 * layout.scale));
          const timeFont = Math.max(14, Math.round(18 * layout.scale));

          return (
            <Card
              key={g.game_id}
              className="relative overflow-hidden transition-all duration-300 bg-card/50 backdrop-blur-sm border flex flex-col"
              style={{ padding: cardPadding, height: cardHeight ? `${cardHeight}px` : undefined }}
            >
              <CardContent className="p-0 flex-1 flex flex-col justify-center">
                <div className="grid grid-cols-3 items-center">
                  {/* Away */}
                  <div className="flex flex-col items-center justify-center gap-1">
                    {awayLogo && (
                      <img
                        src={awayLogo}
                        alt={awayAbbr || 'Away'}
                        className={`rounded-sm object-contain ${isFinal ? (awayWin ? 'opacity-100' : 'opacity-40') : ''}`}
                        style={{
                          width: logoSize,
                          height: logoSize,
                          filter: isFinal && awayWin
                            ? 'drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(255,255,255,0.6))'
                            : undefined,
                        }}
                        loading="lazy"
                        width={64}
                        height={64}
                      />
                    )}
                  </div>

                  {/* Center: status or score/time */}
                  <div className="text-center">
                    {isFinal ? (
                      <div className="font-extrabold tracking-wide" style={{ fontSize: scoreFont }}>
                        <span className={awayWin ? 'text-white' : 'text-white/50'}>{aScore}</span>
                        <span className="mx-2 text-muted-foreground">-</span>
                        <span className={homeWin ? 'text-white' : 'text-white/50'}>{hScore}</span>
                      </div>
                    ) : isLive ? (
                      <Badge className="bg-red-600 text-white animate-pulse font-bold px-3 py-1 text-xs">LIVE</Badge>
                    ) : (
                      <div className="font-bold" style={{ fontSize: timeFont }}>{g.time || 'TBA'}</div>
                    )}
                  </div>

                  {/* Home */}
                  <div className="flex flex-col items-center justify-center gap-1">
                    {homeLogo && (
                      <img
                        src={homeLogo}
                        alt={homeAbbr || 'Home'}
                        className={`rounded-sm object-contain ${isFinal ? (homeWin ? 'opacity-100' : 'opacity-40') : ''}`}
                        style={{
                          width: logoSize,
                          height: logoSize,
                          filter: isFinal && homeWin
                            ? 'drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(255,255,255,0.6))'
                            : undefined,
                        }}
                        loading="lazy"
                        width={64}
                        height={64}
                      />
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
const ScheduleNFLViewV2 = ({ scheduleData, logoMap }: { scheduleData: NFLScheduleData | null; logoMap: Record<string, string> }) => {
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
            const aScore = Number(g.away_score);
            const hScore = Number(g.home_score);
            const hasScores = Number.isFinite(aScore) && Number.isFinite(hScore);
            const awayWin = hasScores ? aScore >= hScore : false;
            const homeWin = hasScores ? hScore >= aScore : false;
            const isFinal = String(g.status || '').toLowerCase().includes('final') || Boolean((g as any).winner);
            const providers: string[] = Array.isArray(g.tv_providers)
              ? (g.tv_providers as string[]).filter(Boolean)
              : g.tv
              ? String(g.tv).split(',').map((s) => s.trim()).filter(Boolean)
              : [];

            return (
              <Card key={g.game_id} className="relative overflow-hidden transition-all duration-300 bg-card/50 backdrop-blur-sm border p-2">
                {/* TV Badges */}
                {/* TV provider badges removed as requested */}

                <CardContent className="pt-3">
                  <div className="grid grid-cols-3 items-center">
                    {/* Away */}
                    <div className="flex flex-col items-center justify-center gap-1">
                      {awayLogo && (
                        <img
                          src={awayLogo}
                          alt={awayAbbr || 'Away'}
                          className={`h-12 w-12 md:h-14 md:w-14 rounded-sm object-contain ${isFinal ? (awayWin ? 'opacity-100' : 'opacity-40') : ''}`}
                          style={isFinal && awayWin ? { filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(255,255,255,0.6))' } : undefined}
                          loading="lazy"
                          width={72}
                          height={72}
                        />
                      )}
                      <div className="text-xs md:text-sm font-semibold text-center truncate max-w-[8rem]">
                        {g.matchup ? g.matchup.split('@')[0]?.trim() : (awayAbbr || 'Away')}
                      </div>
                    </div>

                    {/* Center status/score */}
                    <div className="text-center">
                      {(() => {
                        const s = String(g.status || '').toLowerCase();
                        if (s === 'final') {
                          return (
                            <div className="font-extrabold tracking-wide text-xl md:text-2xl">
                              <span className={awayWin ? 'text-white' : 'text-white/50'}>{aScore}</span>
                              <span className="mx-2 text-muted-foreground">-</span>
                              <span className={homeWin ? 'text-white' : 'text-white/50'}>{hScore}</span>
                            </div>
                          );
                        }
                        if (s.includes('live')) {
                          return <Badge className="bg-red-600 text-white animate-pulse font-bold px-2.5 py-0.5 text-[10px]">LIVE</Badge>;
                        }
                        return <div className="font-bold text-lg md:text-xl">{g.time || 'TBA'}</div>;
                      })()}
                      {g.tv && providers.length === 0 && (
                        <div className="text-[10px] text-muted-foreground truncate mx-auto max-w-[140px]">{String(g.tv)}</div>
                      )}
                    </div>

                    {/* Home */}
                    <div className="flex flex-col items-center justify-center gap-1">
                      {homeLogo && (
                        <img
                          src={homeLogo}
                          alt={homeAbbr || 'Home'}
                          className={`h-12 w-12 md:h-14 md:w-14 rounded-sm object-contain ${isFinal ? (homeWin ? 'opacity-100' : 'opacity-40') : ''}`}
                          style={isFinal && homeWin ? { filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(255,255,255,0.6))' } : undefined}
                          loading="lazy"
                          width={72}
                          height={72}
                        />
                      )}
                      <div className="text-xs md:text-sm font-semibold text-center truncate max-w-[8rem]">
                        {g.matchup ? g.matchup.split('@')[1]?.trim() : (homeAbbr || 'Home')}
                      </div>
                    </div>
                  </div>

                  {/* Footer: location */}
                  <div className="mt-2 text-xs text-muted-foreground text-center">{g.location || ''}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
