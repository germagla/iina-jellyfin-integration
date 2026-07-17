import { createHash } from 'node:crypto';
import { posix, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const surfaces = ['catalog', 'sidebar', 'overlay', 'preferences'] as const;
type Surface = (typeof surfaces)[number];

function isSurface(value: string): value is Surface {
  return surfaces.includes(value as Surface);
}

function cspHash(source: string): string {
  return `'sha256-${createHash('sha256').update(source).digest('base64')}'`;
}

function referenceToBundleName(htmlFileName: string, reference: string): string {
  const withoutQuery = reference.split(/[?#]/, 1)[0] ?? reference;
  return posix.normalize(posix.join(posix.dirname(htmlFileName), withoutQuery));
}

/**
 * IINA loads plugin pages from file URLs. WKWebView does not reliably execute
 * Vite's cross-origin ES module graph from that origin, so each production
 * surface is emitted as one classic, self-contained document instead.
 */
function iinaWebviewBundle(): Plugin {
  return {
    name: 'iina-webview-bundle',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlAssets = Object.values(bundle).filter(
        (item) => item.type === 'asset' && item.fileName.endsWith('.html'),
      );
      if (htmlAssets.length !== 1) {
        this.error(`Expected one IINA webview HTML entry, received ${htmlAssets.length}.`);
      }

      const htmlAsset = htmlAssets[0];
      if (!htmlAsset || htmlAsset.type !== 'asset') return;

      let html = String(htmlAsset.source);
      const scriptSources: string[] = [];
      const styleSources: string[] = [];
      const inlinedFiles = new Set<string>();

      html = html.replace(
        /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
        (_tag, reference: string) => {
          const fileName = referenceToBundleName(htmlAsset.fileName, reference);
          const output = bundle[fileName];
          if (!output || output.type !== 'chunk') {
            this.error(`Unable to inline webview script ${reference}.`);
          }
          const source = output.code.replace(/<\/script/gi, '<\\/script');
          scriptSources.push(source);
          inlinedFiles.add(fileName);
          return '';
        },
      );

      html = html.replace(
        /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi,
        (_tag, reference: string) => {
          const fileName = referenceToBundleName(htmlAsset.fileName, reference);
          const output = bundle[fileName];
          if (!output || output.type !== 'asset') {
            this.error(`Unable to inline webview stylesheet ${reference}.`);
          }
          const source = String(output.source).replace(/<\/style/gi, '<\\/style');
          styleSources.push(source);
          inlinedFiles.add(fileName);
          return `<style>${source}</style>`;
        },
      );

      html = html
        .replace(/<link\b[^>]*\brel=["']modulepreload["'][^>]*>/gi, '')
        .replace(/\s+crossorigin(?:=["'][^"']*["'])?/gi, '');

      if (scriptSources.length !== 1 || styleSources.length !== 1) {
        this.error(
          `Expected one script and one stylesheet for ${htmlAsset.fileName}; received ${scriptSources.length} and ${styleSources.length}.`,
        );
      }

      const scriptPolicy = scriptSources.map(cspHash).join(' ');
      const stylePolicy = styleSources.map(cspHash).join(' ');
      html = html
        .replace("script-src 'self'", `script-src ${scriptPolicy}`)
        .replace("style-src 'self'", `style-src ${stylePolicy}`);

      const classicScripts = scriptSources.map((source) => `<script>${source}</script>`).join('');
      html = html.replace(/<\/body>/i, () => `${classicScripts}</body>`);
      htmlAsset.source = html;

      for (const fileName of inlinedFiles) delete bundle[fileName];
    },
  };
}

function browserDevelopment(): Plugin {
  return {
    name: 'browser-development',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split(/[?#]/, 1)[0];
        if (path !== '/') {
          next();
          return;
        }
        response.statusCode = 302;
        response.setHeader('Location', '/ui/catalog/');
        response.end();
      });
    },
    transformIndexHtml(html) {
      return html
        .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
        .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
        .replace("connect-src 'none'", "connect-src 'self' ws: wss:");
    },
  };
}

export default defineConfig(({ command, mode }) => {
  if (command === 'build' && !isSurface(mode)) {
    throw new Error(`Build mode must select one IINA webview: ${surfaces.join(', ')}.`);
  }
  const surface: Surface = isSurface(mode) ? mode : 'catalog';

  return {
    base: './',
    plugins: [react(), browserDevelopment(), iinaWebviewBundle()],
    server: {
      host: '0.0.0.0',
      allowedHosts: ['terminal.local'],
    },
    build: {
      outDir: 'dist',
      emptyOutDir: surface === 'catalog',
      target: 'safari14.1',
      modulePreload: false,
      rollupOptions: {
        input: resolve(__dirname, `ui/${surface}/index.html`),
        output: {
          inlineDynamicImports: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      restoreMocks: true,
    },
  };
});
