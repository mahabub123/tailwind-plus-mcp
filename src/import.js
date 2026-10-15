import fs from 'node:fs/promises';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import yauzl from 'yauzl';
import { scan, allowed, safeRelative, MAX_FILE, MAX_TOTAL, MAX_FILES } from './library.js';
async function extract(zipPath,dest) {
  const zip=await new Promise((resolve,reject)=>yauzl.open(zipPath,{lazyEntries:true,autoClose:true,validateEntrySizes:true},(e,z)=>e?reject(e):resolve(z)));
  let count=0,total=0;
  await new Promise((resolve,reject)=>{
    const fail=e=>{zip.close();reject(e);}; zip.on('error',fail); zip.on('end',resolve);
    zip.on('entry',entry=>{ (async()=>{
      if(++count>MAX_FILES) throw Error('Too many ZIP entries');
      const name=entry.fileName.replace(/\/$/,''); safeRelative(name);
      const mode=(entry.externalFileAttributes>>>16)&0xf000;
      if(mode && mode!==0x8000 && mode!==0x4000) throw Error('ZIP links and special files are forbidden');
      if(entry.generalPurposeBitFlag&1) throw Error('Encrypted ZIP is unsupported');
      if(entry.fileName.endsWith('/') || !allowed(name)) {zip.readEntry();return;}
      if(entry.uncompressedSize>MAX_FILE || total+entry.uncompressedSize>MAX_TOTAL) throw Error('ZIP size limit exceeded');
      const target=path.join(dest,name); await fs.mkdir(path.dirname(target),{recursive:true});
      const stream=await new Promise((res,rej)=>zip.openReadStream(entry,(e,s)=>e?rej(e):res(s)));
      let bytes=0;
      await pipeline(stream,new Transform({transform(chunk,encoding,cb){bytes+=chunk.length;total+=chunk.length;cb(bytes>MAX_FILE||total>MAX_TOTAL?Error('ZIP expansion limit exceeded'):null,chunk);}}),createWriteStream(target,{flags:'wx',mode:0o600}));
      zip.readEntry();
    })().catch(fail); }); zip.readEntry();
  });
}
export async function importAssets(source,destination) {
  source=path.resolve(source); destination=path.resolve(destination);
  const stat=await fs.lstat(source);
  if(stat.isSymbolicLink()) throw Error('Source cannot be a symbolic link');
  const parent=await fs.realpath(path.dirname(destination)); destination=path.join(parent,path.basename(destination));
  const realSource=await fs.realpath(source);
  if(destination===realSource || destination.startsWith(realSource+path.sep)) throw Error('Destination must be outside source');
  try {await fs.lstat(destination); throw Error('Destination already exists; choose a new directory');} catch(e){if(e.code!=='ENOENT')throw e;}
  const stage=await fs.mkdtemp(path.join(parent,'.tailwind-import-'));
  try {
    if(stat.isDirectory()) for(const f of await scan(realSource)) {const target=path.join(stage,f.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,f.source,{mode:0o600});}
    else if(stat.isFile() && path.extname(source).toLowerCase()==='.zip') await extract(source,stage);
    else if(stat.isFile() && allowed(path.basename(source))) {const files=await import('./library.js');await fs.writeFile(path.join(stage,path.basename(source)),await files.readSafe(path.dirname(realSource),path.basename(realSource)),{mode:0o600});}
    else throw Error('Use a local directory, supported text file, or ZIP archive');
    const files=await scan(stage); if(!files.length) throw Error('No supported assets found');
    // mkdir is exclusive: never overwrite an existing destination, even after a race.
    await fs.mkdir(destination,{mode:0o700});
    try {for (const name of await fs.readdir(stage)) await fs.cp(path.join(stage,name),path.join(destination,name),{recursive:true,errorOnExist:true,force:false});} catch(e){await fs.rm(destination,{recursive:true,force:true});throw e;}
    return {destination,files:files.length};
  } finally {await fs.rm(stage,{recursive:true,force:true});}
}
