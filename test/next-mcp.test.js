import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMcp } from '../src/next-mcp.js';

test('Next handler authenticates and completes MCP initialization and tool requests', async () => {
  process.env.MCP_TOKEN = 'test-token-'.repeat(5);
  process.env.TAILWIND_PLUS_ROOT = 'examples/assets';
  process.env.MCP_PUBLIC_URL = 'http://localhost:3001';
  const request = (body, extra = {}) => new Request('http://localhost:3001/mcp', {
    method: 'POST', headers: {host:'localhost:3001', authorization:`Bearer ${process.env.MCP_TOKEN}`, 'content-type':'application/json', accept:'application/json, text/event-stream', ...extra}, body:JSON.stringify(body),
  });
  assert.equal((await handleMcp(request({}, {authorization:''}))).status,401);
  assert.equal((await handleMcp(request({}, {origin:'https://evil.example'}))).status,403);
  const initialized = await handleMcp(request({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'test',version:'1'}}}));
  assert.equal(initialized.status,200);
  assert.ok((await initialized.json()).result.serverInfo);
  const tools = await handleMcp(request({jsonrpc:'2.0',id:2,method:'tools/list',params:{}}));
  assert.equal((await tools.json()).result.tools.length,7);
  const result = await handleMcp(request({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'search_components',arguments:{}}}));
  assert.ok((await result.json()).result.content.length);
});
