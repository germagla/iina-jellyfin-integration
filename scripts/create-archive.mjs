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
await exec('zip', ['-qr', archive, 'Info.json', 'LICENSE', 'README.md', 'dist'], { cwd: root });
process.stdout.write(`${archive}\n`);
