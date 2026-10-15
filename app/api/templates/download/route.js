import { Readable } from 'node:stream';
import { libraryRoot } from '../../../../src/library-config.js';
import { openTemplateArchive } from '../../../../src/templates.js';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const { file, size, filename } = await openTemplateArchive(libraryRoot(), new URL(request.url).searchParams.get('name'));
    return new Response(Readable.toWeb(file.createReadStream()), { headers: { 'Content-Type': 'application/zip', 'Content-Length': String(size), 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return Response.json({ error: 'The original ZIP for this template is unavailable. Re-import its complete download.' }, { status: 404 }); }
}
