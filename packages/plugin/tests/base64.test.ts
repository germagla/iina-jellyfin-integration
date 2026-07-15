import { describe, expect, it } from 'vitest';
import { bytesToBase64, detectImageMimeType } from '../src/base64';

describe('image encoding', () => {
  it('encodes binary data without browser APIs', () => {
    expect(bytesToBase64(new Uint8Array([0x66, 0x6f, 0x6f]))).toBe('Zm9v');
    expect(bytesToBase64(new Uint8Array([0x66, 0x6f]))).toBe('Zm8=');
  });

  it('recognizes supported artwork formats', () => {
    expect(detectImageMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
    expect(detectImageMimeType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe(
      'image/png',
    );
  });
});
