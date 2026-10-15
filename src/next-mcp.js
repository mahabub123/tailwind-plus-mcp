import { timingSafeEqual } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Library } from './library.js';
import { createServer } from './server.js';

let libraryPromise;
export async function handleMcp(request) {
  const token = process.env.MCP_TOKEN;
  const root = process.env.TAILWIND_PLUS_ROOT;
  const publicUrl = process.env.MCP_PUBLIC_URL;
  const reply = (status, error, headers = {}) => Response.json({ error }, { status, headers });
  if (!token || token.length < 32 || !root || !publicUrl) return reply(503, 'Server configuration incomplete');
  let expectedUrl;
  try { expectedUrl = new URL(publicUrl); } catch { return reply(503, 'Invalid server URL'); }
  if (request.headers.get('host') !== expectedUrl.host) return reply(403, 'Invalid host');
  const origin = request.headers.get('origin');
  if (origin && origin !== expectedUrl.origin) return reply(403, 'Invalid origin');
  const expected = Buffer.from(`Bearer ${token}`);
  const supplied = Buffer.from(request.headers.get('authorization') ?? '');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return reply(401, 'Unauthorized', { 'WWW-Authenticate': 'Bearer' });
  if (request.method !== 'POST') return reply(405, 'Method not allowed', { Allow: 'POST' });
  let server;
  try {
    libraryPromise ??= Library.open(root).catch(error => { libraryPromise = undefined; throw error; });
    server = createServer(await libraryPromise);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    // JSON-only transport: consume the completed response before closing the server.
    const body = await response.arrayBuffer();
    return new Response(body.byteLength ? body : null, { status: response.status, headers: response.headers });
  } catch {
    return reply(500, 'Internal server error');
  } finally {
    await server?.close().catch(() => {});
  }
}
