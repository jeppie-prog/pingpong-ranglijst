import { getAll, isAdmin, jsonError, ready, sql } from '@/lib/db';

const UNDO_MINUTES = 15;
const UUID = /^[0-9a-f-]{36}$/i;

// Uitslag verwijderen: iedereen binnen 15 minuten (ongedaan maken), beheerder altijd.
export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!UUID.test(id)) return jsonError('Onbekende uitslag.', 404);
  try {
    await ready();
    const db = sql();
    const admin = isAdmin(request);
    const result = admin
      ? await db`DELETE FROM matches WHERE id = ${id} RETURNING id`
      : await db`DELETE FROM matches WHERE id = ${id}
                 AND played_at > now() - make_interval(mins => ${UNDO_MINUTES}) RETURNING id`;
    if (result.length === 0) {
      return jsonError(admin ? 'Uitslag niet gevonden.' : 'Te laat om ongedaan te maken. Vraag de beheerder.', 409);
    }
    return Response.json(await getAll());
  } catch (e) {
    console.error(e);
    return jsonError('Verwijderen mislukt.', 500);
  }
}
