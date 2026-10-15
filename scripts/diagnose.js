import { Library } from '../src/library.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const token = process.env.MCP_TOKEN;
const redact = value => token ? String(value).replaceAll(token, '[REDACTED]') : String(value);
let client;
try {
  if (!token || token.length < 32) throw Error('MCP_TOKEN is missing or shorter than 32 characters');
  if (!process.env.TAILWIND_PLUS_ROOT) throw Error('TAILWIND_PLUS_ROOT is missing');
  if (!process.env.MCP_PUBLIC_URL) throw Error('MCP_PUBLIC_URL is missing');
  console.log('Environment: required variables present (token hidden)');
  const library = await Library.open(process.env.TAILWIND_PLUS_ROOT);
  console.log(`Library: ${library.entries.length} files, ${library.templates().length} templates`);
  if (!library.entries.length) throw Error('Library contains no supported source files');
  const url = new URL('/mcp', process.env.MCP_PUBLIC_URL);
  // Check authenticated POST separately to distinguish proxy/auth failures.
  const response = await fetch(url, {
    method:'POST', signal:AbortSignal.timeout(20000),
    headers:{Authorization:`Bearer ${token}`,Accept:'application/json, text/event-stream','Content-Type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'diagnostic',version:'1'}}}),
  });
  console.log(`Public MCP initialization: HTTP ${response.status}`);
  if (!response.ok) {
    const hints = {401:'Token mismatch or Authorization header not reaching the app',403:'Host or Origin rejected; check proxy headers and MCP_PUBLIC_URL',404:'MCP route missing from deployed build',405:'POST method rejected by app or proxy',500:'Library unreadable in running service or MCP runtime error; check application logs',503:'Running service is missing required environment variables'};
    throw Error(hints[response.status] ?? 'Unexpected HTTP response from public endpoint');
  }
  const initialized = await response.json();
  if (initialized.error || !initialized.result?.serverInfo) throw Error('Endpoint did not return a successful MCP initialization');
  client = new Client({name:'tailwind-diagnostic',version:'1'});
  await client.connect(new StreamableHTTPClientTransport(url,{requestInit:{headers:{Authorization:`Bearer ${token}`}}}),{timeout:20000});
  console.log(`Tools: ${(await client.listTools()).tools.length}`);
  const result = await client.callTool({name:'search_components',arguments:{limit:1}});
  if (result.isError) throw Error('Component search returned an MCP tool error');
  const data = JSON.parse(result.content[0].text);
  console.log(`Component search: ${data.total} indexed component files`);
  console.log('PASS: public authenticated MCP connection and tool call succeeded');
} catch (error) {
  console.error('FAIL:',redact(error.message));
  process.exitCode=1;
} finally { await client?.close().catch(()=>{}); }
