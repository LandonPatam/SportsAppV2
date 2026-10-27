interface TeamRecord {
  TEAM_NAME: string;
  W: number;
  L: number;
  GP: number;
}

interface RecordGame {
  game_id?: string;
  date?: string;
  time?: string;
  home?: string;
  away?: string;
  matchup?: string;
  status?: string;
  winner?: string | null;
  home_score?: number | string | null;
  away_score?: number | string | null;
  is_preseason?: boolean;
  is_playoff?: boolean;
  tournament?: string | null;
  series_note?: string | null;
}

type Schedule = RecordGame[] | { games?: RecordGame[] } | null;

/** Bridge the delay between final scores and the official regular-season stats. */
export function computeNBARecordMap(
  teams: TeamRecord[],
  schedule: Schedule,
  abbreviations: Record<string, string>,
): Record<string, string> {
  const results: Record<string, boolean[]> = {};
  const games = Array.isArray(schedule) ? schedule : schedule?.games || [];
  const seen = new Set<string>();
  const finished = games.filter(game => {
    if (game.is_preseason || game.is_playoff) return false;
    const note = `${game.tournament || ''} ${game.series_note || ''}`;
    if (/play[ -]?in|all[ -]?star|nba cup.*(?:championship|\bfinals?\b)/i.test(note)) return false;
    const status = (game.status || '').toLowerCase();
    const final = /^final\b|^status_final$/.test(status) || (!status && Boolean(game.winner));
    const scores = [game.home_score, game.away_score];
    return final && scores.every(score => score != null && String(score).trim() !== '' && Number.isFinite(Number(score)))
      && Number(game.home_score) !== Number(game.away_score);
  }).sort((a, b) => {
    const dateOrder = (a.date || '').localeCompare(b.date || '');
    if (dateOrder) return dateOrder;
    return (Date.parse(`${a.date} ${a.time || '12:00 AM'}`) || 0)
      - (Date.parse(`${b.date} ${b.time || '12:00 AM'}`) || 0);
  });

  for (const game of finished) {
    if (game.game_id && seen.has(game.game_id)) continue;
    const [awayName, homeName] = game.matchup?.split('@').map(name => name.trim()) || [];
    const away = (game.away || abbreviations[awayName] || '').toUpperCase();
    const home = (game.home || abbreviations[homeName] || '').toUpperCase();
    if (!away || !home || away === home) continue;
    if (game.game_id) seen.add(game.game_id);
    (results[away] ||= []).push(Number(game.away_score) > Number(game.home_score));
    (results[home] ||= []).push(Number(game.home_score) > Number(game.away_score));
  }

  const records: Record<string, string> = {};
  for (const team of teams) {
    const abbr = abbreviations[team.TEAM_NAME]?.toUpperCase();
    if (!abbr) continue;
    let wins = Number(team.W);
    let losses = Number(team.L);
    // Compare game counts rather than timestamps: a new stats file can still
    // contain the old record, or one team's record can catch up before another.
    const officialGames = Math.max(Number(team.GP) || 0, wins + losses);
    const completed = results[abbr] || [];
    for (const won of completed.slice(officialGames)) {
      if (won) wins++;
      else losses++;
    }
    records[abbr] = `${wins} - ${losses}`;
  }
  return records;
}
