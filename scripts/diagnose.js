import { libraryRoot, openLibrary } from '../src/library-config.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

let client;
try {
  if (!process.env.MCP_PUBLIC_URL) throw Error('MCP_PUBLIC_URL is missing');
  console.log('Environment: public URL configured; no authentication required');
  const library = await openLibrary(libraryRoot());
  console.log(`Library: ${library.entries.length} files, ${library.templates().length} templates`);
  if (!library.entries.length) throw Error('Library contains no supported source files');
  const url = new URL('/mcp', process.env.MCP_PUBLIC_URL);
  // Check anonymous POST separately to distinguish proxy/auth failures.
  const response = await fetch(url, {
    method:'POST', signal:AbortSignal.timeout(20000),
    headers:{Accept:'application/json, text/event-stream','Content-Type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'diagnostic',version:'1'}}}),
  });
  console.log(`Public MCP initialization: HTTP ${response.status}`);
  if (!response.ok) {
    const hints = {401:'Old authenticated build or upstream proxy authentication still active',403:'Host or Origin rejected; check proxy headers and MCP_PUBLIC_URL',404:'MCP route missing from deployed build',405:'POST method rejected by app or proxy',500:'Library unreadable in running service or MCP runtime error; check application logs',503:'Running service is missing required environment variables'};
    throw Error(hints[response.status] ?? 'Unexpected HTTP response from public endpoint');
  }
  const initialized = await response.json();
  if (initialized.error || !initialized.result?.serverInfo) throw Error('Endpoint did not return a successful MCP initialization');
  client = new Client({name:'tailwind-diagnostic',version:'1'});
  await client.connect(new StreamableHTTPClientTransport(url),{timeout:20000});
  console.log(`Tools: ${(await client.listTools()).tools.length}`);
  const result = await client.callTool({name:'search_components',arguments:{limit:1}});
  if (result.isError) throw Error('Component search returned an MCP tool error');
  const data = JSON.parse(result.content[0].text);
  console.log(`Component search: ${data.total} indexed component files`);
  console.log('PASS: public anonymous MCP connection and tool call succeeded');
} catch (error) {
  console.error('FAIL:',error.message);
  process.exitCode=1;
} finally { await client?.close().catch(()=>{}); }
