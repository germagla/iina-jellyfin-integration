import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseStableVersion } from './release-version.mjs';

export function extractReleaseNotes(markdown, version) {
  if (parseStableVersion(version) === undefined) {
    throw new Error(`Release notes require a stable semantic version, received: ${version}`);
  }

  const escapedVersion = version.replaceAll('.', '\\.');
  const headingPattern = new RegExp(`^##\\s+v?${escapedVersion}(?:\\s|$)`);
  const lines = markdown.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => headingPattern.test(line));
  if (startIndex === -1) {
    throw new Error(`CHANGELOG.md does not contain a level-two heading for ${version}`);
  }

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      endIndex = index;
      break;
    }
  }

  const notes = lines
    .slice(startIndex + 1, endIndex)
    .join('\n')
    .trim();
  if (notes.length === 0) {
    throw new Error(`CHANGELOG.md has no release notes for ${version}`);
  }
  return `${notes}\n`;
}

async function main() {
  const tag = process.argv[2];
  const outputPath = process.argv[3];
  if (!tag || !outputPath) {
    throw new Error('Usage: node scripts/release-notes.mjs <vX.Y.Z> <output-path>');
  }

  const version = tag.startsWith('v') ? tag.slice(1) : tag;
  const root = path.resolve(import.meta.dirname, '..');
  const changelog = await readFile(path.join(root, 'CHANGELOG.md'), 'utf8');
  const notes = extractReleaseNotes(changelog, version);
  const resolvedOutputPath = path.resolve(root, outputPath);
  await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, notes, 'utf8');
  process.stdout.write(`Created release notes for v${version} at ${resolvedOutputPath}.\n`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
