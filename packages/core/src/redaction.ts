export const REDACTED = '[REDACTED]';

const SECRET_KEY = /(?:authorization|x-emby-token|token|api[_-]?key|password|passwd|\bpw|secret)$/i;
const SECRET_QUERY_KEY = /^(?:api[_-]?key|access[_-]?token|token|x-emby-token|password|secret)$/i;

function redactUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    let changed = false;
    if (url.password !== '') {
      url.password = REDACTED;
      changed = true;
    }
    for (const key of [...url.searchParams.keys()]) {
      if (SECRET_QUERY_KEY.test(key)) {
        url.searchParams.set(key, REDACTED);
        changed = true;
      }
    }
    return changed ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function redactString(value: string): string {
  const wholeUrl = redactUrl(value);
  if (wholeUrl !== undefined) return wholeUrl;

  return value
    .replace(
      /([?&](?:api[_-]?key|access[_-]?token|token|x-emby-token|password|secret)=)([^&#\s]*)/gi,
      (_match, prefix: string) => `${prefix}${encodeURIComponent(REDACTED)}`,
    )
    .replace(/(MediaBrowser\s+[^\r\n]*?\bToken=")[^"]*(")/gi, `$1${REDACTED}$2`)
    .replace(/(Bearer\s+)[^\s,]+/gi, `$1${REDACTED}`)
    .replace(/(Authorization:\s*Basic\s+)[^\s,]+/gi, `$1${REDACTED}`);
}

export function redactSecrets<T>(input: T): T {
  const seen = new WeakMap<object, unknown>();

  const visit = (value: unknown): unknown => {
    if (typeof value === 'string') return redactString(value);
    if (value === null || typeof value !== 'object') return value;
    if (value instanceof Date) return new Date(value.getTime());
    if (seen.has(value)) return '[CIRCULAR]';

    if (Array.isArray(value)) {
      const output: unknown[] = [];
      seen.set(value, output);
      for (const item of value) output.push(visit(item));
      return output;
    }

    const output: Record<string, unknown> = {};
    seen.set(value, output);
    for (const [key, item] of Object.entries(value)) {
      output[key] = SECRET_KEY.test(key) ? REDACTED : visit(item);
    }
    return output;
  };

  return visit(input) as T;
}
