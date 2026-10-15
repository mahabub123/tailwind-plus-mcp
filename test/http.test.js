import test from 'node:test';
import assert from 'node:assert/strict';
import { startHttp } from '../src/http.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

test('remote MCP authenticates requests and serves tools', async () => {
  const token = 'a'.repeat(40);
  // Use localhost as the public hostname to verify host validation.
  const server = await startHttp('examples/assets', { port: 3000, token, publicUrl: 'http://localhost:3000' });
  const url = new URL(`http://localhost:${server.address().port}/mcp`);
  const headers = { Host: 'localhost:3000' };
  const client = new Client({ name: 'test', version: '1' });
  try {
    assert.equal((await fetch(url, { headers })).status, 401);
    assert.equal((await fetch(url, { headers: { ...headers, Authorization: `Bearer ${token}`, Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await fetch(new URL(`http://127.0.0.1:${server.address().port}/mcp`), { headers: { Authorization: `Bearer ${token}` } })).status, 403);
    assert.equal((await fetch(url, { headers: { ...headers, Authorization: `Bearer ${token}` } })).status, 405);
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { ...headers, Authorization: `Bearer ${token}` } } }));
    assert.equal((await client.listTools()).tools.length, 7);
    const result = await client.callTool({ name: 'search_components', arguments: {} });
    assert.ok(result.content.length);
  } finally {
    await client.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('remote MCP refuses missing authentication', async () => {
  await assert.rejects(startHttp('examples/assets', { token: '' }), /MCP_TOKEN/);
});
