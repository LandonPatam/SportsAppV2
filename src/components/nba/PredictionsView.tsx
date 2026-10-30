import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Data written by the NBA Forecaster (`nba_forecaster auto --export`), refreshed by data/nba_predictions.py.
// The main file is today's forecast; past days are in /data/nba_predictions/<YYYYMMDD>.json.
const PREDICTIONS_URL = '/data/nba_predictions.json';
const dayUrl = (yyyymmdd: string) => `/data/nba_predictions/${yyyymmdd}.json`;
const DK_COLOR = '#22c55e';
const ESPN_COLOR = '#ef4444';
const POLL_MS = 60_000;

type Range = [number, number] | null;
type PlayerProjection = {
  id: string; name: string; status: string | null; play_prob: number; minutes: number;
  pts: number; reb: number; ast: number; fg3m: number; stl: number; blk: number; tov: number;
  range80: { pts: Range; reb: Range; ast: Range };
};
type TeamSide = {
  team_id: string; abbr: string; name: string | null; win_prob: number; expected_score: number;
  back_to_back: boolean; out: string[]; players: PlayerProjection[];
};
type MarketLine = { home_win_prob: number; spread?: number | null; over_under?: number | null } | null;
type PredictionGame = {
  game_id: string; tip_utc: string; home: TeamSide; away: TeamSide; expected_margin: number;
  injury_report: { report_time_utc?: string | null; usable?: boolean } | null;
  issued_before_tip: boolean;
  market: { draftkings: MarketLine; espn: MarketLine; captured_at?: string | null };
  result: { home_score: number; away_score: number; model_correct: boolean } | null;
};
type Comparison = {
  games: number; ours: { log_loss: number; accuracy: number }; theirs: { log_loss: number; accuracy: number };
  disagreements: number; ours_right_in_disagreements: number;
};
type DayData = { date: string; issued_at: string | null; games: PredictionGame[] };
type PredictionsData = {
  date: string; issued_at: string | null; generated_at: string; available_dates?: string[];
  games: PredictionGame[]; recent_results: PredictionGame[];
  season_record: { since: string; games: number; model?: { accuracy: number; log_loss: number; margin_mae: number };
                   vs?: { draftkings?: Comparison; espn_predictor?: Comparison } };
};

// `gradient` is the Scoreboard card's team color (teamGradientColors start).
export type TeamLook = { abbr: string; logo?: string; primary: string; secondary: string; gradient: string };

// Live or final score from the Scoreboard's polled schedule, keyed by ESPN game id (no "espn:" prefix).
export type LiveScore = { away: number; home: number; final: boolean; period: number | null; clock: string | null };
const liveKey = (gameId: string) => gameId.replace(/^espn:/, '');

// Actual box scores, saved by data/nba_boxscores.py as soon as the schedule marks a game final.
const boxscoreUrl = (gameId: string) => `/data/nba_boxscores/${liveKey(gameId)}.json`;
const BOXSCORE_RETRY_MS = 20_000;
type StatKey = 'min' | 'pts' | 'reb' | 'ast' | 'fg3m' | 'stl' | 'blk' | 'tov';
type ActualLine = { id: string; name: string; starter: boolean; dnp: boolean } & Record<StatKey, number | null>;
type BoxScore = { game_id: string; fetched_at: string; teams: { abbr: string; players: ActualLine[] }[] };

// Neutral card surface shared with the Scoreboard's "No games" card.
const PANEL = 'rounded-2xl border bg-card/60 backdrop-blur-sm';

const pct = (p: number) => `${Math.round(p * 100)}%`;
const fmtTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';
const fmtDate = (yyyymmdd: string) =>
  new Date(`${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6)}T12:00:00`)
    .toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

const TeamBlock = ({ side, look, align }: { side: TeamSide; look: TeamLook; align: 'left' | 'right' }) => (
  <div className={`flex items-center gap-3 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
    {look.logo
      ? <img src={look.logo} alt="" className="h-14 w-14 object-contain" loading="lazy" />
      : <span className="text-lg font-black text-white">{look.abbr}</span>}
    <div>
      <div className="text-4xl font-black tracking-wide tabular-nums text-white leading-none">{pct(side.win_prob)}</div>
      <div className="mt-1 text-xs font-black tracking-wide text-white/80">
        {side.name ?? look.abbr}{side.back_to_back ? ' · B2B' : ''}
      </div>
    </div>
  </div>
);

// One bar: the fill is the model's away/home win split. Market ticks sit at their own split point,
// DraftKings on the top half and ESPN on the bottom half, so both show even when they coincide.
// The final score sits underneath once the game is over (no live scores on this tab).
const GameBar = ({ game, score, away, home }: { game: PredictionGame; score: LiveScore | null; away: TeamLook; home: TeamLook }) => {
  const markets = [
    { label: 'DraftKings', color: DK_COLOR, p: game.market.draftkings?.home_win_prob, position: '-top-2' },
    { label: 'ESPN', color: ESPN_COLOR, p: game.market.espn?.home_win_prob, position: 'top-1.5' },
  ].filter((m): m is { label: string; color: string; p: number; position: string } => typeof m.p === 'number');
  return (
    <div className="mt-4">
      <div className="relative h-3 w-full rounded-full bg-black/30 ring-1 ring-white/20">
        <div className="absolute inset-y-0 left-0 rounded-l-full" style={{ width: pct(game.away.win_prob), background: away.primary }} />
        <div className="absolute inset-y-0 right-0 rounded-r-full" style={{ width: pct(game.home.win_prob), background: home.primary }} />
        {markets.map((m) => (
          <div key={m.label} className={`absolute ${m.position} z-10 h-[14px] w-[3px] -translate-x-1/2 rounded-full`}
               style={{ left: `${(1 - m.p) * 100}%`, background: m.color }} title={`${m.label}: ${home.abbr} ${pct(m.p)}`} />
        ))}
      </div>
      {score?.final && (
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center text-xs font-black tracking-wide tabular-nums text-white">
          <span className={score.away < score.home ? 'text-white/50' : ''}>{score.away}</span>
          <span className="text-white/80">Final</span>
          <span className={`text-right ${score.home < score.away ? 'text-white/50' : ''}`}>{score.home}</span>
        </div>
      )}
    </div>
  );
};

// Final points minus the predicted score as displayed (rounded), so "110" and a final of 116 reads +6.
const ScoreDiff = ({ predicted, actual }: { predicted: number; actual: number }) => {
  const diff = actual - Math.round(predicted);
  return (
    <span className={`text-sm font-black ${diff === 0 ? 'text-white/40' : diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
      {diff === 0 ? '0' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)}`}
    </span>
  );
};

const Dot = ({ color }: { color: string }) => (
  <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: color }} />
);

const isoKey = (yyyymmdd: string) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6)}`;

const DateNavigator = ({ dates, current, today, onChange }: {
  dates: string[]; current: string; today: string; onChange: (d: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => ({ year: Number(current.slice(0, 4)), month: Number(current.slice(4, 6)) }));
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const ref = useRef<HTMLDivElement | null>(null);
  const index = dates.indexOf(current);
  const available = useMemo(() => new Set(dates), [dates]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const openCalendar = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setMonth({ year: Number(current.slice(0, 4)), month: Number(current.slice(4, 6)) });
    setOpen(true);
  };
  const firstDay = new Date(month.year, month.month - 1, 1).getDay();
  const daysInMonth = new Date(month.year, month.month, 0).getDate();
  const cells: (string | null)[] = [...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month.year}${String(month.month).padStart(2, '0')}${String(i + 1).padStart(2, '0')}`)];
  const label = new Date(isoKey(current) + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const monthLabel = new Date(month.year, month.month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const shiftMonth = (delta: number) => setMonth(({ year, month: m }) => {
    const d = new Date(year, m - 1 + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  return (
    <div className="relative flex items-center justify-center gap-3">
      <Button variant="ghost" size="icon" onClick={() => onChange(dates[index - 1])} disabled={index <= 0} className="rounded-full hover:bg-white/10">
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <div className="text-lg font-black tracking-wide text-white">{label}</div>
      <Button variant="ghost" size="icon" onClick={() => onChange(dates[index + 1])} disabled={index < 0 || index >= dates.length - 1} className="rounded-full hover:bg-white/10">
        <ChevronRight className="h-5 w-5" />
      </Button>
      <div className="absolute right-0" ref={ref}>
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-transparent" onClick={openCalendar} aria-label="Pick a date">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </Button>
        {open && (
          <div className="fixed z-50 w-72 rounded-xl border border-white/10 p-4 shadow-2xl"
               style={{ backgroundColor: '#1a1a1a', top: position.top, right: position.right }}>
            <div className="mb-3 flex items-center justify-between">
              <button className="rounded-full p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white" onClick={() => shiftMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-black tracking-wide text-white">{monthLabel}</span>
              <button className="rounded-full p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white" onClick={() => shiftMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-0.5 grid grid-cols-7">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div key={d} className="py-0.5 text-center text-[10px] font-black tracking-wide text-white/30">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((key, i) => {
                if (!key) return <div key={`empty-${i}`} />;
                const has = available.has(key);
                const selected = key === current;
                return (
                  <button
                    key={key}
                    disabled={!has}
                    onClick={() => { onChange(key); setOpen(false); }}
                    className={`relative flex h-[32px] w-full items-center justify-center rounded-lg text-xs font-black tabular-nums transition-all duration-150 ${
                      selected ? 'bg-white text-black shadow-lg' : has ? 'cursor-pointer text-white hover:bg-white/15' : 'cursor-default text-white/20'}`}
                  >
                    {Number(key.slice(6))}
                    {key === today && (
                      <span className={`absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${selected ? 'bg-black' : 'bg-white/70'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Stat columns: header, projected field, actual (box score) field.
const STAT_COLUMNS: { label: string; projected: keyof PlayerProjection; actual: StatKey; strong?: boolean }[] = [
  { label: 'Min', projected: 'minutes', actual: 'min' },
  { label: 'Pts', projected: 'pts', actual: 'pts', strong: true },
  { label: 'Reb', projected: 'reb', actual: 'reb' },
  { label: 'Ast', projected: 'ast', actual: 'ast' },
  { label: '3PM', projected: 'fg3m', actual: 'fg3m' },
  { label: 'Stl', projected: 'stl', actual: 'stl' },
  { label: 'Blk', projected: 'blk', actual: 'blk' },
  { label: 'TO', projected: 'tov', actual: 'tov' },
];

// With a box score (`actuals`), each cell shows the projection followed by the actual-minus-projected
// difference: green + when the player beat it, red - when he fell short.
const PlayerTable = ({ side, look, actuals }: { side: TeamSide; look: TeamLook; actuals?: Map<string, ActualLine> }) => (
  <div className="min-w-0 flex-1">
    <div className="mb-2 flex items-center gap-2">
      {look.logo && <img src={look.logo} alt="" className="h-6 w-6 object-contain" />}
      <span className="text-sm font-black uppercase tracking-wide text-white">{side.name ?? look.abbr}</span>
    </div>
    <table className="w-full text-xs font-semibold text-white/90 tabular-nums">
      <thead className="text-[10px] uppercase tracking-wide text-white/50">
        <tr>
          <th className="py-1 text-left font-black">Player</th>
          <th className="py-1 text-right font-black">Play</th>
          {/* With a box score each stat gets a second, unlabeled column for its difference,
              so the header stays right over the projection. */}
          {STAT_COLUMNS.map((c) => (
            <React.Fragment key={c.label}>
              <th className="py-1 text-right font-black">{c.label}</th>
              {actuals && <th className="w-[3rem]" aria-hidden />}
            </React.Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {side.players.map((p) => {
          const actual = actuals?.get(liveKey(p.id));
          return (
            <tr key={p.id} className="border-t border-white/5">
              <td className="py-1 pr-2 text-left">
                {p.name}
                {actual?.dnp ? (
                  <span className="ml-1 rounded bg-white/10 px-1 text-[10px] font-bold text-white/60">DNP</span>
                ) : p.status && !['unlisted', 'unknown'].includes(p.status) && (
                  <span className="ml-1 rounded bg-amber-400/20 px-1 text-[10px] font-bold text-amber-300">{p.status}</span>
                )}
              </td>
              <td className="py-1 text-right">{pct(p.play_prob)}</td>
              {STAT_COLUMNS.map((c) => {
                const projected = p[c.projected] as number;
                const value = actual && !actual.dnp ? actual[c.actual] : null;
                const diff = value == null ? null : Math.round((value - projected) * 10) / 10;
                return (
                  <React.Fragment key={c.label}>
                    <td className={`py-1 text-right whitespace-nowrap ${c.strong ? 'font-black text-white' : ''}`}>
                      {projected.toFixed(1)}
                    </td>
                    {actuals && (
                      <td className={`py-1 pl-1.5 text-left whitespace-nowrap text-[11px] font-black ${
                        diff == null || diff === 0 ? 'text-white/40' : diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {diff == null ? '—' : diff === 0 ? '0.0' : `${diff > 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)}`}
                      </td>
                    )}
                  </React.Fragment>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
    {side.out.length > 0 && <div className="mt-2 text-[11px] font-semibold text-red-300/90">Out / doubtful: {side.out.join(', ')}</div>}
  </div>
);

const GameCard = ({ game, lookup, index, live }: {
  game: PredictionGame; lookup: (s: TeamSide) => TeamLook; index: number; live?: LiveScore;
}) => {
  const [open, setOpen] = useState(false);
  const away = lookup(game.away);
  const home = lookup(game.home);
  // Schedule score while in progress; the forecaster's recorded result once the game is settled.
  const score: LiveScore | null = live
    ?? (game.result ? { away: game.result.away_score, home: game.result.home_score, final: true, period: null, clock: null } : null);
  const favorite = game.expected_margin >= 0 ? home : away;

  // Once the game is final, load the saved box score; it can land a few seconds after the
  // schedule flips to final, so retry until it is there.
  const final = Boolean(score?.final);
  const [box, setBox] = useState<BoxScore | null>(null);
  useEffect(() => {
    if (!final || box) return;
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await fetch(boxscoreUrl(game.game_id), { cache: 'no-cache' });
        const json = resp.ok ? ((await resp.json()) as BoxScore) : null;
        if (!cancelled && json?.teams) setBox(json);
      } catch {
        // Not written yet (or the dev server answered with its HTML fallback); retry below.
      }
    };
    load();
    const timer = window.setInterval(load, BOXSCORE_RETRY_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [final, box, game.game_id]);
  const actuals = useMemo(
    () => (box ? new Map(box.teams.flatMap((t) => t.players).map((pl) => [pl.id, pl] as const)) : undefined),
    [box],
  );

  const dk = game.market.draftkings;
  const espn = game.market.espn;
  return (
    <Card
      className="relative overflow-hidden rounded-2xl border transition-all duration-300"
      style={{ animation: `slideUp 0.4s ease-out ${index * 0.05}s both` }}
    >
      {/* Scoreboard card background: away-to-home team gradient under a dark scrim. */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(to right, ${away.gradient} 0%, ${away.gradient} 20%, ${home.gradient} 80%, ${home.gradient} 100%)` }}
      />
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 px-5 pt-4 pb-3">
        <div className="mb-3 flex items-center justify-between text-xs font-black tracking-wide text-white/80">
          <span>{fmtTime(game.tip_utc)}</span>
          {game.result ? (
            <span className={game.result.model_correct ? 'text-emerald-300' : 'text-red-300'}>
              Final {game.result.away_score}–{game.result.home_score} · {game.result.model_correct ? 'Model correct' : 'Model missed'}
            </span>
          ) : (
            <span>
              {game.injury_report?.usable ? `Injury report ${fmtTime(game.injury_report.report_time_utc)}` : 'No injury report yet'}
            </span>
          )}
        </div>
        {/* Equal side columns keep the predicted score centered regardless of team name widths. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="justify-self-start"><TeamBlock side={game.away} look={away} align="left" /></div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-2xl font-black tracking-wide tabular-nums text-white whitespace-nowrap">
              {score?.final && <ScoreDiff predicted={game.away.expected_score} actual={score.away} />}
              <span>{game.away.expected_score.toFixed(0)} – {game.home.expected_score.toFixed(0)}</span>
              {score?.final && <ScoreDiff predicted={game.home.expected_score} actual={score.home} />}
            </div>
            <div className="text-xs font-black tracking-wide text-white/80">
              {favorite.abbr} by {Math.abs(game.expected_margin).toFixed(1)}
            </div>
          </div>
          <div className="justify-self-end"><TeamBlock side={game.home} look={home} align="right" /></div>
        </div>
        <GameBar game={game} score={score} away={away} home={home} />
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-black tracking-wide">
          {dk && (
            <span className="rounded-full bg-black/30 px-3 py-1 text-white/90">
              <Dot color={DK_COLOR} />DraftKings: {home.abbr} {pct(dk.home_win_prob)}
              {typeof dk.spread === 'number' && ` · ${home.abbr} ${dk.spread > 0 ? '+' : ''}${dk.spread}`}
              {typeof dk.over_under === 'number' && ` · O/U ${dk.over_under}`}
            </span>
          )}
          {espn && (
            <span className="rounded-full bg-black/30 px-3 py-1 text-white/90"><Dot color={ESPN_COLOR} />ESPN: {home.abbr} {pct(espn.home_win_prob)}</span>
          )}
          {!dk && !espn && <span className="text-white/60">No market lines captured</span>}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-black/30 px-3 py-1 text-white transition-colors hover:bg-black/50"
          >
            {actuals ? 'Box score' : 'Projected box score'} <ChevronDown size={14} className={`nba-boxscore-chevron ${open ? 'is-open' : ''}`} />
          </button>
        </div>
      </div>
      {/* Grid-rows reveal, same motion as the mobile season menu (styles in index.css). */}
      <div className={`nba-boxscore-reveal relative z-10 ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <div className="nba-boxscore-clip">
          <div className="nba-boxscore-body border-t border-white/10 bg-black/40 px-5 py-4">
            {actuals && (
              <div className="mb-3 text-[11px] font-black tracking-wide text-white/60">
                Projection <span className="text-white/40">· difference from final stats</span>
              </div>
            )}
            {/* Final games stack the teams so each row has room for the differences. */}
            <div className={actuals ? 'flex flex-col gap-5' : 'flex gap-6'}>
              <PlayerTable side={game.away} look={away} actuals={actuals} />
              <PlayerTable side={game.home} look={home} actuals={actuals} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

const RecordCard = ({ data }: { data: PredictionsData }) => {
  const record = data.season_record;
  const dk = record.vs?.draftkings;
  const espn = record.vs?.espn_predictor;
  if (!record.model) return null;
  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div>
      <div className="text-2xl font-black tabular-nums text-white">{value}</div>
      <div className="text-[11px] font-black tracking-wide text-white/60">{label}</div>
    </div>
  );
  return (
    <Card className={`${PANEL} px-5 py-4`}>
      <div className="mb-3 text-xs font-black tracking-wide text-white/80">Live record since {fmtDate(record.since)}</div>
      <div className="flex flex-wrap gap-8">
        <Stat label="Games" value={String(record.games)} />
        <Stat label="Winners picked" value={pct(record.model.accuracy)} />
        <Stat label="Log loss (lower is better)" value={record.model.log_loss.toFixed(3)} />
        {dk && <Stat label={`DraftKings log loss (${dk.games} g)`} value={dk.theirs.log_loss.toFixed(3)} />}
        {espn && <Stat label={`ESPN log loss (${espn.games} g)`} value={espn.theirs.log_loss.toFixed(3)} />}
        {dk && <Stat label="Disagreed with DK, we were right" value={`${dk.ours_right_in_disagreements}/${dk.disagreements}`} />}
      </div>
    </Card>
  );
};

export const PredictionsView = ({ resolveTeam, liveScores = {} }: {
  resolveTeam: (name: string | null, espnAbbr: string) => TeamLook; liveScores?: Record<string, LiveScore>;
}) => {
  const [data, setData] = useState<PredictionsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await fetch(PREDICTIONS_URL, { cache: 'no-cache' });
        if (!resp.ok) throw new Error(String(resp.status));
        const json = (await resp.json()) as PredictionsData;
        if (!cancelled) { setData(json); setError(false); }
      } catch {
        if (!cancelled) setError(true);
      }
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const lookup = useMemo(() => (side: TeamSide) => resolveTeam(side.name, side.abbr), [resolveTeam]);

  // Selected day: today (the main file) unless the user picks another forecast date.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayData, setDayData] = useState<DayData | null>(null);
  const currentDate = selectedDate ?? data?.date ?? null;
  const dates = useMemo(() => data?.available_dates?.length ? data.available_dates : (data ? [data.date] : []), [data]);
  useEffect(() => {
    if (!data || !currentDate || currentDate === data.date) { setDayData(null); return; }
    let cancelled = false;
    fetch(dayUrl(currentDate), { cache: 'no-cache' })
      .then((resp) => (resp.ok ? resp.json() : null))
      .then((json) => { if (!cancelled) setDayData(json as DayData | null); })
      .catch(() => { if (!cancelled) setDayData(null); });
    return () => { cancelled = true; };
  }, [currentDate, data]);

  if (!data || !currentDate) {
    return (
      <div className="px-4 py-10 text-center text-sm font-black tracking-wide text-muted-foreground">
        {error ? 'Predictions are not available yet. The forecaster writes /data/nba_predictions.json.' : 'Loading predictions…'}
      </div>
    );
  }
  const view: DayData | null = currentDate === data.date ? data : dayData;
  return (
    <div className="flex flex-col gap-4 px-2 pb-8">
      <DateNavigator dates={dates} current={currentDate} today={data.date} onChange={setSelectedDate} />
      <RecordCard data={data} />
      {!view && <Card className={`${PANEL} py-8 text-center text-sm font-black tracking-wide text-muted-foreground`}>Loading…</Card>}
      {view && view.games.length === 0 && (
        <Card className={`${PANEL} py-8 text-center text-sm font-black tracking-wide text-muted-foreground`}>No games forecast for this day.</Card>
      )}
      {view?.games.map((game, index) => <GameCard key={game.game_id} game={game} lookup={lookup} index={index} live={liveScores[liveKey(game.game_id)]} />)}
      {data.recent_results.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-lg font-black tracking-wide text-white">Recent results</h3>
          <Card className={`${PANEL} overflow-hidden`}>
            <table className="w-full text-xs font-semibold text-white/80 tabular-nums">
              <thead className="bg-black/20 text-[10px] font-black uppercase tracking-wide text-white/50">
                <tr>
                  <th className="px-3 py-2 text-left">Game</th>
                  <th className="px-3 py-2 text-right">Model (home)</th>
                  <th className="px-3 py-2 text-right">DraftKings</th>
                  <th className="px-3 py-2 text-right">ESPN</th>
                  <th className="px-3 py-2 text-right">Final</th>
                  <th className="px-3 py-2 text-right">Pick</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_results.map((g) => {
                  const away = lookup(g.away);
                  const home = lookup(g.home);
                  return (
                    <tr key={g.game_id} className="border-t border-white/5">
                      <td className="px-3 py-1.5">{new Date(g.tip_utc).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {away.abbr} @ {home.abbr}</td>
                      <td className="px-3 py-1.5 text-right">{pct(g.home.win_prob)}</td>
                      <td className="px-3 py-1.5 text-right">{g.market.draftkings ? pct(g.market.draftkings.home_win_prob) : '—'}</td>
                      <td className="px-3 py-1.5 text-right">{g.market.espn ? pct(g.market.espn.home_win_prob) : '—'}</td>
                      <td className="px-3 py-1.5 text-right">{g.result ? `${g.result.away_score}–${g.result.home_score}` : '—'}</td>
                      <td className={`px-3 py-1.5 text-right font-bold ${g.result?.model_correct ? 'text-emerald-300' : 'text-red-300'}`}>
                        {g.result?.model_correct ? '✓' : '✗'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PredictionsView;
