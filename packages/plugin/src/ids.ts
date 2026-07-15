function randomHex(length: number): string {
  let output = '';
  while (output.length < length) {
    output += Math.floor(Math.random() * 0x1_0000)
      .toString(16)
      .padStart(4, '0');
  }
  return output.slice(0, length);
}

/**
 * IINA's JavaScriptCore context does not guarantee Web Crypto. This identifier is
 * used for correlation and device stability, not authentication or authorization.
 */
export function createOpaqueId(prefix = 'id'): string {
  const time = Date.now().toString(36);
  return `${prefix}-${time}-${randomHex(20)}`;
}

export function createStableDeviceId(): string {
  return `iina-${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${(
    8 + Math.floor(Math.random() * 4)
  ).toString(16)}${randomHex(3)}-${randomHex(12)}`;
}
