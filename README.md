# Jellyfin for IINA

Browse and play your Jellyfin movies and shows in [IINA](https://iina.io/).

Jellyfin for IINA is a Direct Mode client: your library stays on Jellyfin and is fetched on
demand. Playback uses IINA's native mpv player, while progress and session state are synchronized
back to Jellyfin.

## Features

- Password and Quick Connect sign-in
- Home, search, and a separate tab for each supported Jellyfin library
- Movie, series, season, and episode details
- Resume progress, media versions, audio tracks, and subtitles
- Direct Play, remuxing, and server transcoding when needed
- Live playback status in the catalog and an IINA player sidebar
- Chapter skipping with persistent On, Prompt, and Off modes; Prompt is the default
- One managed player by default, with an option to open another window

The current release supports one Jellyfin server and user, movies, and television. Music, Live TV,
casting, offline downloads, SyncPlay, and multiple servers are not supported yet.

See the [changelog](CHANGELOG.md) for release notes and contributor credits.

## Install

Requires IINA 1.4.4 or later.

### From GitHub

1. Open IINA → Settings → Plugins.
2. Choose **Install from GitHub** and enter:
   `https://github.com/germagla/iina-jellyfin-integration`
3. Enable **Jellyfin for IINA**.
4. Choose Plugins → **Open Jellyfin Library**, or press <kbd>⌥⌘J</kbd>.
5. Enter your Jellyfin address and sign in.

The connection form starts with `http://localhost:8096`. Local addresses default to HTTP; remote
addresses default to HTTPS.

Plugin actions are also available from IINA → Settings → Plugins → Jellyfin for IINA →
Preferences.

### From a release

Download `jellyfin-for-iina.iinaplgz` from the
[latest GitHub Release](https://github.com/germagla/iina-jellyfin-integration/releases/latest), then
open the file with IINA. Both installation methods include IINA's GitHub update metadata.

Chapter skipping matches the configured chapter titles case-insensitively. Its defaults cover
common labels such as Opening, Intro, OP, Ending, Outro, Credits, and their common title/credit
variants. Choose **On** to skip automatically, **Prompt** to show a ten-second button over the
video, or **Off** to disable it. The same setting is available in the Jellyfin player sidebar and
remains selected for future files.

## Development

Requirements: macOS, Node.js 22 or later, and pnpm 11.

```sh
pnpm install
pnpm check
```

To test the checkout directly in IINA, first uninstall the GitHub copy so IINA does not load two
plugins with the same identifier. Then run:

```sh
pnpm iina:link
```

Restart IINA after linking or rebuilding. Remove the development link with:

```sh
pnpm iina:unlink
```

Other useful commands:

```sh
pnpm dev              # catalog UI with mock data
pnpm build            # production bundle in dist/
pnpm package:archive  # installable package in .artifacts/
```

The production `dist/` bundle is committed because IINA installs the plugin directly from the
GitHub repository.

## Release

Update every package version, `PLUGIN_VERSION`, and `Info.json.version`, then increment
`Info.json.ghVersion`. Move the completed notes in `CHANGELOG.md` under a heading matching the new
version, build and commit `dist/`, verify the metadata, and push the matching tag:

```sh
git fetch --tags origin
pnpm check
pnpm release:validate -- v0.2.0
git tag v0.2.0
git push origin main v0.2.0
```

The tag workflow reruns all checks and publishes a GitHub Release containing the installable
`.iinaplgz` archive, its SHA-256 checksum, and the matching changelog section. Automated releases
accept stable semantic versions; prerelease channels are not supported yet. GitHub Packages is
intentionally unused because the plugin is distributed as an IINA archive rather than an npm or
container package.

## Diagnostics

Choose Plugins → **Reveal Jellyfin Diagnostic Log** or use the plugin Preferences page. Logs are
redacted, rotated, and stored in the plugin's private data directory:

```text
~/Library/Application Support/com.colliderli.iina/plugins/.data/dev.germagla.iina-jellyfin/
```

Plugin logs exclude credentials, media URLs, titles, usernames, and Jellyfin session identifiers.
IINA's native logs are separate and may contain stream URLs, so sanitize them before sharing.

## Privacy and security

Access tokens are stored in macOS Keychain and never sent to the catalog webview. Artwork and
subtitles are brokered through the plugin, remote servers require HTTPS unless explicitly allowed,
and sensitive headers and query values are removed from plugin logs.

## License

[MIT](LICENSE). Third-party notices are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
