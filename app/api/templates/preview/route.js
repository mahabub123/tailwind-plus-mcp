import path from 'node:path';
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import crypto from 'node:crypto';
import { libraryRoot } from '../../../../src/library-config.js';
import { safeRelative } from '../../../../src/library.js';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const url = new URL(request.url);
  if (url.searchParams.get('name') !== 'oatmeal-olive-instrument') return new Response('Unknown local template preview', { status: 404 });
  const asset = url.searchParams.get('asset');
  const page = url.searchParams.get('page') || '/';
  if (!asset && !['/', '/about', '/pricing', '/privacy-policy'].includes(page)) return new Response('Unknown page', { status: 404 });
  let file;
  try {
    const relative = asset ? safeRelative(asset) : (page === '/' ? 'home' : page.slice(1)) + '.html';
    if (asset && (!asset.startsWith('img/') || !/\.(svg|webp|png|jpe?g)$/.test(asset))) throw Error('Invalid image');
    let location = libraryRoot();
    for (const part of ['.previews', 'oatmeal-olive-instrument', ...relative.split('/')]) {
      location = path.join(location, part);
      if ((await fs.lstat(location)).isSymbolicLink()) throw Error('Symbolic link rejected');
    }
    file = await fs.open(location, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 12 * 1024 * 1024) throw Error('Invalid file');
    const content = await file.readFile();
    if (asset) {
      const types = { '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
      return new Response(content, { headers: { 'Content-Type': types[path.extname(asset)], 'Cache-Control': 'private, max-age=3600', 'Content-Security-Policy': "default-src 'none'", 'X-Content-Type-Options': 'nosniff' } });
    }
    const nonce = crypto.randomBytes(18).toString('base64');
    const html = content.toString('utf8').replace('<script type="module"', `<script nonce="${nonce}" type="module"`);
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; base-uri 'none'; form-action 'none'`, 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new Response('Local preview unavailable. Run npm run preview:templates to generate the installed Oatmeal demo.', { status: 404 }); }
  finally { await file?.close(); }
}
