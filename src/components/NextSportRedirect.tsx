import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { chooseNextSport, type SportPath } from '@/lib/nextSport';

export function NextSportRedirect() {
  const [destination, setDestination] = useState<SportPath | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(() => controller.abort(), 5000);
    const files = { '/nba': 'nba_schedule.json', '/nfl': 'nfl_schedule.json', '/f1': 'f1_calendar.json' } as const;
    Promise.all(Object.entries(files).map(async ([path, file]) => {
      try {
        const response = await fetch(`/data/${file}`, { cache: 'no-store', signal: controller.signal });
        return [path, response.ok ? await response.json() : []] as const;
      } catch {
        return [path, []] as const;
      }
    })).then(entries => {
      if (!cancelled) setDestination(chooseNextSport(Object.fromEntries(entries)));
    }).finally(() => clearTimeout(timeout));
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, []);
  return destination ? <Navigate to={destination} replace /> : <div role="status" className="p-6 text-muted-foreground">Finding the next event…</div>;
}
