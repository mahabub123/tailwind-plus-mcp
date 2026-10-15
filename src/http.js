import { createServer as createHttpServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { libraryRoot, openLibrary } from './library-config.js';
import { createServer } from './server.js';

export async function startHttp(root, options = {}) {
  const token = options.token ?? process.env.MCP_TOKEN;
  const publicUrl = new URL(options.publicUrl ?? process.env.MCP_PUBLIC_URL ?? 'http://localhost:3000');
  const host = options.host ?? process.env.HOST ?? '127.0.0.1';
  const port = Number(options.port ?? process.env.PORT ?? 3000);
  if (!token || token.length < 32) throw Error('MCP_TOKEN must contain at least 32 characters');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid PORT');
  if (!['http:', 'https:'].includes(publicUrl.protocol)) throw Error('Invalid MCP_PUBLIC_URL');
  const library = await openLibrary(libraryRoot(root));
  const expected = Buffer.from(`Bearer ${token}`);
  const http = createHttpServer(async (req, res) => {
    const reply = (status, message) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: message })); };
    if (req.headers.host !== publicUrl.host) return reply(403, 'Invalid host');
    if (req.headers.origin && req.headers.origin !== publicUrl.origin) return reply(403, 'Invalid origin');
    if (req.url !== '/mcp') return reply(404, 'Not found');
    const supplied = Buffer.from(req.headers.authorization ?? '');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return reply(401, 'Unauthorized');
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply(405, 'Method not allowed'); }
    const server = createServer(library);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.once('close', () => { void server.close().catch(() => {}); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch {
      if (!res.headersSent) reply(500, 'Internal server error');
      else res.end();
      await server.close().catch(() => {});
    }
  });
  http.requestTimeout = 30000;
  http.headersTimeout = 10000;
  await new Promise((resolve, reject) => { http.once('error', reject); http.listen(port, host, resolve); });
  return http;
}
