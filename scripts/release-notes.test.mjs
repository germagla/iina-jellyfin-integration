import assert from 'node:assert/strict';
import test from 'node:test';

import { extractReleaseNotes } from './release-notes.mjs';

test('extracts only the requested changelog section', () => {
  const changelog = `# Changelog

## Unreleased

Future work.

## 1.2.3 — 2026-07-20

Release summary.

### Fixes

- Fixed playback.

## 1.2.2 — 2026-07-01

Older notes.
`;

  assert.equal(
    extractReleaseNotes(changelog, '1.2.3'),
    'Release summary.\n\n### Fixes\n\n- Fixed playback.\n',
  );
});

test('matches exact versions rather than version prefixes', () => {
  const changelog = `# Changelog

## 1.2.30

Wrong release.

## v1.2.3

Right release.
`;

  assert.equal(extractReleaseNotes(changelog, '1.2.3'), 'Right release.\n');
});

test('rejects missing, empty, and unstable release sections', () => {
  assert.throws(() => extractReleaseNotes('# Changelog\n', '1.2.3'), /does not contain/);
  assert.throws(
    () => extractReleaseNotes('# Changelog\n\n## 1.2.3\n\n## 1.2.2\n\nOlder\n', '1.2.3'),
    /no release notes/,
  );
  assert.throws(() => extractReleaseNotes('# Changelog\n', '1.2.3-beta.1'), /stable/);
});
