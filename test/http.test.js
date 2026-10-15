import test from 'node:test';
import assert from 'node:assert/strict';
import { startHttp } from '../src/http.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

test('remote MCP serves anonymous clients while validating host and origin', async () => {
  delete process.env.MCP_TOKEN;
  const server = await startHttp('examples/assets', { port: 31009, publicUrl: 'http://localhost:31009' });
  const url = new URL('http://localhost:31009/mcp');
  const client = new Client({ name: 'test', version: '1' });
  try {
    assert.equal((await fetch(url)).status, 405);
    assert.equal((await fetch(url, {headers:{Origin:'https://evil.example'}})).status, 403);
    assert.equal((await fetch('http://127.0.0.1:31009/mcp')).status, 403);
    await client.connect(new StreamableHTTPClientTransport(url));
    assert.equal((await client.listTools()).tools.length, 7);
    const result = await client.callTool({ name: 'search_components', arguments: {} });
    assert.ok(!result.isError);
    const found=JSON.parse(result.content[0].text).results[0];
    const read=await client.callTool({name:'get_component',arguments:{id:found.id,lineCount:5}});
    assert.ok(!read.isError);
    assert.ok(JSON.parse(read.content[0].text).source);
  } finally {
    await client.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
