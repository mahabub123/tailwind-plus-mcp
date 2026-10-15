import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { importAssets } from '../src/import.js';
import { scan, Library } from '../src/library.js';

const source = path.resolve(process.argv[2] ?? path.join(os.homedir(), 'Downloads'));
const destination = path.resolve(process.argv[3] ?? 'library');
const names = ['catalyst-ui-kit','keynote','syntax','pocket','transmit','commit','protocol','primer','studio','salient','compass','radiant','spotlight','oatmeal-olive-instrument','ecommerce-v4','application-ui-v4','marketing-v4'];
// Never overwrite an existing library. Validate all archives before publishing.
try { await fs.lstat(destination); throw Error('Destination already exists; choose a new directory'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const stage = await fs.mkdtemp(path.join(path.dirname(destination), '.tailwind-batch-'));
const work = await fs.mkdtemp(path.join(os.tmpdir(), 'tailwind-batch-'));
try {
  const report = [];
  await fs.mkdir(path.join(stage, '.archives'), {mode:0o700});
  for (const name of names) {
    const archive = path.join(source, `${name}.zip`);
    const unpacked = path.join(work, name);
    await importAssets(archive, unpacked);
    const files = await scan(unpacked);
    const counts = {name, files:files.length, components:0, templates:0};
    for (const file of files) {
      let relative;
      if (['ecommerce-v4','application-ui-v4','marketing-v4'].includes(name)) {
        relative = `components/${name}/${file.path}`;
      } else if (name === 'catalyst-ui-kit') {
        const stripped = file.path.replace(/^catalyst-ui-kit\//, '');
        if (stripped.startsWith('demo/')) {
          const [,variant,...rest] = stripped.split('/');
          relative = `templates/catalyst-demo-${variant}/${rest.join('/')}`;
        } else relative = `components/catalyst/${stripped}`;
      } else {
        const stripped = file.path.replace(new RegExp(`^tailwind-plus-${name}/`), '');
        relative = `templates/${name}/${stripped}`;
      }
      const target = path.join(stage, relative);
      await fs.mkdir(path.dirname(target), {recursive:true,mode:0o700});
      await fs.writeFile(target, file.source, {flag:'wx',mode:0o600});
      counts[relative.startsWith('templates/') ? 'templates' : 'components']++;
    }
    // Keep complete downloads, including images/fonts, outside the searchable index.
    await fs.copyFile(archive, path.join(stage, '.archives', `${name}.zip`));
    await fs.chmod(path.join(stage, '.archives', `${name}.zip`), 0o600);
    report.push(counts);
    console.log(JSON.stringify(counts));
  }
  const lib = await Library.open(stage);
  const summary = {archives:report.length, files:lib.entries.length, templates:lib.templates().map(t=>({name:t.name,files:t.files.length})), imports:report};
  await fs.writeFile(path.join(stage, '.import-manifest.json'), JSON.stringify(summary,null,2), {mode:0o600});
  await fs.mkdir(destination,{mode:0o700});
  try {
    for (const entry of await fs.readdir(stage)) await fs.cp(path.join(stage,entry),path.join(destination,entry),{recursive:true,errorOnExist:true,force:false});
  } catch (error) { await fs.rm(destination,{recursive:true,force:true}); throw error; }
  console.log(JSON.stringify({destination,archives:summary.archives,files:summary.files,templates:summary.templates.length}));
} finally {
  await fs.rm(stage,{recursive:true,force:true});
  await fs.rm(work,{recursive:true,force:true});
}
