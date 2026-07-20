const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseStableVersion(value) {
  const match = VERSION_PATTERN.exec(value);
  if (match === null) return undefined;
  return [BigInt(match[1]), BigInt(match[2]), BigInt(match[3])];
}

export function compareStableVersions(leftValue, rightValue) {
  const left = parseStableVersion(leftValue);
  const right = parseStableVersion(rightValue);
  if (left === undefined || right === undefined) {
    throw new Error(`Cannot compare invalid stable versions: ${leftValue}, ${rightValue}`);
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }
  return 0;
}
