import test from 'node:test';
import assert from 'node:assert/strict';
import { compute, eloDelta, coffeeSlaves, nextWorkday, headToHead, START_RATING } from '../lib/stats.js';

const players = [
  { id: 1, name: 'Jep', active: true },
  { id: 2, name: 'Dimitri', active: true },
  { id: 3, name: 'Sanne', active: true },
  { id: 4, name: 'Oud', active: false },
];
const m = (id, day, w, l, special = '', declarerId = null) => ({
  id: String(id), playedAt: `2026-11-${String(day).padStart(2, '0')}T12:00:00.000Z`, winnerId: w, loserId: l, special, declarerId,
});

test('elo: equal ratings gives 16, zero-sum', () => {
  assert.equal(eloDelta(1000, 1000), 16);
  const s = compute(players, [m(1, 2, 1, 2)]);
  assert.equal(s.byId[1].rating, 1016);
  assert.equal(s.byId[2].rating, 984);
  const total = Object.values(s.byId).reduce((a, p) => a + p.rating, 0);
  assert.equal(total, 4 * START_RATING);
});

test('underdog wins more than favourite', () => {
  assert.ok(eloDelta(900, 1100) > eloDelta(1100, 900));
});

test('streaks, h2h, ranking, inactive hidden, unranked', () => {
  const s = compute(players, [m(1, 2, 1, 2), m(2, 3, 1, 2), m(3, 4, 1, 3), m(4, 5, 2, 1), m(5, 5, 4, 1)]);
  assert.equal(s.byId[1].bestWinStreak, 3);
  assert.equal(s.byId[1].streak, -2);
  assert.deepEqual(s.byId[1].h2h[2], { w: 2, l: 1 });
  assert.ok(!s.ranked.some((p) => p.id === 4));
  assert.equal(s.matches[0].id, '5'); // newest first
  const h = headToHead(s, 1, 2);
  assert.equal(h.aWins, 2);
  assert.equal(h.bWins, 1);
  assert.equal(s.byId[1].rival.id, 2);
});

test('special outcomes', () => {
  const s = compute(players, [m(1, 2, 1, 2, 'tafel'), m(2, 3, 1, 2, 'koffie', 1), m(3, 4, 3, 1, 'koffie', 1)]);
  assert.equal(s.byId[1].tafelGiven, 1);
  assert.equal(s.byId[2].tafelTaken, 1);
  assert.equal(s.byId[2].koffieSlaaf, 1);
  assert.equal(s.byId[1].comebacks, 1);
  assert.equal(s.byId[1].bluffs, 1);
  assert.equal(s.byId[1].koffieSlaaf, 1);
});

test('coffee slave is due the next working day', () => {
  // Friday 6 Nov -> Monday 9 Nov
  assert.equal(nextWorkday(new Date(2026, 10, 6)).getDate(), 9);
  const fri = { ...m(1, 6, 1, 2, 'koffie', 1), playedAt: new Date(2026, 10, 6, 13).toISOString() };
  const s = compute(players, [fri]);
  assert.equal(coffeeSlaves(s, new Date(2026, 10, 9, 9)).todaySlaves.length, 1);
  assert.equal(coffeeSlaves(s, new Date(2026, 10, 10, 9)).todaySlaves.length, 0);
  assert.equal(coffeeSlaves(s, new Date(2026, 10, 6, 16)).upcoming.length, 1);
});
