import { describe, expect, it } from 'vitest';

import { createIinaDeviceProfile } from '../src/device-profile';
import {
  clampPositionTicks,
  JELLYFIN_TICKS_PER_SECOND,
  millisecondsToTicks,
  secondsToTicks,
  ticksToSeconds,
} from '../src/ticks';

describe('Jellyfin ticks', () => {
  it('converts between seconds, milliseconds, and 100ns ticks', () => {
    expect(JELLYFIN_TICKS_PER_SECOND).toBe(10_000_000);
    expect(secondsToTicks(12.345)).toBe(123_450_000);
    expect(millisecondsToTicks(12_345)).toBe(123_450_000);
    expect(ticksToSeconds(123_450_000)).toBe(12.345);
  });

  it('clamps reported positions and rejects invalid values', () => {
    expect(clampPositionTicks(200, 100)).toBe(100);
    expect(() => secondsToTicks(-1)).toThrow();
    expect(() => millisecondsToTicks(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe('IINA/mpv device profile', () => {
  it('is stable and advertises both direct playback and server fallbacks', () => {
    const first = createIinaDeviceProfile();
    const second = createIinaDeviceProfile();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.DirectPlayProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ Type: 'Video', Container: expect.stringContaining('mkv') }),
      ]),
    );
    expect(first.TranscodingProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ Type: 'Video', Protocol: 'hls' }),
        expect.objectContaining({ Type: 'Audio', Protocol: 'http' }),
      ]),
    );
    expect(first.SubtitleProfiles).toContainEqual({ Format: 'srt', Method: 'External' });
  });

  it('uses the requested bitrate consistently', () => {
    const profile = createIinaDeviceProfile(40_000_000);
    expect(profile.MaxStreamingBitrate).toBe(40_000_000);
    expect(profile.MaxStaticBitrate).toBe(40_000_000);
  });
});
