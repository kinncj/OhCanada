#!/usr/bin/env node
/** make deploy-check — verifies dist/ is deployable to GitHub Pages and infra files are in sync. */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const errors = [];
const config = JSON.parse(readFileSync(join(root, 'content', 'game.config.json'), 'utf8'));
const pages = JSON.parse(readFileSync(join(root, 'infra', 'pages.config.json'), 'utf8'));

if (!existsSync(dist)) errors.push('dist/ missing (run make build)');
else {
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  const files = walk(dist);
  const total = files.reduce((n, f) => n + statSync(f).size, 0);
  for (const f of files) if (statSync(f).size > 100 * 1024 * 1024) errors.push(`${relative(dist, f)} exceeds the 100 MB GitHub file limit`);
  if (total > 1024 * 1024 * 1024) errors.push(`dist/ is ${(total / 1048576).toFixed(0)} MB — over the 1 GB Pages limit`);
  for (const must of ['index.html', '404.html', 'sw.js']) if (!existsSync(join(dist, must))) errors.push(`dist/${must} missing`);
  const html = existsSync(join(dist, 'index.html')) ? readFileSync(join(dist, 'index.html'), 'utf8') : '';
  const expectedBase = pages.customDomain ? '/' : `/${pages.repository.split('/')[1]}/`;
  if (config.basePath !== expectedBase) errors.push(`game.config basePath ${config.basePath} != expected ${expectedBase} for ${pages.repository}${pages.customDomain ? ' (custom domain)' : ''}`);
  if (!html.includes(`src="${config.basePath}assets/`) && !html.includes(`src="${config.basePath}`)) errors.push(`index.html does not reference assets under ${config.basePath}`);
  if (/https?:\/\/[^"']+\.(js|css)/.test(html)) errors.push('index.html references an external script/stylesheet (CDNs are not allowed)');
  console.log(`deploy-check: dist ${(total / 1048576).toFixed(1)} MB, ${files.length} files, base ${config.basePath}`);
}
// Workflows: .github/workflows must mirror infra/github/workflows (source of truth).
for (const f of readdirSync(join(root, 'infra', 'github', 'workflows'))) {
  const a = readFileSync(join(root, 'infra', 'github', 'workflows', f), 'utf8');
  const b = existsSync(join(root, '.github', 'workflows', f)) ? readFileSync(join(root, '.github', 'workflows', f), 'utf8') : null;
  if (a !== b) errors.push(`.github/workflows/${f} is out of sync with infra/github/workflows/${f} (run: cp infra/github/workflows/*.yml .github/workflows/)`);
}
if (errors.length) {
  for (const e of errors) console.error(` ✗ ${e}`);
  process.exit(1);
}
console.log('deploy-check: OK');
