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
  track_svg_extracted?: string;
  session_times?: Record<string, string>; // e.g. { "Race": "March 15 at 12:00 AM PST", ... }
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

// Build "Fri, March 13 – Sun, March 15" from session_times
function getWeekendRange(race: { session_times?: Record<string, string>; date: string }): string {
  const sessions = race.session_times ?? {};
  const dates: Date[] = [];
  const year = new Date().getFullYear();

  // Parse "March 13 at 12:00 AM PDT" -> Date
  for (const val of Object.values(sessions)) {
    const m = val.match(/^([A-Za-z]+ \d+) at /);
    if (!m) continue;
    try {
      const d = new Date(`${m[1]} ${year}`);
      if (!isNaN(d.getTime())) dates.push(d);
    } catch {}
  }

  if (dates.length < 2) return race.date; // fallback to raw string

  dates.sort((a, b) => a.getTime() - b.getTime());
  const first = dates[0];
  const last  = dates[dates.length - 1];

  const fmt = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });
  return `${fmt(first)} – ${fmt(last)}`;
}

// Parse "March 15 at 12:00 AM PDT" -> Date object (treated as local time)
function parseSessionTime(timeStr: string): Date | null {
  try {
    // Strip timezone suffix e.g. " PDT", " PST"
    const clean = timeStr.replace(/\s+P[SD]T$/, '').trim();
    // clean = "March 15 at 12:00 AM"
    const m = clean.match(/^([A-Za-z]+ \d+) at (\d+:\d+ [AP]M)$/);
    if (!m) return null;
    const year = new Date().getFullYear();
    const d = new Date(`${m[1]} ${year} ${m[2]}`);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

// Given session_times, return the next upcoming session from the card sessions
// (SQ, SPR, QUAL, RACE only — not practice), or null if all passed
function getNextCardSession(race: F1Race): { label: string; date: Date } | null {
  const st = race.session_times ?? {};
  const hasSprint = !!(st['Sprint Race'] || st['Sprint']);
  const sessions = hasSprint
    ? [
        { label: 'SQ',   time: st['Sprint'] ?? st['Sprint Qualifying'] },
        { label: 'SPR',  time: st['Sprint Race'] },
        { label: 'QUAL', time: st['Qualifying'] },
        { label: 'RACE', time: st['Race'] },
      ]
    : [
        { label: 'QUAL', time: st['Qualifying'] },
        { label: 'RACE', time: st['Race'] ?? race.start_time_west },
      ];

  const now = new Date();
  for (const s of sessions) {
    if (!s.time) continue;
    const d = parseSessionTime(s.time);
    if (d && d > now) return { label: s.label, date: d };
  }
  return null;
}

function useSessionCountdown(race: F1Race) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  const next = getNextCardSession(race);
  if (!next) return null;

  const diff = Math.max(0, next.date.getTime() - Date.now());
  const totalSecs = Math.floor(diff / 1_000);
  const days  = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins  = Math.floor((totalSecs % 3600) / 60);
  const secs  = totalSecs % 60;
  return { label: next.label, days, hours, mins, secs };
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

        // Remove any <g> that contained only label background rects (left over after text removal)
        svg.querySelectorAll('g').forEach((g) => {
          if (g.children.length === 0) { g.remove(); return; }
          const children = Array.from(g.children);
          // Only remove groups whose children are ALL rects (label boxes), not paths (track geometry)
          const allLabelRects = children.every((c) =>
            c.tagName.toLowerCase() === 'rect'
          );
          if (allLabelRects) g.remove();
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

        // Force white stroke on all track elements as attributes (beats inline style overrides)
        svg.querySelectorAll('path, polyline, polygon, circle, ellipse, line, rect').forEach((el) => {
          el.setAttribute('fill', 'none');
          el.setAttribute('stroke', '#ffffff');
          el.setAttribute('stroke-width', '1.5');
          // Clear any inline style that might override CSS
          el.removeAttribute('style');
        });

        // Inject style to make all paths thin, white, and glowing
        // Scoped to .f1-track-svg to avoid bleeding into other SVGs (e.g. Lucide icons)
        svg.classList.add('f1-track-svg');
        const styleEl = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
        styleEl.textContent = `
          .f1-track-svg path, .f1-track-svg polyline, .f1-track-svg polygon,
          .f1-track-svg circle, .f1-track-svg ellipse, .f1-track-svg line, .f1-track-svg rect {
            fill: none !important;
            stroke: #ffffff !important;
            stroke-width: 1.5 !important;
          }
          .f1-teal-strip {
            fill: none !important;
            stroke: #00e5cc !important;
            stroke-width: 3 !important;
          }
          @keyframes f1-dash {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: var(--f1-track-len); }
          }
          .f1-teal-strip {
            animation: f1-dash var(--f1-anim-dur, 35s) linear infinite;
            will-change: stroke-dashoffset;
          }
        `;
        svg.insertBefore(styleEl, svg.firstChild);

        // Find the longest path to use as the motion track
        const allPaths = Array.from(svg.querySelectorAll('path'));
        const trackPath = allPaths.reduce((longest, p) =>
          (p.getTotalLength?.() ?? 0) > (longest.getTotalLength?.() ?? 0) ? p : longest
        , allPaths[0]);

        if (trackPath) {
          const totalLen = trackPath.getTotalLength?.() ?? 500;
          const stripLen = totalLen * 0.08;
          const gap = totalLen * 10;

          const strip = trackPath.cloneNode() as SVGPathElement;
          strip.setAttribute('class', 'f1-teal-strip');
          strip.setAttribute('stroke-dasharray', `${stripLen} ${gap}`);
          strip.setAttribute('stroke-dashoffset', '0');
          strip.style.setProperty('--f1-track-len', `-${totalLen}`);
          strip.removeAttribute('id');
          svg.appendChild(strip);
        }

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
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', willChange: 'transform', filter: 'drop-shadow(0 0 4px #ffffff88) drop-shadow(0 0 8px #ffffff44)' }}
    />
  );
};

// ============================
// 🗺️ ExtractedSvg — renders pre-extracted SVG string directly (no fetch needed)
// ============================

const ExtractedSvg = ({ svgString, className }: { svgString: string; className?: string }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  const glowStyle = `<style>
    .f1-track-svg path, .f1-track-svg polyline, .f1-track-svg polygon,
    .f1-track-svg circle, .f1-track-svg ellipse, .f1-track-svg line, .f1-track-svg rect {
      fill: none !important;
      stroke: #ffffff !important;
      stroke-width: 1.5 !important;
    }
    .f1-teal-strip {
      fill: none !important;
      stroke: #00e5cc !important;
      stroke-width: 3 !important;
      animation: f1-dash var(--f1-anim-dur, 35s) linear infinite;
      will-change: stroke-dashoffset;
    }
    @keyframes f1-dash {
      from { stroke-dashoffset: 0; }
      to { stroke-dashoffset: var(--f1-track-len); }
    }
  </style>`;

  const processed = svgString
    .replace(/(<svg[^>]*)\s+width="[^"]*"/, '$1')
    .replace(/(<svg[^>]*)\s+height="[^"]*"/, '$1')
    .replace(/<svg([^>]*)>/, `<svg$1 class="f1-track-svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${glowStyle}`);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    const allPaths = Array.from(svg.querySelectorAll('path'));
    if (!allPaths.length) return;
    const trackPath = allPaths.reduce((longest, p) =>
      (p.getTotalLength?.() ?? 0) > (longest.getTotalLength?.() ?? 0) ? p : longest
    , allPaths[0]);

    if (!trackPath) return;

    const totalLen = trackPath.getTotalLength?.() ?? 500;
    const stripLen = totalLen * 0.08;
    const gap = totalLen * 10;

    const strip = trackPath.cloneNode() as SVGPathElement;
    strip.setAttribute('class', 'f1-teal-strip');
    strip.setAttribute('stroke-dasharray', `${stripLen} ${gap}`);
    strip.setAttribute('stroke-dashoffset', '0');
    strip.style.setProperty('--f1-track-len', `-${totalLen}`);
    strip.removeAttribute('id');
    svg.appendChild(strip);

    return () => { strip.remove(); };
  }, [processed]);

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: processed }}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', willChange: 'transform', filter: 'drop-shadow(0 0 4px #ffffff88) drop-shadow(0 0 8px #ffffff44)' }}
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
// ⏱️ SessionCountdown
// ============================
const SessionCountdown = ({ race, isMobile = false }: { race: F1Race; isMobile?: boolean }) => {
  const cd = useSessionCountdown(race);
  if (!cd) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-lg font-semibold" style={{ color: '#2dd4bf' }}>{cd.label === 'QUAL' ? 'Q' : cd.label}</span>
      <span className="text-lg font-semibold text-white tabular-nums">
        {String(cd.days).padStart(2, '0')} : {String(cd.hours).padStart(2, '0')} : {String(cd.mins).padStart(2, '0')} : {String(cd.secs).padStart(2, '0')}
      </span>
    </div>
  );
};


// ============================
// 🏎️ RaceCalendarNavigator — left panel of Dashboard
// ============================

const RaceCalendarNavigator = ({ races, isMobile = false, teamsData = [] }: { races: F1Race[]; isMobile?: boolean; teamsData?: F1Team[] }) => {
  // Build sorted entries with parsed date keys
  const racesWithKeys = useMemo(() => {
    return races
      .filter((r) => r.start_time_west !== 'Canceled')
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

  // Results modal state
  const [resultsModal, setResultsModal] = useState<F1Race | null>(null);

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

  // ── Shared nav header (used both on desktop and as sticky on mobile) ──
  const navHeader = (
    <div
      className={`relative flex items-center${isMobile ? ' pl-16 pr-10 sticky top-0 z-30 backdrop-blur-md bg-background/80 flex-nowrap justify-between' : ' gap-3'}`}
      style={isMobile ? { paddingTop: '26px', paddingBottom: '14px' } : undefined}
    >
      {/* Left: arrows + race number */}
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setIndex((i) => clamp(i - 1))} disabled={index <= 0} className="rounded-full">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="text-lg font-semibold whitespace-nowrap">Race {race.race_number}</span>
        <Button variant="ghost" size="icon" onClick={() => setIndex((i) => clamp(i + 1))} disabled={index >= racesWithKeys.length - 1} className="rounded-full">
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Countdown — inline on mobile, absolutely centered on desktop */}
      {isMobile ? (
        <div className="shrink-0">
          <SessionCountdown race={race} isMobile={isMobile} />
        </div>
      ) : (
        <div className="absolute left-1/2 -translate-x-1/2">
          <SessionCountdown race={race} isMobile={isMobile} />
        </div>
      )}

      {/* Calendar icon + popup */}
      <div className="absolute right-0" ref={calendarRef}>
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent" onClick={openCalendar} aria-label="Pick a race weekend">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </Button>

        {showCalendar && calendarMonth && (
          <div className="absolute top-11 right-0 z-50 rounded-2xl border border-white/10 shadow-2xl p-4 w-72" style={{ backgroundColor: '#1a1a1a' }}>
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button className="p-1 rounded-full hover:bg-white/10 transition-colors text-white/70 hover:text-white"
                onClick={() => setCalendarMonth(({ year: y, month: m }) => { const d = new Date(y, m - 2, 1); return { year: d.getFullYear(), month: d.getMonth() + 1 }; })}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-white tracking-wide">{calMonthLabel}</span>
              <button className="p-1 rounded-full hover:bg-white/10 transition-colors text-white/70 hover:text-white"
                onClick={() => setCalendarMonth(({ year: y, month: m }) => { const d = new Date(y, m, 1); return { year: d.getFullYear(), month: d.getMonth() + 1 }; })}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div key={d} className="text-center text-[10px] font-bold text-white/30 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {calGrid.map((key, i) => {
                if (!key) return <div key={`empty-${i}`} />;
                const hasRace = raceDateSet.has(key);
                const isSelected = key === currentKey;
                const isToday = key === todayKey;
                const dayNum = parseInt(key.split('-')[2], 10);
                return (
                  <button key={key} onClick={() => handleCalendarDayClick(key)} disabled={!hasRace}
                    className={`relative flex items-center justify-center rounded-lg text-xs font-bold h-8 w-full transition-all duration-150
                      ${isSelected ? 'bg-white text-black shadow-lg' : hasRace ? 'text-white hover:bg-white/15 cursor-pointer' : 'text-white/20 cursor-default'}`}>
                    {dayNum}
                    {isToday && !isSelected && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/70" />}
                    {isToday && isSelected && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-black" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── Mobile layout: sticky header + scrollable dashboard content ──
  if (isMobile) {
    return (
      <div className="flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
        {navHeader}

        <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
          {/* Race info card */}
          <Card
            className="relative overflow-hidden rounded-2xl border border-white/10 cursor-pointer hover:ring-2 hover:ring-white/20 transition-all duration-300 mx-0 mb-3"
            onClick={() => setResultsModal(race)}
          >
            <div className="absolute inset-0" style={{ background: '#141414' }} />
            <div className="relative z-10 px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex flex-col justify-start min-w-0 gap-1">
                <h2 className="text-xl font-extrabold text-white leading-tight truncate">{race.race_name}</h2>
                <p className="text-sm font-bold text-white/50 leading-tight truncate">{race.circuit}</p>
                <p className="text-xs font-medium text-white/30 leading-tight">{race.date}</p>
              </div>
              {(() => {
                const st = race.session_times ?? {};
                const hasSprint = !!(st['Sprint Race'] || st['Sprint']);
                const badges = hasSprint
                  ? [{ label: 'SQ', time: st['Sprint'] ?? st['Sprint Qualifying'] }, { label: 'SPR', time: st['Sprint Race'] }, { label: 'QUAL', time: st['Qualifying'] }, { label: 'RACE', time: st['Race'] }]
                  : [{ label: 'QUAL', time: st['Qualifying'] }, { label: 'RACE', time: st['Race'] ?? race.start_time_west }];
                const visibleBadges = badges.filter(b => b.time);
                if (!visibleBadges.length) return null;
                return (
                  <div className="flex-shrink-0 flex flex-col gap-1 items-end">
                    {visibleBadges.map(({ label, time }) => {
                      const datePart = time?.match(/^([A-Za-z]+ \d+) at /)?.[1] ?? '';
                      const timePart = time?.replace(/^[A-Za-z]+ \d+ at /, '') ?? '';
                      return (
                        <div key={label} className="flex items-center gap-1">
                          <span className="text-[10px] font-black tracking-wider" style={{ color: '#2dd4bf' }}>{label}</span>
                          <span className="text-[10px] font-semibold text-white">{datePart}</span>
                          <span className="text-[10px] font-medium text-white/70">{timePart}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </Card>

          {/* Track SVG */}
          <Card className="relative overflow-hidden rounded-2xl border border-white/10 mb-3 mx-0" style={{ height: '240px' }}>
            <div className="absolute inset-0" style={{ background: '#141414' }} />
            <style>{`.f1-svg-wrap svg { width: 100% !important; height: 100% !important; display: block; }`}</style>
            <div className="f1-svg-wrap absolute inset-0" style={{ transform: 'scale(1.1) translateY(10%)', transformOrigin: 'center center' }}>
              {race.track_svg_extracted
                ? <ExtractedSvg svgString={race.track_svg_extracted} className="w-full h-full" />
                : <InlineSvg url={race.track_svg} className="w-full h-full" />
              }
            </div>
          </Card>

          {/* Driver standings — top 6 */}
          {(() => {
            const allDrivers = teamsData.flatMap((team) =>
              (team.drivers ?? []).map((d: any) => ({ ...d, teamColour: team.colour ?? '#ffffff' }))
            ).filter((d: any) => d.points != null).sort((a: any, b: any) => b.points - a.points).slice(0, 6);
            if (!allDrivers.length) return null;
            return (
              <div className="mb-3">
                <p className="text-xs font-black tracking-widest text-white/30 uppercase mb-2 px-1">Drivers</p>
                <div className="grid grid-cols-2 gap-2">
                  {allDrivers.map((driver: any, index: number) => {
                    const accent = driver.teamColour;
                    const lastName = driver.name.split(' ').slice(1).join(' ') || driver.name;
                    return (
                      <div key={driver.name} className="relative rounded-xl overflow-hidden" style={{ backgroundImage: `linear-gradient(300deg, ${accent}, ${accent}99)`, padding: '3px' }}>
                        <div className="absolute inset-[3px] rounded-xl" style={{ backgroundColor: '#141414' }} aria-hidden />
                        <div className="relative z-10 flex items-center justify-between px-3 h-12">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black text-white/40">#{index + 1}</span>
                            <span className="text-sm font-black text-white uppercase tracking-wide">{lastName}</span>
                          </div>
                          <span className="text-xl font-black text-white leading-none">
                            {driver.points}<span className="text-[10px] font-semibold text-white/40 ml-1">PTS</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Constructor standings — top 6 */}
          {(() => {
            const sortedTeams = [...teamsData].sort((a, b) => (b.team_points ?? 0) - (a.team_points ?? 0)).slice(0, 6);
            if (!sortedTeams.length) return null;
            return (
              <div className="mb-3">
                <p className="text-xs font-black tracking-widest text-white/30 uppercase mb-2 px-1">Constructors</p>
                <div className="grid grid-cols-2 gap-2">
                  {sortedTeams.map((team: any, index: number) => {
                    const accent = team.colour ?? '#ffffff';
                    return (
                      <div key={team.name} className="relative rounded-xl overflow-hidden" style={{ backgroundImage: `linear-gradient(300deg, ${accent}, ${accent}99)`, padding: '3px' }}>
                        <div className="absolute inset-[3px] rounded-xl" style={{ backgroundColor: '#141414' }} aria-hidden />
                        <div className="relative z-10 flex items-center justify-between px-3 h-12">
                          <div className="flex items-center gap-2">
                            {team.logo_url && <img src={team.logo_url} alt="" className="w-5 h-5 object-contain" loading="lazy" />}
                            <div className="flex flex-col">
                              <span className="text-[11px] font-black text-white/40">#{index + 1}</span>
                              <span className="text-sm font-black text-white truncate max-w-[80px]">{team.name}</span>
                            </div>
                          </div>
                          <span className="text-xl font-black text-white leading-none">
                            {team.team_points ?? 0}<span className="text-[10px] font-semibold text-white/40 ml-1">PTS</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ── Desktop layout (unchanged) ──
  return (
    <div className="flex flex-col h-full space-y-3">

      {/* ── Date navigator header ── */}
      <div className="relative flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIndex((i) => clamp(i - 1))}
            disabled={index <= 0}
            className="rounded-full"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <span className="text-lg font-semibold">Race {race.race_number}</span>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIndex((i) => clamp(i + 1))}
            disabled={index >= racesWithKeys.length - 1}
            className="rounded-full"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2">
          <SessionCountdown race={race} />
        </div>

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

      {/* ── Top Card (1/4): Race info + session times ── */}
      <Card
        className="relative overflow-hidden rounded-2xl border border-white/10 cursor-pointer hover:ring-2 hover:ring-white/20 transition-all duration-300 flex-shrink-0 flex flex-col justify-center"
        style={{ flex: '1 0 0', maxHeight: '25%' }}
        onClick={() => setResultsModal(race)}
      >
        <div className="absolute inset-0" style={{ background: '#141414' }} />
        <div className="relative z-10 px-4 py-3 flex items-center justify-between gap-4 h-full">

          {/* Left: race name + circuit + date range */}
          <div className="flex flex-col justify-start min-w-0 h-full pt-2 gap-1">
            <h2 className="text-2xl font-extrabold text-white leading-tight truncate">
              {race.race_name}
            </h2>
            <p className="text-base font-bold text-white/50 leading-tight truncate">{race.circuit}</p>
            <p className="text-xs font-medium text-white/30 leading-tight">{race.date}</p>
          </div>

          {/* Right: session times as inline badges */}
          {(() => {
            const st = race.session_times ?? {};
            const hasSprint = !!(st['Sprint Race'] || st['Sprint']);
            const badges = hasSprint
              ? [
                  { label: 'SQ',   time: st['Sprint'] ?? st['Sprint Qualifying'] },
                  { label: 'SPR',  time: st['Sprint Race'] },
                  { label: 'QUAL', time: st['Qualifying'] },
                  { label: 'RACE', time: st['Race'] },
                ]
              : [
                  { label: 'QUAL', time: st['Qualifying'] },
                  { label: 'RACE', time: st['Race'] ?? race.start_time_west },
                ];

            const visibleBadges = badges.filter(b => b.time);
            if (!visibleBadges.length) return null;

            return (
              <div className="flex-shrink-0 flex flex-col gap-1.5 items-end">
                {visibleBadges.map(({ label, time }) => {
                  const datePart = time?.match(/^([A-Za-z]+ \d+) at /)?.[1] ?? '';
                  const timePart = time?.replace(/^[A-Za-z]+ \d+ at /, '') ?? '';
                  return (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className="text-[11px] font-black tracking-wider" style={{ color: '#2dd4bf' }}>{label}</span>
                      <span className="text-[11px] font-semibold text-white">{datePart}</span>
                      <span className="text-[11px] font-medium text-white">{timePart}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </Card>

      {/* ── Bottom Card (3/4): Track SVG ── */}
      <Card
        className="relative overflow-hidden rounded-2xl border border-white/10 flex-1 min-h-0"
        style={{ flex: '3 0 0' }}
      >
        <div className="absolute inset-0" style={{ background: '#141414' }} />
        <style>{`.f1-svg-wrap svg { width: 100% !important; height: 100% !important; display: block; }`}</style>
        <div className="f1-svg-wrap absolute inset-0" style={{ transform: 'scale(1.1) translateY(10%)', transformOrigin: 'center center' }}>
          {race.track_svg_extracted
            ? <ExtractedSvg svgString={race.track_svg_extracted} className="w-full h-full" />
            : <InlineSvg url={race.track_svg} className="w-full h-full" />
          }
        </div>
      </Card>

      {/* Results Modal */}
      {resultsModal && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={() => setResultsModal(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div
            className="relative bg-zinc-900 rounded-2xl w-full max-w-[95vw] h-[95vh] flex flex-col shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <span className="text-white font-bold text-sm">{resultsModal.race_name} — Results</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open(resultsModal.urls.results, '_blank', 'noopener,noreferrer')}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Open on F1.com
                </button>
                <button
                  onClick={() => setResultsModal(null)}
                  className="bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg p-2 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 rotate-[-90deg]" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-white rounded-b-2xl">
              <iframe
                src={resultsModal.urls.results}
                className="w-full h-full border-0"
                title={`${resultsModal.race_name} Results`}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


// ============================
// 🏎️ DriversTab Component
// ============================

// Standard F1 points → finishing position
// Includes sprint (8/7/6/5/4/3/2/1), fastest lap bonus (1pt), and DNF/DNS (null)
const PTS_TO_POS: Record<number, string> = {
  25: '1st', 18: '2nd', 15: '3rd', 12: '4th', 10: '5th',
   8: '6th',  6: '7th',  4: '8th',  2: '9th',  1: '10th',
};
// Sprint points overlap with regular points so we can't distinguish perfectly,
// but for the main race grid this is accurate for P1-P10, anything else is P11+
function ptsToPos(pts: number | null): string {
  if (pts === null) return '—';
  if (pts === 0) return 'P11+';
  return PTS_TO_POS[pts] ?? `${pts}pts`; // fallback shows raw pts if unexpected value
}

const DriversTab = ({ teamsData, calendarData = [] }: { teamsData: F1Team[]; calendarData?: any[] }) => {
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(true);
  const [showPositions, setShowPositions] = useState(true);
  const [numCols, setNumCols] = useState(typeof window !== 'undefined' && window.innerWidth >= 1024 ? 4 : 2);

  useEffect(() => {
    const update = () => setNumCols(window.innerWidth >= 1024 ? 4 : 2);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Build position lookup: driverName -> raceAbbrev -> { pos, sprintPos }
  // Race abbreviations come from the driver's race_points keys.
  // We match calendar races (which have results[]) to abbreviations by order —
  // both ESPN standings columns and calendar races are in chronological order.
  const positionMap = useMemo(() => {
    const completedRaces = calendarData
      .filter((r: any) => Array.isArray(r.results) && r.results.length > 0)
      .sort((a: any, b: any) => a.race_number - b.race_number);

    // Get ordered race abbreviations from the first driver with race_points
    const firstDriverWithPoints = teamsData
      .flatMap((t: any) => t.drivers ?? [])
      .find((d: any) => d.race_points && Object.keys(d.race_points).length > 0);
    const raceAbbrevs: string[] = firstDriverWithPoints
      ? Object.keys(firstDriverWithPoints.race_points)
      : [];

    const map: Record<string, Record<string, { pos: number | null; sprintPos: number | null }>> = {};

    teamsData.flatMap((t: any) => t.drivers ?? []).forEach((driver: any) => {
      map[driver.name] = {};
      raceAbbrevs.forEach((abbrev, i) => {
        const calRace = completedRaces[i];
        if (!calRace) return;

        // Find this driver in main results
        const mainEntry = (calRace.results ?? []).find((r: any) => {
          const dn = (r.driver ?? '').toLowerCase();
          const sn = (r.short_name ?? '').toLowerCase();
          const parts = driver.name.toLowerCase().split(' ');
          return parts.some((p: string) => dn.includes(p) || sn.includes(p));
        });
        const sprintEntry = (calRace.sprint_results ?? []).find((r: any) => {
          const dn = (r.driver ?? '').toLowerCase();
          const sn = (r.short_name ?? '').toLowerCase();
          const parts = driver.name.toLowerCase().split(' ');
          return parts.some((p: string) => dn.includes(p) || sn.includes(p));
        });

        map[driver.name][abbrev] = {
          pos: mainEntry?.position ?? null,
          sprintPos: sprintEntry?.position ?? null,
        };
      });
    });

    return map;
  }, [calendarData, teamsData]);

  const drivers = teamsData.flatMap((team) =>
    (team.drivers ?? []).map((d: any) => ({ ...d, teamColour: team.colour ?? '#ffffff', teamLogo: team.logo_url }))
  ).sort((a: any, b: any) => b.points - a.points);

  const cols: any[][] = Array.from({ length: numCols }, () => []);
  drivers.forEach((d, i) => cols[i % numCols].push({ ...d, globalIndex: i }));

  const renderCard = (driver: any) => {
    const accent = driver.teamColour;
    const raceEntries = Object.entries(driver.race_points ?? {}) as [string, number | null][];
    const isExpanded = expandAll || expandedDriver === driver.name;
    const driverPositions = positionMap[driver.name] ?? {};

    return (
      <div
        key={driver.name}
        className="relative rounded-xl cursor-pointer mb-4"
        style={{ backgroundImage: `linear-gradient(300deg, ${accent}, ${accent}99)`, padding: '3px', animation: `slideUp 0.4s ease-out ${driver.globalIndex * 0.04}s both` }}
        onClick={() => setExpandedDriver(isExpanded && !expandAll ? null : driver.name)}
      >
        <div className="absolute inset-[3px] rounded-xl" style={{ backgroundColor: '#141414' }} aria-hidden />
        <div className="relative z-10 p-4 text-white">
          <div className="flex items-center gap-2">
            {driver.teamLogo && <img src={driver.teamLogo} alt="team logo" className="w-8 h-8 object-contain" loading="lazy" />}
            <span className="text-m font-black text-white">#{driver.globalIndex + 1}</span>
            <span className="text-base font-bold text-white">{driver.name}</span>
            <span className="ml-auto text-3xl font-black text-white leading-none">
              {driver.points}<span className="text-xs font-semibold text-white/40 ml-1">PTS</span>
            </span>
          </div>
          <div style={{ maxHeight: isExpanded ? '600px' : '0px', overflow: 'hidden', transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div className="rounded-xl p-3 mt-4" style={{ backgroundColor: '#0000004c' }}>
              <div className="grid grid-cols-3 gap-x-2 gap-y-1">
                {raceEntries.map(([race, pts]) => {
                  const posData = driverPositions[race];
                  const hasPos = posData && posData.pos != null;
                  const hasSprint = posData && posData.sprintPos != null;

                  let displayValue: React.ReactNode;
                  let isActive: boolean;

                  if (showPositions) {
                    if (hasPos) {
                      const posLabel = `P${posData!.pos}`;
                      const sprintColor = posData!.sprintPos === 1 ? '#a855f7' : posData!.sprintPos === 2 ? '#3b82f6' : posData!.sprintPos === 3 ? '#22c55e' : 'white';
                      displayValue = (
                        <span>
                          <span style={{ color: posData!.pos === 1 ? '#a855f7' : posData!.pos === 2 ? '#3b82f6' : posData!.pos === 3 ? '#22c55e' : 'white' }}>
                            {posLabel}
                          </span>
                          {hasSprint && (
                            <span style={{ color: sprintColor }}>{` · P${posData!.sprintPos}`}</span>
                          )}
                        </span>
                      );
                      isActive = true;
                    } else {
                      displayValue = '—';
                      isActive = false;
                    }
                  } else {
                    displayValue = pts != null ? pts : '—';
                    isActive = pts != null && pts > 0;
                  }

                  return (
                    <div key={race} className="grid grid-cols-2 items-center py-0.5 border-b border-white/5">
                      <span className="text-[10px] font-bold text-white/40 uppercase">{race}</span>
                      <span className={`text-[11px] font-black ${isActive ? '' : 'text-white/20'}`}>{displayValue}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="overflow-y-auto no-scrollbar" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="flex justify-end items-center gap-2 mb-3">
        {/* Info icon with points tooltip */}
        <div className="relative group">
          <button className="flex items-center justify-center w-7 h-7 rounded-full transition-colors" style={{ color: '#ffffff66' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffffcc')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#ffffff66')}
            aria-label="Points system info"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="8.01" strokeWidth="3" />
              <line x1="12" y1="12" x2="12" y2="16" />
            </svg>
          </button>
          {/* Tooltip */}
          <div className="absolute right-0 top-9 z-50 hidden group-hover:block w-64 rounded-xl border border-white/10 shadow-2xl p-3" style={{ backgroundColor: '#1a1a1a' }}>
            <p className="text-[10px] font-black tracking-widest uppercase mb-2" style={{ color: '#2dd4bf' }}>Points System</p>
            <div className="grid grid-cols-3 gap-x-2 mb-2">
              <span className="text-[9px] font-bold text-white/30 uppercase">Place</span>
              <span className="text-[9px] font-bold text-white/30 uppercase">Race</span>
              <span className="text-[9px] font-bold text-white/30 uppercase">Sprint</span>
            </div>
            {[
              ['1st', 25, 8],
              ['2nd', 18, 7],
              ['3rd', 15, 6],
              ['4th', 12, 5],
              ['5th', 10, 4],
              ['6th',  8, 3],
              ['7th',  6, 2],
              ['8th',  4, 1],
              ['9th',  2, '—'],
              ['10th', 1, '—'],
              ['11th+', 0, '—'],
            ].map(([place, race, sprint]) => (
              <div key={String(place)} className="grid grid-cols-3 gap-x-2 py-0.5 border-b border-white/5">
                <span className="text-[10px] font-bold text-white/50">{place}</span>
                <span className="text-[10px] font-black text-white">{race}</span>
                <span className="text-[10px] font-black text-white/60">{sprint}</span>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowPositions(p => !p)}
          className="px-5 py-2 text-xs font-bold rounded-full transition-all duration-200"
          style={showPositions
            ? { backgroundColor: '#2dd4bf', color: '#000000' }
            : { backgroundColor: '#1f1f1f', color: '#ffffff99', border: '1px solid #ffffff22' }}
        >
          {showPositions ? 'Points View' : 'Positions View'}
        </button>
        <button
          onClick={() => { setExpandAll(!expandAll); setExpandedDriver(null); }}
          className="px-5 py-2 text-xs font-bold rounded-full transition-all duration-200"
          style={{ backgroundColor: '#ffffff', color: '#000000' }}
        >
          {expandAll ? 'Compact View' : 'Expand View'}
        </button>
      </div>
      <div className="flex gap-4 pb-4 items-start">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col flex-1 min-w-0">
            {col.map(renderCard)}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================
// 🏆 ConstructorsTab Component
// ============================

const ConstructorsTab = ({ teamsData }: { teamsData: F1Team[] }) => {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(true);
  const [numCols, setNumCols] = useState(typeof window !== 'undefined' && window.innerWidth >= 1024 ? 4 : 2);

  useEffect(() => {
    const update = () => setNumCols(window.innerWidth >= 1024 ? 4 : 2);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const sortedTeams = [...teamsData].sort((a, b) => (b.team_points ?? 0) - (a.team_points ?? 0));
  const cols: any[][] = Array.from({ length: numCols }, () => []);
  sortedTeams.forEach((t, i) => cols[i % numCols].push({ ...t, globalIndex: i }));

  const renderCard = (team: any) => {
    const accent = team.colour ?? '#ffffff';
    const raceEntries = Object.entries(team.team_race_points ?? {}) as [string, number | null][];
    const isExpanded = expandAll || expandedTeam === team.name;
    return (
      <div
        key={team.name}
        className="relative rounded-xl cursor-pointer mb-4"
        style={{ backgroundImage: `linear-gradient(300deg, ${accent}, ${accent}99)`, padding: '3px', animation: `slideUp 0.4s ease-out ${team.globalIndex * 0.04}s both` }}
        onClick={() => setExpandedTeam(isExpanded && !expandAll ? null : team.name)}
      >
        <div className="absolute inset-[3px] rounded-xl" style={{ backgroundColor: '#141414' }} aria-hidden />
        <div className="relative z-10 p-4 text-white">
          <div className="flex items-center gap-2">
            {team.logo_url && <img src={team.logo_url} alt="team logo" className="w-8 h-8 object-contain" loading="lazy" />}
            <span className="text-m font-black text-white">#{team.globalIndex + 1}</span>
            <span className="text-base font-bold text-white">{team.name}</span>
            <span className="ml-auto text-3xl font-black text-white leading-none">
              {team.team_points ?? 0}<span className="text-xs font-semibold text-white/40 ml-1">PTS</span>
            </span>
          </div>
          <div style={{ maxHeight: isExpanded ? '600px' : '0px', overflow: 'hidden', transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div className="rounded-xl p-3 mt-4" style={{ backgroundColor: '#0000004c' }}>
              <div className="grid grid-cols-3 gap-x-2 gap-y-1">
                {raceEntries.map(([race, pts]) => (
                  <div key={race} className="grid grid-cols-2 items-center py-0.5 border-b border-white/5">
                    <span className="text-[10px] font-bold text-white/40 uppercase">{race}</span>
                    <span className={`text-[11px] font-black ${pts != null && pts > 0 ? 'text-white' : 'text-white/20'}`}>{pts != null ? pts : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="overflow-y-auto no-scrollbar" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => { setExpandAll(!expandAll); setExpandedTeam(null); }}
          className="px-5 py-2 text-xs font-bold rounded-full transition-all duration-200"
          style={{ backgroundColor: '#ffffff', color: '#000000' }}
        >
          {expandAll ? 'Compact View' : 'Expand View'}
        </button>
      </div>
      <div className="flex gap-4 pb-4 items-start">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col flex-1 min-w-0">
            {col.map(renderCard)}
          </div>
        ))}
      </div>
    </div>
  );
};


// ============================
// 🏎️ Main F1 Component
// ============================

// ── Module-level data cache ──────────────────────────────────────────────────
// Persists across tab switches so the page renders instantly with stale data
// while a background refresh completes silently.
let _cachedCalendar: F1Race[] | null = null;
let _cachedTeams: F1Team[] | null = null;
// ────────────────────────────────────────────────────────────────────────────

const F1 = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [calendarData, setCalendarData] = useState<F1Race[]>(() => _cachedCalendar ?? []);
  const [teamsData, setTeamsData] = useState<F1Team[]>(() => _cachedTeams ?? []);
  const [loading, setLoading] = useState(() => _cachedCalendar === null);
  const [raceModal, setRaceModal] = useState<F1Race | null>(null);

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
    let cancelled = false;

    const safeFetchJson = async (url: string) => {
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) return null;
      const text = await resp.text();
      try { return { data: JSON.parse(text), text }; } catch {
        console.warn(`Skipping corrupt JSON from ${url} — will retry next cycle`);
        return null;
      }
    };

    const loadData = async () => {
      try {
        const [calResult, teamsResult] = await Promise.all([
          safeFetchJson('/data/f1_calendar.json?_=' + Date.now()),
          safeFetchJson('/data/f1_teams.json?_=' + Date.now()),
        ]);
        if (cancelled) return;
        if (calResult && Array.isArray(calResult.data)) {
          setCalendarData(prev => {
            const prevText = JSON.stringify(prev);
            if (prevText === calResult.text) return prev;
            _cachedCalendar = calResult.data;
            return calResult.data;
          });
        }
        if (teamsResult && Array.isArray(teamsResult.data)) {
          setTeamsData(prev => {
            const prevText = JSON.stringify(prev);
            if (prevText === teamsResult.text) return prev;
            _cachedTeams = teamsResult.data;
            return teamsResult.data;
          });
        }
      } catch (err) {
        console.error('Failed to load F1 data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Initial load
    loadData();

    // Poll every 30s — only re-renders if JSON content actually changed
    let id: ReturnType<typeof setInterval>;
    const start = () => {
      id = setInterval(() => {
        if (cancelled) return;
        if (typeof document !== 'undefined' && document.hidden) return;
        loadData();
      }, 30_000);
    };
    start();

    // Re-fetch immediately when tab becomes visible again
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadData();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
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
      {/* ── Mobile: no tabs, just the dashboard navigator full screen ── */}
      {isMobile ? (
        loading ? (
          <div className="flex items-center justify-center h-screen text-sm text-muted-foreground"></div>
        ) : (
          <RaceCalendarNavigator races={calendarData} isMobile={true} teamsData={teamsData} />
        )
      ) : (
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
            className="flex gap-4"
            style={{ height: 'calc(100vh - 8rem)' }}
          >
            {/* Left column: Calendar + Driver grid stacked */}
            <div className="flex flex-col gap-4 flex-shrink-0 min-h-0" style={{ width: '600px' }}>

              {/* Calendar */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {loading ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  </div>
                ) : (
                  <RaceCalendarNavigator races={calendarData} />
                )}
              </div>

              {/* Bottom: Driver Standings 3x2 */}
              <div className="flex-shrink-0">
                {(() => {
                  const allDrivers = teamsData.flatMap((team) =>
                    (team.drivers ?? []).map((d: any) => ({ ...d, teamColour: team.colour ?? '#ffffff' }))
                  )
                    .filter((d: any) => d.points != null)
                    .sort((a: any, b: any) => b.points - a.points)
                    .slice(0, 6);

                  return (
                    <div className="grid grid-cols-2 gap-2">
                      {allDrivers.map((driver: any, index: number) => {
                        const accent = driver.teamColour;
                        const lastName = driver.name.split(' ').slice(1).join(' ') || driver.name;
                        return (
                          <div
                            key={driver.name}
                            className="relative rounded-xl overflow-hidden cursor-pointer hover:scale-[1.015] transition-all duration-200"
                            style={{
                              backgroundImage: `linear-gradient(300deg, ${accent}, ${accent}99)`,
                              padding: '3px',
                              animation: `slideUp 0.35s ease-out ${index * 0.04}s both`,
                            }}
                          >
                            <div className="absolute inset-[3px] rounded-xl" style={{ backgroundColor: '#141414' }} aria-hidden />
                            <div className="relative z-10 flex items-center justify-between px-3 h-14">
                              <div className="flex flex-col">
                                <span className="text-[12px] font-black text-white/40">#{index + 1}</span>
                                <span className="text-base font-black text-white uppercase tracking-wide">{lastName}</span>
                              </div>
                              <span className="text-2xl font-black text-white leading-none">
                                {driver.points}
                                <span className="text-xs font-semibold text-white/40 ml-1">PTS</span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* Right: Constructor Standings — full height */}
            <div className="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
              {[...teamsData]
                .sort((a, b) => (b.team_points ?? 0) - (a.team_points ?? 0))
                .slice(0, 8)
                .map((team, index) => {
                  const accent = team.colour ?? '#ffffff';
                  const pts = team.team_points ?? 0;

                  return (
                    <div
                      key={team.name}
                      className="relative rounded-xl overflow-hidden cursor-pointer hover:scale-[1.015] transition-all duration-200 flex-1"
                      style={{
                        backgroundImage: `linear-gradient(300deg, ${accent}, ${accent}99)`,
                        padding: '3px',
                        animation: `slideUp 0.35s ease-out ${index * 0.04}s both`,
                      }}
                    >
                      {/* Dark base */}
                      <div className="absolute inset-[3px] rounded-xl" style={{ backgroundColor: '#141414' }} aria-hidden />
                      {/* Car image — anchored to bottom, pushed left */}
                      {team.car_url && (
                        <div className="absolute inset-[3px] rounded-xl overflow-hidden" aria-hidden>
                          <img
                            src={team.car_url}
                            alt=""
                            className="f1-team-car absolute object-contain"
                            style={{ height: '90px', width: 'auto', opacity: 0.95 }}
                            loading="lazy"
                          />
                          {/* Fade car out to the right */}
                          <div
                            className="absolute inset-0"
                            style={{ background: 'linear-gradient(90deg, transparent 30%, #141414 68%)' }}
                          />
                          {/* Fade bottom edge */}
                          <div
                            className="absolute inset-0"
                            style={{ background: 'linear-gradient(180deg, transparent 40%, #14141488 100%)' }}
                          />
                        </div>
                      )}
                      {/* Team logo — top left */}
                      {team.logo_url && (
                        <div className="absolute top-2 left-2 z-20">
                          <img
                            src={team.logo_url}
                            alt={`${team.name} logo`}
                            style={{ height: '28px', width: 'auto' }}
                            className="object-contain opacity-90"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="relative z-10 flex items-center justify-between px-3 h-full">
                        <div />
                        <span className="text-3xl font-black text-white leading-none">
                          {pts}
                          <span className="text-xs font-semibold text-white/40 ml-1">PTS</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

          </div>
        </TabsContent>

        {/* ========================
            TAB: Drivers
        ======================== */}
        <TabsContent value="drivers" className="mt-0">
          <DriversTab teamsData={teamsData} calendarData={calendarData} />
        </TabsContent>

        {/* ========================
            TAB: Constructors
        ======================== */}
        <TabsContent value="constructors" className="mt-0">
          <ConstructorsTab teamsData={teamsData} />
        </TabsContent>

        {/* ========================
            TAB: Races
        ======================== */}
        <TabsContent value="races" className="mt-0">
          <div className="overflow-y-auto no-scrollbar" style={{ height: 'calc(100vh - 8rem)' }}>
            <div className="grid grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
              {[...calendarData]
                .sort((a, b) => a.race_number - b.race_number)
                .map((race, index) => {
                  const todayKey = new Date().toISOString().slice(0, 10);
                  const raceKey = parseRaceEndDate(race.date);
                  const hasDate = !!race.date && race.date.trim().length > 0 && race.date.trim().toUpperCase() !== 'TBD';
                  const isCanceled = race.start_time_west === 'Canceled';
                  const isUpcoming = !isCanceled && hasDate && raceKey >= todayKey;
                  return (
                    <div
                      key={race.race_number}
                      className="relative overflow-hidden rounded-2xl border transition-all duration-300 flex flex-col"
                      style={{
                        background: '#141414',
                        height: '280px',
                        animation: `slideUp 0.35s ease-out ${index * 0.03}s both`,
                        borderColor: isCanceled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                        opacity: isCanceled ? 0.5 : 1,
                        cursor: isCanceled ? 'default' : 'pointer',
                      }}
                      onClick={() => !isCanceled && setRaceModal(race)}
                    >
                      {/* Canceled diagonal stripe overlay */}
                      {isCanceled && (
                        <div className="absolute inset-0 z-20 pointer-events-none rounded-2xl overflow-hidden">
                          <div style={{
                            position: 'absolute', inset: 0,
                            backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 12px)',
                          }} />
                        </div>
                      )}
                      {/* Text */}
                      <div className="relative z-10 p-4 pb-2 flex-shrink-0">
                        <span className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: isCanceled ? '#666' : '#2dd4bf' }}>
                          Race {race.race_number}
                        </span>
                        <div className="flex items-start gap-2 mt-0.5">
                          <h2 className="text-lg font-extrabold leading-tight flex-1" style={{ color: isCanceled ? 'rgba(255,255,255,0.4)' : 'white' }}>
                            {race.race_name}
                          </h2>
                          <Badge
                            className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 mt-0.5"
                            style={isCanceled
                              ? { backgroundColor: '#3a1a1a', color: '#ff4444', border: '1px solid #ff444433' }
                              : isUpcoming
                              ? { backgroundColor: '#e10600', color: '#ffffff' }
                              : { backgroundColor: '#2a2a2a', color: '#888' }}
                          >
                            {isCanceled ? 'Canceled' : isUpcoming ? 'Upcoming' : 'Completed'}
                          </Badge>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: isCanceled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.5)' }}>{race.circuit}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] font-semibold" style={{ color: isCanceled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)' }}>{race.date}</span>
                          {!isCanceled && (
                            <>
                              <span className="text-white/20 text-xs">·</span>
                              <span className="text-[11px] font-semibold text-white/60">{race.start_time_west}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Track SVG */}
                      <style>{`.f1-races-svg-wrap svg { width: 100% !important; height: 100% !important; display: block; }`}</style>
                      <div className="f1-races-svg-wrap absolute z-10" style={{ top: '45%', left: '5%', right: '5%', bottom: '-10%' }}>
                        {race.track_svg_extracted
                          ? <ExtractedSvg svgString={race.track_svg_extracted} className="w-full h-full" />
                          : <InlineSvg url={race.track_svg} className="w-full h-full" />
                        }
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </TabsContent>

      </Tabs>
      )} {/* end desktop-only block */}

      {/* Race Modal — shown on both mobile and desktop */}
      {raceModal && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={() => setRaceModal(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div
            className="relative bg-zinc-900 rounded-2xl w-full max-w-[95vw] h-[95vh] flex flex-col shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <span className="text-white font-bold text-sm">{raceModal.race_name} — Results</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open(raceModal.urls.results, '_blank', 'noopener,noreferrer')}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Open on F1.com
                </button>
                <button
                  onClick={() => setRaceModal(null)}
                  className="bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg p-2 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 rotate-[-90deg]" />
                </button>
              </div>
            </div>

            {/* Iframe */}
            <div className="flex-1 overflow-hidden bg-white rounded-b-2xl">
              <iframe
                src={raceModal.urls.results}
                className="w-full h-full border-0"
                title={`${raceModal.race_name} Results`}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
              />
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .drivers-columns { columns: 2; column-fill: auto; }
        @media (min-width: 1024px) { .drivers-columns { columns: 4; column-fill: auto; } }

        /* Half screen: car lower and further left */
        .f1-team-car {
          bottom: -14px;
          left: -65px;
        }
        /* Full screen / large viewport: car higher and further right */
        @media (min-width: 1280px) {
          .f1-team-car {
            bottom: 0px;
            left: 50px;
          }
        }
      `}</style>
    </PageLayout>
  );
};

export default F1;
