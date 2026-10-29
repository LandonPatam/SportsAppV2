import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Data written by the NBA Forecaster (`nba_forecaster auto --export`), refreshed by data/nba_predictions.py.
const PREDICTIONS_URL = '/data/nba_predictions.json';
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
type PredictionsData = {
  date: string; issued_at: string | null; generated_at: string;
  games: PredictionGame[]; recent_results: PredictionGame[];
  season_record: { since: string; games: number; model?: { accuracy: number; log_loss: number; margin_mae: number };
                   vs?: { draftkings?: Comparison; espn_predictor?: Comparison } };
};

export type TeamLook = { abbr: string; logo?: string; primary: string; secondary: string };

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
      <div className="text-4xl font-black tabular-nums text-white leading-none">{pct(side.win_prob)}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/70">
        {side.name ?? look.abbr}{side.back_to_back ? ' · B2B' : ''}
      </div>
    </div>
  </div>
);

const ProbabilityBar = ({ game, away, home }: { game: PredictionGame; away: TeamLook; home: TeamLook }) => {
  const markers = [
    { label: 'DK', p: game.market.draftkings?.home_win_prob },
    { label: 'ESPN', p: game.market.espn?.home_win_prob },
  ].filter((m): m is { label: string; p: number } => typeof m.p === 'number');
  return (
    <div className="relative mt-4 h-3 w-full overflow-visible rounded-full bg-white/10">
      <div className="absolute inset-y-0 left-0 rounded-l-full" style={{ width: pct(game.away.win_prob), background: away.primary }} />
      <div className="absolute inset-y-0 right-0 rounded-r-full" style={{ width: pct(game.home.win_prob), background: home.primary }} />
      {markers.map((m) => (
        // Market markers sit at the market's away/home split point.
        <div key={m.label} className="absolute -top-1 h-5 w-0.5 bg-white" style={{ left: pct(1 - m.p) }} title={`${m.label}: home ${pct(m.p)}`}>
          <span className="absolute -top-5 -translate-x-1/2 text-[10px] font-bold text-white/80">{m.label}</span>
        </div>
      ))}
    </div>
  );
};

const PlayerTable = ({ side, look }: { side: TeamSide; look: TeamLook }) => (
  <div className="min-w-0 flex-1">
    <div className="mb-2 flex items-center gap-2">
      {look.logo && <img src={look.logo} alt="" className="h-6 w-6 object-contain" />}
      <span className="text-sm font-black uppercase tracking-wide text-white">{side.name ?? look.abbr}</span>
    </div>
    <table className="w-full text-xs text-white/90 tabular-nums">
      <thead className="text-[10px] uppercase tracking-wide text-white/50">
        <tr>
          <th className="py-1 text-left font-semibold">Player</th>
          <th className="py-1 text-right font-semibold">Play</th>
          <th className="py-1 text-right font-semibold">Min</th>
          <th className="py-1 text-right font-semibold">Pts (80%)</th>
          <th className="py-1 text-right font-semibold">Reb</th>
          <th className="py-1 text-right font-semibold">Ast</th>
          <th className="py-1 text-right font-semibold">3PM</th>
          <th className="py-1 text-right font-semibold">Stl</th>
          <th className="py-1 text-right font-semibold">Blk</th>
          <th className="py-1 text-right font-semibold">TO</th>
        </tr>
      </thead>
      <tbody>
        {side.players.map((p) => (
          <tr key={p.id} className="border-t border-white/5">
            <td className="py-1 pr-2 text-left">
              {p.name}
              {p.status && !['unlisted', 'unknown'].includes(p.status) && (
                <span className="ml-1 rounded bg-amber-400/20 px-1 text-[10px] font-bold text-amber-300">{p.status}</span>
              )}
            </td>
            <td className="py-1 text-right">{pct(p.play_prob)}</td>
            <td className="py-1 text-right">{p.minutes.toFixed(1)}</td>
            <td className="py-1 text-right font-bold text-white">
              {p.pts.toFixed(1)}
              {p.range80.pts && <span className="ml-1 font-normal text-white/50">({p.range80.pts[0]}–{p.range80.pts[1]})</span>}
            </td>
            <td className="py-1 text-right">{p.reb.toFixed(1)}</td>
            <td className="py-1 text-right">{p.ast.toFixed(1)}</td>
            <td className="py-1 text-right">{p.fg3m.toFixed(1)}</td>
            <td className="py-1 text-right">{p.stl.toFixed(1)}</td>
            <td className="py-1 text-right">{p.blk.toFixed(1)}</td>
            <td className="py-1 text-right">{p.tov.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    {side.out.length > 0 && <div className="mt-2 text-[11px] text-red-300/90">Out / doubtful: {side.out.join(', ')}</div>}
  </div>
);

const GameCard = ({ game, lookup, index }: { game: PredictionGame; lookup: (s: TeamSide) => TeamLook; index: number }) => {
  const [open, setOpen] = useState(false);
  const away = lookup(game.away);
  const home = lookup(game.home);
  const favorite = game.expected_margin >= 0 ? home : away;
  const dk = game.market.draftkings;
  const espn = game.market.espn;
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur"
      style={{
        backgroundImage: `linear-gradient(90deg, ${away.primary}40 0%, transparent 35%, transparent 65%, ${home.primary}40 100%)`,
        animation: `slideUp 0.4s ease-out ${index * 0.05}s both`,
      }}
    >
      <div className="px-5 pt-4 pb-3">
        <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-white/60">
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
        <div className="flex items-center justify-between gap-4">
          <TeamBlock side={game.away} look={away} align="left" />
          <div className="text-center">
            <div className="text-2xl font-black tabular-nums text-white">
              {game.away.expected_score.toFixed(0)}–{game.home.expected_score.toFixed(0)}
            </div>
            <div className="text-xs font-semibold text-white/60">
              {favorite.abbr} by {Math.abs(game.expected_margin).toFixed(1)}
            </div>
          </div>
          <TeamBlock side={game.home} look={home} align="right" />
        </div>
        <ProbabilityBar game={game} away={away} home={home} />
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {dk && (
            <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/80">
              DraftKings: {home.abbr} {pct(dk.home_win_prob)}
              {typeof dk.spread === 'number' && ` · ${home.abbr} ${dk.spread > 0 ? '+' : ''}${dk.spread}`}
              {typeof dk.over_under === 'number' && ` · O/U ${dk.over_under}`}
            </span>
          )}
          {espn && (
            <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/80">ESPN: {home.abbr} {pct(espn.home_win_prob)}</span>
          )}
          {!dk && !espn && <span className="text-white/40">No market lines captured</span>}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 font-semibold text-white hover:bg-white/20"
          >
            Projected box score <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {open && (
        <div className="flex gap-6 border-t border-white/10 bg-black/20 px-5 py-4">
          <PlayerTable side={game.away} look={away} />
          <PlayerTable side={game.home} look={home} />
        </div>
      )}
    </div>
  );
};

const RecordCard = ({ data }: { data: PredictionsData }) => {
  const record = data.season_record;
  const dk = record.vs?.draftkings;
  const espn = record.vs?.espn_predictor;
  if (!record.model) {
    return <div className="rounded-2xl bg-white/5 px-5 py-4 text-sm text-white/60">Live record starts once the first predicted games are final.</div>;
  }
  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div>
      <div className="text-2xl font-black tabular-nums text-white">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{label}</div>
    </div>
  );
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/60">Live record since {fmtDate(record.since)}</div>
      <div className="flex flex-wrap gap-8">
        <Stat label="Games" value={String(record.games)} />
        <Stat label="Winners picked" value={pct(record.model.accuracy)} />
        <Stat label="Log loss (lower is better)" value={record.model.log_loss.toFixed(3)} />
        {dk && <Stat label={`DraftKings log loss (${dk.games} g)`} value={dk.theirs.log_loss.toFixed(3)} />}
        {espn && <Stat label={`ESPN log loss (${espn.games} g)`} value={espn.theirs.log_loss.toFixed(3)} />}
        {dk && <Stat label="Disagreed with DK, we were right" value={`${dk.ours_right_in_disagreements}/${dk.disagreements}`} />}
      </div>
    </div>
  );
};

export const PredictionsView = ({ resolveTeam }: { resolveTeam: (name: string | null, espnAbbr: string) => TeamLook }) => {
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

  if (!data) {
    return (
      <div className="px-4 py-10 text-center text-white/60">
        {error ? 'Predictions are not available yet. The forecaster writes /data/nba_predictions.json.' : 'Loading predictions…'}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 px-2 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wide text-white">Model predictions</h2>
          <div className="text-xs text-white/60">
            {fmtDate(data.date)} · forecast issued {fmtTime(data.issued_at)} · win %, expected score and projected box scores
          </div>
        </div>
        <div className="text-[11px] text-white/40">Market lines are shown for comparison only; they are not model inputs.</div>
      </div>
      <RecordCard data={data} />
      {data.games.length === 0 && <div className="rounded-2xl bg-white/5 px-5 py-6 text-center text-white/60">No games forecast for today yet.</div>}
      {data.games.map((game, index) => <GameCard key={game.game_id} game={game} lookup={lookup} index={index} />)}
      {data.recent_results.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-white/80">Recent results</h3>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-xs text-white/80 tabular-nums">
              <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-white/50">
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
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictionsView;
