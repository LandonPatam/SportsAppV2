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

function getRegularSeasonResults(
  schedule: Schedule,
  abbreviations: Record<string, string>,
): Record<string, (boolean | null)[]> {
  const results: Record<string, (boolean | null)[]> = {};
  const games = Array.isArray(schedule) ? schedule : schedule?.games || [];
  const seen = new Set<string>();
  const regularSeason = games.filter(game => {
    if (game.is_preseason || game.is_playoff) return false;
    const note = `${game.tournament || ''} ${game.series_note || ''}`;
    if (/play[ -]?in|all[ -]?star|nba cup.*(?:championship|\bfinals?\b)/i.test(note)) return false;
    return !/cancel|postpon/i.test(game.status || '');
  }).sort((a, b) => {
    const dateOrder = (a.date || '').localeCompare(b.date || '');
    if (dateOrder) return dateOrder;
    return (Date.parse(`${a.date} ${a.time || '12:00 AM'}`) || 0)
      - (Date.parse(`${b.date} ${b.time || '12:00 AM'}`) || 0);
  });

  for (const game of regularSeason) {
    if (game.game_id && seen.has(game.game_id)) continue;
    const [awayName, homeName] = game.matchup?.split('@').map(name => name.trim()) || [];
    const away = (game.away || abbreviations[awayName] || '').toUpperCase();
    const home = (game.home || abbreviations[homeName] || '').toUpperCase();
    if (!away || !home || away === home) continue;
    if (game.game_id) seen.add(game.game_id);
    const status = (game.status || '').toLowerCase();
    const final = /^final\b|^status_final$/.test(status) || (!status && Boolean(game.winner));
    const validScores = [game.home_score, game.away_score].every(
      score => score != null && String(score).trim() !== '' && Number.isFinite(Number(score)),
    ) && Number(game.home_score) !== Number(game.away_score);
    const decided = final && validScores;
    // Retain each fixture's position even when an older score was never saved.
    // Otherwise a missing historical final hides a newly completed game.
    (results[away] ||= []).push(decided ? Number(game.away_score) > Number(game.home_score) : null);
    (results[home] ||= []).push(decided ? Number(game.home_score) > Number(game.away_score) : null);
  }

  return results;
}

/** Bridge the delay between final scores and the official regular-season stats. */
export function computeNBARecordMap(
  teams: TeamRecord[],
  schedule: Schedule,
  abbreviations: Record<string, string>,
): Record<string, string> {
  const results = getRegularSeasonResults(schedule, abbreviations);
  const records: Record<string, string> = {};
  for (const team of teams) {
    const abbr = abbreviations[team.TEAM_NAME]?.toUpperCase();
    if (!abbr) continue;
    let wins = Number(team.W);
    let losses = Number(team.L);
    // Compare game counts rather than timestamps: a new stats file can still
    // contain the old record, or one team's record can catch up before another.
    const officialGames = Math.max(Number(team.GP) || 0, wins + losses);
    const fixtures = results[abbr] || [];
    for (const won of fixtures.slice(officialGames)) {
      if (won === null) continue;
      if (won) wins++;
      else losses++;
    }
    records[abbr] = `${wins} - ${losses}`;
  }
  return records;
}

/** Reconcile streaks with official results and finals newer than the stats. */
export function computeNBAStreakMap(
  teams: TeamRecord[],
  schedule: Schedule,
  abbreviations: Record<string, string>,
): Record<string, { type: 'W' | 'L'; count: number }> {
  const results = getRegularSeasonResults(schedule, abbreviations);
  const streaks: Record<string, { type: 'W' | 'L'; count: number }> = {};
  for (const team of teams) {
    const abbr = abbreviations[team.TEAM_NAME]?.toUpperCase();
    if (!abbr) continue;
    const fixtures = results[abbr] || [];
    const officialGames = Math.max(Number(team.GP) || 0, Number(team.W) + Number(team.L));
    const officialResults = fixtures.slice(0, officialGames);
    const knownWins = officialResults.filter(won => won === true).length;
    const knownLosses = officialResults.filter(won => won === false).length;
    const missing = officialResults.filter(won => won === null).length;
    const missingWins = Number(team.W) - knownWins;
    const missingLosses = Number(team.L) - knownLosses;
    // Fill historical gaps only when the official record proves every missing
    // result was the same outcome. Mixed results cannot establish their order.
    if (officialResults.length === officialGames && missing > 0 && (
      (missingWins === missing && missingLosses === 0)
      || (missingLosses === missing && missingWins === 0)
    )) {
      for (let i = 0; i < officialGames; i++) {
        if (fixtures[i] === null) fixtures[i] = missingWins > 0;
      }
    }
    let lastPlayed = Math.min(officialGames, fixtures.length) - 1;
    fixtures.forEach((won, index) => {
      if (won !== null) lastPlayed = Math.max(lastPlayed, index);
    });
    const last = fixtures[lastPlayed];
    if (last == null) continue;
    let count = 0;
    for (let i = lastPlayed; i >= 0 && fixtures[i] === last; i--) count++;
    streaks[abbr] = { type: last ? 'W' : 'L', count };
  }
  return streaks;
}
