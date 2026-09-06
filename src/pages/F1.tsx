// ============================
// 🏎️ F1 Dashboard
// Displays F1 drivers, constructors, and race calendar
// ============================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { PageNavbar } from '@/components/layout/PageNavbar';
import {
  Card, CardContent,
} from '@/components/ui/card';
import {
  Tabs, TabsContent,
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
  results?: any[];
  sprint_results?: any[];
  urls: {
    race_page: string;
    circuit_info: string;
    results: string;
  };
  circuit_stats?: {
    location?: string;
    length?: string;
    corners?: number;
    tags?: string[];
    top_speed?: string;
    lap_record?: { time: string; driver: string; year: number | null };
  };
}

interface F1Team {
  [key: string]: any;
}

function getCircuitTagStyle(tag: string): React.CSSProperties {
  const tl = tag.toLowerCase();
  const base: React.CSSProperties = {
    backgroundColor: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.65)',
  };

  if (tl.includes('overtaking')) {
    if (tl.includes('nearly impossible')) {
      return { ...base, backgroundColor: 'rgba(127,29,29,0.38)', borderColor: 'rgba(248,113,113,0.30)', color: '#f87171' };
    }
    if (tl.includes('very difficult')) {
      return { ...base, backgroundColor: 'rgba(153,27,27,0.34)', borderColor: 'rgba(252,165,165,0.28)', color: '#fca5a5' };
    }
    if (tl.includes('difficult')) {
      return { ...base, backgroundColor: 'rgba(194,65,12,0.34)', borderColor: 'rgba(251,146,60,0.30)', color: '#fb923c' };
    }
    if (tl.includes('excellent')) {
      return { ...base, backgroundColor: 'rgba(21,128,61,0.34)', borderColor: 'rgba(74,222,128,0.30)', color: '#4ade80' };
    }
    if (tl.includes('good')) {
      return { ...base, backgroundColor: 'rgba(29,78,216,0.32)', borderColor: 'rgba(96,165,250,0.28)', color: '#60a5fa' };
    }
  }

  if (tl.includes('speed')) {
    if (tl.includes('very high')) {
      return { ...base, backgroundColor: 'rgba(124,58,237,0.32)', borderColor: 'rgba(196,181,253,0.28)', color: '#c4b5fd' };
    }
    if (tl.includes('medium-high')) {
      return { ...base, backgroundColor: 'rgba(8,145,178,0.30)', borderColor: 'rgba(103,232,249,0.28)', color: '#67e8f9' };
    }
    if (tl.includes('high')) {
      return { ...base, backgroundColor: 'rgba(13,148,136,0.30)', borderColor: 'rgba(94,234,212,0.28)', color: '#5eead4' };
    }
  }

  return base;
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
    if (timeStr === 'Canceled') return null;
    // Strip timezone suffix e.g. " PDT", " PST"
    const clean = timeStr.replace(/\s+P[SD]T$/, '').trim();
    // clean = "March 15 at 12:00 AM", "March 15 at 12:00AM", or "March 15 at 12:00"
    const m = clean.match(/^([A-Za-z]+ \d+) at (\d+):(\d+)\s*([AP]M)?$/);
    if (!m) return null;
    const year = new Date().getFullYear();
    const meridiem = m[4] ? ` ${m[4]}` : '';
    const d = new Date(`${m[1]} ${year} ${m[2]}:${m[3]}${meridiem}`);
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

function normalizeTrackSvgViewBox(svg: SVGSVGElement, paddingRatio = 0.1) {
  const elements = Array.from(
    svg.querySelectorAll<SVGGraphicsElement>('path, polyline, polygon, circle, ellipse, line')
  ).filter((el) => !el.classList.contains('f1-teal-strip'));

  if (!elements.length) return;

  const boxes = elements
    .map((el) => {
      try { return el.getBBox(); } catch { return null; }
    })
    .filter((box): box is DOMRect => !!box && box.width > 0 && box.height > 0);

  if (!boxes.length) return;

  const minX = Math.min(...boxes.map(box => box.x));
  const minY = Math.min(...boxes.map(box => box.y));
  const maxX = Math.max(...boxes.map(box => box.x + box.width));
  const maxY = Math.max(...boxes.map(box => box.y + box.height));
  const width = maxX - minX;
  const height = maxY - minY;
  const pad = Math.max(width, height) * paddingRatio;

  svg.setAttribute('viewBox', `${minX - pad} ${minY - pad} ${width + pad * 2} ${height + pad * 2}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
}


// ============================
// 🗺️ InlineSvg — fetches SVG, strips elevation graph + labels, renders inline
// ============================

const InlineSvg = ({ url, className }: { url: string; className?: string }) => {
  const [svgContent, setSvgContent] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

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

        const allPaths = Array.from(svg.querySelectorAll('path'));
        const trackPath = allPaths.reduce((longest, p) =>
          (p.getTotalLength?.() ?? 0) > (longest.getTotalLength?.() ?? 0) ? p : longest
        , allPaths[0]);

        // Raw fallback SVGs can include dots, helper shapes, and duplicate linework.
        // Keep only the longest path so the dashboard renders a clean circuit.
        svg.querySelectorAll('path, polyline, polygon, circle, ellipse, line, rect').forEach((el) => {
          if (el !== trackPath) el.remove();
        });

        if (trackPath) {
          trackPath.setAttribute('fill', 'none');
          trackPath.setAttribute('stroke', '#ffffff');
          trackPath.setAttribute('stroke-width', '4.5');
          trackPath.setAttribute('stroke-linejoin', 'round');
          trackPath.setAttribute('stroke-linecap', 'round');
          trackPath.removeAttribute('style');
        }

        // Inject style to make all paths thin, white, and glowing
        // Scoped to .f1-track-svg to avoid bleeding into other SVGs (e.g. Lucide icons)
        svg.classList.add('f1-track-svg');
        const styleEl = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
        styleEl.textContent = `
          .f1-track-svg path, .f1-track-svg polyline, .f1-track-svg polygon,
          .f1-track-svg circle, .f1-track-svg ellipse, .f1-track-svg line, .f1-track-svg rect {
            fill: none !important;
            stroke: #ffffff !important;
            stroke-width: 4.5 !important;
            stroke-linejoin: round !important;
            stroke-linecap: round !important;
          }
          .f1-teal-strip {
            fill: none !important;
            stroke: #2dd4bf !important;
            stroke-width: 7 !important;
            stroke-linecap: round !important;
          }
          @keyframes f1-dash {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: var(--f1-track-len); }
          }
          .f1-teal-strip {
            animation: f1-dash var(--f1-anim-dur, 25s) linear infinite;
            will-change: stroke-dashoffset;
          }
        `;
        svg.insertBefore(styleEl, svg.firstChild);

        if (!cancelled) setSvgContent(svg.outerHTML);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;
    normalizeTrackSvgViewBox(svg);
  }, [svgContent]);

  if (!svgContent) return null;
  return (
    <div
      ref={containerRef}
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
    .f1-track-svg .f1-circuit-shape {
      fill: rgba(255, 255, 255, 0.95) !important;
      stroke: rgba(255, 255, 255, 0.42) !important;
      stroke-width: 0.8 !important;
      vector-effect: non-scaling-stroke;
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

    allPaths.forEach((path) => {
      if (path !== trackPath) path.remove();
    });

    trackPath.setAttribute('class', 'f1-circuit-shape');
    trackPath.removeAttribute('id');
    trackPath.removeAttribute('style');
    trackPath.removeAttribute('stroke-width');

    normalizeTrackSvgViewBox(svg, 0.08);
  }, [processed]);

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: processed }}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', willChange: 'transform', filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.36)) drop-shadow(0 0 7px rgba(255,255,255,0.18))' }}
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
// 🗓️ Session display helpers
// ============================

function formatSessionShort(timeStr: string): { day: string; time: string } | null {
  try {
    if (timeStr === 'Canceled') return null;
    const clean = timeStr.replace(/\s+P[SD]T$/, '').trim();
    const m = clean.match(/^([A-Za-z]+ \d+) at (\d+):(\d+)\s*([AP]M)?$/);
    if (!m) return null;
    const year = new Date().getFullYear();
    const d = new Date(`${m[1]} ${year}`);
    if (isNaN(d.getTime())) return null;
    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
    return { day, time: `${m[2]}:${m[3]}${m[4] ? ` ${m[4]}` : ''}` };
  } catch { return null; }
}

function isSessionCompleted(timeStr: string): boolean {
  const sessionDate = parseSessionTime(timeStr);
  return !!sessionDate && sessionDate.getTime() <= Date.now();
}

const SESSION_ORDER: { keys: string[]; label: string }[] = [
  { keys: ['Free Practice 1'], label: 'FP1' },
  { keys: ['Free Practice 2'], label: 'FP2' },
  { keys: ['Free Practice 3'], label: 'FP3' },
  { keys: ['Free Practice'],   label: 'FP' },
  { keys: ['Sprint Qualifying', 'Sprint'], label: 'SQ' },
  { keys: ['Sprint Race'],     label: 'SPR' },
  { keys: ['Qualifying'],      label: 'QUAL' },
  { keys: ['Race'],            label: 'RACE' },
];

const COUNTDOWN_LABELS: Record<string, string> = {
  SQ: 'Sprint Qualifying', SPR: 'Sprint Race', QUAL: 'Qualifying', RACE: 'Race',
};

const RaceCardFooter = ({ race }: { race: F1Race }) => {
  const cd = useSessionCountdown(race);
  if (!cd) return null;
  const units = [
    { v: cd.days,  l: 'DAYS' },
    { v: cd.hours, l: 'HRS' },
    { v: cd.mins,  l: 'MIN' },
    { v: cd.secs,  l: 'SEC' },
  ];
  const label = COUNTDOWN_LABELS[cd.label] ?? cd.label;
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-2.5 border-t border-white/[0.06]">
      <span className="text-xs font-black tracking-widest uppercase whitespace-nowrap" style={{ color: '#2dd4bf' }}>
        {label}
      </span>
      <div className="flex items-end gap-1.5">
        {units.map(({ v, l }, i) => (
          <React.Fragment key={l}>
            {i > 0 && <span className="text-base font-black pb-3.5" style={{ color: 'rgba(255,255,255,0.2)' }}>:</span>}
            <div className="flex flex-col items-center">
              <span className="text-xl font-black text-white tabular-nums leading-none">{String(v).padStart(2, '0')}</span>
              <span className="text-[8px] font-bold tracking-widest mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{l}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ============================
// 🏎️ RaceCalendarNavigator — left panel of Dashboard
// ============================

const DesktopSessionPanel = ({ race }: { race: F1Race }) => {
  const cd = useSessionCountdown(race);
  const rows = SESSION_ORDER
    .map((s) => {
      const key = s.keys.find(k => race.session_times?.[k]);
      if (!key) return null;
      const timeStr = race.session_times![key];
      const fmt = formatSessionShort(timeStr);
      if (!fmt) return null;
      return { label: s.label, isCompleted: isSessionCompleted(timeStr), ...fmt };
    })
    .filter(Boolean) as { label: string; day: string; time: string; isCompleted: boolean }[];

  const units = cd
    ? [
        { v: cd.days,  l: 'DAYS' },
        { v: cd.hours, l: 'HRS' },
        { v: cd.mins,  l: 'MIN' },
        { v: cd.secs,  l: 'SEC' },
      ]
    : [];
  const label = cd ? (COUNTDOWN_LABELS[cd.label] ?? cd.label) : '';

  return (
    <aside
      className="w-[202px] flex-shrink-0 self-stretch py-4 overflow-visible"
      style={{
        color: '#ffffff',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div className="text-[10px] font-black uppercase leading-none text-white">Session Schedule</div>
      <div className="h-px bg-white/20 mt-2 mb-3" />

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className={[
              'grid grid-cols-[42px_32px_1fr] items-baseline gap-2 text-[11px] leading-none',
              row.isCompleted ? 'line-through decoration-white/45 decoration-1' : '',
            ].join(' ')}
          >
            <span className="font-black uppercase tracking-wide" style={{ color: row.isCompleted ? 'rgba(45,212,191,0.38)' : '#2dd4bf' }}>{row.label}</span>
            <span className={row.isCompleted ? 'font-medium text-white/30' : 'font-medium text-white/65'}>{row.day}</span>
            <span className={row.isCompleted ? 'font-medium text-right tabular-nums text-white/35' : 'font-medium text-right tabular-nums text-white'}>{row.time}</span>
          </div>
        ))}
      </div>

      {cd && (
        <>
          <div className="h-px bg-white/10 mt-6 mb-4" />
          <div className="text-[11px] font-black uppercase leading-none tracking-wide" style={{ color: '#2dd4bf' }}>
            {label}
          </div>
          <div className="flex items-end gap-1 mt-3">
            {units.map(({ v, l }, i) => (
              <React.Fragment key={l}>
                {i > 0 && <span className="pb-[17px] text-2xl font-semibold leading-none text-white">:</span>}
                <div className="flex flex-col items-center min-w-[26px]">
                  <span className="text-[28px] font-semibold leading-none tabular-nums text-white">
                    {String(v).padStart(2, '0')}
                  </span>
                  <span className="mt-1 text-[8px] font-medium leading-none text-white/45">{l}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </aside>
  );
};

function getLatestPoints(pointsByRace?: Record<string, number | null>): number | null {
  const entries = Object.entries(pointsByRace ?? {});
  return ([...entries].reverse().find(([, v]) => typeof v === 'number')?.[1] as number | null) ?? null;
}

function getShortTeamName(name: string): string {
  return name
    .replace('Red Bull Racing', 'Red Bull')
    .replace('Haas F1 Team', 'Haas')
    .replace('Aston Martin', 'Aston')
    .trim();
}

function getDynamicRaceTitle(name: string): string[] {
  return name
    .replace(/\s+Grand Prix$/i, ' GP')
    .split(/\s+/)
    .filter(Boolean);
}

const TeamStandingsGrid = ({ teamsData, limit = 8 }: { teamsData: F1Team[]; limit?: number }) => {
  const sortedTeams = [...teamsData]
    .sort((a, b) => (b.team_points ?? 0) - (a.team_points ?? 0))
    .slice(0, limit);

  if (!sortedTeams.length) return null;

  return (
    <div className="grid grid-cols-4 gap-3">
      {sortedTeams.map((team: any, index: number) => {
        const accent = team.colour ?? '#e10600';
        const pts = team.team_points ?? 0;
        const latest = getLatestPoints(team.team_race_points);
        const featured = index < 4;

        return (
          <div
            key={team.name}
            className={[
              'group relative overflow-hidden rounded-xl border cursor-pointer transition-all duration-200',
              featured ? 'col-span-2 h-[150px]' : 'col-span-1 h-[118px]',
            ].join(' ')}
            style={{
              background: 'linear-gradient(135deg, #171717 0%, #0f0f0f 100%)',
              borderColor: 'rgba(255,255,255,0.10)',
              boxShadow: '0 14px 34px rgba(0, 0, 0, 0.28)',
              animation: `slideUp 0.35s ease-out ${index * 0.04}s both`,
            }}
          >
            <div
              className="absolute rounded-full"
              style={{
                top: featured ? -32 : -48,
                right: featured ? 45 : -10,
                width: featured ? 280 : 160,
                height: featured ? 220 : 160,
                border: `2px solid ${accent}`,
                opacity: 0.52,
                transform: featured ? 'rotate(30deg)' : undefined,
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                right: featured ? -160 : -96,
                bottom: featured ? -48 : -4,
                width: featured ? 340 : 190,
                height: featured ? 250 : 190,
                border: `18px solid ${accent}`,
                opacity: 0.95,
                transform: featured ? 'rotate(-30deg)' : undefined,
              }}
            />
            <div
              className="absolute left-0 top-0 h-full"
              style={{
                width: featured ? 122 : 76,
                background: `linear-gradient(135deg, ${accent} 0%, ${accent} 48%, transparent 49%)`,
                clipPath: 'polygon(0 0, 100% 0, 42% 100%, 0 100%)',
              }}
            />
            <div
              className="absolute font-black italic leading-none select-none"
              style={{
                top: featured ? -14 : -8,
                left: featured ? 0 : 0,
                color: 'rgba(255,255,255,0.92)',
                fontSize: featured ? 112 : 82,
                letterSpacing: 0,
              }}
            >
              {index + 1}
            </div>

            {team.logo_url && (
              <div
                className="absolute z-20 flex items-center justify-center rounded-full"
                style={{
                  top: featured ? 18 : 14,
                  right: featured ? 22 : 14,
                  width: featured ? 42 : 34,
                  height: featured ? 42 : 34,
                  backgroundColor: accent,
                  boxShadow: '0 8px 18px rgba(0,0,0,0.16)',
                }}
              >
                <img
                  src={team.logo_url}
                  alt={`${team.name} logo`}
                  className="max-h-[70%] max-w-[74%] object-contain"
                  loading="lazy"
                />
              </div>
            )}

            <div
              className="relative z-30 h-full"
              style={{ padding: featured ? '12px 24px' : '8px 16px' }}
            >
              <div style={{ marginLeft: featured ? 150 : 72 }}>
                <p
                  className="font-black uppercase leading-none text-white"
                  style={{ fontSize: featured ? 22 : 14 }}
                >
                  {getShortTeamName(team.name)}
                </p>
                <div className="flex items-center gap-2" style={{ marginTop: featured ? 5 : 3 }}>
                  <p
                    className="font-black leading-none tabular-nums text-white"
                    style={{ fontSize: featured ? 38 : 28 }}
                  >
                    {pts}
                  </p>
                  {latest != null && latest > 0 && (
                    <span className="text-xs font-black tabular-nums text-white">+{latest}</span>
                  )}
                </div>
              </div>
            </div>

            {team.car_url && (
              <img
                src={team.car_url}
                alt=""
                className="absolute z-20 object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                style={{
                  width: featured ? '73%' : '89%',
                  height: featured ? 68 : 56,
                  left: featured ? 44 : 20,
                  bottom: featured ? -2 : -8,
                  filter: 'drop-shadow(0 10px 8px rgba(0,0,0,0.28))',
                }}
                loading="lazy"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

const RaceCalendarNavigator = ({ races, isMobile = false, teamsData = [] }: { races: F1Race[]; isMobile?: boolean; teamsData?: F1Team[] }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pages = ['/nba', '/f1', '/nfl'] as const;
  const currentPageIdx = pages.findIndex(p => location.pathname.startsWith(p));
  const cycleToNextPage = () => navigate(pages[(currentPageIdx === -1 ? 1 : currentPageIdx + 1) % pages.length]);

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

  // Start at the current race until standings points land, then advance.
  const initialIndex = useMemo(() => {
    if (racesWithKeys.length === 0) return 0;
    const idx = racesWithKeys.findIndex(({ race, dateKey }) => {
      if (dateKey > todayKey) return true;
      if (dateKey === todayKey) return !hasRacePointsUpdated(race, teamsData);
      return !hasRacePointsUpdated(race, teamsData);
    });
    return idx >= 0 ? idx : racesWithKeys.length - 1;
  }, [racesWithKeys, teamsData, todayKey]);

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
  const totalRaceCount = races.length;
  const raceTitleWords = getDynamicRaceTitle(race.race_name);
  const longestRaceTitleWord = Math.max(...raceTitleWords.map(word => word.length), 0);
  const raceTitleFontSize = raceTitleWords.length >= 5
    ? 36
    : raceTitleWords.length >= 4
      ? 42
      : longestRaceTitleWord > 8
        ? 44
        : 54;

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
        <Button variant="ghost" size="icon" onClick={() => setIndex((i) => clamp(i - 1))} disabled={index <= 0} className="rounded-full hover:bg-white/10">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="text-lg font-semibold whitespace-nowrap">Race {race.race_number}</span>
        <Button variant="ghost" size="icon" onClick={() => setIndex((i) => clamp(i + 1))} disabled={index >= racesWithKeys.length - 1} className="rounded-full hover:bg-white/10">
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
        <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
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
                      const isCompleted = time ? isSessionCompleted(time) : false;
                      return (
                        <div
                          key={label}
                          className={[
                            'flex items-center gap-1',
                            isCompleted ? 'line-through decoration-white/45 decoration-1' : '',
                          ].join(' ')}
                        >
                          <span className="text-[10px] font-black tracking-wider" style={{ color: isCompleted ? 'rgba(45,212,191,0.38)' : '#2dd4bf' }}>{label}</span>
                          <span className={isCompleted ? 'text-[10px] font-semibold text-white/30' : 'text-[10px] font-semibold text-white'}>{datePart}</span>
                          <span className={isCompleted ? 'text-[10px] font-medium text-white/35' : 'text-[10px] font-medium text-white/70'}>{timePart}</span>
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
              <span className="text-white font-bold text-base tracking-wider">F1</span>
              <span className="text-white/40 text-[11px] mt-0.5">Race {race.race_number}</span>
            </button>
            <button
              onClick={() => setIndex(i => clamp(i + 1))}
              disabled={index >= racesWithKeys.length - 1}
              className="flex-1 flex items-center justify-center h-16 disabled:opacity-30 active:bg-white/10 transition-colors"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Desktop layout (unchanged) ──
  return (
    <div className="flex flex-col h-full space-y-3">

      {/* ── Race info card ── */}
      <div className="relative flex-shrink-0">
        <div className="relative z-10 flex flex-col">

          {/* Header: < RACE 07 / 24 > + calendar */}
          <div className="flex items-center justify-between px-2 py-1.5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" onClick={() => setIndex(i => clamp(i - 1))} disabled={index <= 0} className="h-7 w-7 rounded-full hover:bg-white/10">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-[11px] font-black tracking-[0.15em] text-white/60 uppercase px-1">
                Race {String(race.race_number).padStart(2, '0')} / {String(totalRaceCount).padStart(2, '0')}
              </span>
              <Button variant="ghost" size="icon" onClick={() => setIndex(i => clamp(i + 1))} disabled={index >= racesWithKeys.length - 1} className="h-7 w-7 rounded-full hover:bg-white/10">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="relative" ref={calendarRef}>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-white/10" onClick={openCalendar} aria-label="Pick a race weekend">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </Button>
              {showCalendar && calendarMonth && (
                <div className="absolute top-9 right-0 z-50 rounded-2xl border border-white/10 shadow-2xl p-4 w-72" style={{ backgroundColor: '#1a1a1a' }}>
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

          {/* Body: dynamic race name + circuit map + session times */}
          <div className="relative flex h-[330px] items-center gap-6 overflow-hidden px-5 pt-0 pb-16 cursor-pointer" onClick={() => setResultsModal(race)}>
            <div className="relative h-[250px] w-[32%] min-w-0 overflow-visible self-start pt-14">
              <div
                className="relative h-[132px] origin-top-left overflow-visible"
                style={{
                  transform: 'rotate(-6deg) skewX(-8deg)',
                  marginTop: 0,
                  marginLeft: -2,
                }}
              >
                {raceTitleWords.map((word, wordIndex) => (
                  <div
                    key={`${word}-${wordIndex}`}
                    className="font-black uppercase text-white leading-[0.78] whitespace-nowrap"
                    style={{
                      fontSize: `${raceTitleFontSize}px`,
                      letterSpacing: 0,
                      textShadow: '0 10px 22px rgba(0,0,0,0.42)',
                    }}
                  >
                    {word}
                  </div>
                ))}
              </div>
              <div
                className="absolute left-0 top-[218px]"
              >
                <svg
                  className="block overflow-visible"
                  width="280"
                  height="16"
                  viewBox="0 0 280 16"
                  style={{
                    fontFamily: 'inherit',
                    textRendering: 'geometricPrecision',
                  }}
                  aria-label={race.circuit}
                >
                  <text
                    x="0"
                    y="12"
                    fill="#2dd4bf"
                    fontSize="12"
                    fontWeight="800"
                    letterSpacing="0"
                    className="uppercase"
                  >
                    {race.circuit}
                  </text>
                </svg>
                <p className="text-xs font-black uppercase text-white mt-1 leading-none">{race.date}</p>
                {false && (() => {
                  const cs = race.circuit_stats;
                  const lap = cs?.lap_record;
                  const hasLap = !!(lap?.time && lap.time !== 'TBD');
                  const tags = cs?.tags ?? [];
                  if (!hasLap && tags.length === 0 && !cs?.top_speed) return null;

                  return (
                    <div className="mt-4 flex flex-col items-start gap-2">
                      {hasLap && (
                        <div
                          className="inline-flex items-center gap-3 rounded-2xl border border-white/10 px-3 py-2"
                          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                        >
                          <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-wide leading-none text-white">Lap Record</p>
                            <p className="mt-1 text-lg font-black leading-none tabular-nums text-white">{lap!.time}</p>
                            <p className="mt-1 text-[10px] font-medium leading-none text-white/60">
                              {lap!.driver}{lap!.year ? ` · ${lap!.year}` : ''}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col items-start gap-1.5">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wide leading-none"
                            style={getCircuitTagStyle(tag)}
                          >
                            {tag}
                          </span>
                        ))}
                        {cs?.top_speed && (
                          <span className="rounded-full bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-wide leading-none text-white">
                            Top Speed {cs.top_speed}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="relative flex-1 h-[260px] min-w-0 translate-y-14">
              <style>{`.f1-top-svg-wrap svg { width: 100% !important; height: 100% !important; display: block; }`}</style>
              <div className="f1-top-svg-wrap f1-dashboard-track-wrap absolute inset-0">
                {race.track_svg_extracted
                  ? <ExtractedSvg svgString={race.track_svg_extracted} className="w-full h-full" />
                  : <InlineSvg url={race.track_svg} className="w-full h-full" />
                }
              </div>
            </div>
            <div className="translate-y-8">
              <DesktopSessionPanel race={race} />
            </div>
            {(() => {
              const cs = race.circuit_stats;
              const lap = cs?.lap_record;
              const hasLap = !!(lap?.time && lap.time !== 'TBD');
              const tags = cs?.tags ?? [];
              if (!hasLap && tags.length === 0 && !cs?.top_speed) return null;

              return (
                <div className="absolute bottom-5 left-5 right-[224px] flex items-center gap-2 overflow-visible whitespace-nowrap">
                  {hasLap && (
                    <div
                      className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 px-3"
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                    >
                      <span className="flex flex-col leading-none">
                        <span className="text-[8px] font-black uppercase tracking-wide text-white/70">Lap Record</span>
                        <span className="mt-0.5 text-sm font-black tabular-nums text-white">{lap!.time}</span>
                      </span>
                      <span className="text-[10px] font-medium text-white/55">
                        {lap!.driver}{lap!.year ? ` - ${lap!.year}` : ''}
                      </span>
                    </div>
                  )}
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-3 py-2 text-[9px] font-black uppercase tracking-wide leading-none"
                      style={getCircuitTagStyle(tag)}
                    >
                      {tag}
                    </span>
                  ))}
                  {cs?.top_speed && (
                    <span className="rounded-full bg-white/10 px-3 py-2 text-[9px] font-black uppercase tracking-wide leading-none text-white">
                      Top Speed {cs.top_speed}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>

        </div>
      </div>

      {/* ── Bottom Card (3/4): Track SVG ── */}
      <Card
        className="relative overflow-hidden rounded-2xl border border-white/10 flex-1 min-h-0"
        style={{ flex: '3 1 0', minHeight: 0 }}
      >
        <div className="absolute inset-0" style={{ background: '#141414' }} />
        <style>{`.f1-svg-wrap svg { width: 100% !important; height: 100% !important; display: block; }`}</style>
        <div className="f1-svg-wrap absolute inset-0" style={{ transform: 'translate(-22px, -52px)', transformOrigin: 'center center' }}>
          {race.track_svg_extracted
            ? <ExtractedSvg svgString={race.track_svg_extracted} className="w-full h-full" />
            : <InlineSvg url={race.track_svg} className="w-full h-full" />
          }
        </div>

        {/* Four-corner overlay */}
        {(() => {
          const cs = race.circuit_stats;
          const lap = cs?.lap_record;
          const lapValid = lap && lap.time && lap.time !== 'TBD';
          return (
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between">
              {/* Top row */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.08]">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Circuit Layout</span>
                {cs?.corners != null && (
                  <span className="text-[10px] font-black uppercase tracking-wide" style={{ color: '#2dd4bf' }}>
                    {cs.corners} <span className="text-white/40">Turns</span>
                  </span>
                )}
              </div>
              {/* Bottom row */}
              <div className="flex items-end justify-between gap-2 px-3 py-2 border-t border-white/[0.08]">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Lap Record</span>
                  {lapValid ? (
                    <>
                      <span className="text-xs font-black text-white tabular-nums">{lap!.time}</span>
                      <span className="text-[9px] text-white/30">
                        {lap!.driver.split(' ').pop()} · {lap!.year}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-black text-white/30">—</span>
                  )}
                </div>
                {cs?.tags && cs.tags.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-1">
                    {cs.tags.map(tag => {
                      return (
                        <span
                          key={tag}
                          className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                          style={getCircuitTagStyle(tag)}
                        >
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
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
const RACE_ABBREVS = [
  'AUS', 'CHN', 'JPN', 'BRN', 'SAU', 'MIA', 'CAN', 'MCO', 'BAR', 'AUT', 'GBR', 'BEL',
  'HUN', 'NLD', 'ITA', 'ESP', 'AZE', 'SGP', 'USA', 'MEX', 'BRA', 'LAS', 'QAT', 'UAE',
];
const RACE_POINTS_BY_POSITION: Record<number, number> = {
  1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
};
const SPRINT_POINTS_BY_POSITION: Record<number, number> = {
  1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1,
};

function getRaceAbbrev(race: { race_number?: number }): string | null {
  if (!race.race_number) return null;
  return RACE_ABBREVS[race.race_number - 1] ?? null;
}

function hasRacePointsUpdated(race: F1Race, teamsData: F1Team[]): boolean {
  const abbrev = getRaceAbbrev(race);
  if (!abbrev) return false;

  if ((race.results?.length ?? 0) > 0 || (race.sprint_results?.length ?? 0) > 0) {
    return true;
  }

  return teamsData.some((team: any) => {
    if (typeof team.team_race_points?.[abbrev] === 'number') return true;
    return (team.drivers ?? []).some((driver: any) => typeof driver.race_points?.[abbrev] === 'number');
  });
}

function getCanceledRaceMap(calendarData: F1Race[]): Record<string, boolean> {
  return calendarData.reduce((map, race: any) => {
    const abbrev = getRaceAbbrev(race);
    if (!abbrev) return map;
    const sessions = Object.values(race.session_times ?? {});
    map[abbrev] = race.start_time_west === 'Canceled' || sessions.some((session) => session === 'Canceled');
    return map;
  }, {} as Record<string, boolean>);
}

function driverMatchesResult(driverName: string, result: any): boolean {
  const haystack = `${result.driver ?? ''} ${result.short_name ?? ''}`.toLowerCase();
  return driverName
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .some((part) => haystack.includes(part));
}

function deriveTeamsFromCalendar(teamsData: F1Team[], calendarData: F1Race[]): F1Team[] {
  const completedRaces = calendarData
    .filter((race: any) => Array.isArray(race.results) && race.results.length > 0)
    .sort((a, b) => a.race_number - b.race_number);

  if (completedRaces.length === 0) return teamsData;

  return teamsData.map((team: any) => {
    const teamRacePoints: Record<string, number | null> = {};
    RACE_ABBREVS.forEach((abbrev) => {
      teamRacePoints[abbrev] = null;
    });

    const drivers = (team.drivers ?? []).map((driver: any) => {
      const racePoints: Record<string, number | null> = {};
      RACE_ABBREVS.forEach((abbrev) => {
        racePoints[abbrev] = driver.race_points?.[abbrev] ?? null;
      });

      completedRaces.forEach((race: any) => {
        const abbrev = getRaceAbbrev(race);
        if (!abbrev) return;

        const raceEntry = (race.results ?? []).find((result: any) => driverMatchesResult(driver.name, result));
        const sprintEntry = (race.sprint_results ?? []).find((result: any) => driverMatchesResult(driver.name, result));
        const mainPoints = raceEntry ? RACE_POINTS_BY_POSITION[raceEntry.position] ?? 0 : 0;
        const sprintPoints = sprintEntry ? SPRINT_POINTS_BY_POSITION[sprintEntry.position] ?? 0 : 0;
        const totalPoints = mainPoints + sprintPoints;

        racePoints[abbrev] = totalPoints > 0 ? totalPoints : null;
      });

      return {
        ...driver,
        points: Object.values(racePoints).reduce((sum: number, points) => sum + (points ?? 0), 0),
        race_points: racePoints,
      };
    });

    drivers.forEach((driver: any) => {
      Object.entries(driver.race_points ?? {}).forEach(([abbrev, points]) => {
        if (!RACE_ABBREVS.includes(abbrev)) return;
        teamRacePoints[abbrev] = (teamRacePoints[abbrev] ?? 0) + (points as number ?? 0);
        if (teamRacePoints[abbrev] === 0) teamRacePoints[abbrev] = null;
      });
    });

    return {
      ...team,
      drivers,
      team_points: Object.values(teamRacePoints).reduce((sum: number, points) => sum + (points ?? 0), 0),
      team_race_points: teamRacePoints,
    };
  });
}
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
  const canceledRaceMap = useMemo(() => getCanceledRaceMap(calendarData as F1Race[]), [calendarData]);
  const completedRaceMap = useMemo(() => {
    return (calendarData as F1Race[]).reduce<Record<string, boolean>>((map, race: any) => {
      const abbrev = getRaceAbbrev(race);
      if (!abbrev) return map;
      map[abbrev] = (race.results?.length ?? 0) > 0 || (race.sprint_results?.length ?? 0) > 0;
      return map;
    }, {});
  }, [calendarData]);

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

    const map: Record<string, Record<string, { pos: number | null; sprintPos: number | null }>> = {};

    teamsData.flatMap((t: any) => t.drivers ?? []).forEach((driver: any) => {
      map[driver.name] = {};
      completedRaces.forEach((calRace: any) => {
        const abbrev = getRaceAbbrev(calRace);
        if (!abbrev) return;

        // Find this driver in main results
        const mainEntry = (calRace.results ?? []).find((r: any) => {
          return driverMatchesResult(driver.name, r);
        });
        const sprintEntry = (calRace.sprint_results ?? []).find((r: any) => {
          return driverMatchesResult(driver.name, r);
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
    const raceEntries = (Object.entries(driver.race_points ?? {}) as [string, number | null][])
      .map(([race, pts]) => [
        race,
        pts ?? (!canceledRaceMap[race] && completedRaceMap[race] ? 0 : null),
      ] as [string, number | null]);
    const isExpanded = expandAll || expandedDriver === driver.name;
    const driverPositions = positionMap[driver.name] ?? {};

    return (
      <div
        key={driver.name}
        className="group relative rounded-2xl cursor-pointer mb-4 overflow-hidden border border-white/10 transition-all duration-200 hover:scale-[1.01]"
        style={{
          background: 'linear-gradient(135deg, #171717 0%, #0f0f0f 100%)',
          boxShadow: '0 14px 34px rgba(0,0,0,0.24)',
          animation: `slideUp 0.4s ease-out ${driver.globalIndex * 0.04}s both`,
        }}
        onClick={() => setExpandedDriver(isExpanded && !expandAll ? null : driver.name)}
      >
        <div
          className="absolute left-0 top-0 h-[62px]"
          style={{
            width: 60,
            background: `linear-gradient(135deg, ${accent} 0%, ${accent} 56%, transparent 57%)`,
          }}
        />
        <div
          className="absolute font-black italic leading-none select-none"
          style={{
            left: 8,
            top: 3,
            color: 'rgba(255,255,255,0.92)',
            fontSize: 46,
            letterSpacing: 0,
          }}
        >
          {driver.globalIndex + 1}
        </div>

        <div className="relative z-10 px-4 py-3 text-white">
          <div className="flex items-center gap-4 min-h-[58px]">
            <div className="w-[36px] shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {driver.teamLogo && (
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: accent }}
                  >
                    <img src={driver.teamLogo} alt="team logo" className="max-h-[68%] max-w-[72%] object-contain" loading="lazy" />
                  </span>
                )}
                <span className="truncate text-xl font-black uppercase leading-none text-white">
                  {driver.name}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-end gap-1">
              <span className="text-4xl font-black text-white leading-none tabular-nums">{driver.points}</span>
              <span className="pb-1 text-[10px] font-bold text-white/45 leading-none">PTS</span>
            </div>
          </div>
          <div style={{ maxHeight: isExpanded ? '600px' : '0px', overflow: 'hidden', transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div className="rounded-xl p-3 mt-3 border border-white/10" style={{ backgroundColor: 'rgba(0,0,0,0.28)' }}>
              <div
                className="grid grid-flow-col gap-x-2 gap-y-1"
                style={{
                  gridTemplateRows: `repeat(${Math.ceil(raceEntries.length / 3)}, minmax(0, auto))`,
                  gridAutoColumns: 'minmax(0, 1fr)',
                }}
              >
                {raceEntries.map(([race, pts]) => {
                  const posData = driverPositions[race];
                  const hasPos = posData && posData.pos != null;
                  const hasSprint = posData && posData.sprintPos != null;
                  const isCanceledRace = canceledRaceMap[race];

                  let displayValue: React.ReactNode;
                  let isActive: boolean;

                  if (isCanceledRace) {
                    displayValue = <span className="text-white/30 tracking-wider line-through decoration-white/40">CXL</span>;
                    isActive = false;
                  } else if (showPositions) {
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
                    const pointColor = posData?.pos === 1 ? '#a855f7' : posData?.pos === 2 ? '#3b82f6' : posData?.pos === 3 ? '#22c55e' : undefined;
                    if (pts === 0) {
                      displayValue = <span className="text-red-500">X</span>;
                    } else {
                    displayValue = pts != null ? <span style={{ color: pointColor }}>{pts}</span> : '—';
                    }
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
    <div className="overflow-y-auto no-scrollbar" style={{ height: 'calc(100vh - 6rem)' }}>
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

const ConstructorsTab = ({ teamsData, calendarData = [] }: { teamsData: F1Team[]; calendarData?: F1Race[] }) => {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(true);
  const [numCols, setNumCols] = useState(typeof window !== 'undefined' && window.innerWidth >= 1024 ? 4 : 2);
  const canceledRaceMap = useMemo(() => getCanceledRaceMap(calendarData), [calendarData]);
  const completedRaceMap = useMemo(() => {
    return calendarData.reduce<Record<string, boolean>>((map, race: any) => {
      const abbrev = getRaceAbbrev(race);
      if (!abbrev) return map;
      map[abbrev] = (race.results?.length ?? 0) > 0 || (race.sprint_results?.length ?? 0) > 0;
      return map;
    }, {});
  }, [calendarData]);
  const constructorRacePointColors = useMemo(() => {
    const colors = ['#a855f7', '#3b82f6', '#22c55e'];
    const raceTotals: Record<string, number[]> = {};

    teamsData.forEach((team: any) => {
      Object.entries(team.team_race_points ?? {}).forEach(([race, pts]) => {
        if (typeof pts !== 'number' || pts <= 0) return;
        if (!raceTotals[race]) raceTotals[race] = [];
        raceTotals[race].push(pts);
      });
    });

    return Object.entries(raceTotals).reduce<Record<string, Record<number, string>>>((map, [race, totals]) => {
      const rankedTotals = [...new Set(totals)].sort((a, b) => b - a).slice(0, 3);
      map[race] = {};
      rankedTotals.forEach((total, index) => {
        map[race][total] = colors[index];
      });
      return map;
    }, {});
  }, [teamsData]);

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
    const raceEntries = (Object.entries(team.team_race_points ?? {}) as [string, number | null][])
      .map(([race, pts]) => [
        race,
        pts ?? (!canceledRaceMap[race] && completedRaceMap[race] ? 'X' : null),
      ] as [string, number | 'X' | null]);
    const isExpanded = expandAll || expandedTeam === team.name;
    return (
      <div
        key={team.name}
        className="group relative rounded-2xl cursor-pointer mb-4 overflow-hidden border border-white/10 transition-all duration-200 hover:scale-[1.01]"
        style={{
          background: 'linear-gradient(135deg, #171717 0%, #0f0f0f 100%)',
          boxShadow: '0 14px 34px rgba(0,0,0,0.24)',
          animation: `slideUp 0.4s ease-out ${team.globalIndex * 0.04}s both`,
        }}
        onClick={() => setExpandedTeam(isExpanded && !expandAll ? null : team.name)}
      >
        <div
          className="absolute left-0 top-0 h-[62px]"
          style={{
            width: 60,
            background: `linear-gradient(135deg, ${accent} 0%, ${accent} 56%, transparent 57%)`,
          }}
        />
        <div
          className="absolute font-black italic leading-none select-none"
          style={{
            left: 8,
            top: 3,
            color: 'rgba(255,255,255,0.92)',
            fontSize: 46,
            letterSpacing: 0,
          }}
        >
          {team.globalIndex + 1}
        </div>
        <div className="relative z-10 px-4 py-3 text-white">
          <div className="flex items-center gap-4 min-h-[58px]">
            <div className="w-[36px] shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {team.logo_url && (
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: accent }}
                  >
                    <img src={team.logo_url} alt="team logo" className="max-h-[68%] max-w-[72%] object-contain" loading="lazy" />
                  </span>
                )}
                <span className="truncate text-2xl font-black uppercase leading-none text-white">
                  {team.name}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-end gap-1">
              <span className="text-4xl font-black text-white leading-none tabular-nums">{team.team_points ?? 0}</span>
              <span className="pb-1 text-[10px] font-bold text-white/45 leading-none">PTS</span>
            </div>
          </div>
          <div style={{ maxHeight: isExpanded ? '600px' : '0px', overflow: 'hidden', transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div className="rounded-xl p-3 mt-3 border border-white/10" style={{ backgroundColor: 'rgba(0,0,0,0.28)' }}>
              <div
                className="grid grid-flow-col gap-x-2 gap-y-1"
                style={{
                  gridTemplateRows: `repeat(${Math.ceil(raceEntries.length / 3)}, minmax(0, auto))`,
                  gridAutoColumns: 'minmax(0, 1fr)',
                }}
              >
                {raceEntries.map(([race, pts]) => (
                  <div key={race} className="grid grid-cols-2 items-center py-0.5 border-b border-white/5">
                    <span className="text-[10px] font-bold text-white/40 uppercase">{race}</span>
                    <span
                      className={`text-[11px] font-black ${typeof pts === 'number' && pts > 0 ? 'text-white' : pts === 'X' ? 'text-red-500' : completedRaceMap[race] ? 'text-white/40' : 'text-white/20'}`}
                      style={typeof pts === 'number' && constructorRacePointColors[race]?.[pts] ? { color: constructorRacePointColors[race][pts] } : undefined}
                    >
                      {canceledRaceMap[race] ? <span className="text-white/30 tracking-wider line-through decoration-white/40">CXL</span> : pts != null ? pts : '—'}
                    </span>
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
    <div className="overflow-y-auto no-scrollbar" style={{ height: 'calc(100vh - 6rem)' }}>
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
  const standingsTeamsData = useMemo(
    () => deriveTeamsFromCalendar(teamsData, calendarData),
    [teamsData, calendarData]
  );

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
          <RaceCalendarNavigator races={calendarData} isMobile={true} teamsData={standingsTeamsData} />
        )
      ) : (
      <Tabs
        theme="f1"
        value={activeTab}
        className="w-full"
        onValueChange={(v) => setActiveTab(v)}
      >
        {/* ── Tab Bar ── */}
        <PageNavbar
          tabs={[
            { value: 'dashboard',    label: 'Dashboard'    },
            { value: 'drivers',      label: 'Drivers'      },
            { value: 'constructors', label: 'Constructors' },
            { value: 'races',        label: 'Races'        },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* ========================
            TAB: Dashboard
        ======================== */}
        <TabsContent value="dashboard" className="mt-0">
          <div
            className="overflow-hidden flex flex-col gap-4 pr-1 pt-0"
            style={{ height: 'calc(100vh - 4.5rem)' }}
          >
            {/* Left column: Calendar + Driver grid stacked */}
            <div className="flex flex-col gap-8 flex-shrink-0 min-h-0" style={{ width: '100%', minHeight: '340px' }}>

              {/* Calendar */}
              <div className="flex-1 min-h-0">
                {loading ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  </div>
                ) : (
                  <RaceCalendarNavigator races={calendarData} teamsData={standingsTeamsData} />
                )}
              </div>

              {/* Bottom: Driver Standings */}
              <div className="flex-shrink-0">
                {(() => {
                  const allDrivers = standingsTeamsData.flatMap((team) =>
                    (team.drivers ?? []).map((d: any) => ({ ...d, teamColour: team.colour ?? '#ffffff' }))
                  )
                    .filter((d: any) => d.points != null)
                    .sort((a: any, b: any) => b.points - a.points)
                    .slice(0, 6);

                  return (
                    <div className="grid grid-cols-6 gap-3">
                      {allDrivers.map((driver: any, index: number) => {
                        const accent = driver.teamColour;
                        const lastName = driver.name.split(' ').slice(1).join(' ') || driver.name;
                        const latest = getLatestPoints(driver.race_points);
                        return (
                          <div
                            key={driver.name}
                            className="relative h-[82px] rounded-2xl overflow-hidden cursor-pointer hover:scale-[1.015] transition-all duration-200"
                            style={{
                              background: 'linear-gradient(135deg, #171717 0%, #0f0f0f 100%)',
                              border: '1px solid rgba(255,255,255,0.10)',
                              boxShadow: '0 12px 28px rgba(18,18,18,0.11)',
                              animation: `slideUp 0.35s ease-out ${index * 0.04}s both`,
                            }}
                          >
                            <div
                              className="absolute inset-y-0 left-0"
                              style={{
                                width: 30,
                                background: `linear-gradient(135deg, ${accent} 0%, ${accent} 54%, transparent 55%)`,
                              }}
                            />
                            <div
                              className="absolute font-black italic leading-none select-none"
                              style={{
                                left: 5,
                                top: 6,
                                color: 'rgba(255,255,255,0.96)',
                                fontSize: 24,
                                letterSpacing: 0,
                              }}
                            >
                              {index + 1}
                            </div>
                            <div className="relative z-10 h-full flex items-center justify-between gap-2 pl-[38px] pr-4">
                              <div className="min-w-0">
                                <p className="text-xs font-black uppercase leading-none truncate text-white">
                                  {lastName}
                                </p>
                                <div className="mt-2">
                                  <span className="text-[28px] font-black leading-none tabular-nums text-white">
                                    {driver.points}
                                  </span>
                                  <div className="flex items-baseline gap-1 mt-1">
                                  {latest != null && latest > 0 && (
                                    <span className="text-xs font-black tabular-nums leading-none" style={{ color: '#089f98' }}>
                                      +{latest}
                                    </span>
                                  )}
                                    <span className="text-[10px] font-bold text-white/45 leading-none">PTS</span>
                                  </div>
                                </div>
                              </div>
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
            <div className="flex-shrink-0 pb-4">
              <TeamStandingsGrid teamsData={standingsTeamsData} />
              {false && (
              <div className="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
              {[...standingsTeamsData]
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
                        backgroundColor: '#141414',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderLeft: `4px solid ${accent}`,
                        animation: `slideUp 0.35s ease-out ${index * 0.04}s both`,
                      }}
                    >
                      {/* Car image — anchored to bottom, pushed left */}
                      {team.car_url && (
                        <div className="absolute inset-0 rounded-xl overflow-hidden" aria-hidden>
                          <img
                            src={team.car_url}
                            alt=""
                            className="f1-team-car absolute object-contain"
                            style={{ height: '90px', width: 'auto', opacity: 0.95 }}
                            loading="lazy"
                          />
                          <div
                            className="absolute inset-0"
                            style={{ background: 'linear-gradient(90deg, transparent 30%, #141414 68%)' }}
                          />
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
                        {(() => {
                          const entries = Object.entries(team.team_race_points ?? {});
                          const latest = [...entries].reverse().find(([, v]) => v != null)?.[1] as number | null;
                          return (
                            <div className="flex items-center gap-2">
                              <span className="text-3xl font-black text-white leading-none tabular-nums">{pts}</span>
                              {latest != null && latest > 0 && (
                                <span className="text-[11px] font-black tabular-nums text-white">+{latest}</span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>

          </div>
        </TabsContent>

        {/* ========================
            TAB: Drivers
        ======================== */}
        <TabsContent value="drivers" className="mt-3">
          <DriversTab teamsData={standingsTeamsData} calendarData={calendarData} />
        </TabsContent>

        {/* ========================
            TAB: Constructors
        ======================== */}
        <TabsContent value="constructors" className="mt-3">
          <ConstructorsTab teamsData={standingsTeamsData} calendarData={calendarData} />
        </TabsContent>

        {/* ========================
            TAB: Races
        ======================== */}
        <TabsContent value="races" className="mt-3">
          <div className="overflow-y-auto no-scrollbar" style={{ height: 'calc(100vh - 6rem)' }}>
            <div className="grid grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
              {[...calendarData]
                .sort((a, b) => a.race_number - b.race_number)
                .map((race, index) => {
                  const todayKey = new Date().toISOString().slice(0, 10);
                  const raceKey = parseRaceEndDate(race.date);
                  const hasDate = !!race.date && race.date.trim().length > 0 && race.date.trim().toUpperCase() !== 'TBD';
                  const isCanceled = race.start_time_west === 'Canceled';
                  const isUpcoming = !isCanceled && hasDate && raceKey >= todayKey;
                  const statusColor = isCanceled ? '#ef4444' : isUpcoming ? '#a855f7' : '#22c55e';
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
                      <div
                        className="absolute left-0 top-0 z-20 h-[72px]"
                        style={{
                          width: 68,
                          background: `linear-gradient(135deg, ${statusColor} 0%, ${statusColor} 56%, transparent 57%)`,
                        }}
                      />
                      <div
                        className="absolute z-30 font-black italic leading-none select-none text-white"
                        style={{
                          left: 8,
                          top: 7,
                          fontSize: 42,
                          letterSpacing: 0,
                        }}
                      >
                        {race.race_number}
                      </div>

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
                      <div className="relative z-10 p-4 pl-[76px] pb-2 flex-shrink-0">
                        <div className="mt-1">
                          <h2
                            className="text-xl font-black uppercase leading-[0.9] flex-1"
                            style={{
                              color: isCanceled ? 'rgba(255,255,255,0.4)' : 'white',
                              letterSpacing: 0,
                              textShadow: isCanceled ? undefined : '0 8px 18px rgba(0,0,0,0.38)',
                            }}
                          >
                            {race.race_name}
                          </h2>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-[11px] font-black uppercase leading-none" style={{ color: isCanceled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)', letterSpacing: 0 }}>{race.date}</span>
                          {false && !isCanceled && (
                            <>
                              <span className="text-white/20 text-xs">·</span>
                              <span className="text-[11px] font-black uppercase leading-none text-white/75">{race.start_time_west}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Track SVG */}
                      <style>{`.f1-races-svg-wrap svg { width: 100% !important; height: 100% !important; display: block; }`}</style>
                      <div className="f1-races-svg-wrap absolute z-10" style={{ top: '34%', left: '5%', right: '5%', bottom: '1%' }}>
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
        .f1-dashboard-track-wrap {
          transform: translate(-22px, -52px);
          transform-origin: center center;
        }
        @media (min-width: 1280px) {
          .f1-dashboard-track-wrap {
            transform: translate(-22px, -28px) scale(1.39);
          }
        }
      `}</style>
    </PageLayout>
  );
};

export default F1;
