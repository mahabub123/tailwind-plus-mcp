import path from 'node:path';
import { Library } from './library.js';

export function libraryRoot(explicitRoot, env = process.env, cwd = process.cwd()) {
  return path.resolve(cwd, explicitRoot || env.TAILWIND_PLUS_ROOT?.trim() || 'library');
}

export async function openLibrary(root = libraryRoot()) {
  let library;
  try {
    library = await Library.open(root);
  } catch (cause) {
    if (!['ENOENT', 'EACCES', 'ENOTDIR', 'EPERM'].includes(cause.code)) throw cause;
    throw Object.assign(new Error(`Library unavailable at ${root}. Extract your private library into the project's library/ folder and ensure the service user can read it.`, { cause }), { code: 'LIBRARY_NOT_READY' });
  }
  if (!library.entries.length) throw Object.assign(new Error(`No supported assets in ${root}. Import your licensed assets into the project's library/ folder.`), { code: 'LIBRARY_NOT_READY' });
  return library;
}
