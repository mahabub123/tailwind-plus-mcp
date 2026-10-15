import { openLibrary, libraryRoot } from './library-config.js';
let pending, root;
export function webLibrary() {
  const nextRoot = libraryRoot();
  if (root !== nextRoot) { root = nextRoot; pending = undefined; }
  return pending ??= openLibrary(root).catch(error => { pending = undefined; throw error; });
}
