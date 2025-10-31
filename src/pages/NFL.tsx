import React, { useState, useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sun, Moon } from 'lucide-react';
// Data now loaded dynamically from public/data/nfl_site_nfl_standings.json
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
  Home?: string;
  Road?: string;
  Div?: string;
  DivPct?: string;
  Conf?: string;
  ConfPct?: string;
  NonConf?: string;
  Strk?: string;
  Last5?: string;
  logo?: string;
  link?: string;
}

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
  PPG: 'Points per game scored by the team',
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
          <div className="flex justify-left gap-3 text-sm cursor-help">
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
  const getHighlight = (key: 'WIN_PCT' | 'PF' | 'PA' | 'PD' | 'PPG') => {
    if (!leagueAverages) return undefined;
    const teamValue =
      key === 'WIN_PCT' ? team.win_pct :
      key === 'PF' ? team.points_for :
      key === 'PA' ? team.points_against :
      key === 'PD' ? team.point_diff :
      key === 'PPG' ? (totalGames > 0 ? team.points_for / totalGames : 0) : 0;

    const leagueValue = leagueAverages[key];
    const diff = teamValue - leagueValue;
    if (Math.abs(diff) < 0.01) return 'neutral';

    // For Points Against lower is better
    if (key === 'PA') return diff < 0 ? 'high' : 'low';
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
              className="w-8 h-8 rounded-sm"
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
            {/* Team statistics grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Left column */}
              <div className="space-y-2">
                <StatRow label="Win %" value={`${(team.win_pct * 100).toFixed(1)}%`} highlight={getHighlight('WIN_PCT')} />
                <StatRow label="Points For (PF)" value={team.points_for} highlight={getHighlight('PF')} />
                <StatRow label="Points Against (PA)" value={team.points_against} highlight={getHighlight('PA')} />
                {team.Div && (
                  <StatRow label="Division" value={`${team.Div}`} highlight={getConfHighlight('DIV')} />
                )}
                {team.Last5 && (
                  <StatRow label="Last 5" value={team.Last5} highlight={getConfHighlight('LAST5')} />
                )}
              </div>

              {/* Right column */}
              <div className="space-y-2">
                <StatRow
                  label="Point Diff (PD)"
                  value={`${team.point_diff >= 0 ? '+' : ''}${team.point_diff}`}
                  highlight={getHighlight('PD')}
                />
                <StatRow
                  label="PPG"
                  value={totalGames > 0 ? (team.points_for / totalGames).toFixed(1) : '0.0'}
                  highlight={getHighlight('PPG')}
                />
                {team.Strk && <StatRow label="Streak" value={team.Strk} />}
                {team.Conf && (
                  <StatRow label="Conference" value={`${team.Conf}`} highlight={getConfHighlight('CONF')} />
                )}
              </div>
            </div>
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
  const [sortField, setSortField] = useState<'WIN_PCT' | 'PF' | 'PA' | 'PD' | 'PPG'>('WIN_PCT');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
      (acc, t) => {
        const games = t.wins + t.losses + t.ties;
        acc.WIN_PCT += t.win_pct;
        acc.PF += t.points_for;
        acc.PA += t.points_against;
        acc.PD += t.point_diff;
        acc.PPG_SUM += games > 0 ? t.points_for / games : 0;
        return acc;
      },
      { WIN_PCT: 0, PF: 0, PA: 0, PD: 0, PPG_SUM: 0 }
    );
    const n = teams.length;
    return {
      WIN_PCT: totals.WIN_PCT / n,
      PF: totals.PF / n,
      PA: totals.PA / n,
      PD: totals.PD / n,
      PPG: totals.PPG_SUM / n,
    } as Record<'WIN_PCT' | 'PF' | 'PA' | 'PD' | 'PPG', number>;
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

  return (
    <PageLayout>
      {/* Dark mode toggle */}
      <div className="flex justify-end">
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
          <TabsTrigger value="all">All Teams</TabsTrigger>
          <TabsTrigger value="AFC">AFC</TabsTrigger>
          <TabsTrigger value="NFC">NFC</TabsTrigger>
        </TabsList>

        {/* All Teams Tab with Sort Controls */}
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {sortTeamsDynamic(teams).map((team, index) => (
              <TeamCard
                key={team.name}
                team={{ ...team, rank: index + 1 }}
                leagueAverages={leagueAverages}
                conferenceAverages={conferenceAverages}
              />
            ))}
          </div>
        </TabsContent>

        {/* AFC and NFC Conference Tabs */}
        {['AFC', 'NFC'].map((conference) => (
          <TabsContent key={conference} value={conference} className="space-y-8">
            
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
      </Tabs>
    </PageLayout>
  );
};

export default NFL;
