import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { libraryRoot, openLibrary } from '../src/library-config.js';

test('automatic library location, overrides, and installation errors', async () => {
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'library-config-'));
  try {
    const root=libraryRoot(undefined,{},cwd);
    assert.equal(root,path.join(cwd,'library'));
    assert.equal(libraryRoot(undefined,{TAILWIND_PLUS_ROOT:'   '},cwd),root);
    assert.equal(libraryRoot('explicit',{TAILWIND_PLUS_ROOT:'override'},cwd),path.join(cwd,'explicit'));
    assert.equal(libraryRoot(undefined,{TAILWIND_PLUS_ROOT:'override'},cwd),path.join(cwd,'override'));
    await assert.rejects(openLibrary(root),{code:'LIBRARY_NOT_READY'});
    await fs.mkdir(root);
    await assert.rejects(openLibrary(root),{code:'LIBRARY_NOT_READY'});
    await fs.writeFile(path.join(root,'button.tsx'),'export default function Button() { return null; }');
    assert.equal((await openLibrary(root)).entries.length,1);
  } finally {await fs.rm(cwd,{recursive:true,force:true});}
});
