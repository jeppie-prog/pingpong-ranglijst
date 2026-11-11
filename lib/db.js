import postgres from 'postgres';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let sqlInstance;
let schemaReady;

export function sql() {
  if (!url) throw new Error('DATABASE_URL is missing. Connect a Postgres database.');
  if (!sqlInstance) {
    sqlInstance = postgres(url, {
      max: 5,
      idle_timeout: 20,
      prepare: false, // also works with pooled connections (e.g. Neon pooler)
    });
  }
  return sqlInstance;
}

/** Creates the tables if they do not exist yet. */
export async function ready() {
  if (!schemaReady) {
    const db = sql();
    schemaReady = (async () => {
      await db`
        CREATE TABLE IF NOT EXISTS players (
          id         SERIAL PRIMARY KEY,
          name       TEXT NOT NULL UNIQUE,
          active     BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await db`
        CREATE TABLE IF NOT EXISTS matches (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          played_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
          winner_id   INTEGER NOT NULL REFERENCES players(id),
          loser_id    INTEGER NOT NULL REFERENCES players(id),
          special     TEXT NOT NULL DEFAULT '' CHECK (special IN ('', 'tafel', 'koffie')),
          declarer_id INTEGER REFERENCES players(id),
          CHECK (winner_id <> loser_id)
        )`;
      await db`CREATE INDEX IF NOT EXISTS matches_played_at ON matches (played_at)`;
    })().catch((e) => {
      schemaReady = undefined;
      throw e;
    });
  }
  return schemaReady;
}

export async function getAll() {
  await ready();
  const db = sql();
  const [players, matches] = await Promise.all([
    db`SELECT id, name, active FROM players ORDER BY lower(name)`,
    db`SELECT id, played_at, winner_id, loser_id, special, declarer_id
       FROM matches ORDER BY played_at, id`,
  ]);
  return {
    players: players.map((p) => ({ id: p.id, name: p.name, active: p.active })),
    matches: matches.map((m) => ({
      id: m.id,
      playedAt: m.played_at.toISOString(),
      winnerId: m.winner_id,
      loserId: m.loser_id,
      special: m.special,
      declarerId: m.declarer_id,
    })),
  };
}

export function isAdmin(request) {
  const code = process.env.ADMIN_CODE;
  return Boolean(code) && request.headers.get('x-admin-code') === code;
}

export function jsonError(message, status = 400) {
  return Response.json({ error: message }, { status });
}
