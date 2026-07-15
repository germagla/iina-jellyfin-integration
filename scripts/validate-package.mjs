import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const manifestPath = path.join(root, 'Info.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

const failures = [];
const required = [
  'name',
  'identifier',
  'version',
  'description',
  'author',
  'entry',
  'globalEntry',
  'sidebarTab',
];
for (const key of required) {
  if (!manifest[key]) failures.push(`Info.json is missing ${key}`);
}

if (manifest.identifier !== 'dev.germagla.iina-jellyfin') {
  failures.push('Info.json identifier must be dev.germagla.iina-jellyfin');
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version ?? '')) {
  failures.push('Info.json version must be semantic versioning');
}

if (typeof manifest.author?.name !== 'string' || manifest.author.name.trim() === '') {
  failures.push('Info.json author.name is required');
}

if (typeof manifest.sidebarTab?.name !== 'string' || manifest.sidebarTab.name.trim() === '') {
  failures.push('Info.json sidebarTab.name is required');
}

const requiredPermissions = ['network-request', 'show-osd', 'video-overlay', 'file-system'];
if (
  !Array.isArray(manifest.permissions) ||
  [...manifest.permissions].sort().join('\0') !== [...requiredPermissions].sort().join('\0')
) {
  failures.push(`permissions must be exactly: ${requiredPermissions.join(', ')}`);
}

if (JSON.stringify(manifest.allowedDomains) !== JSON.stringify(['*'])) {
  failures.push('allowedDomains must be ["*"] for self-hosted servers');
}

const bundlePaths = [
  manifest.entry,
  manifest.globalEntry,
  'dist/ui/catalog/index.html',
  'dist/ui/sidebar/index.html',
  'dist/ui/overlay/index.html',
];

for (const relative of bundlePaths) {
  if (
    typeof relative !== 'string' ||
    path.isAbsolute(relative) ||
    relative.split(/[\\/]/).includes('..')
  ) {
    failures.push(`Unsafe plugin path: ${String(relative)}`);
    continue;
  }
  const target = path.join(root, relative);
  try {
    await access(target);
    const info = await stat(target);
    if (info.size === 0) failures.push(`${relative} is empty`);
  } catch {
    failures.push(`${relative} does not exist`);
  }
}

for (const relative of bundlePaths.filter(
  (value) => typeof value === 'string' && value.endsWith('.html'),
)) {
  try {
    const html = await readFile(path.join(root, relative), 'utf8');
    if (!/http-equiv=["']Content-Security-Policy["']/i.test(html)) {
      failures.push(`${relative} is missing a Content Security Policy`);
    }
    if (!/default-src\s+'none'/i.test(html) || !/connect-src\s+'none'/i.test(html)) {
      failures.push(`${relative} CSP must deny default and network sources`);
    }
    if (/https?:\/\//i.test(html)) {
      failures.push(`${relative} contains an unexpected remote asset URL`);
    }
  } catch {
    // The missing bundle path was already reported above.
  }
}

const preferenceText = JSON.stringify(manifest.preferenceDefaults ?? {}).toLowerCase();
if (/token|password|secret|api[_-]?key/.test(preferenceText)) {
  failures.push('Preference defaults contain a secret-shaped key');
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('Plugin package validation passed.\n');
}
