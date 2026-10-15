import { webLibrary } from '../../../src/web-library.js';
import { assetSource, htmlVariant, previewDocument } from '../../../src/preview.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const url = new URL(request.url);
  try {
    const library = await webLibrary();
    const entry = library.entry(url.searchParams.get('id'));
    const html = htmlVariant(library, entry);
    if (!html) return new Response('This source file has no standalone HTML preview. Use the Code tab to inspect it.', { status: 422 });
    const result = await previewDocument(await assetSource(library, html), url.searchParams.get('theme'));
    return new Response(result.html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': result.csp, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new Response('Preview unavailable. Refresh the library and try again.', { status: 404 }); }
}
