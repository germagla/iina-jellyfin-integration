import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const surfaces = ['catalog', 'sidebar', 'overlay', 'preferences'];
const uiRoot = join(import.meta.dirname, '..', 'dist', 'ui');
const mountTimeoutMs = 2_000;
const mountPollMs = 25;

function describeError(value) {
  if (value instanceof Error) return value.stack ?? value.message;
  if (typeof value === 'string') return value;
  if (value !== null && typeof value === 'object') {
    if ('stack' in value && typeof value.stack === 'string') return value.stack;
    if ('message' in value && typeof value.message === 'string') {
      const name = 'name' in value && typeof value.name === 'string' ? `${value.name}: ` : '';
      return `${name}${value.message}`;
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function smokeSurface(surface, options = {}) {
  const htmlPath = join(uiRoot, surface, 'index.html');
  const errors = [];
  const virtualConsole = new VirtualConsole();

  virtualConsole.on('jsdomError', (error) => {
    errors.push(`jsdom: ${describeError(error)}`);
  });
  virtualConsole.on('error', (...values) => {
    errors.push(`console.error: ${values.map(describeError).join(' ')}`);
  });

  const html = await readFile(htmlPath, 'utf8');
  const dom = new JSDOM(html, {
    beforeParse(window) {
      window.addEventListener('error', (event) => {
        errors.push(`runtime: ${describeError(event.error ?? event.message)}`);
      });
      window.addEventListener('unhandledrejection', (event) => {
        errors.push(`unhandled rejection: ${describeError(event.reason)}`);
      });
    },
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    url: `${pathToFileURL(htmlPath).href}${options.disconnected ? '?disconnected=1' : ''}`,
    virtualConsole,
  });

  try {
    const mounted = await waitForMount(dom.window, surface);

    const scripts = [...dom.window.document.scripts];
    if (scripts.length !== 1 || scripts[0]?.src !== '' || scripts[0]?.type === 'module') {
      errors.push('expected exactly one inline classic script');
    }
    if (dom.window.document.querySelectorAll('style').length !== 1) {
      errors.push('expected exactly one inline stylesheet');
    }
    if (dom.window.document.querySelector('script[src], link[rel="stylesheet"]') !== null) {
      errors.push('found an external script or stylesheet');
    }

    if (surface === 'preferences') {
      const button = dom.window.document.querySelector('[data-open-catalog]');
      const status = dom.window.document.querySelector('[data-open-status]');
      if (button === null || status === null) {
        errors.push('missing the Open Jellyfin Library control');
      } else {
        button.click();
        if (!status.textContent?.includes('Plugins menu')) {
          errors.push('preferences script did not bind the library action');
        }
      }
      const chapterModes = [
        ...dom.window.document.querySelectorAll('input[type="radio"][name="chapterSkipMode"]'),
      ];
      const chapterTitles = dom.window.document.querySelector(
        '[data-pref-key="skipChapterTitles"]',
      );
      if (chapterModes.length !== 3) {
        errors.push('preferences are missing the chapter skip mode control');
      } else if (chapterModes.map((input) => input.value).join(',') !== 'on,prompt,off') {
        errors.push('chapter skip mode must expose on, prompt, and off');
      } else if (chapterModes.find((input) => input.checked)?.value !== 'prompt') {
        errors.push('chapter skip mode must render prompt as its safe default');
      }
      if (!(chapterTitles instanceof dom.window.HTMLInputElement)) {
        errors.push('preferences are missing the chapter title control');
      } else if (chapterTitles.maxLength !== 4_096) {
        errors.push('chapter title input must cap untrusted preference size');
      }
    } else {
      const root = dom.window.document.querySelector('#root');
      if (root === null) {
        errors.push('missing #root');
      } else if (root.innerHTML.trim().length === 0) {
        errors.push('#root remained empty after scripts ran');
      }
      if (surface === 'catalog' && root?.querySelector('[data-catalog-fallback]') !== null) {
        errors.push('catalog fallback remained after React should have mounted');
      }
      if (surface === 'catalog' && options.disconnected) {
        const address = root?.querySelector('input[inputmode="url"]');
        if (!(address instanceof dom.window.HTMLInputElement)) {
          errors.push('disconnected catalog is missing the server address field');
        } else if (address.value !== 'http://localhost:8096') {
          errors.push(`unexpected default Jellyfin address: ${address.value}`);
        }
      }
      if (!mounted) errors.push(`did not mount within ${mountTimeoutMs} ms`);
    }
  } finally {
    dom.window.close();
  }

  if (errors.length > 0) {
    throw new Error(`${surface} webview failed:\n- ${errors.join('\n- ')}`);
  }
}

async function waitForMount(window, surface) {
  if (surface === 'preferences') return true;
  const deadline = Date.now() + mountTimeoutMs;
  while (Date.now() < deadline) {
    const root = window.document.querySelector('#root');
    const hasContent = root?.innerHTML.trim().length;
    const catalogMounted = root?.querySelector('[data-catalog-fallback]') === null;
    if (hasContent && (surface !== 'catalog' || catalogMounted)) return true;
    await new Promise((resolve) => window.setTimeout(resolve, mountPollMs));
  }
  return false;
}

const failures = [];

for (const surface of surfaces) {
  try {
    await smokeSurface(surface);
    process.stdout.write(`Webview smoke passed: ${surface}\n`);
  } catch (error) {
    failures.push(describeError(error));
  }
}

try {
  await smokeSurface('catalog', { disconnected: true });
  process.stdout.write('Webview smoke passed: catalog (disconnected)\n');
} catch (error) {
  failures.push(describeError(error));
}

if (failures.length > 0) {
  throw new Error(`IINA webview smoke failures:\n\n${failures.join('\n\n')}`);
}
