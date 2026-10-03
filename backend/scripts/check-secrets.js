/**
 * check-secrets.js — refuses to let secrets reach the repository.
 *
 * Fails (exit 1) when any tracked or staged file:
 *   - contains a "private_key" JSON field (service-account key material), or
 *   - is a .env file (other than .env.example), or
 *   - is named like a Firebase service-account / adminsdk key.
 *
 * Run before every push: `npm run check:secrets` (from backend/). It inspects
 * the whole repository (the parent folder of backend/).
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch (error) {
    if (error.status === 1 && !error.stderr) return ''; // git grep: no matches
    throw error;
  }
};

const problems = [];

const trackedFiles = git('ls-files', '--cached', '--others', '--exclude-standard')
  .split('\n')
  .filter(Boolean);
for (const file of trackedFiles) {
  const base = path.basename(file);
  if (/^\.env(\..+)?$/.test(base) && base !== '.env.example')
    problems.push(`${file}: environment file must not be committed`);
  if (/firebase-service-account|firebase-adminsdk/i.test(base) && base.endsWith('.json')) {
    problems.push(`${file}: Firebase service-account key must not be committed`);
  }
}

const keyHits = git('grep', '-l', '--cached', '-e', '"private_key"', '--', ':!*.md', ':!**/check-secrets.js');
for (const file of keyHits.split('\n').filter(Boolean))
  problems.push(`${file}: contains a private_key field`);

if (problems.length) {
  console.error('✖ Secrets check failed:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`✔ No secrets found in ${trackedFiles.length} tracked/untracked files`);
