import { getAll, isAdmin, jsonError, ready, sql } from '@/lib/db';

const UNDO_MINUTES = 15;
const UUID = /^[0-9a-f-]{36}$/i;

// Delete a result: anyone within 15 minutes (undo), the admin always.
export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!UUID.test(id)) return jsonError('Unknown result.', 404);
  try {
    await ready();
    const db = sql();
    const admin = isAdmin(request);
    const result = admin
      ? await db`DELETE FROM matches WHERE id = ${id} RETURNING id`
      : await db`DELETE FROM matches WHERE id = ${id}
                 AND played_at > now() - make_interval(mins => ${UNDO_MINUTES}) RETURNING id`;
    if (result.length === 0) {
      return jsonError(admin ? 'Result not found.' : 'Too late to undo. Ask the admin.', 409);
    }
    return Response.json(await getAll());
  } catch (e) {
    console.error(e);
    return jsonError('Deleting failed.', 500);
  }
}
