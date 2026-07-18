import { createHash } from 'node:crypto';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const manifestPath = path.join(root, 'Info.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

const failures = [];
const versionFiles = [
  'package.json',
  'packages/core/package.json',
  'packages/plugin/package.json',
  'packages/ui/package.json',
];
for (const relative of versionFiles) {
  try {
    const packageJson = JSON.parse(await readFile(path.join(root, relative), 'utf8'));
    if (packageJson.version !== manifest.version) {
      failures.push(`${relative} version must match Info.json (${manifest.version})`);
    }
  } catch {
    failures.push(`${relative} could not be read for version validation`);
  }
}
try {
  const constants = await readFile(path.join(root, 'packages/plugin/src/constants.ts'), 'utf8');
  const runtimeVersion = constants.match(/PLUGIN_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
  if (runtimeVersion !== manifest.version) {
    failures.push(`PLUGIN_VERSION must match Info.json (${manifest.version})`);
  }
} catch {
  failures.push('packages/plugin/src/constants.ts could not be read for version validation');
}

const expectedEntryPaths = {
  entry: 'dist/index.js',
  globalEntry: 'dist/global.js',
  preferencesPage: 'dist/ui/preferences/index.html',
};
for (const [key, expected] of Object.entries(expectedEntryPaths)) {
  if (manifest[key] !== expected) failures.push(`Info.json ${key} must be ${expected}`);
}

const required = [
  'name',
  'identifier',
  'version',
  'description',
  'author',
  'entry',
  'globalEntry',
  'preferencesPage',
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

if (manifest.ghRepo !== 'germagla/iina-jellyfin-integration') {
  failures.push('Info.json ghRepo must match the public GitHub repository');
}

if (!Number.isSafeInteger(manifest.ghVersion) || manifest.ghVersion < 1) {
  failures.push('Info.json ghVersion must be a positive integer');
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
  manifest.preferencesPage,
  'dist/ui/catalog/index.html',
  'dist/ui/sidebar/index.html',
  'dist/ui/overlay/index.html',
];

try {
  const notices = await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  if (!/uri-js/i.test(notices) || !/Copyright 2011 Gary Court/.test(notices)) {
    failures.push('THIRD_PARTY_NOTICES.md must include the bundled uri-js license notice');
  }
} catch {
  failures.push('THIRD_PARTY_NOTICES.md is required for the bundled uri-js dependency');
}

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
    if (!info.isFile()) failures.push(`${relative} is not a regular file`);
    else if (info.size === 0) failures.push(`${relative} is empty`);
  } catch {
    failures.push(`${relative} does not exist`);
  }
}

for (const relative of bundlePaths.filter(
  (value) => typeof value === 'string' && value.endsWith('.html'),
)) {
  try {
    const htmlPath = path.join(root, relative);
    const html = await readFile(htmlPath, 'utf8');
    const markupOnly = html
      .replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>')
      .replace(/(<style\b[^>]*>)[\s\S]*?<\/style>/gi, '$1</style>');
    if (!/http-equiv=["']Content-Security-Policy["']/i.test(markupOnly)) {
      failures.push(`${relative} is missing a Content Security Policy`);
    }
    if (/https?:\/\//i.test(markupOnly)) {
      failures.push(`${relative} contains an unexpected remote asset URL`);
    }

    if (/<script\b[^>]*\btype=["']module["']/i.test(markupOnly)) {
      failures.push(`${relative} contains an IINA-incompatible module script`);
    }
    if (/<link\b[^>]*\brel=["']modulepreload["']/i.test(markupOnly)) {
      failures.push(`${relative} contains an IINA-incompatible module preload`);
    }
    if (/\bcrossorigin(?:\s*=|\s|>)/i.test(markupOnly)) {
      failures.push(`${relative} contains an unnecessary cross-origin attribute`);
    }
    if (/<script\b[^>]*\bsrc\s*=/i.test(markupOnly)) {
      failures.push(`${relative} must inline its script for IINA file-backed webviews`);
    }
    if (/<link\b[^>]*\brel=["']stylesheet["']/i.test(markupOnly)) {
      failures.push(`${relative} must inline its stylesheet for IINA file-backed webviews`);
    }

    const cspTag = markupOnly.match(
      /<meta\b(?=[^>]*\bhttp-equiv=["']Content-Security-Policy["'])[^>]*>/i,
    )?.[0];
    const csp = cspTag?.match(/\bcontent=(["'])([\s\S]*?)\1/i)?.[2] ?? '';
    const cspDirectives = new Map();
    for (const directive of csp
      .split(';')
      .map((value) => value.trim())
      .filter(Boolean)) {
      const [name, ...sources] = directive.split(/\s+/);
      if (name === undefined) continue;
      const normalizedName = name.toLowerCase();
      if (cspDirectives.has(normalizedName)) {
        failures.push(`${relative} CSP repeats ${normalizedName}`);
      }
      cspDirectives.set(normalizedName, sources);
    }
    for (const name of ['default-src', 'connect-src']) {
      const sources = cspDirectives.get(name);
      if (sources?.length !== 1 || sources[0] !== "'none'") {
        failures.push(`${relative} CSP ${name} must be exactly 'none'`);
      }
    }
    if (/['"]unsafe-inline['"]/i.test(csp)) {
      failures.push(`${relative} CSP must not allow arbitrary inline code or styles`);
    }
    const inlineScripts = [
      ...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi),
    ];
    const inlineStyles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];

    if (inlineScripts.length !== 1) {
      failures.push(`${relative} must contain exactly one self-contained classic script`);
    }
    if (inlineStyles.length !== 1) {
      failures.push(`${relative} must contain exactly one self-contained stylesheet`);
    }

    const expectedScriptSources = [];
    for (const [index, match] of inlineScripts.entries()) {
      const source = match[1] ?? '';
      const hash = createHash('sha256').update(source, 'utf8').digest('base64');
      expectedScriptSources.push(`'sha256-${hash}'`);
      try {
        new vm.Script(source, { filename: `${relative}#script-${index + 1}` });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${relative} inline script is not valid classic JavaScript: ${message}`);
      }
    }

    const expectedStyleSources = [];
    for (const match of inlineStyles) {
      const source = match[1] ?? '';
      const hash = createHash('sha256').update(source, 'utf8').digest('base64');
      expectedStyleSources.push(`'sha256-${hash}'`);
    }
    if (JSON.stringify(cspDirectives.get('script-src')) !== JSON.stringify(expectedScriptSources)) {
      failures.push(`${relative} CSP script-src must contain only the built inline script hash`);
    }
    if (JSON.stringify(cspDirectives.get('style-src')) !== JSON.stringify(expectedStyleSources)) {
      failures.push(`${relative} CSP style-src must contain only the built inline style hash`);
    }

    const assetPattern = /\b(?:src|href)=["']([^"']+)["']/gi;
    for (const match of markupOnly.matchAll(assetPattern)) {
      const reference = match[1];
      if (reference === undefined || reference.startsWith('data:') || reference.startsWith('#')) {
        continue;
      }
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) {
        failures.push(`${relative} contains a non-local asset reference: ${reference}`);
        continue;
      }

      const localReference = reference.split(/[?#]/, 1)[0];
      const assetPath = path.resolve(path.dirname(htmlPath), localReference);
      const relativeAssetPath = path.relative(root, assetPath);
      if (relativeAssetPath.startsWith('..') || path.isAbsolute(relativeAssetPath)) {
        failures.push(`${relative} references an asset outside the plugin: ${reference}`);
        continue;
      }
      try {
        const info = await stat(assetPath);
        if (!info.isFile() || info.size === 0) {
          failures.push(`${relative} references an empty or non-file asset: ${reference}`);
        }
      } catch {
        failures.push(`${relative} references a missing asset: ${reference}`);
      }
    }
  } catch {
    // The missing bundle path was already reported above.
  }
}

const preferenceText = JSON.stringify(manifest.preferenceDefaults ?? {}).toLowerCase();
if (/token|password|secret|api[_-]?key/.test(preferenceText)) {
  failures.push('Preference defaults contain a secret-shaped key');
}
if (manifest.preferenceDefaults?.chapterSkipMode !== 'prompt') {
  failures.push('Chapter skipping must default to prompt mode');
}
if (manifest.preferenceDefaults?.skipChapterTitles !== 'Opening,Ending') {
  failures.push('Chapter skipping must default to Opening and Ending titles');
}

try {
  const preferencesHtml = await readFile(path.join(root, manifest.preferencesPage), 'utf8');
  if (!/data-open-catalog/i.test(preferencesHtml)) {
    failures.push('Plugin preferences must expose the catalog launch action');
  }
  if (/autoplayNextEpisode|Automatically play the next episode/i.test(preferencesHtml)) {
    failures.push('Plugin preferences must not expose Up Next until its event transport is ready');
  }
  if (/data-pref-key=["'](?:connectionMetadata|deviceId)["']/i.test(preferencesHtml)) {
    failures.push('Plugin preferences must not bind connection or device metadata');
  }
  if (!preferencesHtml.includes('⌥⌘J')) {
    failures.push('Plugin preferences must document the ⌥⌘J catalog shortcut');
  }
  if (!/type=["']radio["'][^>]*name=["']chapterSkipMode["']/i.test(preferencesHtml)) {
    failures.push('Plugin preferences must expose the chapter skip mode');
  }
  if (!/data-pref-key=["']skipChapterTitles["']/i.test(preferencesHtml)) {
    failures.push('Plugin preferences must expose chapter title matching');
  }
} catch {
  // The missing preferences page was already reported above.
}

try {
  const globalBundle = await readFile(path.join(root, manifest.globalEntry), 'utf8');
  if (!globalBundle.includes('Alt+Meta+j')) {
    failures.push('Global plugin bundle must register Alt+Meta+j for the catalog action');
  }
} catch {
  // The missing global entry was already reported above.
}

try {
  const catalogHtml = await readFile(path.join(root, 'dist/ui/catalog/index.html'), 'utf8');
  const shelfRule = catalogHtml.match(/\.media-shelf\s*\{([^}]*)\}/i)?.[1];
  if (
    shelfRule === undefined ||
    !/display\s*:\s*grid/i.test(shelfRule) ||
    /overflow-x\s*:\s*auto|grid-auto-flow\s*:\s*column/i.test(shelfRule)
  ) {
    failures.push('Built Home media shelves must be wrapping grids without horizontal paging');
  }
} catch {
  // The missing catalog page was already reported above.
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('Plugin package validation passed.\n');
}
