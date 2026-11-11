import { isAdmin, jsonError } from '@/lib/db';

// Checks whether the admin code is correct.
export async function POST(request) {
  if (!process.env.ADMIN_CODE) return jsonError('No ADMIN_CODE has been set yet.', 503);
  return isAdmin(request) ? Response.json({ ok: true }) : jsonError('Wrong admin code.', 401);
}
