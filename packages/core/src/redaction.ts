import {
  encodeQueryEntries,
  isSecretQueryParameterName,
  parseAbsoluteUrl,
  queryEntries,
  serializeAbsoluteUrl,
} from './portable-url';

export const REDACTED = '[REDACTED]';

const SECRET_KEY = /(?:authorization|x-emby-token|token|api[_-]?key|password|passwd|\bpw|secret)$/i;

function redactUrl(value: string): string | undefined {
  try {
    const url = parseAbsoluteUrl(value);
    let changed = false;
    const passwordSeparator = url.userinfo?.indexOf(':') ?? -1;
    if (url.userinfo !== undefined && passwordSeparator >= 0) {
      url.userinfo = `${url.userinfo.slice(0, passwordSeparator)}:${REDACTED}`;
      changed = true;
    }
    let queryChanged = false;
    const entries = queryEntries(url.query).map(([key, entryValue]): [string, string] => {
      if (isSecretQueryParameterName(key)) {
        changed = true;
        queryChanged = true;
        return [key, REDACTED];
      }
      return [key, entryValue];
    });
    if (queryChanged) url.query = encodeQueryEntries(entries);
    return changed ? serializeAbsoluteUrl(url) : undefined;
  } catch {
    return undefined;
  }
}

function redactJsonDocument(value: string): string | undefined {
  const trimmed = value.trim();
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return undefined;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== 'object') return undefined;
    return JSON.stringify(redactSecrets(parsed));
  } catch {
    return undefined;
  }
}

export function redactString(value: string): string {
  const wholeUrl = redactUrl(value);
  if (wholeUrl !== undefined) return wholeUrl;

  // Structured values are often serialized before reaching the logger. Parsing
  // first exposes escaped Authorization values (Token=\"…\") to the normal
  // recursive redactor instead of relying only on surface-level regexes.
  const jsonDocument = redactJsonDocument(value);
  if (jsonDocument !== undefined) return jsonDocument;

  return value
    .replace(
      /("(?:access[_-]?token|token|api[_-]?key|password|passwd|pw|secret)"\s*:\s*")[^"]*(")/gi,
      `$1${REDACTED}$2`,
    )
    .replace(
      /([?&](?:api[_-]?key|[a-z0-9_.-]*(?:token|password|secret(?:[_-]?key)?)|passwd|pw)=)([^&#\s]*)/gi,
      (_match, prefix: string) => `${prefix}${encodeURIComponent(REDACTED)}`,
    )
    .replace(/(MediaBrowser\s+[^\r\n]*?\bToken=\\")[^"\\]*(\\")/gi, `$1${REDACTED}$2`)
    .replace(
      /(\b(?:api[_-]?key|[a-z0-9_.-]*(?:token|password|secret(?:[_-]?key)?)|passwd|pw)=)("[^"]*"|'[^']*'|[^\\&#\s,;"']+)/gi,
      (_match, prefix: string, secretValue: string) => {
        const quote = secretValue.startsWith('"') ? '"' : secretValue.startsWith("'") ? "'" : '';
        return `${prefix}${quote}${REDACTED}${quote}`;
      },
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
