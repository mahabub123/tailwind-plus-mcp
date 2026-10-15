import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlVariant, previewDocument } from '../src/preview.js';
test('framework variants resolve only to their exact HTML counterpart', () => {
  const html = { path: 'components/marketing-v4/html/sections/heroes/01-simple.html', format: 'html' };
  const library = { entries: [html] };
  assert.equal(htmlVariant(library, { path: 'components/marketing-v4/react/sections/heroes/01-simple.jsx', format: 'jsx' }), html);
  assert.equal(htmlVariant(library, { path: 'templates/demo/src/page.tsx', format: 'tsx' }), undefined);
});
test('previews compile Tailwind locally and restrict asset script execution', async () => {
  const source = '<div class="text-7xl dark:bg-gray-900">Example</div><script>alert(1)</script>';
  const light = await previewDocument(source, 'light');
  assert.match(light.html, /\.text-7xl\s*\{/);
  assert.match(light.html, /font-size: var\(--text-7xl\)/);
  assert.ok(!light.html.includes('alert(1)'));
  assert.match(light.csp, /default-src 'none'/);
  assert.match(light.csp, /script-src 'nonce-/);
  assert.match(light.csp, /form-action 'none'/);
  const dark = await previewDocument(source, 'dark');
  assert.match(dark.html, /<html class="dark"/);
  assert.notEqual(light.csp, dark.csp);
});
