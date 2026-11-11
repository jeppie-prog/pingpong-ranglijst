import { isAdmin, jsonError } from '@/lib/db';

// Controleert of de beheerderscode klopt.
export async function POST(request) {
  if (!process.env.ADMIN_CODE) return jsonError('Er is nog geen ADMIN_CODE ingesteld.', 503);
  return isAdmin(request) ? Response.json({ ok: true }) : jsonError('Verkeerde beheerderscode.', 401);
}
