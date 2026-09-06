const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function setup(fetch) {
  const timers = new Map();
  const listeners = new Map();
  let nextId = 0;
  const document = {
    hidden: false,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  };
  const context = {
    exports: {}, document, fetch, AbortController, Date,
    setTimeout: (fn, delay) => { timers.set(++nextId, { fn, delay }); return nextId; },
    clearTimeout: id => timers.delete(id),
  };
  const source = fs.readFileSync('src/lib/pollSchedule.ts', 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  return { ...context, timers, listeners, poll: context.exports.pollSchedule };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const response = data => ({ ok: true, json: async () => data });

test('live local scores poll at 5 seconds, pause hidden, and resume immediately', async () => {
  let calls = 0;
  const h = setup(async () => { calls++; return response([{ status: 'live' }]); });
  const stop = h.poll('/data/nba_schedule.json', () => {});
  await flush();
  assert.equal(calls, 1);
  assert.deepEqual([...h.timers.values()].map(t => t.delay), [5000]);
  h.document.hidden = true;
  h.listeners.get('visibilitychange')();
  assert.equal(h.timers.size, 0);
  h.document.hidden = false;
  h.listeners.get('visibilitychange')();
  await flush();
  assert.equal(calls, 2);
  stop();
  assert.equal(h.timers.size, 0);
  assert.equal(h.listeners.size, 0);
});

test('pending requests never overlap and unchanged data does not trigger state updates', async () => {
  let resolve;
  let calls = 0;
  let updates = 0;
  const h = setup(() => { calls++; return new Promise(done => { resolve = done; }); });
  const stop = h.poll('/data/nfl_schedule.json', () => { updates++; });
  h.listeners.get('visibilitychange')();
  assert.equal(calls, 1);
  resolve(response([{ status: 'final' }]));
  await flush();
  assert.equal(updates, 1);
  assert.deepEqual([...h.timers.values()].map(t => t.delay), [30000]);
  h.listeners.get('visibilitychange')();
  resolve(response([{ status: 'final' }]));
  await flush();
  assert.equal(updates, 1);
  stop();
});

test('invalid responses retain previous scores and schedule another refresh', async () => {
  let updates = 0;
  let fail = false;
  const h = setup(async () => {
    if (fail) throw new Error('offline');
    return response([{ status: 'live', home_score: 20 }]);
  });
  const stop = h.poll('/data/nfl_schedule.json', () => { updates++; });
  await flush();
  fail = true;
  h.listeners.get('visibilitychange')();
  await flush();
  assert.equal(updates, 1);
  assert.deepEqual([...h.timers.values()].map(t => t.delay), [5000]);
  stop();
});
