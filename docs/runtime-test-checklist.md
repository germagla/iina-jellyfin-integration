# IINA 1.4.4 runtime checklist

Use this checklist for release testing against Jellyfin 10.10 and 10.11. Automated tests cover
builders, contracts, state transitions, webview behavior, and security boundaries; these checks
exercise the native IINA/mpv boundary.

## Connection and catalog

- [ ] Password login against a remote HTTPS server.
- [ ] Quick Connect authorization and expiry.
- [ ] LAN HTTP warning remains visible while connection is allowed.
- [ ] Remote HTTP rejection and explicit override.
- [ ] Reverse-proxy path such as `https://example.test/jellyfin`.
- [ ] Revoked token returns to a recoverable connect state.
- [ ] Home shelves, Movies, Shows, search debounce, sorting, and pagination.
- [ ] Large library scrolling and artwork cache eviction.
- [ ] Network interruption, 401, 429, 503, empty, and stale-item states.

## Playback

- [ ] H.264/AAC direct play with resume.
- [ ] HEVC/direct play with multiple media versions.
- [ ] Direct Stream/remux.
- [ ] Audio-only conversion without a modal.
- [ ] Decline and accept video re-encoding.
- [ ] Server-returned HLS URL containing `ApiKey`; confirm logs contain no value.
- [ ] Selected embedded audio and subtitle streams.
- [ ] Authenticated external SRT, VTT, ASS, and SSA subtitle download.
- [ ] Installation clearly requests `file-system`; subtitle resolution remains inside plugin
      `@tmp` storage.
- [ ] Progress after start, every ten seconds, and immediately after seek/pause/resume.
- [ ] Stopped report on completion, window close, replacement, failure, and explicit stop.
- [ ] Managed-player reuse and Open in New Window.
- [ ] No stale progress from the replaced generation.
- [ ] Cancelable Up Next and autoplay-disabled behavior.
- [ ] Video-transcode confirmation is still required for Up Next.

## Packaging

- [x] `pnpm check` passes locally (2026-07-15: typecheck, lint, 102 tests, formatting, build, and
      package validation).
- [ ] Repeat `pnpm check` from a clean checkout after the initial commit exists.
- [x] `pnpm package:archive` creates `.artifacts/jellyfin-for-iina.iinaplgz`; `unzip -t` reports no
      errors.
- [x] IINA 1.4.4's `iina-plugin pack` accepts a minimal staging copy containing `Info.json`,
      `LICENSE`, `README.md`, and `dist/`.
- [ ] Local-package installation in IINA 1.4.4.
- [ ] GitHub installation from a repository containing committed `dist/` output.
