import assert from 'node:assert/strict';
import test from 'node:test';

import { compareStableVersions, parseStableVersion } from './release-version.mjs';

test('parses stable versions and rejects other tag shapes', () => {
  assert.deepEqual(parseStableVersion('1.2.3'), [1n, 2n, 3n]);
  assert.equal(parseStableVersion('1.2.3-beta.1'), undefined);
  assert.equal(parseStableVersion('01.2.3'), undefined);
  assert.equal(parseStableVersion('v1.2.3'), undefined);
});

test('orders stable semantic versions', () => {
  assert.equal(compareStableVersions('1.2.4', '1.2.3'), 1);
  assert.equal(compareStableVersions('2.0.0', '1.99.99'), 1);
  assert.equal(compareStableVersions('1.2.3', '1.2.3'), 0);
  assert.equal(compareStableVersions('1.2.2', '1.2.3'), -1);
});
