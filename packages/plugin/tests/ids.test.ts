import { describe, expect, it } from 'vitest';
import { createOpaqueId, createStableDeviceId } from '../src/ids';

describe('identifiers', () => {
  it('creates non-secret correlation IDs', () => {
    expect(createOpaqueId('play')).toMatch(/^play-[a-z0-9]+-[a-f0-9]{20}$/);
  });

  it('creates IINA-scoped UUID-shaped device IDs', () => {
    expect(createStableDeviceId()).toMatch(
      /^iina-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    );
  });
});
