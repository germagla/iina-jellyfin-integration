# Changelog

## Unreleased

### Three-state chapter skipping

> **Contributor credit:** This feature began with the chapter-skipping contribution from
> **Daniel Chinye ([@5thDimensionalVader](https://github.com/5thDimensionalVader))** in
> [PR #1](https://github.com/germagla/iina-jellyfin-integration/pull/1).

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
