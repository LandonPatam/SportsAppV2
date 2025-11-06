// ============================
// 🏀 NBA Dashboard
// Displays NBA team standings and top player stats
// ============================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { X, Sun, Moon, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
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

const abbreviationToTeamName: Record<string, string> = Object.fromEntries(
  Object.entries(teamAbbreviations).map(([name, abbr]) => [abbr, name])
);




// ============================
// Dashboard Compact Components
// ============================

const DashboardTeamMiniCard = React.forwardRef<HTMLDivElement, { team: NBATeam; highlight?: boolean }>(
  ({ team, highlight = false }, ref) => {
  const abbr = teamAbbreviations[team.TEAM_NAME] || 'UNK';
  const colors = teamColors[abbr] || { primary: '#222', secondary: '#555' };
  return (
    <div
      ref={ref}
      className={`relative rounded-xl overflow-hidden transition-all duration-300`}
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

const DashboardPlayerMiniCard = ({ player, logoMap, rank }: { player: Player; logoMap: Record<string, string>; rank?: number }) => {
  const abbr = player.TEAM_ABBREVIATION || 'UNK';
  const colors = teamColors[abbr] || { primary: '#222', secondary: '#555' };
  const logo = logoMap[abbr];
  return (
    <div
      className="relative rounded-xl overflow-hidden"
//      style={{
//        backgroundImage: `linear-gradient(300deg, ${colors.primary}, ${colors.secondary})`,
//        padding: '2px',
//      }}
    >
<div 
  className="absolute inset-0.5 rounded-lg" 
  style={{ backgroundColor: '#16181d47' }}
  aria-hidden 
/>      <div className="relative z-10 flex items-center gap-4 p-3 border">
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
}: {
  scheduleData: NBAScheduleData | null;
  logoMap: Record<string, string>;
  recordMap: Record<string, string>;
  onGapChange?: (gap: number) => void;
  onTeamFocus?: (info: { teamName?: string; teamAbbr?: string }) => void;
}) => {
  const todayKey = React.useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const games = React.useMemo(() => {
    if (!scheduleData) return [] as ScheduleGameAny[];
    const arr: ScheduleGameAny[] = Array.isArray(scheduleData)
      ? (scheduleData as ScheduleGameAny[])
      : (scheduleData.games || []);
    return arr.filter((g) => String(g.date || '').slice(0, 10) === todayKey);
  }, [scheduleData, todayKey]);

  // Reactive scale so all cards fit without scrolling (vertical-only sizing)
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  const [availPx, setAvailPx] = React.useState(0);
  const [ready, setReady] = React.useState(false);
  React.useLayoutEffect(() => {
    const BASE_CARD = 92; // px baseline compact card height
    const BASE_GAP = 12;  // px gap between cards
    const MIN_SCALE = 0.6;
    const MAX_SCALE = 1.5; // allow growing to fill the screen
    const compute = () => {
      const wrapper = containerRef.current as HTMLElement | null;
      const rect = wrapper?.getBoundingClientRect();
      const top = rect ? rect.top : 0;

      // Estimate extra space below the grid: padding/margins of CardContent/Card
      let extraBottom = 16;
      const contentEl = wrapper?.parentElement as HTMLElement | null; // CardContent
      if (contentEl) {
        const cs = window.getComputedStyle(contentEl);
        extraBottom += (parseFloat(cs.paddingBottom || '0') || 0) + (parseFloat(cs.marginBottom || '0') || 0);
      }
      const cardEl = contentEl?.parentElement as HTMLElement | null; // Card
      if (cardEl) {
        const cs2 = window.getComputedStyle(cardEl);
        extraBottom += (parseFloat(cs2.paddingBottom || '0') || 0) + (parseFloat(cs2.marginBottom || '0') || 0) + (parseFloat(cs2.borderBottomWidth || '0') || 0);
      }

      const available = Math.max(100, window.innerHeight - top - extraBottom);
      setAvailPx(available);

      // Estimate natural height based on baseline sizes
      // If there's only 1 game, size as if there were 2 so the single card
      // doesn't expand to fill the entire column height.
      const nActual = Math.max(1, games.length);
      const nForScale = Math.max(2, nActual);
      // Include top and bottom edge gap so inter-card gap equals edge gap
      const naturalHeight = nForScale * BASE_CARD + (nForScale - 1 + 2) * BASE_GAP;
      const FUDGE = 0.97; // slight undershoot to avoid cutoff
      const sRaw = (available / naturalHeight) * FUDGE;
      const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, sRaw * FUDGE));
      setScale(s);
      // compute current gap (used for equal edge spacing)
      const g = Math.round(12 * s);
      try { onGapChange && onGapChange(g); } catch {}
      setReady(true);
    };
    compute();
    const onResize = () => compute();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize as any);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize as any);
    };
  }, [games.length, scheduleData]);

  const focusTeam = React.useCallback(
    (teamAbbr?: string, fallbackName?: string) => {
      if (!onTeamFocus) return;
      onTeamFocus({ teamAbbr, teamName: fallbackName });
    },
    [onTeamFocus]
  );

  if (!scheduleData) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (games.length === 0) return <div className="text-sm text-muted-foreground">No games today</div>;

  const gap = Math.round(12 * scale);
  return (
    <div
      ref={containerRef}
      className="grid grid-cols-1 auto-rows-max items-start content-start"
      style={{
        rowGap: gap,
        paddingTop: gap,
        paddingBottom: gap,
        height: availPx ? `${availPx}px` : undefined,
        overflow: 'hidden',
        opacity: ready ? 1 : 0,
        transition: 'opacity 120ms ease-out',
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
        const aScore = Number((g as any).away_score);
        const hScore = Number((g as any).home_score);
        const hasScores = Number.isFinite(aScore) && Number.isFinite(hScore);
        const awayWin = hasScores ? aScore >= hScore : false;
        const homeWin = hasScores ? hScore >= aScore : false;

        // Normalize TV providers similar to schedule tab
        const providers: string[] = Array.isArray((g as any).tv_providers)
          ? ((g as any).tv_providers as string[]).filter(Boolean)
          : (g as any).tv
            ? String((g as any).tv)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [];

        const statusText = String((g as any).status || '').toLowerCase();
        const isFinal = statusText.includes('final') || Boolean((g as any).winner);

        const cardPadding = Math.max(8, Math.round(12 * scale));
          const logoSize = Math.max(18, Math.round(40 * scale));
          const scoreFont = Math.max(16, Math.round(24 * scale));
          const timeFont = Math.max(14, Math.round(20 * scale));
          const nameFont = Math.max(11, Math.round(14 * scale));
          const contentPad = Math.max(6, Math.round(10 * scale));
          const contentSkew = Math.max(2, Math.round(4 * scale));
          const topPad = Math.max(0, contentPad - (2 * contentSkew));
          const bottomPad = contentPad + (2 * contentSkew);

            return (
          <Card key={g.game_id} className="relative overflow-hidden transition-all duration-300 bg-card/50 backdrop-blur-sm border" style={{ padding: cardPadding }}>
            

            {/* TV Badges top-right */}
            {providers.length > 0 && (
              <div className="absolute top-2 right-2 flex flex-wrap justify-end gap-1 max-w-[220px]">
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
                    <Badge key={p} className="text-[10px] font-semibold px-2 py-0.5" style={style}>
                      {p}
                    </Badge>
                  );
                })}
              </div>
            )}

            <CardContent className="p-0" style={{ paddingTop: topPad, paddingBottom: bottomPad }}>
              <div className="grid grid-cols-3 items-center">
                {/* Away side */}
               <div className="flex flex-col items-center justify-center gap-1">
                  {awayLogo && (
                    <button
                      type="button"
                      onClick={() => focusTeam(awayAbbr, normalizedAwayName)}
                      className="rounded-sm focus:outline-none"
                      style={{ width: logoSize, height: logoSize }}
                      title={normalizedAwayName || awayAbbr || 'Away team'}
                    >
                      <img
                        src={awayLogo}
                        alt={awayAbbr || 'Away'}
                        className={`rounded-sm object-contain cursor-pointer ${isFinal ? (awayWin ? 'opacity-100' : 'opacity-40') : ''}`}
                        style={{ width: '100%', height: '100%', filter: isFinal && awayWin ? 'drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(255, 255, 255, 0.6))' : undefined }}
                        loading="lazy"
                        width={64}
                        height={64}
                      />
                    </button>
                  )}
                  <div className="text-center">
                    <div className="font-semibold truncate max-w-[9rem]" style={{ fontSize: nameFont }}>
                      {normalizedAwayName || awayAbbr || 'Away'}
                    </div>
                
                  </div>
                </div>

                {/* Center time or score */}
                <div className="text-center">
                  {(() => {
                    const statusTextCenter = String((g as any).status || '').toLowerCase();
                    const isFinalCenter = statusTextCenter.includes('final') || Boolean((g as any).winner);
                    const isLiveCenter = (statusTextCenter.includes('live') || statusTextCenter.includes('in progress')) || (hasScores && !isFinalCenter);
                    if (isLiveCenter) {
                      return <Badge className="bg-red-600 text-white animate-pulse font-bold px-3 py-1 text-xs">LIVE</Badge>;
                    }
                    return hasScores ? (
                    <div className="font-extrabold tracking-wide" style={{ fontSize: scoreFont }}>
                      <span className={(awayWin) ? 'text-white' : 'text-white/50'}>
                        {aScore}
                      </span>
                      <span className="mx-2 text-muted-foreground">-</span>
                      <span className={(homeWin) ? 'text-white' : 'text-white/50'}>
                        {hScore}
                      </span>
                    </div>
                  ) : (
                    <div className="font-bold" style={{ fontSize: timeFont }}>{g.time || 'TBA'}</div>
                  );
                  })()}
                  {(g as any).tv && providers.length === 0 && (
                    <div className="text-[10px] text-muted-foreground truncate mx-auto" style={{ maxWidth: Math.round(120 * scale) }}>
                      {String((g as any).tv)}
                    </div>
                  )}
                </div>

                {/* Home side */}
                <div className="flex flex-col items-center justify-center gap-1">
                  {homeLogo && (
                    <button
                      type="button"
                      onClick={() => focusTeam(homeAbbr, normalizedHomeName)}
                      className="rounded-sm focus:outline-none"
                      style={{ width: logoSize, height: logoSize }}
                      title={normalizedHomeName || homeAbbr || 'Home team'}
                    >
                      <img
                        src={homeLogo}
                        alt={homeAbbr || 'Home'}
                        className={`rounded-sm object-contain cursor-pointer ${isFinal ? (homeWin ? 'opacity-100' : 'opacity-40') : ''}`}
                        style={{ width: '100%', height: '100%', filter: isFinal && homeWin ? 'drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(255,255,255,0.6))' : undefined }}
                        loading="lazy"
                        width={64}
                        height={64}
                      />
                    </button>
                  )}

                  
                  <div className="text-center">
                    <div className="font-semibold truncate max-w-[9rem]" style={{ fontSize: nameFont }}>
                      {normalizedHomeName || homeAbbr || 'Home'}
                    </div>

                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
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
  "OREB" : 'Offensive Rebounds',
  "DREB" : 'Defensive Rebounds',
  "3PM" : 'Three pointers made',
  "FTM" : 'Free throws made'
  

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
const ScheduleViewV2 = ({ scheduleData, logoMap }: { scheduleData: NBAScheduleData | null, logoMap: Record<string, string> }) => {
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

  if (!scheduleData) return <div className="text-sm text-muted-foreground">Loading schedule…</div>;
  const logos: Record<string, string> = Array.isArray(scheduleData) ? {} : (scheduleData?.teams || {});

  // All available date keys sorted ascending
  const dateKeys = useMemo(() => Object.keys(gamesByDate).sort(), [gamesByDate]);

  // Helper to format date labels from YYYY-MM-DD
  const formatLabel = (key: string) => {
    const [y, m, d] = key.split('-').map((s) => parseInt(s, 10));
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

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
            const aScore = Number((g as any).away_score);
            const hScore = Number((g as any).home_score);
            const hasScores = Number.isFinite(aScore) && Number.isFinite(hScore);
            const awayWin = hasScores ? aScore >= hScore : false;
            const homeWin = hasScores ? hScore >= aScore : false;
            const statusText = String((g as any).status || '').toLowerCase();
            const isFinal = statusText.includes('final') || Boolean((g as any).winner);

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

            return (
              <Card key={g.game_id} className="relative overflow-hidden transition-all duration-300 bg-card/50 backdrop-blur-sm border p-2">
                {/* TV Badges top-right */}
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

                <CardContent className="pt-3">
                  <div className="grid grid-cols-3 items-center">
                    {/* Away side */}
                    <div className="flex flex-col items-center justify-center gap-2">
                      {awayLogo && (
                        <img
                          src={awayLogo}
                          alt={awayAbbr || 'Away'}
                          className={`h-8 w-8 md:h-10 md:w-10 rounded-sm object-contain ${isFinal ? (awayWin ? 'opacity-100' : 'opacity-40') : ''}`}
                          style={isFinal && awayWin ? { filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(255,255,255,0.6))' } : undefined}
                          loading="lazy"
                          width={64}
                          height={64}
                        />
                      )}
                      <div className="text-xs md:text-sm font-semibold text-center truncate max-w-[8rem]">
                        {awayName || awayAbbr || 'Away'}
                      </div>
                    </div>

                    {/* Center time or score */}
                    <div className="text-center">
                      {(() => {
                        const statusText2 = String((g as any).status || '').toLowerCase();
                        const hasScores2 = Boolean((g as any).home_score && (g as any).away_score);
                        const isFinal2 = statusText2.includes('final') || Boolean((g as any).winner);
                        const isLive2 = (statusText2.includes('live') || statusText2.includes('in progress')) || (hasScores2 && !isFinal2);
                        if (isLive2) {
                          return <Badge className="bg-red-600 text-white animate-pulse font-bold px-2.5 py-0.5 text-[10px]">LIVE</Badge>;
                        }
                        if (hasScores2) {
                          const a = parseInt((g as any).away_score as string, 10);
                          const h = parseInt((g as any).home_score as string, 10);
                          return (
                            <div className="text-xl md:text-2xl font-extrabold tracking-wide">
                              <span className={(a >= h) ? 'text-white' : 'text-white/50'}>{(g as any).away_score}</span>
                              <span className="mx-2 text-muted-foreground">-</span>
                              <span className={(h >= a) ? 'text-white' : 'text-white/50'}>{(g as any).home_score}</span>
                            </div>
                          );
                        }
                        return <div className="text-lg md:text-xl font-bold">{g.time || 'TBA'}</div>;
                      })()}
                    </div>

                    {/* Home side */}
                    <div className="flex flex-col items-center justify-center gap-2">
                      {homeLogo && (
                        <img
                          src={homeLogo}
                          alt={homeAbbr || 'Home'}
                          className={`h-8 w-8 md:h-10 md:w-10 rounded-sm object-contain ${isFinal ? (homeWin ? 'opacity-100' : 'opacity-40') : ''}`}
                          style={isFinal && homeWin ? { filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(255,255,255,0.6))' } : undefined}
                          loading="lazy"
                          width={64}
                          height={64}
                        />
                      )}
                      <div className="text-xs md:text-sm font-semibold text-center truncate max-w-[8rem]">
                        {homeName || homeAbbr || 'Home'}
                      </div>
                    </div>
                  </div>

                  {/* Footer: arena centered */}
                  <div className="mt-2 text-xs text-muted-foreground text-center">
                    {(g as any).location || ''}
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
// Displays a team's full roster in a modal
// ============================

const PlayerModal = ({
  team,
  nbaPlayerData,
  onClose,
}: {
  team: NBATeam;
  nbaPlayerData: Record<string, Player[]>;
  onClose: () => void;
}) => {
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
        className="relative bg-background rounded-2xl max-w-6xl w-full max-h-[85vh] overflow-hidden border"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'scaleIn 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-6 flex items-center justify-between z-10">
          <div className="flex-1 min-h-0 flex flex-col">
            <h2 className="text-3xl font-bold">{team.TEAM_NAME}</h2>
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
                  className="overflow-hidden transition-all duration-300 bg-card/50 backdrop-blur-sm"
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

  // Helper to determine stat color vs league average
const getHighlight = (statKey: TeamStatKey) => {
    if (!leagueAverages) return undefined;
    const diff = Number((team as any)[statKey]) - Number((leagueAverages as any)[statKey]);
  
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


const teamGradientColors = {
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
  <h3 className="text-lg font-bold">{team.TEAM_NAME}</h3>
<Badge
  className="ml-auto border-0 text-white font-semibold"
  style={{
    backgroundImage:
      team.W >= team.L
        ? 'linear-gradient(90deg, #ffffffff, #ffffffff)' // 🟢 Green gradient for winning record
        : 'linear-gradient(90deg, #000000ff, #000000ff)', // 🔴 Red gradient for losing record
    color: team.W >= team.L ? '#2b2b2bff' : '#ffffffff',
    padding: '0.25rem 0.6rem',
    borderRadius: '0.4rem',
    letterSpacing: '0.5px',
    textShadow: '0 1px 2px rgba(0,0,0,0.4)', // subtle depth for visibility
  }}
>
  {team.W}-{team.L}
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
              <StatRow label="BPI" value={typeof (team as any).bpi === 'number' ? (team as any).bpi.toFixed(1) : ((team as any).bpi ?? '-')} />
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
              <StatRow label="FT%" value={`${(team.FT_PCT * 100).toFixed(1)}%`} highlight={getHighlight('FT_PCT')} />
            </div>
            <div className="space-y-2">
              <StatRow label="OFF" value={typeof (team as any).off === 'number' ? (team as any).off.toFixed(1) : ((team as any).off ?? '-')} />
              <StatRow label="DEF" value={typeof (team as any).def === 'number' ? (team as any).def.toFixed(1) : ((team as any).def ?? '-')} />
              <StatRow label="PBPI" value={typeof (team as any).pbpi === 'number' ? (team as any).pbpi.toFixed(1) : ((team as any).pbpi ?? '-')} />
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
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedTeam, setSelectedTeam] = useState<NBATeam | null>(null);
  // Separate selection for All Teams detail pane to avoid opening roster modal
  const [selectedTeamAll, setSelectedTeamAll] = useState<NBATeam | null>(null);
  const [sortField, setSortField] = useState<'WIN_PCT' | 'PTS' | 'REB' | 'AST' | 'FG_PCT' | 'FG3_PCT'>('WIN_PCT');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [scheduleData, setScheduleData] = useState<NBAScheduleData | null>(null);
  const logosScrollRef = useRef<HTMLDivElement | null>(null);
  const dashboardTeamRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const dashboardHighlightTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dashboardHighlightTeamId, setDashboardHighlightTeamId] = useState<number | null>(null);
  // League-wide maxima for radar normalization (memoized for smooth animation)
  const teamMaxima = useMemo(() => {
    return nbaTeams.reduce(
      (acc, t) => ({
        pts: Math.max(acc.pts, Number((t as any).PTS || 0)),
        reb: Math.max(acc.reb, Number((t as any).REB || 0)),
        threes: Math.max(acc.threes, Number((t as any).FG3M || 0)),
        ftm: Math.max(acc.ftm, Number((t as any).FTM || 0)),
        blk: Math.max(acc.blk, Number((t as any).BLK || 0)),
      }),
      { pts: 0, reb: 0, threes: 0, ftm: 0, blk: 0 }
    );
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
      return acc;
    },
    { 
      WIN_PCT: 0, PTS: 0, REB: 0, AST: 0, FG_PCT: 0, FG3_PCT: 0, FT_PCT: 0,
      W_PCT: 0, MIN: 0, FGM: 0, FGA: 0, FG3M: 0, FG3A: 0, FTM: 0, FTA: 0,
      OREB: 0, DREB: 0, TOV: 0, STL: 0, BLK: 0, BLKA: 0, PF: 0, PFD: 0,
      PLUS_MINUS: 0
    }
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
}, [nbaPlayerData]);

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

const getLeagueHighlight = (
  player: Player,
  key: keyof Player,
  leagueAverages: Record<string, number> | null
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
  | 'PTS'
  | 'REB'
  | 'AST'
  | 'STL'
  | 'FG_PCT'
  | 'FG3_PCT'
  | 'FT_PCT'
  | 'VALUE_SCORE';

const [playerSortField, setPlayerSortField] = useState<PlayerSortField>('VALUE_SCORE');





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

  // Clamp between 0–100 just in case
  return Math.max(0, Math.min(100, Number(normalized.toFixed(1))));
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
<PageLayout>
      <div className="flex justify-end">
      </div>
      {/* Tabs for Dashboard / All / East / West / Scorers / Schedule */}
      <Tabs
        defaultValue="dashboard"
        className="w-full"
        onValueChange={(v) => {
          setActiveTab(v);
          if (v === 'all' || v === 'Eastern' || v === 'Western') {
            setSelectedConference(v as any);
          }
        }}
      >
        <TabsList className="grid w-full grid-cols-4 mb-6 max-w-none">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="all">All Teams</TabsTrigger>
          <TabsTrigger value="top-scorers">Top Players</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

<TabsContent value="dashboard">
  {/* === Outer Grid === */}
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(103vh-135px)] overflow-hidden -mt-0">
    
    {/* === LEFT COLUMN (2 equal static cards) === */}
    <div className="flex flex-col gap-4 lg:col-span-7 h-full overflow-hidden">
      {/* Top Teams */}
      <Card className="bg-card border w-full flex-1 min-h-0 flex flex-col overflow-hidden">
        <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden p-0">
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
        <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden p-0">
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
        <SelectItem value="WIN_PCT" className="hover:bg-white/10 cursor-pointer">
          Win %
        </SelectItem>
        <SelectItem value="PPG" className="hover:bg-white/10 cursor-pointer">
          PPG
        </SelectItem>
        <SelectItem value="REB" className="hover:bg-white/10 cursor-pointer">
          RPG
        </SelectItem>
        <SelectItem value="AST" className="hover:bg-white/10 cursor-pointer">
          APG
        </SelectItem>
        <SelectItem value="FG_PCT" className="hover:bg-white/10 cursor-pointer">
          FG%
        </SelectItem>
        <SelectItem value="FG3_PCT" className="hover:bg-white/10 cursor-pointer">
          3P%
        </SelectItem>
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
    const teams = sortTeams(nbaTeams);
    const currentTeam = selectedTeamAll || teams[0];
    const teamPlayers: Player[] = currentTeam ? (nbaPlayerData[currentTeam.TEAM_ID.toString()] || []) : [];
    const topTeamPlayers = [...teamPlayers]
      .sort((a, b) => getPlayerValueScore(b) - getPlayerValueScore(a));

    return (
    <div className="flex flex-col xl:flex-row gap-4 h-[85vh] overflow-hidden">
        {/* Left: logos as rounded-square buttons */}
        <div
          ref={logosScrollRef}
          className="w-64 md:w-72 lg:w-80 shrink-0 overflow-y-auto no-scrollbar max-h-[85vh] pr-1 pt-0 pb-7 snap-y snap-mandatory"
          style={{ scrollPaddingTop: '24px', scrollPaddingBottom: '24px' }}
        >
          <div className="grid grid-cols-3 gap-3">
            {teams.map((t) => {
              const isActive = currentTeam && t.TEAM_ID === currentTeam.TEAM_ID;
              return (
                <button
                  key={t.TEAM_ID}
                  onClick={() => setSelectedTeamAll(t)}
                  className={`relative w-full aspect-square rounded-xl overflow-hidden bg-card/70 flex items-center justify-center border snap-start ${
                    isActive
                      ? 'ring-2 ring-inset ring-white/80 border-transparent'
                      : 'border-white/10'
                  }`}
                  title={t.TEAM_NAME}
                >
                  {t.LOGO_URL ? (
                    <img
                      src={t.LOGO_URL}
                      alt={`${t.TEAM_NAME} logo`}
                      className="w-3/5 h-3/5 object-contain"
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
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-4 w-0 pr-0">
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
            const radarLabels = ['PPG', 'RPG', '3PM', 'FTM', 'BLK'];
            const rawValues = {
              PPG: Number(currentTeam.PTS || 0),
              RPG: Number(currentTeam.REB || 0),
              '3PM': Number(currentTeam.FG3M || 0),
              FTM: Number(currentTeam.FTM || 0),
              BLK: Number(currentTeam.BLK || 0),
            } as const;
            const maxs = teamMaxima;
            // Normalize each metric to a common 0–100 scale so categories with different units are comparable
            const norm = (v: number, max: number) => (max > 0 ? (v / max) * 100 : 0);
            const normalizedValues = [
              norm(rawValues.PPG, maxs.pts),
              norm(rawValues.RPG, maxs.reb),
              norm(rawValues['3PM'], maxs.threes),
              norm(rawValues.FTM, maxs.ftm),
              norm(rawValues.BLK, maxs.blk),
            ];
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
              <div className="w-full flex gap-4 items-stretch">
                <div className="w-full xl:w-3/6 xl:w-1/2 mr-auto">
                  <TeamCard
                    team={{ ...currentTeam, rank: (teams.findIndex(tt => tt.TEAM_ID === currentTeam.TEAM_ID) + 1) || 1 }}
                    leagueAverages={leagueAverages}
                    onClick={() => setSelectedTeam(currentTeam)}
                  />
                </div>
                {/* Use the right gap exclusively for the pie chart (xl+) */}
                <div className="hidden xl:block flex-1 min-w-0">
                  <Card className="bg-transparent border-none w-[342px] h-[235px] overflow-hidden">
                    <CardHeader className="py-2 px-3">
                    </CardHeader>
                    <CardContent className="h-[220px] p-1">
                      <Doughnut data={doughnutData} options={doughnutOptions} />
                    </CardContent>
                  </Card>
                </div>
                {/* Spider (Radar) chart on the right of pie (xl+) */}
                <div className="hidden xl:block shrink-0">
                  <Card className="bg-transparent border-none w-[342px] h-[235px] overflow-hidden">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {topTeamPlayers.map((p) => (
                    <Card
                      key={p.PLAYER_ID}
                      className="overflow-hidden bg-card/60 backdrop-blur border snap-start"
                      style={{ scrollMarginTop: '16px', scrollMarginBottom: '16px' }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{p.PLAYER_NAME}</div>
                            <div className="text-xs text-muted-foreground truncate">Value {getPlayerValueScore(p).toFixed(1)}</div>
                          </div>
                        </div>
                        {/* Key stats */}
                        <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                          <div className="bg-background/40 rounded px-2 py-1 text-center">
                            <div className="text-muted-foreground">PPG</div>
                            <div className="font-semibold">{p.PTS.toFixed(1)}</div>
                          </div>
                          <div className="bg-background/40 rounded px-2 py-1 text-center">
                            <div className="text-muted-foreground">RPG</div>
                            <div className="font-semibold">{p.REB.toFixed(1)}</div>
                          </div>
                          <div className="bg-background/40 rounded px-2 py-1 text-center">
                            <div className="text-muted-foreground">APG</div>
                            <div className="font-semibold">{p.AST.toFixed(1)}</div>
                          </div>
                          <div className="bg-background/40 rounded px-2 py-1 text-center">
                            <div className="text-muted-foreground">FG%</div>
                            <div className="font-semibold">{(p.FG_PCT * 100).toFixed(1)}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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

        {/* === Schedule === */}
        <TabsContent value="schedule">
          <ScheduleViewV2 scheduleData={scheduleData} logoMap={abbrToLogo} recordMap={abbrToRecord} />
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
<TabsContent value="top-scorers" className="max-h-[100vh] overflow-y-auto no-scrollbar pb-12 pr-2">

  {/* === Filter Controls === */}
<div className="flex flex-wrap items-center justify-between mb-5 gap-4">
  <div className="flex items-center gap-2">
    <label  className="text-sm font-semibold text-white/80">Rank by:</label>


    <div className="flex items-center gap-2">
      {/* Dropdown */}
      <Select onValueChange={(v) => setPlayerSortField(v as PlayerSortField)} value={playerSortField}>
        <SelectTrigger className={`
  rounded-full px-4 py-2 text-sm font-semibold text-black
  bg-white
  hover:scale-[1.05]
  transition-all duration-300
`}>
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
    onClose={() => setSelectedTeam(null)}
  />
)}
    </PageLayout>
  );
};

export default NBA;

