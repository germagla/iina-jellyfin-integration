# Security

Please report security issues privately through
[GitHub Security Advisories](https://github.com/germagla/iina-jellyfin-integration/security/advisories/new)
rather than opening a public issue. Include the affected version and a minimal reproduction when
possible.

The plugin keeps Jellyfin access tokens in macOS Keychain, never in webview state or plugin
preferences. Logs are designed to redact authorization values and authentication query
parameters. Non-local HTTP connections require an explicit user acknowledgement.
