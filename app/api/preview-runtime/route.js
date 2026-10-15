import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export async function GET() {
  const source = await readFile(require.resolve('@tailwindplus/elements').replace(/\.cjs$/, '.js'), 'utf8');
  return new Response(source, { headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'public, max-age=86400', 'Access-Control-Allow-Origin': '*' } });
}
