# Jellyfin for IINA

Jellyfin for IINA is an IINA-native Direct Mode client for movies and television. It keeps
metadata on Jellyfin, fetches catalog pages and artwork on demand, and hands negotiated streams
to IINA's native mpv player.

## Status

This repository contains the first implementation milestone. It targets IINA 1.4.4 and the
shared Jellyfin 10.10/10.11 API surface. The product includes one server connection,
username/password and Quick Connect authentication, Home/Movies/Shows/Search catalog flows,
item details, playback negotiation, session reporting, a player sidebar, and cancelable Up Next.

Casting, helpers, server plugins, music, Live TV, offline downloads, SyncPlay, and multiple
servers are intentionally out of scope for v1.

## Development

Requirements: macOS, Node.js 22 or newer, and pnpm 11.

```sh
pnpm install
pnpm check
```

`pnpm build` creates the production plugin bundle under `dist/`. `pnpm
package:archive` additionally creates an installable `.iinaplgz` archive under `.artifacts/`.
The generated `dist/` directory is intentionally versioned and must be committed before GitHub
installation is enabled.

For catalog-only development, run `pnpm dev`. The UI automatically uses a mock bridge when it is
not hosted by IINA, so login, browsing, details, playback confirmation, and sidebar states remain
testable in a browser without a Jellyfin token.

## Installing in IINA

Build the repository, then choose IINA → Settings → Plugins → Install from Local Package and
select the archive in `.artifacts/`. Production bundles must be committed because IINA's GitHub
plugin installer consumes repository contents directly. The plugin metadata points at
`germagla/iina-jellyfin-integration` for GitHub-based installation.

## Security model

- Access tokens live only in macOS Keychain.
- The standalone catalog receives typed response data, never credentials or arbitrary network
  access.
- Artwork is fetched by the plugin, size-limited, cached privately, and returned as an opaque data
  URL.
- Server metadata is rendered through React escaping under a restrictive Content Security Policy.
- Authentication headers and sensitive query values are redacted from logs.
- HTTPS is required for non-local servers unless the user explicitly accepts the risk. LAN HTTP
  remains available with a persistent warning in the connection flow.
- IINA's `file-system` permission is used only to resolve a downloaded plugin-private `@tmp`
  subtitle before passing its absolute path to IINA 1.4.4. All plugin file operations remain
  scoped to `@tmp` and `@data` paths in code.

See [Architecture](docs/architecture.md), [Security model](docs/security-model.md), and the
[IINA 1.4.4 runtime checklist](docs/runtime-test-checklist.md) for implementation and release
details.

## License

[MIT](LICENSE)
