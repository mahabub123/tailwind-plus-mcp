// Build only the supplied Oatmeal demo into static preview pages. Never runs package scripts.
import { build } from 'esbuild';
import { compile } from '@tailwindcss/node';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import yauzl from 'yauzl';
import { libraryRoot } from '../src/library-config.js';
const root = libraryRoot();
const input = path.join(root, 'templates/oatmeal-olive-instrument/demo');
try { await fs.access(path.join(input, 'src/app/page.tsx')); } catch { console.log('Oatmeal not installed; skipping.'); process.exit(0); }
const output = path.join(root, '.previews/oatmeal-olive-instrument');
await fs.mkdir(output, { recursive: true });
const sources = [];
async function walk(directory) { for (const file of await fs.readdir(directory, { withFileTypes: true })) { const location = path.join(directory, file.name); if (file.isDirectory()) await walk(location); else if (/\.(tsx?|css)$/.test(file.name)) sources.push(await fs.readFile(location, 'utf8')); } }
await walk(path.join(input, 'src'));
const compiler = await compile(await fs.readFile(path.join(input, 'src/app/globals.css'), 'utf8'), { base: process.cwd(), onDependency() {} });
const css = compiler.build(sources.join('\n').split(/[\s"'`<>=]+/));
const prefix = '/api/templates/preview?name=oatmeal-olive-instrument&asset=';
for (const page of ['', 'about', 'pricing', 'privacy-policy']) {
  const filename = path.join(output, (page || 'home') + '.mjs');
  const pagePath = path.join(input, 'src/app', page, 'page.tsx');
  await build({ stdin: { contents: `import React from 'react'; import Layout from ${JSON.stringify(path.join(input, 'src/app/layout.tsx'))}; import Page from ${JSON.stringify(pagePath)}; export default function Preview(){return <Layout><Page /></Layout>}`, resolveDir: process.cwd(), loader: 'tsx' }, outfile: filename, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', external: ['react', 'react-dom', 'react/jsx-runtime', '@tailwindplus/elements/react'], alias: { '@': path.join(input, 'src') }, plugins: [{ name: 'preview-adapters', setup(build) {
    build.onResolve({ filter: /^next\/(image|link)$/ }, args => ({ path: args.path, namespace: 'preview' }));
    build.onLoad({ filter: /.*/, namespace: 'preview' }, args => ({ loader: 'jsx', contents: args.path === 'next/image' ? `import React from 'react';export default function Image({src,alt,priority,fill,quality,placeholder,blurDataURL,unoptimized,loader,...props}){return <img {...props} alt={alt||''} src={typeof src==='string'?src:src.src}/ >}` : `import React from 'react';export default function Link({href,prefetch,replace,scroll,...props}){return <a {...props} href={typeof href==='string'?href:href.pathname}/ >}` }));
    build.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }));
  } }] });
  const { default: Page } = await import(pathToFileURL(filename).href);
  let html = '<!doctype html>' + renderToStaticMarkup(createElement(Page));
  html = html.replace('</head>', `<style>${css}</style><script type="module" src="/api/preview-runtime"></script></head>`);
  html = html.replace(/(src|href)="(\/img\/[^"?#]+)"/g, (_, attr, value) => `${attr}="${prefix}${encodeURIComponent(value.slice(1))}"`);
  html = html.replace(/href="\/(about|pricing|privacy-policy)?"/g, (_, value) => `href="/api/templates/preview?name=oatmeal-olive-instrument&amp;page=${encodeURIComponent('/' + (value || ''))}"`);
  await fs.writeFile(path.join(output, (page || 'home') + '.html'), html);
  await fs.unlink(filename);
}
await new Promise((resolve, reject) => yauzl.open(path.join(root, '.archives/oatmeal-olive-instrument.zip'), { lazyEntries: true }, (error, zip) => {
  if (error) return reject(error);
  let total = 0;
  zip.on('error', reject); zip.on('end', resolve);
  zip.on('entry', entry => {
    const name = entry.fileName;
    if (!name.startsWith('demo/public/img/') || name.includes('..') || name.includes('\\') || !/\.(svg|webp|png|jpe?g)$/.test(name)) return zip.readEntry();
    if (entry.uncompressedSize > 10 * 1024 * 1024 || (total += entry.uncompressedSize) > 100 * 1024 * 1024) { zip.close(); return reject(Error('Preview image limits exceeded')); }
    zip.openReadStream(entry, async (err, stream) => { if (err) return reject(err); try { const chunks=[]; for await (const chunk of stream) chunks.push(chunk); const target=path.join(output,name.slice('demo/public/'.length)); await fs.mkdir(path.dirname(target),{recursive:true}); await fs.writeFile(target,Buffer.concat(chunks)); zip.readEntry(); } catch(e){zip.close();reject(e);} });
  }); zip.readEntry();
}));
console.log('Built complete Oatmeal home, about, pricing, and privacy previews with original images.');
