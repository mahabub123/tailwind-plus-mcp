import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { groupTemplates } from '../src/templates-data.js';
import { openTemplateArchive } from '../src/templates.js';
test('template gallery groups project files and combines Catalyst variants', () => {
  const grouped = groupTemplates([
    { kind:'template', template:'spotlight', path:'templates/spotlight/spotlight-js/src/app/page.jsx' },
    { kind:'template', template:'spotlight', path:'templates/spotlight/spotlight-ts/src/app/page.tsx' },
    { kind:'template', template:'catalyst-demo-javascript', path:'templates/catalyst-demo-javascript/src/app.jsx' },
    { kind:'template', template:'catalyst-demo-typescript', path:'templates/catalyst-demo-typescript/src/app.tsx' },
  ]);
  assert.equal(grouped.length,2);
  assert.equal(grouped.find(t=>t.id==='spotlight').files,2);
  assert.deepEqual(grouped.find(t=>t.id==='spotlight').variants,['JavaScript','TypeScript']);
  assert.equal(grouped.find(t=>t.id==='catalyst').archive,'catalyst-ui-kit.zip');
});
test('downloads open only allowlisted original ZIPs and reject symbolic links', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'template-download-'));
  try {
    await fs.mkdir(path.join(root,'.archives'));
    await fs.writeFile(path.join(root,'.archives/spotlight.zip'),'PK-test-original');
    const result = await openTemplateArchive(root,'spotlight');
    assert.equal(result.filename,'spotlight.zip');
    assert.equal(await result.file.readFile('utf8'),'PK-test-original');
    await result.file.close();
    await assert.rejects(openTemplateArchive(root,'../../secret'));
    await fs.symlink(path.join(root,'.archives/spotlight.zip'),path.join(root,'.archives/radiant.zip'));
    await assert.rejects(openTemplateArchive(root,'radiant'));
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});
