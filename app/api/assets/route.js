import { webLibrary } from '../../../src/web-library.js';
import { assetSource } from '../../../src/preview.js';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const start = Number(url.searchParams.get('start') || 1);
  if (!/^[a-f0-9]{24}$/.test(id || '') || !Number.isInteger(start) || start < 1) return Response.json({ error: 'Invalid asset request' }, { status: 400 });
  try {
    const library = await webLibrary();
    const entry = library.entry(id);
    const result = url.searchParams.get('full') === '1' ? { source: await assetSource(library, entry), path: entry.path } : await library.read(id, start, 100);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.code === 'LIBRARY_NOT_READY' ? 'Library is unavailable.' : 'Unable to read this asset. Refresh the library and try again.' }, { status: error.code === 'LIBRARY_NOT_READY' ? 503 : 404 });
  }
}
