import { openLibrary } from '../src/library-config.js';
import LibraryBrowser from './library-browser.js';
export const dynamic = 'force-dynamic';
export default async function Home() {
  try {
    const library = await openLibrary();
    const assets = library.entries.map(({ id, path, name, kind, template, category, format, bytes }) => ({ id, path, name, kind, template, category, format, bytes }));
    return <LibraryBrowser assets={assets} />;
  } catch {
    return <LibraryBrowser assets={[]} unavailable />;
  }
}
