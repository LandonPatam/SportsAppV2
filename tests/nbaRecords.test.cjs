const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/nbaRecords.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, context);
const compute = (...args) => JSON.parse(JSON.stringify(context.exports.computeNBARecordMap(...args)));
const abbreviations = { Warriors: 'GSW', Nuggets: 'DEN' };
const teams = (gw = 0, gl = 0, dw = 0, dl = 0) => [
  { TEAM_NAME: 'Warriors', W: gw, L: gl, GP: gw + gl },
  { TEAM_NAME: 'Nuggets', W: dw, L: dl, GP: dw + dl },
];
const game = (id, overrides = {}) => ({
  game_id: String(id), date: `2026-10-${String(20 + id).padStart(2, '0')}`, time: '7:00 PM',
  matchup: 'Warriors @ Nuggets', status: 'final', away_score: '110', home_score: '100',
  ...overrides,
});

test('a live-to-final transition immediately updates winner and loser records', () => {
  const official = teams();
  assert.deepEqual(compute(official, [game(1, { status: 'live' })], abbreviations), { GSW: '0 - 0', DEN: '0 - 0' });
  assert.deepEqual(compute(official, [game(1)], abbreviations), { GSW: '1 - 0', DEN: '0 - 1' });
  assert.equal(official[0].W, 0);
});

test('repeated polls and official stats catching up do not double count', () => {
  const schedule = [game(1)];
  for (const official of [teams(), teams(), teams(1, 0, 0, 1), teams(1, 0, 0, 1)]) {
    assert.deepEqual(compute(official, schedule, abbreviations), { GSW: '1 - 0', DEN: '0 - 1' });
  }
});

test('each team reconciles independently and partially updated stats retain pending results', () => {
  const schedule = [game(2, { away_score: 90, home_score: 100 }), game(1), game(3)];
  assert.deepEqual(compute(teams(1, 0, 0, 0), schedule, abbreviations), { GSW: '2 - 1', DEN: '1 - 2' });
  assert.deepEqual(compute(teams(1, 1, 1, 2), schedule, abbreviations), { GSW: '2 - 1', DEN: '1 - 2' });
});

test('opening the page after a final also applies the adjustment', () => {
  assert.deepEqual(compute(teams(), { games: [game(1)] }, abbreviations), { GSW: '1 - 0', DEN: '0 - 1' });
});

test('missing, partial, or slower schedules never reduce an official record', () => {
  for (const schedule of [null, [], [game(1)]]) {
    assert.deepEqual(compute(teams(3, 2, 2, 3), schedule, abbreviations), { GSW: '3 - 2', DEN: '2 - 3' });
  }
});

test('only regular-season results count, including NBA Cup games before the championship', () => {
  const schedule = [
    game(1, { is_preseason: true }), game(2, { is_playoff: true }),
    game(3, { series_note: 'Play-In Tournament' }),
    game(4, { tournament: 'NBA Cup Championship' }),
    game(5, { tournament: 'NBA Cup Final' }),
    game(6, { series_note: 'NBA All-Star' }),
    game(7, { tournament: 'NBA Cup Semifinals' }),
    game(8, { tournament: 'NBA Cup Group Play' }),
    game(9, { tournament: 'NBA Cup Quarterfinal' }),
  ];
  assert.deepEqual(compute(teams(), schedule, abbreviations), { GSW: '3 - 0', DEN: '0 - 3' });
});

test('incomplete scores, ties, cancelled games and duplicate IDs cannot add results', () => {
  const schedule = [
    game(1), game(1), game(2, { home_score: null }), game(3, { away_score: '' }),
    game(4, { home_score: '110' }), game(5, { status: 'cancelled', winner: 'Warriors' }),
    game(6, { away_score: 'unknown' }), game(7, { away_score: ' ' }),
  ];
  assert.deepEqual(compute(teams(), schedule, abbreviations), { GSW: '1 - 0', DEN: '0 - 1' });
});

test('explicit team abbreviations and overtime finals are supported', () => {
  assert.deepEqual(compute(teams(), [game(1, {
    matchup: undefined, away: 'gsw', home: 'den', status: 'Final/OT',
  })], abbreviations), { GSW: '1 - 0', DEN: '0 - 1' });
});
