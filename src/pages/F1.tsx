// ============================
// 🏎️ F1 Dashboard
// Displays F1 drivers, constructors, and race calendar
// ============================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  Card, CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ============================
// 📘 Type Definitions
// ============================

interface F1Race {
  race_number: number;
  race_name: string;
  circuit: string;
  date: string;               // e.g. "March 5 - 7"
  start_time_west: string;    // e.g. "March 07 at 8:00 pm PST"
  tv_provider: string;
  track_svg: string;
  urls: {
    race_page: string;
    circuit_info: string;
    results: string;
  };
}

interface F1Team {
  [key: string]: any;
}

// ============================
// 🗓️ Date parsing helpers
// ============================

const MONTH_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

// Parse "March 5 - 7" → "2025-03-07"  (race-day end date)
function parseRaceEndDate(dateStr: string): string {
  try {
    const parts = dateStr.trim().split(/\s+/);
    const month = MONTH_MAP[parts[0].toLowerCase()];
    const endDay = parseInt(parts[parts.length - 1], 10);
    const year = new Date().getFullYear();
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(endDay).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  } catch {
    return '2025-01-01';
  }
}

function formatRaceDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}


// ============================
// 🗺️ InlineSvg — fetches SVG, strips elevation graph + labels, renders inline
// ============================

const InlineSvg = ({ url, className }: { url: string; className?: string }) => {
  const [svgContent, setSvgContent] = React.useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => r.text())
      .then((raw) => {
        if (cancelled) return;
        const parser = new DOMParser();
        const doc = parser.parseFromString(raw, 'image/svg+xml');
        const svg = doc.querySelector('svg');
        if (!svg) return;

        // Remove all text/tspan and related elements
        svg.querySelectorAll('text, tspan, flowRoot, flowPara, flowDiv, flowSpan, foreignObject').forEach((el) => el.remove());

        // Remove any <g> that contained text (now empty or near-empty after text removal)
        svg.querySelectorAll('g').forEach((g) => {
          // Remove groups that are now empty
          if (g.children.length === 0) { g.remove(); return; }
          // Remove groups whose only remaining children are rect/path with no fill or white fill
          // (these are label backgrounds left over after text was stripped)
          const children = Array.from(g.children);
          const allBackground = children.every((c) => {
            const tag = c.tagName.toLowerCase();
            const fill = c.getAttribute('fill') || '';
            return (tag === 'rect' || tag === 'path') && /^(#fff|#ffffff|white|none|transparent)$/i.test(fill.trim());
          });
          if (allBackground) g.remove();
        });

        // Remove groups positioned in top-right via transform (ESPN label groups often use translate)
        svg.querySelectorAll('g[transform]').forEach((g) => {
          const transform = g.getAttribute('transform') || '';
          const match = transform.match(/translate\(\s*([\d.]+)\s*,\s*([\d.]+)/);
          if (match) {
            const vb = svg.getAttribute('viewBox')?.split(/\s+/).map(Number) || [0, 0, 800, 600];
            const svgW = vb[2] || 800;
            const svgH = vb[3] || 600;
            const x = parseFloat(match[1]);
            const y = parseFloat(match[2]);
            // If group starts in the top-right quadrant, remove it
            if (x > svgW * 0.5 && y < svgH * 0.35) g.remove();
          }
        });

        // Remove elements whose id/class hints at elevation, chart, legend etc.
        ['elevation', 'profile', 'legend', 'axis', 'chart', 'graph', 'label'].forEach((kw) => {
          svg.querySelectorAll(`[id*="${kw}"], [class*="${kw}"]`).forEach((el) => el.remove());
        });

        // Remove the last top-level <g> if it looks like an elevation profile
        // (has polylines/lines but few complex paths — typical of the bottom graph strip)
        const topGs = Array.from(svg.children).filter((el) => el.tagName === 'g');
        if (topGs.length > 1) {
          const last = topGs[topGs.length - 1];
          const pathCount = last.querySelectorAll('path').length;
          const hasPolyline = !!last.querySelector('polyline, polygon, line');
          if (hasPolyline && pathCount < 5) last.remove();
        }

        // Make SVG fully responsive — remove fixed w/h, keep viewBox for scaling
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        // Ensure transparent background
        svg.setAttribute('style', (svg.getAttribute('style') || '') + '; background: transparent;');

        if (!cancelled) setSvgContent(svg.outerHTML);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url]);

  if (!svgContent) return null;
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: svgContent }}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}
    />
  );
};

// ============================
const TV_PROVIDER_STYLES: Record<string, React.CSSProperties> = {
  'apple tv': { backgroundColor: '#6e6e73', color: '#ffffff' },
  'espn':     { backgroundColor: '#C8102E', color: '#ffffff' },
  'abc':      { backgroundColor: '#111111', color: '#ffffff' },
  'nbc':      { backgroundColor: '#0057A8', color: '#ffffff' },
  'fox':      { backgroundColor: '#003366', color: '#ffffff' },
};

function getTvStyle(provider: string): React.CSSProperties {
  const key = provider.toLowerCase();
  for (const [k, v] of Object.entries(TV_PROVIDER_STYLES)) {
    if (key.includes(k)) return v;
  }
  return { backgroundColor: '#333', color: '#fff' };
}

// ============================
// 🏎️ RaceCalendarNavigator — left panel of Dashboard
// ============================

const RaceCalendarNavigator = ({ races }: { races: F1Race[] }) => {
  // Build sorted entries with parsed date keys
  const racesWithKeys = useMemo(() => {
    return races
      .map((r) => ({ race: r, dateKey: parseRaceEndDate(r.date) }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [races]);

  const dateKeys = useMemo(() => racesWithKeys.map((r) => r.dateKey), [racesWithKeys]);
  const raceDateSet = useMemo(() => new Set(dateKeys), [dateKeys]);

  const todayKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  // Start at the next upcoming race
  const initialIndex = useMemo(() => {
    if (dateKeys.length === 0) return 0;
    const idx = dateKeys.findIndex((k) => k >= todayKey);
    return idx >= 0 ? idx : dateKeys.length - 1;
  }, [dateKeys, todayKey]);

  const [index, setIndex] = useState(initialIndex);
  useEffect(() => { setIndex(initialIndex); }, [initialIndex]);

  // Calendar popup state
  const calendarRef = useRef<HTMLDivElement>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number } | null>(null);

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

  if (racesWithKeys.length === 0) {
    return <div className="text-sm text-muted-foreground">No race data available.</div>;
  }

  const clamp = (n: number) => Math.max(0, Math.min(racesWithKeys.length - 1, n));
  const currentEntry = racesWithKeys[clamp(index)];
  const currentKey = currentEntry.dateKey;
  const race = currentEntry.race;
  const isUpcoming = currentKey >= todayKey;

  const openCalendar = () => {
    const [y, m] = currentKey.split('-').map(Number);
    setCalendarMonth({ year: y, month: m });
    setShowCalendar(true);
  };

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
    if (!raceDateSet.has(key)) return;
    const idx = dateKeys.indexOf(key);
    if (idx >= 0) setIndex(idx);
    setShowCalendar(false);
  };

  const calGrid = calendarMonth ? buildCalendarGrid(calendarMonth.year, calendarMonth.month) : [];
  const calMonthLabel = calendarMonth
    ? new Date(calendarMonth.year, calendarMonth.month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="flex flex-col h-full space-y-3">

      {/* ── Date navigator header ── */}
      <div className="relative flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIndex((i) => clamp(i - 1))}
          disabled={index <= 0}
          className="rounded-full"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <span className="text-lg font-semibold">{formatRaceDateLabel(currentKey)}</span>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIndex((i) => clamp(i + 1))}
          disabled={index >= racesWithKeys.length - 1}
          className="rounded-full"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>

        {/* Calendar icon + popup */}
        <div className="absolute right-0" ref={calendarRef}>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-transparent"
            onClick={openCalendar}
            aria-label="Pick a race weekend"
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
              className="absolute top-11 right-0 z-50 rounded-2xl border border-white/10 shadow-2xl p-4 w-72"
              style={{ backgroundColor: '#1a1a1a' }}
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
                <span className="text-sm font-bold text-white tracking-wide">{calMonthLabel}</span>
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
              <div className="grid grid-cols-7 mb-1">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                  <div key={d} className="text-center text-[10px] font-bold text-white/30 py-1">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-y-1">
                {calGrid.map((key, i) => {
                  if (!key) return <div key={`empty-${i}`} />;
                  const hasRace = raceDateSet.has(key);
                  const isSelected = key === currentKey;
                  const isToday = key === todayKey;
                  const dayNum = parseInt(key.split('-')[2], 10);
                  return (
                    <button
                      key={key}
                      onClick={() => handleCalendarDayClick(key)}
                      disabled={!hasRace}
                      className={`
                        relative flex items-center justify-center rounded-lg text-xs font-bold h-8 w-full transition-all duration-150
                        ${isSelected
                          ? 'bg-white text-black shadow-lg'
                          : hasRace
                          ? 'text-white hover:bg-white/15 cursor-pointer'
                          : 'text-white/20 cursor-default'}
                      `}
                    >
                      {dayNum}
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

      {/* ── Race Card ── */}
      <Card
        className="relative overflow-hidden rounded-2xl border border-white/10 cursor-pointer hover:ring-2 hover:ring-white/20 transition-all duration-300 flex-1 min-h-0 flex flex-col"
        onClick={() => window.open(race.urls.race_page, '_blank', 'noopener,noreferrer')}
      >
        {/* Dark card background */}
        <div className="absolute inset-0" style={{ background: '#141414' }} />

        {/* TV Provider — top right */}
        {race.tv_provider && (
          <div className="absolute top-3 right-3 z-10">
            <Badge className="text-[10px] font-bold px-2 py-0.5" style={getTvStyle(race.tv_provider)}>
              {race.tv_provider}
            </Badge>
          </div>
        )}

        {/* Text — top of card */}
        <div className="relative z-10 p-4 pb-2 flex-shrink-0">
          <span className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: '#e10600' }}>
            Round {race.race_number}
          </span>

          <div className="flex items-start gap-2 mt-0.5">
            <h2 className="text-lg font-extrabold text-white leading-tight flex-1">
              {race.race_name}
            </h2>
            <Badge
              className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 mt-0.5"
              style={isUpcoming ? { backgroundColor: '#e10600', color: '#ffffff' } : { backgroundColor: '#2a2a2a', color: '#888' }}
            >
              {isUpcoming ? 'Upcoming' : 'Completed'}
            </Badge>
          </div>

          <p className="text-xs text-white/50 mt-0.5">{race.circuit}</p>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] font-semibold text-white/60">{race.date}</span>
            <span className="text-white/20 text-xs">·</span>
            <span className="text-[11px] font-semibold text-white/60">{race.start_time_west}</span>
          </div>
        </div>

        {/* SVG — fills from 1/3 down the card to the bottom */}
        <style>{`.f1-svg-wrap svg { width: 100% !important; height: 100% !important; display: block; }`}</style>
        <div className="f1-svg-wrap absolute z-10" style={{ top: '28%', left: '-10%', right: '-10%', bottom: '-10%' }}>
          <InlineSvg
            url={race.track_svg}
            className="w-full h-full"
          />
        </div>

      </Card>
    </div>
  );
};


// ============================
// 🏎️ Main F1 Component
// ============================

const F1 = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [calendarData, setCalendarData] = useState<F1Race[]>([]);
  const [teamsData, setTeamsData] = useState<F1Team[]>([]);
  const [loading, setLoading] = useState(true);

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 && window.innerHeight > window.innerWidth
  );
  useEffect(() => {
    const check = () =>
      setIsMobile(window.innerWidth < 640 && window.innerHeight > window.innerWidth);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [calendarRes, teamsRes] = await Promise.all([
          fetch('/data/f1_calendar.json'),
          fetch('/data/f1_teams.json'),
        ]);
        if (calendarRes.ok) {
          const calJson = await calendarRes.json();
          setCalendarData(Array.isArray(calJson) ? calJson : []);
        }
        if (teamsRes.ok) {
          const teamsJson = await teamsRes.json();
          setTeamsData(Array.isArray(teamsJson) ? teamsJson : []);
        }
      } catch (err) {
        console.error('Failed to load F1 data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

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

  return (
    <PageLayout theme="f1">
      <Tabs
        theme="f1"
        value={activeTab}
        className="w-full"
        onValueChange={(v) => setActiveTab(v)}
      >
        {/* ── Tab Bar ── */}
        <TabsList className="grid py-2 px-2 w-full grid-cols-4 max-w-none mb-4 gap-2 -mt-1 -ml-2 pl-32">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="constructors">Constructors</TabsTrigger>
          <TabsTrigger value="races">Races</TabsTrigger>
        </TabsList>

        {/* ========================
            TAB: Dashboard
        ======================== */}
        <TabsContent value="dashboard" className="mt-0">
          <div
            className="flex flex-col gap-4"
            style={{ height: 'calc(100vh - 8rem)' }}
          >
            {/* ── Top row: Left calendar + Right panel ── */}
            <div className="flex gap-4 min-h-0" style={{ flex: '1 1 0' }}>

              {/* Left: Race Calendar — fixed size always */}
              <div className="flex flex-col min-h-0 overflow-hidden flex-shrink-0" style={{ width: '600px' }}>
                {loading ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    Loading races…
                  </div>
                ) : (
                  <RaceCalendarNavigator races={calendarData} />
                )}
              </div>

              {/* Right: fills remaining width */}
              <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center min-w-0">
                <span className="text-sm text-muted-foreground">Right panel coming soon</span>
              </div>

            </div>

            {/* ── Bottom: full-width section ── */}
            <div
              className="rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center flex-shrink-0"
              style={{ height: '200px' }}
            >
              <span className="text-sm text-muted-foreground">Bottom panel coming soon</span>
            </div>
          </div>
        </TabsContent>

        {/* ========================
            TAB: Drivers
        ======================== */}
        <TabsContent value="drivers">
          {/* Coming soon */}
        </TabsContent>

        {/* ========================
            TAB: Constructors
        ======================== */}
        <TabsContent value="constructors">
          {/* Coming soon */}
        </TabsContent>

        {/* ========================
            TAB: Races
        ======================== */}
        <TabsContent value="races">
          {/* Coming soon */}
        </TabsContent>

      </Tabs>
    </PageLayout>
  );
};

export default F1;