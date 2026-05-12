import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// ── Module-level data cache ──────────────────────────────────────────────────
let _f1Cache: any[] | null = null;
let _nbaCache: any[] | null = null;
let _nflCache: any[] | null = null;
// ────────────────────────────────────────────────────────────────────────────

// ── Sport icons ───────────────────────────────────────────────────────────────

const NBAIcon = () => (
  <svg viewBox="0 0 77.832 77.832" width="24" height="24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M38.916,0C17.458,0,0,17.458,0,38.916c0,2.489,0.245,4.923,0.693,7.284l-0.146,0.175
      c0.07,0.059,0.138,0.109,0.208,0.167c3.555,17.819,19.312,31.29,38.161,31.29c21.458,0,38.916-17.458,38.916-38.916
      S60.374,0,38.916,0z M72.061,25.249c-0.052,12.625-11.312,15.317-16.045,15.888c3.945-13.604,2.821-26.663,1.959-32.572
      C64.236,12.512,69.199,18.337,72.061,25.249z M54.559,6.658c0.653,3.375,3.119,18.577-1.675,34.318
      c-9.122-2.418-10.416-9.061-12.143-18.104c-1.169-6.126-2.491-12.99-6.694-19.474c1.594-0.217,3.217-0.339,4.869-0.339
      C44.521,3.059,49.829,4.354,54.559,6.658z M30.764,4.005c4.453,6.291,5.793,13.262,6.973,19.441
      c1.714,8.979,3.346,17.479,14.175,20.446c-0.799,2.201-1.749,4.398-2.877,6.562C26.575,39.574,12.794,22.096,9.798,18.031
      C14.786,11.094,22.187,6.007,30.764,4.005z M8.018,20.751c4.195,5.486,17.939,21.856,39.521,32.371
      c-0.844,1.407-1.773,2.791-2.789,4.147c-5.908-2.934-11.457-3.388-16.834-3.826c-7.44-0.607-15.128-1.256-24.354-8.571
      c-0.326-1.938-0.504-3.926-0.504-5.956C3.059,32.29,4.872,26.083,8.018,20.751z M4.647,49.475
      c8.612,5.83,15.922,6.438,23.021,7.018c5.113,0.417,9.972,0.82,15.12,3.232c-4.148,4.854-9.563,9.235-16.591,12.709
      C15.932,68.525,7.908,60.038,4.647,49.475z M30.319,73.725c6.382-3.564,11.38-7.873,15.283-12.574
      c1.639,0.906,4.851,3.021,5.688,6.066c0.497,1.805,0.046,3.756-1.312,5.803c-3.485,1.133-7.201,1.754-11.061,1.754
      C35.953,74.773,33.074,74.405,30.319,73.725z M54.134,71.374c0.507-1.685,0.552-3.351,0.101-4.983
      c-1.068-3.863-4.598-6.434-6.729-7.677c1.028-1.403,1.967-2.833,2.823-4.284c5.354,2.402,11.157,4.416,17.387,5.82
      C64.193,64.993,59.529,68.834,54.134,71.374z M69.557,57.523c-6.373-1.342-12.293-3.354-17.74-5.776
      c1.27-2.456,2.322-4.952,3.191-7.446c2.686-0.195,10.21-1.199,15.299-6.387c1.709-1.742,2.957-3.786,3.758-6.096
      c0.463,2.295,0.709,4.668,0.709,7.098C74.773,45.725,72.865,52.096,69.557,57.523z"/>
  </svg>
);

const F1Icon = () => (
  <svg viewBox="0 0 98.751 98.75" width="28" height="28" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.106,46.936c-3.79,0-6.866,3.071-6.866,6.866c0,0.293,0.024,0.58,0.062,0.862
      c0.426,3.386,3.307,6.003,6.805,6.003c3.598,0,6.54-2.761,6.839-6.279c0.017-0.194,0.03-0.389,0.03-0.586
      C28.976,50.008,25.9,46.936,22.106,46.936z M18.667,51.213l1.402,1.4c-0.109,0.188-0.196,0.391-0.249,0.605h-1.975
      C17.947,52.469,18.234,51.789,18.667,51.213z M17.839,54.407h1.988c0.057,0.212,0.139,0.412,0.25,0.598l-1.404,1.402
      C18.239,55.836,17.944,55.152,17.839,54.407z M21.512,58.067c-0.742-0.102-1.419-0.395-1.99-0.824l1.396-1.398
      c0.182,0.107,0.385,0.186,0.594,0.24V58.067z M21.512,51.516c-0.214,0.057-0.417,0.144-0.606,0.254l-1.396-1.398
      c0.573-0.438,1.256-0.726,2.003-0.83L21.512,51.516z M22.701,49.542c0.751,0.104,1.433,0.393,2.007,0.831l-1.397,1.397
      c-0.188-0.11-0.393-0.197-0.609-0.254L22.701,49.542z M22.701,58.067v-1.98c0.212-0.057,0.412-0.135,0.598-0.244l1.395,1.4
      C24.123,57.674,23.446,57.965,22.701,58.067z M25.547,56.411l-1.407-1.408c0.107-0.185,0.198-0.382,0.255-0.596h1.972
      C26.263,55.152,25.982,55.84,25.547,56.411z M24.395,53.219c-0.053-0.215-0.139-0.418-0.247-0.605l1.4-1.4
      c0.435,0.575,0.721,1.256,0.823,2.006H24.395z"/>
    <path d="M78.029,53.801c0-3.049,1.638-5.717,4.072-7.19l-16.177-7.166H55.775c-0.604,0-1.094,0.49-1.094,1.095v1.438
      c0,0.604,0.489,1.095,1.094,1.095h0.72v0.997h-1.841c-0.579,0-1.096,0.371-1.277,0.921L53.23,45.43
      c-3.351-0.271-4.945,2.294-6.62,2.294l-1.131-1.361c-0.674-0.813-1.706-1.241-2.758-1.144c-0.32,0.03-0.661,0.094-1.008,0.211
      l-0.635,2.294c0,0-5.759-0.335-13.245-0.066c1.648,1.537,2.687,3.72,2.687,6.146c0,0.24,0.039,5.32,0.039,5.32h49.383
      c-0.976-1.188-1.637-2.648-1.84-4.266C78.055,54.485,78.029,54.135,78.029,53.801z"/>
    <path d="M13.695,53.801c0-1.928,0.659-3.699,1.753-5.12C9.664,49.487,4.044,50.83,0,53.047
      c0,1.176,5.168,0.019,5.168,2.448H1.181c-0.402,0-0.728,0.325-0.728,0.728v2.172c0,0.402,0.325,0.729,0.728,0.729h9.969
      c0.403,0,0.729-0.326,0.729-0.729v-3.354h1.922c-0.009-0.062-0.024-0.121-0.032-0.185C13.72,54.485,13.695,54.135,13.695,53.801z"/>
    <path d="M96.938,38.084H86.284c-1.003,0-1.815,0.812-1.815,1.814v2.376c0,0.48,0.191,0.942,0.531,1.282l1.855,1.854
      c4.446,0.218,8,3.893,8,8.391c0,0.111-0.012,0.224-0.017,0.334h3.912V39.899C98.752,38.896,97.939,38.084,96.938,38.084z"/>
    <path d="M86.74,46.936c-3.79,0-6.866,3.071-6.866,6.866c0,0.293,0.024,0.58,0.062,0.862
      c0.426,3.386,3.308,6.003,6.806,6.003c3.598,0,6.54-2.761,6.84-6.279c0.017-0.194,0.028-0.389,0.028-0.586
      C93.609,50.008,90.535,46.936,86.74,46.936z M83.302,51.213l1.401,1.4c-0.109,0.188-0.195,0.391-0.249,0.605h-1.976
      C82.581,52.469,82.868,51.789,83.302,51.213z M82.473,54.407h1.988c0.057,0.212,0.139,0.412,0.25,0.598l-1.404,1.402
      C82.873,55.836,82.578,55.152,82.473,54.407z M86.146,58.067c-0.742-0.102-1.42-0.395-1.99-0.824l1.396-1.396
      c0.183,0.106,0.386,0.185,0.595,0.24V58.067z M86.146,51.516c-0.215,0.057-0.418,0.144-0.606,0.254l-1.396-1.398
      c0.572-0.438,1.256-0.726,2.004-0.83v1.975H86.146z M87.335,49.542c0.751,0.104,1.433,0.393,2.007,0.831l-1.396,1.397
      c-0.188-0.11-0.393-0.197-0.609-0.254L87.335,49.542z M87.335,58.067v-1.98c0.212-0.057,0.412-0.135,0.599-0.244l1.396,1.4
      C88.758,57.674,88.08,57.965,87.335,58.067z M90.182,56.411l-1.408-1.408c0.107-0.185,0.199-0.382,0.256-0.596h1.972
      C90.896,55.152,90.616,55.84,90.182,56.411z M89.029,53.219c-0.055-0.215-0.139-0.418-0.248-0.605l1.4-1.4
      c0.435,0.575,0.721,1.256,0.822,2.006H89.029z"/>
  </svg>
);

const NFLIcon = () => (
  <svg viewBox="0 0 64 64" width="26" height="26" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.8 40.3C.7 52 3.2 57 5.1 58.9s7 4.4 18.6 2.3c-4.3-2.3-8.3-5.3-12-8.9c-3.6-3.6-6.6-7.7-8.9-12" />
    <path d="M61.1 23.8c2.1-11.6.3-17.4-1.6-19.3c-1.9-1.9-7.7-3.6-19.3-1.6c4.3 2.3 8.3 5.3 12 8.9c3.6 3.7 6.6 7.7 8.9 12" />
    <path d="M30.8 5.4c-5.6 2-11.2 5.1-15.9 9.7c-4.6 4.7-7.7 10.3-9.7 15.9c1.9 6.1 5.6 12 10.7 17.1c5.1 5.1 11 8.8 17.1 10.7c5.6-2 11.2-5.1 15.9-9.7c4.7-4.7 7.7-10.2 9.7-15.9c-1.9-6.1-5.6-12-10.7-17.1c-5-5.2-11-8.8-17.1-10.7" />
    <path d="M5.2 31c-1.1 3.1-1.9 6.3-2.5 9.4c2.3 4.3 5.3 8.3 8.9 12c3.6 3.6 7.7 6.6 12 8.9c3-.5 6.2-1.3 9.4-2.5c-6.1-1.9-12.1-5.6-17.1-10.7C10.8 43 7.1 37.1 5.2 31" />
    <path d="M52.2 11.8c-3.6-3.6-7.7-6.6-12-8.9c-3 .5-6.2 1.3-9.4 2.5C36.9 7.3 42.9 10.9 48 16s8.8 11 10.7 17.1c1.1-3.1 1.9-6.3 2.5-9.4c-2.4-4.2-5.4-8.2-9-11.9" />
    <path d="M37.8 19.8l6.3 6.3c1 1 2.6-.6 1.6-1.6l-6.3-6.3c-1-1-2.6.6-1.6 1.6" />
    <path d="M33.1 24.6l6.3 6.3c1 1 2.6-.6 1.6-1.6L34.7 23c-1.1-1-2.6.6-1.6 1.6" />
    <path d="M28.3 29.3l6.3 6.3c1 1 2.6-.6 1.6-1.6l-6.3-6.3c-1-1-2.6.6-1.6 1.6" />
    <path d="M23.6 34.1l6.3 6.3c1 1 2.6-.6 1.6-1.6l-6.3-6.3c-1.1-1-2.7.6-1.6 1.6" />
    <path d="M18.8 38.8l6.3 6.3c1 1 2.6-.6 1.6-1.6l-6.3-6.3c-1-1-2.6.6-1.6 1.6" />
    <path d="M21.4 44.2l23.4-23.4c1-1-.6-2.6-1.6-1.6L19.8 42.6c-1 1.1.5 2.7 1.6 1.6" />
  </svg>
);

const PAGES = [
  { path: '/nba' },
  { path: '/f1'  },
  { path: '/nfl' },
] as const;

const ACTIVE_STYLES: Record<string, { background: string; color: string }> = {
  '/nba': { background: 'linear-gradient(90deg, #4c1d95, #2dd4bf)', color: 'white'   },
  '/f1':  { background: 'linear-gradient(90deg, #2dd4bf, #0f766e)', color: 'white'   },
  '/nfl': { background: 'linear-gradient(90deg, #0f766e, #4c1d95)', color: 'white'   },
};

interface Tab {
  value: string;
  label: string;
}

interface PageNavbarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface NextEvent {
  sport: 'F1' | 'NBA' | 'NFL';
  name: string;
  time: Date;
}

function parseLocalTime(timeStr: string): { h: number; m: number } | null {
  const tm = timeStr.match(/(\d+):(\d+)\s*([AP]M)/i);
  if (!tm) return null;
  let h = parseInt(tm[1]);
  if (tm[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (tm[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return { h, m: parseInt(tm[2]) };
}

function abbreviateMatchup(matchup: string): string {
  const parts = matchup.split(' @ ');
  if (parts.length !== 2) return matchup;
  const abbr = (s: string) => s.split(' ').pop() ?? s;
  return `${abbr(parts[0])} @ ${abbr(parts[1])}`;
}

function getNextF1Event(races: any[]): NextEvent | null {
  const now = new Date();
  const year = now.getFullYear();

  // Sort races by date so we check chronologically
  const sorted = [...races]
    .filter(r => r.start_time_west !== 'Canceled')
    .sort((a, b) => {
      const parse = (r: any) => {
        const st = r.session_times?.Race ?? r.start_time_west ?? '';
        return new Date(st).getTime();
      };
      return parse(a) - parse(b);
    });

  for (const race of sorted) {
    const sessions = race.session_times ?? {};
    const order = [
      'Free Practice 1', 'Free Practice 2', 'Free Practice 3',
      'Sprint', 'Sprint Qualifying', 'Sprint Race',
      'Qualifying', 'Race',
    ];
    for (const key of order) {
      const raw = sessions[key];
      if (!raw) continue;
      // Parse "March 15 at 12:00 AM PDT"
      const clean = raw.replace(/\s+P[SD]T$/i, '').trim();
      const m = clean.match(/^([A-Za-z]+ \d+) at (\d+:\d+ [AP]M)$/i);
      if (!m) continue;
      let d = new Date(`${m[1]} ${year} ${m[2]}`);
      if (isNaN(d.getTime())) d = new Date(`${m[1]} ${year + 1} ${m[2]}`);
      if (isNaN(d.getTime()) || d <= now) continue;
      const shortName = race.race_name.replace(/ Grand Prix$/i, ' GP');
      return { sport: 'F1', name: shortName, time: d };
    }
  }
  return null;
}

function getNextScheduledEvent(games: any[], sport: 'NBA' | 'NFL'): NextEvent | null {
  const now = new Date();
  let best: NextEvent | null = null;

  for (const g of games) {
    if (g.status === 'final') continue;
    try {
      let dt: Date;
      if (sport === 'NFL' && g.ts_utc) {
        dt = new Date(g.ts_utc * 1000);
      } else {
        const [y, mo, d] = (g.date as string).split('-').map(Number);
        const t = parseLocalTime(g.time ?? '');
        if (!t) continue;
        dt = new Date(y, mo - 1, d, t.h, t.m);
      }
      if (dt <= now) continue;
      if (!best || dt < best.time) {
        best = { sport, name: abbreviateMatchup(g.matchup ?? ''), time: dt };
      }
    } catch { /* skip malformed */ }
  }
  return best;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

function useNextEvent() {
  const [candidates, setCandidates] = useState<NextEvent[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const load = async () => {
      const safeJson = async (url: string, cache: any[] | null): Promise<any[] | null> => {
        if (cache) return cache;
        try {
          const r = await fetch(url, { cache: 'no-store' });
          if (!r.ok) return null;
          return await r.json();
        } catch { return null; }
      };

      const [f1, nba, nfl] = await Promise.all([
        safeJson('/data/f1_calendar.json',  _f1Cache ).then(d => { if (d) _f1Cache  = d; return d; }),
        safeJson('/data/nba_schedule.json', _nbaCache).then(d => { if (d) _nbaCache = d; return d; }),
        safeJson('/data/nfl_schedule.json', _nflCache).then(d => { if (d) _nflCache = d; return d; }),
      ]);

      const found: NextEvent[] = [];
      if (f1)  { const e = getNextF1Event(f1);                   if (e) found.push(e); }
      if (nba) { const e = getNextScheduledEvent(nba, 'NBA');     if (e) found.push(e); }
      if (nfl) { const e = getNextScheduledEvent(nfl, 'NFL');     if (e) found.push(e); }
      setCandidates(found);
    };
    load();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  const next = candidates
    .filter(e => e.time > now)
    .sort((a, b) => a.time.getTime() - b.time.getTime())[0] ?? null;

  if (!next) return null;

  const diff = Math.max(0, next.time.getTime() - now.getTime());
  const s = Math.floor(diff / 1_000);
  return {
    event: next,
    days:  Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    mins:  Math.floor((s % 3600) / 60),
    secs:  s % 60,
  };
}

// ── Countdown display ─────────────────────────────────────────────────────────

const NextEventCountdown = () => {
  const data = useNextEvent();
  if (!data) return null;
  const { event, days, hours, mins, secs } = data;

  return (
    <div className="flex items-center gap-4 shrink-0">
      <div className="relative flex items-end whitespace-nowrap">
        <span
          className="absolute bottom-full mb-0.5 right-0 text-[10px] font-bold tracking-widest uppercase"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          NEXT · {event.sport}
        </span>
        <span className="text-sm font-bold text-white">{event.name}</span>
      </div>
      <div className="flex items-end gap-3">
        {([{ v: days, l: 'D' }, { v: hours, l: 'H' }, { v: mins, l: 'M' }, { v: secs, l: 'S' }] as const).map(({ v, l }) => (
          <div key={l} className="flex flex-col items-center">
            <span className="text-xl font-black text-white tabular-nums leading-none">
              {String(v).padStart(2, '0')}
            </span>
            <span
              className="text-[9px] font-bold tracking-wider uppercase"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              {l}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── TabBar with sliding indicator ────────────────────────────────────────────

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  activePath: string;
}

function TabBar({ tabs, activeTab, onTabChange, activePath }: TabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const initializedRef = useRef(false);

  useLayoutEffect(() => {
    const activeIndex = tabs.findIndex(t => t.value === activeTab);
    const el = tabRefs.current[activeIndex];
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    if (!el || !container || !indicator) return;

    const left = el.getBoundingClientRect().left - container.getBoundingClientRect().left;
    const width = el.offsetWidth;

    if (!initializedRef.current) {
      indicator.style.transition = 'none';
      indicator.style.transform = `translateX(${left}px)`;
      indicator.style.width = `${width}px`;
      indicator.style.opacity = '1';
      initializedRef.current = true;
      void indicator.getBoundingClientRect(); // flush so "no-transition" position commits
      indicator.style.transition = 'transform 0.2s ease, width 0.2s ease';
    } else {
      indicator.style.transform = `translateX(${left}px)`;
      indicator.style.width = `${width}px`;
    }
  }, [activeTab, tabs]);

  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    if (!indicator || !initializedRef.current) return;
    indicator.style.background = ACTIVE_STYLES[activePath]?.background ?? 'white';
  }, [activePath]);

  return (
    <div ref={containerRef} className="relative flex flex-1 items-center gap-5 mx-3">
      {tabs.map(({ value, label }, i) => (
        <button
          key={value}
          ref={el => { tabRefs.current[i] = el; }}
          onClick={() => onTabChange(value)}
          className="text-[15px] font-semibold pt-3 pb-3 whitespace-nowrap"
          style={{
            color: activeTab === value ? 'white' : 'rgba(255,255,255,0.45)',
            transition: 'color 0.2s ease',
          }}
        >
          {label}
        </button>
      ))}
      <span
        ref={indicatorRef}
        className="absolute bottom-0 left-0 h-0.5 rounded-full pointer-events-none"
        style={{
          opacity: 0,
          willChange: 'transform, width',
          background: ACTIVE_STYLES[activePath]?.background ?? 'white',
        }}
      />
    </div>
  );
}

// ── PageNavbar ────────────────────────────────────────────────────────────────

export function PageNavbar({ tabs, activeTab, onTabChange }: PageNavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const activePath = PAGES.find(p => location.pathname.startsWith(p.path))?.path ?? '/f1';

  return (
    <div className="flex items-center -mx-4 px-2 pt-1 pb-1 mb-1">
      {/* Left: page switcher pill tabs */}
      <div
        className="flex items-center gap-2 rounded-full p-1 shrink-0"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        {PAGES.map(({ path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="px-3 py-2 rounded-full transition-all duration-200 focus:outline-none focus-visible:outline-none flex items-center justify-center"
          >
            <div
              className="w-[5px] h-5 rounded-full transition-all duration-200"
              style={
                activePath === path
                  ? { background: 'white' }
                  : { background: 'rgba(255,255,255,0.25)' }
              }
            />
          </button>
        ))}
      </div>

      {/* Center: page-specific underline tabs */}
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} activePath={activePath} />

      {/* Right: next upcoming event countdown */}
      <NextEventCountdown />
    </div>
  );
}
