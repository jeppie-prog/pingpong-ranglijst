// All ranking calculations. Pure: takes players + matches, returns stats.
// Ratings are never stored; they are recalculated from the matches every time.

export const START_RATING = 1000;
export const K_FACTOR = 48;

export function expected(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// "Under the table" and "coffee slave challenge" games are worth 50% more points.
export const SPECIAL_BONUS = { tafel: 1.5, koffie: 1.5 };

export function eloDelta(winnerRating, loserRating, special = '') {
  const multiplier = SPECIAL_BONUS[special] || 1;
  return Math.max(1, Math.round(K_FACTOR * multiplier * (1 - expected(winnerRating, loserRating))));
}

function emptyStats(p) {
  return {
    id: p.id,
    name: p.name,
    active: p.active,
    rating: START_RATING,
    peak: START_RATING,
    wins: 0,
    losses: 0,
    games: 0,
    streak: 0, // >0 win streak, <0 losing streak
    bestWinStreak: 0,
    history: [], // [{t, r}] rating after each game
    h2h: {}, // opponentId -> {w, l}
    form: [], // last games, true = win (newest last)
    tafelGiven: 0,
    tafelTaken: 0,
    koffieSlaaf: 0,
    comebacks: 0,
    bluffs: 0,
    bestUpset: null, // {match, diff}
  };
}

/**
 * @param players [{id, name, active}]
 * @param matches [{id, playedAt, winnerId, loserId, special, declarerId}]
 */
export function compute(players, matches) {
  const byId = {};
  for (const p of players) byId[p.id] = emptyStats(p);

  const sorted = [...matches].sort((a, b) =>
    a.playedAt === b.playedAt ? String(a.id).localeCompare(String(b.id)) : a.playedAt.localeCompare(b.playedAt)
  );

  const enriched = [];
  let biggestUpset = null;

  for (const m of sorted) {
    const W = byId[m.winnerId];
    const L = byId[m.loserId];
    if (!W || !L) continue;

    const rw = W.rating;
    const rl = L.rating;
    const delta = eloDelta(rw, rl, m.special);
    const em = { ...m, winnerRatingBefore: rw, loserRatingBefore: rl, delta, upset: rl - rw };
    enriched.push(em);

    W.rating += delta;
    L.rating -= delta;
    W.peak = Math.max(W.peak, W.rating);
    W.wins++;
    L.losses++;
    W.games++;
    L.games++;
    W.history.push({ t: m.playedAt, r: W.rating });
    L.history.push({ t: m.playedAt, r: L.rating });
    W.form.push(true);
    L.form.push(false);

    W.streak = W.streak > 0 ? W.streak + 1 : 1;
    L.streak = L.streak < 0 ? L.streak - 1 : -1;
    W.bestWinStreak = Math.max(W.bestWinStreak, W.streak);

    (W.h2h[L.id] ||= { w: 0, l: 0 }).w++;
    (L.h2h[W.id] ||= { w: 0, l: 0 }).l++;

    if (m.special === 'tafel') {
      W.tafelGiven++;
      L.tafelTaken++;
    }
    if (m.special === 'koffie') {
      L.koffieSlaaf++; // the loser is always the coffee slave
      if (m.declarerId === W.id) W.comebacks++;
      if (m.declarerId === L.id) L.bluffs++;
    }

    if (em.upset > 0 && (!W.bestUpset || em.upset > W.bestUpset.diff)) {
      W.bestUpset = { match: em, diff: em.upset };
    }
    if (em.upset > 0 && (!biggestUpset || em.upset > biggestUpset.diff)) {
      biggestUpset = { match: em, diff: em.upset };
    }
  }

  // Rivals per player
  for (const s of Object.values(byId)) {
    s.form = s.form.slice(-5);
    let rival = null, nemesis = null, prey = null;
    for (const [oppId, r] of Object.entries(s.h2h)) {
      const total = r.w + r.l;
      const id = Number(oppId);
      if (!rival || total > rival.total || (total === rival.total && Math.abs(r.w - r.l) < Math.abs(rival.w - rival.l))) {
        rival = { id, total, ...r };
      }
      if (r.l > 0 && (!nemesis || r.l - r.w > nemesis.l - nemesis.w || (r.l - r.w === nemesis.l - nemesis.w && r.l > nemesis.l))) {
        nemesis = { id, ...r };
      }
      if (r.w > 0 && (!prey || r.w - r.l > prey.w - prey.l || (r.w - r.l === prey.w - prey.l && r.w > prey.w))) {
        prey = { id, ...r };
      }
    }
    s.rival = rival;
    s.nemesis = nemesis && nemesis.l > nemesis.w ? nemesis : null;
    s.prey = prey && prey.w > prey.l ? prey : null;
  }

  const ranked = Object.values(byId)
    .filter((s) => s.active && s.games > 0)
    .sort((a, b) => b.rating - a.rating || b.wins - a.wins || a.name.localeCompare(b.name));
  ranked.forEach((s, i) => (s.rank = i + 1));

  const unranked = Object.values(byId)
    .filter((s) => s.active && s.games === 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const longestStreak = Object.values(byId).reduce(
    (best, s) => (s.bestWinStreak > (best?.bestWinStreak || 0) ? s : best),
    null
  );
  const currentHot = ranked.reduce((best, s) => (s.streak > (best?.streak || 1) ? s : best), null);

  return {
    byId,
    ranked,
    unranked,
    matches: enriched.reverse(), // newest first
    highlights: { biggestUpset, longestStreak, currentHot, totalGames: enriched.length },
  };
}

/**
 * Rank movement since a moment (e.g. the start of today).
 * Returns {playerId: number} where >0 = places gained, <0 = places lost,
 * or 'new' for a player who entered the rankings after that moment.
 */
export function rankMovement(players, matches, current, since) {
  const sinceIso = since.toISOString();
  const earlier = matches.filter((m) => m.playedAt < sinceIso);
  if (earlier.length === matches.length) return {};
  const before = compute(players, earlier);
  const beforeRank = Object.fromEntries(before.ranked.map((p) => [p.id, p.rank]));
  const moves = {};
  for (const p of current.ranked) {
    if (beforeRank[p.id] == null) moves[p.id] = 'new';
    else if (beforeRank[p.id] !== p.rank) moves[p.id] = beforeRank[p.id] - p.rank;
  }
  return moves;
}

/** Head-to-head between two players. */
export function headToHead(stats, aId, bId) {
  const list = stats.matches.filter(
    (m) => (m.winnerId === aId && m.loserId === bId) || (m.winnerId === bId && m.loserId === aId)
  );
  const aWins = list.filter((m) => m.winnerId === aId).length;
  return { matches: list, aWins, bWins: list.length - aWins };
}

// ---- Coffee slaves ------------------------------------------------------------

function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** The next working day (Mon-Fri) after the given date. */
export function nextWorkday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  do d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

/**
 * Who is coffee slave today (lost a coffee challenge on the previous working day)
 * and who will be on the next working day (lost today).
 */
export function coffeeSlaves(stats, now = new Date()) {
  const today = dayKey(now);
  const todaySlaves = [];
  const upcoming = [];
  for (const m of stats.matches) {
    if (m.special !== 'koffie') continue;
    const played = new Date(m.playedAt);
    if (dayKey(nextWorkday(played)) === today) todaySlaves.push(m);
    else if (dayKey(played) === today) upcoming.push(m);
  }
  return { todaySlaves, upcoming };
}
