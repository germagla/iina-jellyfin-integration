# Jellyfin for IINA

Jellyfin for IINA is an IINA-native Direct Mode client for movies and television. It keeps
metadata on Jellyfin, fetches catalog pages and artwork on demand, and hands negotiated streams
to IINA's native mpv player.

## Status

This repository contains the first implementation milestone. It targets IINA 1.4.4 and the
shared Jellyfin 10.10/10.11 API surface. The product includes one server connection,
username/password and Quick Connect authentication, Home/Search plus one tab per supported
Jellyfin movie or television library, item details, playback negotiation, session reporting, and a
contextual player sidebar. Up Next is not exposed in this release; its dormant development
components remain in the codebase until episode handoff moves off IINA 1.4.4's unreliable
player-to-global callback path.

Casting, helpers, server plugins, music, Live TV, offline downloads, SyncPlay, and multiple
servers are intentionally out of scope for v1.

## Development

Requirements: macOS, Node.js 22 or newer, and pnpm 11.

```sh
pnpm install
pnpm check
```

For day-to-day IINA development, first uninstall any GitHub-installed copy of this plugin in
IINA → Settings → Plugins. IINA must not load the release package and development link at the
same time because both use the same plugin identifier. Then link this checkout directly:

```sh
pnpm iina:link
```

This builds the plugin, checks for another package with the same identifier, and runs IINA's
`iina-plugin link .` command. Restart IINA to load the development package. After source changes,
rerun `pnpm iina:link` (it is safe when already linked) or run `pnpm build`, then restart IINA
again. Webview-only changes can sometimes be picked up with the webview context menu's Reload
command, but IINA's Reload All Plugins command may retain an already-created standalone window;
use a full IINA restart when changing the catalog bundle. Remove the development link with
`pnpm iina:unlink`.

`pnpm build` creates the production plugin bundle under `dist/`. `pnpm
package:archive` additionally creates an installable `.iinaplgz` archive under `.artifacts/`.
The generated `dist/` directory is intentionally versioned and must be committed before GitHub
installation is enabled.

For catalog-only development, run `pnpm dev`. The UI automatically uses a mock bridge when it is
not hosted by IINA, so login, browsing, details, playback confirmation, and sidebar states remain
testable in a browser without a Jellyfin token.

## Installing in IINA

Run `pnpm package:archive`, then choose IINA → Settings → Plugins → Install from Local Package and
select `.artifacts/jellyfin-for-iina.iinaplgz`. Production bundles must be committed because
IINA's GitHub plugin installer consumes repository contents directly. The plugin metadata points
at `germagla/iina-jellyfin-integration` for GitHub-based installation.

The original 0.1.0 package did not contain IINA's `ghVersion` update marker. Existing 0.1.0 users
must uninstall and reinstall from GitHub once; automatic update checks work for subsequent
versions.

After enabling the plugin, open the catalog from IINA's Plugins menu → Open Jellyfin Library or
press ⌥⌘J from any focused IINA window. The catalog and diagnostic-log actions are also available
by selecting Jellyfin for IINA in IINA → Settings → Plugins → Preferences.

The connection form starts at `http://localhost:8096`, Jellyfin's standard local address. A bare
local or LAN address such as `localhost:8096` is normalized to HTTP; a bare remote hostname is
normalized to HTTPS.

## Diagnostics

The plugin writes always-on, redacted, rotating diagnostic logs so playback failures can be
investigated even when IINA exits unexpectedly. Reveal the Global log from Plugins → Reveal
Jellyfin Diagnostic Log or from the plugin Preferences page. Every current and previous log is
capped at 512 KiB under IINA's plugin-private `@data` directory. On macOS, that directory is
normally:

```text
~/Library/Application Support/com.colliderli.iina/plugins/.data/dev.germagla.iina-jellyfin/
```

The Global files are `jellyfin-diagnostics.log` and `jellyfin-diagnostics.previous.log`. Each IINA
player writes its own uniquely named `jellyfin-player-diagnostics-*.log` pair in the same directory
so independent JavaScript contexts never race while appending or rotating a shared file. At most
32 player generations are retained. Records include playback lifecycle, negotiation method,
selected-track presence, and normalized failures. They do not include titles, usernames, server or
media URLs, request bodies, session identifiers, authorization headers, passwords, or tokens.
IINA's own logs remain available in Window → Log Viewer and under
`~/Library/Logs/com.colliderli.iina/`; native crash reports are under
`~/Library/Logs/DiagnosticReports/`. IINA/mpv's native logs are outside the plugin's redaction
layer and can contain stream URLs, so sanitize them before sharing. Prefer the plugin diagnostic
logs for support.

## Security model

- Access tokens live only in macOS Keychain.
- The standalone catalog receives typed response data, never credentials or arbitrary network
  access.
- Artwork is fetched by the plugin, size-limited, cached privately, and returned as an opaque data
  URL.
- Server metadata is rendered through React escaping under a restrictive Content Security Policy.
- Authentication headers and sensitive query values are redacted from console and local
  diagnostic logs.
- Jellyfin media and subtitle URLs containing credential query parameters are blocked before they
  can reach mpv or IINA's unredacted native logging.
- Video re-encoding requires a short-lived, single-use confirmation permit bound to the exact
  prepared launch; a webview-supplied boolean cannot bypass it.
- HTTPS is required for non-local servers unless the user explicitly accepts the risk. LAN HTTP
  remains available with a persistent warning in the connection flow.
- IINA's `file-system` permission is used for plugin-private artwork, diagnostic logs, and
  downloaded subtitles. All plugin file operations remain scoped to `@tmp` and `@data` paths in
  code; only the temporary subtitle path is resolved before being passed to IINA 1.4.4.

See [Architecture](docs/architecture.md), [Security model](docs/security-model.md), and the
[IINA 1.4.4 runtime checklist](docs/runtime-test-checklist.md) for implementation and release
details.

## License

[MIT](LICENSE). Bundled dependency notices are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
