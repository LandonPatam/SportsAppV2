"""Shared scoreboard cache, process locks and persistent provider backoff."""
import atexit
import hashlib
import json
import os
import time
from email.utils import parsedate_to_datetime
from pathlib import Path

import requests

STATE_DIR = Path(__file__).resolve().parents[1] / ".scoreboard-state"


class ProcessLock:
    """OS releases the lock even if the process crashes."""
    def __init__(self, name):
        STATE_DIR.mkdir(exist_ok=True)
        self.file = (STATE_DIR / (name + ".lock")).open("a+b")
        try:
            self.file.seek(0)
            if not self.file.read(1):
                self.file.write(b"0")
                self.file.flush()
            self.file.seek(0)
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(self.file.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self.file.close()
            raise

    def close(self):
        self.file.close()


def acquire_script_lock(name):
    try:
        lock = ProcessLock(name)
    except OSError:
        print(f"[SKIP] {name} is already running")
        raise SystemExit(0)
    atexit.register(lock.close)
    return lock


def read_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def write_json(path, value):
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(value), encoding="utf-8")
    temp.replace(path)


class ScoreboardUnavailable(Exception):
    pass


class ScoreboardClient:
    def __init__(self):
        self.session = requests.Session()
        self.cache = {}

    def get_json(self, url, headers):
        # One response per URL per script pass, even when many games share a date.
        if url in self.cache:
            return self.cache[url]
        STATE_DIR.mkdir(exist_ok=True)
        deadline = time.monotonic() + 12
        while True:
            try:
                lock = ProcessLock("espn-request")
                break
            except OSError as exc:
                if time.monotonic() >= deadline:
                    raise ScoreboardUnavailable("Another scoreboard request is in flight") from exc
                time.sleep(0.1)
        try:
            now = time.time()
            state_path = STATE_DIR / "espn-backoff.json"
            state = read_json(state_path, {})
            if now < state.get("until", 0):
                raise ScoreboardUnavailable("ESPN scoreboard cooldown is active")
            cache_path = STATE_DIR / (hashlib.sha256(url.encode()).hexdigest() + ".json")
            cached = read_json(cache_path, {})
            age = now - cached.get("at", 0)
            if age < 14:
                self.cache[url] = cached["data"]
                return cached["data"]
            # Small process-start timing differences must not turn 15s into 30s.
            if age < 15:
                time.sleep(15 - age)
            # Pace discovery calls too, including probes without caller-side sleeps.
            time.sleep(max(0, 1.5 - (time.time() - state.get("last_request", 0))))
            response = None
            try:
                requested_at = time.time()
                response = self.session.get(url, headers=headers, timeout=(3, 7))
                response.raise_for_status()
                data = response.json()
                # A malformed response must never look like an empty scoreboard.
                leagues = data["sports"][0]["leagues"]
                if not isinstance(leagues[0]["events"], list):
                    raise ValueError("Invalid scoreboard events")
            except (requests.RequestException, ValueError, KeyError, IndexError, TypeError) as exc:
                failures = min(state.get("failures", 0) + 1, 8)
                delay = min(30 * 2 ** (failures - 1), 900)
                if response is not None:
                    if response.status_code in (401, 403):
                        delay = max(delay, 3600)
                    retry = response.headers.get("Retry-After")
                    if retry:
                        try:
                            delay = max(delay, float(retry))
                        except ValueError:
                            try:
                                delay = max(delay, parsedate_to_datetime(retry).timestamp() - time.time())
                            except (ValueError, TypeError, OverflowError):
                                pass
                write_json(state_path, {"until": time.time() + delay, "failures": failures})
                raise ScoreboardUnavailable(f"ESPN request failed; pausing for {delay:.0f}s") from exc
            write_json(state_path, {"until": 0, "failures": 0, "last_request": time.time()})
            write_json(cache_path, {"at": requested_at, "data": data})
            self.cache[url] = data
            return data
        finally:
            lock.close()
