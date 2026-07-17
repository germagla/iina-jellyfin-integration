import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');
const artifacts = path.join(root, '.artifacts');
const archive = path.join(artifacts, 'jellyfin-for-iina.iinaplgz');

await mkdir(artifacts, { recursive: true });
await rm(archive, { force: true });
await exec(
  'zip',
  ['-qr', archive, 'Info.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md', 'dist'],
  { cwd: root },
);

const { stdout: archiveListing } = await exec('unzip', ['-Z1', archive], { cwd: root });
const entries = archiveListing
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .filter(Boolean);
const allowedRootFiles = new Set(['Info.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md']);
for (const required of allowedRootFiles) {
  if (!entries.includes(required)) throw new Error(`Install archive is missing ${required}`);
}
for (const entry of entries) {
  const segments = entry.split('/').filter(Boolean);
  const unsafe =
    entry.startsWith('/') ||
    entry.includes('\\') ||
    segments.includes('..') ||
    (!allowedRootFiles.has(entry) && entry !== 'dist/' && !entry.startsWith('dist/'));
  if (unsafe) throw new Error(`Install archive contains an unexpected path: ${entry}`);
}
process.stdout.write(`${archive}\n`);
