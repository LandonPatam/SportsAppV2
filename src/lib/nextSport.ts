type Event = Record<string, unknown>;
export type SportPath = '/nba' | '/nfl' | '/f1';

// Schedule display times are Pacific, including daylight saving time.
function pacificTime(date: string, time: string): number {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return NaN;
  const [year, month, day] = date.split('-').map(Number);
  const hour = Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  const target = Date.UTC(year, month - 1, day, hour, Number(match[2]));
  let guess = target;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(guess).map(p => [p.type, p.value]));
    const displayed = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    guess += target - displayed;
  }
  return guess;
}

export function chooseNextSport(schedules: Partial<Record<SportPath, unknown>>, now = Date.now()): SportPath {
  const candidates: { path: SportPath; time: number }[] = [];
  for (const path of ['/nba', '/nfl', '/f1'] as const) {
    const schedule = schedules[path];
    if (!Array.isArray(schedule)) continue;
    for (const event of schedule as Event[]) {
      const status = String(event.status ?? '').toLowerCase();
      if (/final|cancel|postpon/.test(status) || event.winner) continue;
      if (path === '/f1' && Array.isArray(event.results) && event.results.length) continue;
      if (/live|in progress/.test(status)) {
        candidates.push({ path, time: now });
        continue;
      }
      let time = typeof event.ts_utc === 'number' ? event.ts_utc * 1000 : NaN;
      if (!Number.isFinite(time) && path !== '/f1') {
        time = pacificTime(String(event.date ?? ''), String(event.time ?? ''));
      }
      if (path === '/f1') {
        const start = String(event.start_time_west ?? '');
        if (/cancel/i.test(start)) continue;
        const match = start.match(/^(\w+)\s+(\d+)\s+at\s+(.+)$/);
        if (match) {
          const year = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric' }).format(now));
          const month = new Date(`${match[1]} 1, 2000`).getMonth() + 1;
          time = pacificTime(`${year}-${month}-${match[2]}`, match[3]);
        }
      }
      if (Number.isFinite(time) && time >= now) candidates.push({ path, time });
    }
  }
  candidates.sort((a, b) => a.time - b.time);
  return candidates[0]?.path ?? '/nba';
}
