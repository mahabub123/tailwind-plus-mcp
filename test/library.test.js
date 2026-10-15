import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Library, readSafe, safeRelative, dependencies, MAX_FILE } from '../src/library.js';
import { importAssets } from '../src/import.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const fixtures=new URL('./fixtures/',import.meta.url);
async function temp(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tw-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;}
test('search, filtering, dependencies, template files and line reads',async()=>{
 const lib=await Library.open('examples/assets');
 const result=lib.search({query:'demo button',kind:'component'});assert.equal(result.total,1);
 const read=await lib.read(result.results[0].id,2,1);assert.match(read.source,/<button/);assert.equal(read.untrustedContent,true);
 assert.equal(lib.templates()[0].name,'starter');assert.equal(lib.search({format:'jsx',kind:'template'}).total,1);
 assert.equal(lib.search({query:'nonexistent'}).total,0);assert.equal(lib.search({offset:99}).results.length,0);
 assert.deepEqual(dependencies("import x from '@headlessui/react'; const y=require('./x'); import('react/jsx-runtime')").packages,['@headlessui/react','react']);
 assert.throws(()=>lib.entry('../secret'));
});
test('reject traversal, symlinks, oversized files and stale index',async t=>{
 const dir=await temp(t);await fs.writeFile(path.join(dir,'a.html'),'original');
 const lib=await Library.open(dir);await fs.writeFile(path.join(dir,'a.html'),'modified');await assert.rejects(lib.read(lib.entries[0].id),/changed/);
 for(const n of ['../a','/etc/passwd','a\\b','C:/a','a/./b','a//b'])assert.throws(()=>safeRelative(n));
 await fs.symlink(path.join(dir,'a.html'),path.join(dir,'link.html'));await assert.rejects(readSafe(dir,'link.html'),/links/);
 await fs.writeFile(path.join(dir,'big.html'),Buffer.alloc(MAX_FILE+1));await assert.rejects(readSafe(dir,'big.html'),/large/);
});
test('directory and single-file import omit secrets and symlinks; never overwrite',async t=>{
 const dir=await temp(t);const source=path.join(dir,'source');await fs.mkdir(source);
 await fs.writeFile(path.join(source,'button.html'),'<button/>');await fs.writeFile(path.join(source,'.env'),'SECRET');
 await fs.symlink('/etc/passwd',path.join(source,'link.html'));
 const dest=path.join(dir,'library');assert.equal((await importAssets(source,dest)).files,1);
 assert.deepEqual(await fs.readdir(dest),['button.html']);await assert.rejects(importAssets(source,dest),/exists/);
 await assert.rejects(importAssets(source,path.join(source,'nested')),/outside/);
 assert.equal((await importAssets(path.join(source,'button.html'),path.join(dir,'single'))).files,1);
});
test('ZIP import accepts text and rejects traversal, symlinks, empty filtered archive',async t=>{
 const dir=await temp(t);
 const good=await importAssets(new URL('good.zip',fixtures).pathname,path.join(dir,'good'));assert.equal(good.files,1);
 for(const name of ['traversal','symlink','hidden','oversized']) {
  await assert.rejects(importAssets(new URL(name+'.zip',fixtures).pathname,path.join(dir,name)));
  await assert.rejects(fs.stat(path.join(dir,name)));
 }
 assert.equal((await fs.readdir(dir)).filter(n=>n.startsWith('.tailwind-import')).length,0);
});
test('real stdio MCP handshake, tool discovery, calls, schemas, errors and clean shutdown',async t=>{
 const transport=new StdioClientTransport({command:process.execPath,args:['src/cli.js','serve','--root',path.resolve('examples/assets')],stderr:'pipe'});
 const client=new Client({name:'integration-test',version:'1.0.0'});
 t.after(()=>client.close());await client.connect(transport);
 const tools=await client.listTools();assert.equal(tools.tools.length,7);assert.ok(tools.tools.every(t=>t.annotations.readOnlyHint));
 const call=async(name,args={})=>client.callTool({name,arguments:args});
 const search=JSON.parse((await call('search_components',{query:'button'})).content[0].text);assert.equal(search.total,1);
 assert.match(JSON.parse((await call('get_component',{id:search.results[0].id})).content[0].text).source,/Demo button/);
 assert.equal((await call('get_component',{id:'0'.repeat(24)})).isError,true);
 assert.equal((await call('search_components',{limit:51})).isError,true);
 for(const name of ['list_categories','list_templates','search_templates'])assert.ok((await call(name)).content);
 const template=JSON.parse((await call('get_template',{name:'starter'})).content[0].text);assert.equal(template.total,2);
 const dep=JSON.parse((await call('get_component_dependencies',{id:template.files.find(f=>f.format==='jsx').id})).content[0].text);assert.deepEqual(dep.packages,['react']);assert.equal(dep.packageManifests.length,1);
 await client.close();
});

test('bounded responses and long-line pagination',async t=>{
 const dir=await temp(t);await fs.writeFile(path.join(dir,'long.html'),'x'.repeat(70000)+'\nsmall');
 const lib=await Library.open(dir);await assert.rejects(lib.read(lib.entries[0].id,1,1),/too large/);
 assert.equal((await lib.read(lib.entries[0].id,2,1)).source,'small');
});
