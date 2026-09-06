// Poll the app's JSON files; this never calls ESPN from the browser.
export function pollSchedule<T>(url: string, onData: (data: T) => void) {
  let stopped = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout>;
  let controller: AbortController | undefined;
  let lastText: string | undefined;
  let interval = 5_000;

  const load = async () => {
    if (stopped || inFlight || document.hidden) return;
    clearTimeout(timer);
    inFlight = true;
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 10_000);
    try {
      const response = await fetch(`${url}?_=${Date.now()}`, {
        cache: 'no-store', signal: controller.signal,
      });
      if (!response.ok || stopped) return;
      const data = await response.json();
      if (stopped) return;
      const games = Array.isArray(data) ? data : data?.games;
      if (!Array.isArray(games)) return;
      interval = games.some((game: { status?: string }) => game.status === 'live') ? 5_000 : 30_000;
      const text = JSON.stringify(data);
      if (text !== lastText) {
        lastText = text;
        onData(data as T);
      }
    } catch {
      // Keep the last successful scores on network errors or partial writes.
    } finally {
      clearTimeout(timeout);
      inFlight = false;
      if (!stopped && !document.hidden) timer = setTimeout(load, interval);
    }
  };
  const visibility = () => {
    clearTimeout(timer);
    if (!document.hidden) void load();
  };
  document.addEventListener('visibilitychange', visibility);
  void load();
  return () => {
    stopped = true;
    clearTimeout(timer);
    controller?.abort();
    document.removeEventListener('visibilitychange', visibility);
  };
}
