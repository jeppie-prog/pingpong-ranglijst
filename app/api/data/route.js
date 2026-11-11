import { connection } from 'next/server';
import { getAll, jsonError } from '@/lib/db';

export async function GET() {
  await connection();
  try {
    return Response.json(await getAll(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error(e);
    return jsonError('Could not load the data.', 500);
  }
}
