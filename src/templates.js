import path from 'node:path';
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { templateDefinition } from './templates-data.js';
export async function openTemplateArchive(root, id) {
  const template = templateDefinition(id);
  if (!template) throw Error('Unknown template');
  const directory = path.join(root, '.archives');
  if ((await fs.lstat(directory)).isSymbolicLink()) throw Error('Archive directory must not be a symbolic link');
  const file = await fs.open(path.join(directory, template.archive), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 250 * 1024 * 1024) throw Error('Invalid template archive');
    return { file, size: stat.size, filename: template.archive };
  } catch (error) { await file.close(); throw error; }
}
