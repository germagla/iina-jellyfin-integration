import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { extractReleaseNotes } from './release-notes.mjs';
import { compareStableVersions, parseStableVersion } from './release-version.mjs';

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(path.join(root, 'Info.json'), 'utf8'));
const tag =
  process.argv.slice(2).find((argument) => argument !== '--') ?? process.env.GITHUB_REF_NAME;

if (!tag) {
  throw new Error('Pass the release tag, for example: pnpm release:validate -- v0.1.1');
}

const expectedTag = `v${manifest.version}`;
if (tag !== expectedTag) {
  throw new Error(`Release tag ${tag} must match Info.json version (${expectedTag})`);
}

if (parseStableVersion(manifest.version) === undefined) {
  throw new Error('Automated releases currently support stable semantic versions only');
}

if (!Number.isSafeInteger(manifest.ghVersion) || manifest.ghVersion < 1) {
  throw new Error('Info.json ghVersion must be a positive integer');
}

const changelog = await readFile(path.join(root, 'CHANGELOG.md'), 'utf8');
extractReleaseNotes(changelog, manifest.version);

const { stdout } = await exec('git', ['tag', '--format=%(refname:short)'], { cwd: root });
const previousTags = stdout
  .split(/\r?\n/)
  .map((candidate) => candidate.trim())
  .filter(
    (candidate) =>
      candidate !== tag &&
      candidate.startsWith('v') &&
      parseStableVersion(candidate.slice(1)) !== undefined,
  );

let latestVersionTag;
let greatestGhVersion = 0;
let greatestGhVersionTag;
for (const previousTag of previousTags) {
  if (
    latestVersionTag === undefined ||
    compareStableVersions(previousTag.slice(1), latestVersionTag.slice(1)) > 0
  ) {
    latestVersionTag = previousTag;
  }
  const { stdout: previousManifestText } = await exec('git', ['show', `${previousTag}:Info.json`], {
    cwd: root,
  });
  const previousManifest = JSON.parse(previousManifestText);
  if (!Number.isSafeInteger(previousManifest.ghVersion) || previousManifest.ghVersion < 1) {
    throw new Error(`${previousTag} has an invalid Info.json ghVersion`);
  }
  if (previousManifest.ghVersion > greatestGhVersion) {
    greatestGhVersion = previousManifest.ghVersion;
    greatestGhVersionTag = previousTag;
  }
}

if (
  latestVersionTag !== undefined &&
  compareStableVersions(manifest.version, latestVersionTag.slice(1)) <= 0
) {
  throw new Error(
    `Release version ${manifest.version} must be greater than ${latestVersionTag.slice(1)}`,
  );
}

if (manifest.ghVersion <= greatestGhVersion) {
  throw new Error(
    `Info.json ghVersion (${manifest.ghVersion}) must be greater than ${greatestGhVersionTag} (${greatestGhVersion})`,
  );
}

process.stdout.write(`Release metadata is valid for ${tag} (ghVersion ${manifest.ghVersion}).\n`);
