import { getAll, isAdmin, jsonError, ready, sql } from '@/lib/db';

function cleanName(n) {
  return String(n || '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

// Beheer: spelers toevoegen (één of meer namen).
export async function POST(request) {
  if (!isAdmin(request)) return jsonError('Wrong admin code.', 401);
  const body = await request.json().catch(() => ({}));
  const names = [...new Set((body.names || []).map(cleanName).filter(Boolean))];
  if (names.length === 0) return jsonError('No names given.');
  try {
    await ready();
    const db = sql();
    for (const name of names) {
      await db`INSERT INTO players (name) VALUES (${name}) ON CONFLICT (name) DO UPDATE SET active = TRUE`;
    }
    return Response.json(await getAll());
  } catch (e) {
    console.error(e);
    return jsonError('Adding failed.', 500);
  }
}

// Beheer: speler hernoemen of (de)activeren.
export async function PATCH(request) {
  if (!isAdmin(request)) return jsonError('Wrong admin code.', 401);
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isInteger(id)) return jsonError('Unknown player.');
  try {
    await ready();
    const db = sql();
    if (body.name !== undefined) {
      const name = cleanName(body.name);
      if (!name) return jsonError('Name cannot be empty.');
      const clash = await db`SELECT 1 FROM players WHERE name = ${name} AND id <> ${id}`;
      if (clash.length) return jsonError('That name already exists.');
      await db`UPDATE players SET name = ${name} WHERE id = ${id}`;
    }
    if (typeof body.active === 'boolean') {
      await db`UPDATE players SET active = ${body.active} WHERE id = ${id}`;
    }
    return Response.json(await getAll());
  } catch (e) {
    console.error(e);
    return jsonError('Saving failed.', 500);
  }
}
