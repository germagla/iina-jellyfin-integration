# Changelog

## Unreleased

## 0.2.0 — 2026-07-22

This release makes Jellyfin playback feel at home in IINA by integrating with its native History
and playlist while making large catalog screens steadier and easier to browse.

### Native IINA integration

- Adds credential-free, human-readable Jellyfin entries to IINA History and Open Recent. Entries
  can reopen using the saved Jellyfin connection without placing access tokens or authenticated
  media URLs in IINA's native stores.
- Populates IINA's playlist with up to 100 earlier and 100 later playable episodes from the current
  season, placing the current episode in sequence and giving every row a readable show, season,
  episode, and title label.
- Holds playback at the end of a queued episode until another playlist item is selected, then
  creates a fresh Jellyfin playback session lazily instead of exposing a reusable stream URL.

### Catalog improvements

- Removes timer-driven catalog polling and layout-shifting background indicators so open screens
  no longer flash during periodic refreshes.
- Replaces library pagination with one responsive, continuously loading grid that resets cleanly
  when the library or sort order changes.
- Groups recently added episodes by series with explicit episode counts and latest-episode context
  instead of showing duplicate series cards.
- Scans a bounded larger Recently Added window so bulk season imports do not crowd other new titles
  out of the shelf.

### Reliability and presentation

- Fixes a fatal mpv command error when quitting IINA with a managed Jellyfin playlist, including
  the race where an in-flight episode request completed during shutdown.
- Adds a screenshot gallery to the README and documents the native History and playlist behavior.
- Documents the credential-free marker retention used to reopen native History and Open Recent
  entries.

## 0.1.1 — 2026-07-20

This is the first packaged GitHub release of Jellyfin for IINA: an IINA-native Direct Mode client
for browsing and playing movies and television from a Jellyfin server.

> **Contributor highlight:** Chapter skipping began with the contribution from **Daniel Chinye
> ([@5thDimensionalVader](https://github.com/5thDimensionalVader))** in
> [PR #1](https://github.com/germagla/iina-jellyfin-integration/pull/1). His contribution and
> follow-up testing shaped the three-state feature included in this release.

### Direct Mode catalog

- Connects to one Jellyfin server with password authentication or Quick Connect while keeping the
  access token in macOS Keychain.
- Provides Home shelves, debounced search, responsive grids, and a separate navigation tab for
  each supported Jellyfin movie or television library.
- Includes movie, series, season, and episode details with artwork, progress, media versions,
  audio tracks, and subtitle choices.

### Native IINA playback

- Plans playback through Jellyfin's PlaybackInfo API, then uses native IINA/mpv playback for
  Direct Play, remuxing, audio conversion, and user-confirmed video transcoding.
- Reports playback start, progress, seeks, pause/resume state, completion, and stopped sessions
  back to Jellyfin.
- Supports embedded and authenticated external subtitles, resume playback, managed-player reuse,
  Open in New Window, Up Next, and a contextual Jellyfin player sidebar.
- Keeps the detail page synchronized with the active player's loading, playing, paused, stopped,
  completed, and error states.

### Three-state chapter skipping

- Adds `On`, `Prompt`, and `Off` chapter-skipping modes. `Prompt` is the safe default and displays
  a clickable ten-second overlay; automatic skipping only occurs when `On` is selected.
- Matches common opening and ending chapter names case-insensitively, including Opening, Intro,
  OP, Ending, Outro, Credits, and related title and credit variants.
- Supports bounded chapters and final ending or credit chapters while preserving IINA's natural
  end-of-file and Jellyfin playback-reporting behavior.
- Adds synchronized controls to plugin preferences and the Jellyfin player sidebar, with settings
  persisted across files and player reuse.
- Gives Up Next priority over skip prompts and rejects stale or invalid overlay actions.
- Improves player-webview lifecycle handling, clickable overlay reliability, sidebar attachment,
  bounded recovery, and privacy-safe local diagnostics.

### Reliability, privacy, and installation

- Adds a global Open Jellyfin Library command with the ⌥⌘J shortcut and plugin-specific
  preferences.
- Brokers authenticated artwork and subtitles without exposing tokens to webviews, redacts
  sensitive values from logs, and provides a rotating local diagnostic log.
- Includes an installable `.iinaplgz` archive and SHA-256 checksum on the GitHub release page.
- Requires IINA 1.4.4 or later.
