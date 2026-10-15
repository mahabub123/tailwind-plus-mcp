import { compile } from '@tailwindcss/node';
import { readSafe } from './library.js';
import crypto from 'node:crypto';
export async function assetSource(library, entry) {
  const source = await readSafe(library.root, entry.path);
  if (crypto.createHash('sha256').update(source).digest('hex') !== entry.sha256) throw Error('Asset changed; restart to reindex');
  return source;
}
export function htmlVariant(library, entry) {
  if (entry.format === 'html') return entry;
  const target = entry.path.replace(/\/(react|vue)\//, '/html/').replace(/\.[^.]+$/, '.html');
  return library.entries.find(e => e.path === target);
}
const compiled = new Map();
export async function previewDocument(source, theme = 'light') {
  const key = crypto.createHash('sha256').update(source).digest('hex');
  let css = compiled.get(key);
  if (!css) {
    const compiler = await compile('@import "tailwindcss"; @custom-variant dark (&:where(.dark, .dark *));', { base: process.cwd(), onDependency() {} });
    const classes = [...source.matchAll(/class\s*=\s*["']([^"']*)["']/g)].flatMap(m => m[1].split(/\s+/));
    css = compiler.build(classes);
    if (compiled.size >= 80) compiled.delete(compiled.keys().next().value);
    compiled.set(key, css);
  }
  const nonce = crypto.randomBytes(18).toString('base64');
  const csp = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src https: data:; font-src https: data:; connect-src 'none'; form-action 'none'; base-uri 'none'`;
  // Library markup stays inside an opaque-origin sandbox. Only the official runtime has script permission.
  const markup = source.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '').replace(/<\/?(?:html|head|body)\b[^>]*>/gi, '');
  return { csp, html: `<!doctype html><html class="${theme === 'dark' ? 'dark' : ''}" lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.replace(/<\/style/gi, '')}\nhtml{color-scheme:${theme === 'dark' ? 'dark' : 'light'};background:${theme === 'dark' ? '#111827' : '#fff'}}body{min-height:100vh;position:relative;margin:0;font-family:Inter,ui-sans-serif,system-ui,sans-serif}el-dialog,el-dialog-panel{display:contents}</style><script nonce="${nonce}" src="/api/preview-runtime" type="module"></script></head><body>${markup}</body></html>` };
}
