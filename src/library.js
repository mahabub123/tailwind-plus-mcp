import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
export const MAX_FILE = 2 * 1024 * 1024;
export const MAX_TOTAL = 100 * 1024 * 1024;
export const MAX_FILES = 10000;
const extensions = new Set(['.html','.jsx','.tsx','.js','.ts','.vue','.svelte','.css','.json','.md','.mdx','.mjs','.cjs']);
const ignored = new Set(['node_modules','.git','.next','dist','build','.cache']);
export function allowed(name) {
  return !name.split(/[\\/]/).some(x => x.startsWith('.') || ignored.has(x)) &&
    extensions.has(path.extname(name).toLowerCase()) && !/^(?:credentials|secrets|package-lock|pnpm-lock|yarn\.lock)/i.test(path.basename(name));
}
export function safeRelative(name) {
  if (!name || name.includes('\\') || name.includes('\0') || name.includes(':') || path.posix.isAbsolute(name) || /^[A-Za-z]:/.test(name) || name.split('/').some(x=> x==='..' || x==='.' || x==='')) throw Error('Unsafe relative path');
  return name;
}
export async function readSafe(root, relative) {
  safeRelative(relative);
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if ((await fs.lstat(current)).isSymbolicLink()) throw Error('Symbolic links are not allowed');
  }
  const handle = await fs.open(current, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_FILE) throw Error('Not a supported regular file or file too large');
    const data = await handle.readFile();
    if (data.length > MAX_FILE || data.includes(0)) throw Error('Binary or oversized file');
    return new TextDecoder('utf-8', { fatal:true }).decode(data);
  } finally { await handle.close(); }
}
export async function scan(root) {
  const files=[]; let total=0, visited=0;
  async function walk(dir, prefix='') {
    const entries = await fs.readdir(dir,{withFileTypes:true});
    entries.sort((a,b)=>a.name.localeCompare(b.name));
    for (const e of entries) {
      if (++visited > MAX_FILES * 3) throw Error('Too many directory entries');
      if (e.name.startsWith('.') || ignored.has(e.name) || e.isSymbolicLink()) continue;
      const rel=prefix+e.name;
      if (e.isDirectory()) await walk(path.join(dir,e.name),rel+'/');
      else if (e.isFile() && allowed(rel)) {
        const source=await readSafe(root,rel);
        total+=Buffer.byteLength(source);
        if(total>MAX_TOTAL || files.length>=MAX_FILES) throw Error('Library size limit exceeded');
        files.push({path:rel,source});
      }
    }
  }
  await walk(root); return files;
}
export function dependencies(source) {
  const external=new Set(), local=new Set();
  const re=/(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)['"]([^'"\r\n]+)['"]/g;
  for(const match of source.matchAll(re)) {
    const s=match[1];
    if(s.startsWith('.') || s.startsWith('/') || s.startsWith('@/') || s.startsWith('~/')) local.add(s);
    else if(!s.startsWith('node:')) external.add(s.startsWith('@')?s.split('/').slice(0,2).join('/'):s.split('/')[0]);
  }
  return {packages:[...external].sort(),localImports:[...local].sort(),method:'Static import heuristic; inspect package.json for authoritative versions.'};
}
export class Library {
  static async open(root) {
    const lib=new Library(); lib.root=await fs.realpath(root); const files=await scan(lib.root);
    lib.entries=files.map(f=>{
      const parts=f.path.split('/'); const template=parts[0]==='templates' && parts.length>=3;
      return {id:crypto.createHash('sha256').update(f.path).digest('hex').slice(0,24),path:f.path,name:path.basename(f.path,path.extname(f.path)),kind:template?'template':'component',template:template?parts[1]:null,category:parts.slice(0,-1).join('/')||'uncategorized',format:path.extname(f.path).slice(1),bytes:Buffer.byteLength(f.source),sha256:crypto.createHash('sha256').update(f.source).digest('hex'),dependencies:dependencies(f.source),text:f.source.toLowerCase()};
    }); return lib;
  }
  summary(e) { const {text,...rest}=e; return rest; }
  search({query='',kind,format,category,offset=0,limit=20}={}) {
    const words=query.toLowerCase().split(/\s+/).filter(Boolean);
    const results=this.entries.filter(e=>(!kind||e.kind===kind)&&(!format||e.format===format)&&(!category||e.category===category)).map(e=>({e,score:words.reduce((n,w)=>n+(e.path.toLowerCase().includes(w)?5:0)+(e.text.includes(w)?1:0),0)})).filter(x=>words.length===0||words.every(w=>x.e.path.toLowerCase().includes(w)||x.e.text.includes(w))).sort((a,b)=>b.score-a.score||a.e.path.localeCompare(b.e.path));
    return {total:results.length,offset,results:results.slice(offset,offset+limit).map(x=>this.summary(x.e))};
  }
  entry(id) { const e=this.entries.find(e=>e.id===id); if(!e) throw Error('Unknown asset ID; use search first'); return e; }
  async read(id,startLine=1,lineCount=200) {
    const e=this.entry(id), source=await readSafe(this.root,e.path);
    if(crypto.createHash('sha256').update(source).digest('hex')!==e.sha256) throw Error('Asset changed; restart the server to reindex');
    const lines=source.split('\n'); const selected=lines.slice(startLine-1,startLine-1+lineCount).join('\n');
    if(Buffer.byteLength(selected)>65536) throw Error('Response too large; request fewer lines');
    return {...this.summary(e),startLine,totalLines:lines.length,source:selected,untrustedContent:true};
  }
  templates() {
    return [...new Set(this.entries.map(e=>e.template).filter(Boolean))].sort().map(name=>({name,files:this.entries.filter(e=>e.template===name).map(e=>this.summary(e))}));
  }
}
