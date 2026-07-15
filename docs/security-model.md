# Security model

## Trust boundaries

- The global and player plugin entries are trusted code.
- Jellyfin server responses and metadata are untrusted.
- The catalog/sidebar/overlay WKWebViews are less-trusted presentation contexts.
- User-supplied server URLs are untrusted network destinations.

## Credentials

- Passwords exist only for the duration of `AuthenticateByName` and are never persisted or
  logged.
- Jellyfin access tokens are written to macOS Keychain under a server/user-specific account.
- Preferences contain only validated connection metadata, a stable non-secret device ID, and UI
  settings.
- IINA 1.4 has no Keychain delete API. Disconnect overwrites the credential with an empty value
  before removing connection metadata. If the overwrite fails, disconnect fails and retains the
  metadata so cleanup can be retried; account switches follow the same rollback rule.
- Quick Connect secrets remain in global-entry memory; the webview only receives the user-facing
  code.

## Network policy

- Server URL normalization rejects credentials, queries, fragments, and non-HTTP(S) schemes.
- Reverse-proxy base paths are preserved.
- Non-local HTTP is rejected unless the user explicitly accepts it. Local HTTP is labeled as an
  insecure transport in the connect UI but is not blocked.
- Server-returned absolute media URLs must remain on the configured origin before credentials are
  attached. Relative URLs retain the configured reverse-proxy path.
- The current `Authorization: MediaBrowser ...` format is used for API and mpv requests.

## Webviews and artwork

- A restrictive Content Security Policy blocks arbitrary network requests and inline script.
- React text rendering escapes Jellyfin metadata. No Jellyfin values are passed to `innerHTML`.
- Bridge operations and payloads are allowlisted and runtime validated.
- Artwork requests are dimension-limited. Downloads go to plugin-private `@data`, are checked for
  image magic and byte size, partitioned by server and user, evicted by LRU metadata, and returned
  to visible cards as data URLs. Identical requests are single-flight and download concurrency is
  bounded.
- External subtitles use an allowlisted extension, a 10 MiB post-download limit, and a
  plugin-private `@tmp` destination. Rejected and terminal-session files are removed promptly.

IINA 1.4.4 does not expand its `@tmp` pseudo-path in `core.subtitle.loadTrack`. The plugin therefore
requests `file-system` solely to call `utils.resolvePath` for that private temporary file before
loading it. The implementation never chooses or resolves a user-supplied filesystem path.

IINA's download API buffers a response before returning and exposes no streaming byte-limit or
abort hook. Artwork and subtitle files are deleted immediately when their post-download limit is
exceeded, but a single oversized response cannot be interrupted in flight. Bounded concurrency
limits amplification.

## Logging

The safe logger recursively redacts authorization values, passwords, secrets, tokens, and common
token query parameters. HTTP failures expose status-specific user messages rather than server
response bodies or request URLs.
