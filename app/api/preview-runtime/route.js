import { readFile } from 'node:fs/promises';
import path from 'node:path';
export async function GET() {
  const source = await readFile(path.join(process.cwd(), 'node_modules/@tailwindplus/elements/dist/index.js'), 'utf8');
  return new Response(source, { headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'public, max-age=86400', 'Access-Control-Allow-Origin': '*' } });
}
