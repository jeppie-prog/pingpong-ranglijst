import { getAll, jsonError, ready, sql } from '@/lib/db';

const SPECIALS = ['', 'tafel', 'koffie'];

// Nieuwe uitslag invullen (iedereen mag dit).
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Ongeldige aanvraag.');
  }
  const winnerId = Number(body.winnerId);
  const loserId = Number(body.loserId);
  const special = SPECIALS.includes(body.special) ? body.special : null;
  let declarerId = body.declarerId == null ? null : Number(body.declarerId);

  if (!Number.isInteger(winnerId) || !Number.isInteger(loserId)) return jsonError('Kies twee spelers.');
  if (winnerId === loserId) return jsonError('Je kunt niet van jezelf winnen.');
  if (special === null) return jsonError('Onbekende bijzonderheid.');
  if (special === 'koffie') {
    if (declarerId !== winnerId && declarerId !== loserId) return jsonError('Kies wie de koffieslaaf-uitdaging riep.');
  } else {
    declarerId = null;
  }

  try {
    await ready();
    const db = sql();
    const found = await db`SELECT id FROM players WHERE active AND id IN (${winnerId}, ${loserId})`;
    if (found.length !== 2) return jsonError('Onbekende speler.');
    const [row] = await db`
      INSERT INTO matches (winner_id, loser_id, special, declarer_id)
      VALUES (${winnerId}, ${loserId}, ${special}, ${declarerId})
      RETURNING id`;
    return Response.json({ ...(await getAll()), newId: row.id });
  } catch (e) {
    console.error(e);
    return jsonError('Opslaan mislukt, probeer het opnieuw.', 500);
  }
}
