import {
  CheckCircle,
  LockKey,
  HardDrives,
  ShieldWarning,
  SpinnerGap,
  X,
} from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import type { CatalogBridge } from '../bridge/contracts';

interface ConnectionScreenProps {
  bridge: CatalogBridge;
  onConnected: () => void;
}

type AuthMode = 'password' | 'quick-connect';

function isLocalHostname(hostname: string): boolean {
  const value = hostname.toLocaleLowerCase().replace(/^\[|\]$/g, '');
  if (value === 'localhost' || value === '::1' || value.endsWith('.local')) return true;
  if (/^127\./.test(value) || /^10\./.test(value) || /^192\.168\./.test(value)) return true;
  const match = /^172\.(\d{1,3})\./.exec(value);
  return match !== null && Number(match[1]) >= 16 && Number(match[1]) <= 31;
}

export function isInsecureRemoteServer(serverUrl: string): boolean {
  try {
    const url = new URL(serverUrl);
    return url.protocol === 'http:' && !isLocalHostname(url.hostname);
  } catch {
    return false;
  }
}

export function isInsecureLocalServer(serverUrl: string): boolean {
  try {
    const url = new URL(serverUrl);
    return url.protocol === 'http:' && isLocalHostname(url.hostname);
  } catch {
    return false;
  }
}

function validateServerUrl(serverUrl: string): string | undefined {
  try {
    const parsed = new URL(serverUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      return 'Use an http:// or https:// Jellyfin address.';
    if (parsed.username || parsed.password)
      return 'Do not include credentials in the server address.';
    return undefined;
  } catch {
    return 'Enter a complete Jellyfin address, including http:// or https://.';
  }
}

export function ConnectionScreen({ bridge, onConnected }: ConnectionScreenProps) {
  const [serverUrl, setServerUrl] = useState('https://');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [quickCode, setQuickCode] = useState<string>();
  const [quickExpires, setQuickExpires] = useState<number>();
  const [pendingInsecureAuth, setPendingInsecureAuth] = useState<AuthMode>();
  const [acknowledgedInsecure, setAcknowledgedInsecure] = useState(false);

  useEffect(() => {
    if (!quickCode) return;
    let active = true;
    const timer = window.setInterval(() => {
      void bridge
        .request('connection.quickConnect.poll', {})
        .then((result) => {
          if (!active) return;
          if (result.authenticated) onConnected();
        })
        .catch((reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason.message : 'Quick Connect failed.');
        });
    }, 2_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [bridge, onConnected, quickCode]);

  function validateBeforeAuth(mode: AuthMode): boolean {
    const urlError = validateServerUrl(serverUrl.trim());
    if (urlError) {
      setError(urlError);
      return false;
    }
    if (isInsecureRemoteServer(serverUrl.trim()) && !acknowledgedInsecure) {
      setPendingInsecureAuth(mode);
      return false;
    }
    return true;
  }

  async function authenticateWithPassword(allowInsecure = acknowledgedInsecure): Promise<void> {
    if (!username.trim() || !password) {
      setError('Enter your Jellyfin username and password.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const trimmedUrl = serverUrl.trim();
      await bridge.request('connection.probe', {
        serverUrl: trimmedUrl,
        allowInsecureRemote: allowInsecure,
      });
      await bridge.request('connection.login.password', {
        serverUrl: trimmedUrl,
        username: username.trim(),
        password,
        allowInsecureRemote: allowInsecure,
      });
      setPassword('');
      onConnected();
    } catch (reason) {
      setPassword('');
      setError(reason instanceof Error ? reason.message : 'Jellyfin sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function startQuickConnect(allowInsecure = acknowledgedInsecure): Promise<void> {
    setBusy(true);
    setError(undefined);
    try {
      const trimmedUrl = serverUrl.trim();
      await bridge.request('connection.probe', {
        serverUrl: trimmedUrl,
        allowInsecureRemote: allowInsecure,
      });
      const result = await bridge.request('connection.quickConnect.start', {
        serverUrl: trimmedUrl,
        allowInsecureRemote: allowInsecure,
      });
      setQuickCode(result.code);
      setQuickExpires(result.expiresInSeconds);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Quick Connect could not be started.');
    } finally {
      setBusy(false);
    }
  }

  function continueInsecureAuth(): void {
    if (!acknowledgedInsecure || !pendingInsecureAuth) return;
    const mode = pendingInsecureAuth;
    setPendingInsecureAuth(undefined);
    if (mode === 'password') void authenticateWithPassword(true);
    else void startQuickConnect(true);
  }

  return (
    <main className="connection-screen">
      <section className="connection-card" aria-labelledby="connect-title">
        <div className="connection-mark">
          <HardDrives size={30} weight="duotone" aria-hidden="true" />
        </div>
        <p className="connection-eyebrow">Jellyfin for IINA</p>
        <h1 id="connect-title">Connect your library</h1>
        <p className="connection-intro">
          Your movies and shows stay on Jellyfin and stream directly into IINA.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (validateBeforeAuth('password')) void authenticateWithPassword();
          }}
        >
          <label className="form-field">
            <span>Server address</span>
            <input
              value={serverUrl}
              onChange={(event) => {
                setServerUrl(event.target.value);
                setAcknowledgedInsecure(false);
              }}
              type="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              placeholder="https://jellyfin.example.com/media"
            />
          </label>
          {isInsecureLocalServer(serverUrl.trim()) ? (
            <p className="lan-http-note" role="note">
              <ShieldWarning size={16} aria-hidden="true" />
              Local HTTP is unencrypted. Connect only on a network you trust.
            </p>
          ) : null}
          <label className="form-field">
            <span>Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="primary-button connect-button" type="submit" disabled={busy}>
            {busy ? (
              <SpinnerGap className="spin" size={20} aria-hidden="true" />
            ) : (
              <LockKey size={20} weight="fill" aria-hidden="true" />
            )}
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        </form>

        <div className="connection-divider">
          <span>or</span>
        </div>
        <button
          className="secondary-button quick-connect-button"
          type="button"
          disabled={busy}
          onClick={() => {
            if (validateBeforeAuth('quick-connect')) void startQuickConnect();
          }}
        >
          Quick Connect
        </button>

        {quickCode ? (
          <div className="quick-code" role="status">
            <CheckCircle size={23} weight="fill" aria-hidden="true" />
            <div>
              <strong>{quickCode}</strong>
              <span>
                Enter this code in Jellyfin
                {quickExpires ? ` within ${Math.ceil(quickExpires / 60)} minutes` : ''}.
              </span>
            </div>
          </div>
        ) : null}

        <p className="privacy-note">
          Your password is used only for this sign-in and is discarded immediately afterward. Access
          tokens never enter this window.
        </p>
      </section>

      {pendingInsecureAuth ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="confirmation-modal insecure-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="insecure-title"
            aria-describedby="insecure-description"
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setPendingInsecureAuth(undefined)}
              aria-label="Close insecure connection warning"
            >
              <X size={18} aria-hidden="true" />
            </button>
            <span className="modal-icon">
              <ShieldWarning size={26} weight="fill" aria-hidden="true" />
            </span>
            <h2 id="insecure-title">This connection isn’t encrypted</h2>
            <p id="insecure-description">
              The server uses HTTP outside your local network. Your username, password, and viewing
              activity could be intercepted.
            </p>
            <label className="acknowledgement">
              <input
                type="checkbox"
                checked={acknowledgedInsecure}
                onChange={(event) => setAcknowledgedInsecure(event.target.checked)}
              />
              <span>I understand and want to connect anyway.</span>
            </label>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setPendingInsecureAuth(undefined)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={!acknowledgedInsecure}
                onClick={continueInsecureAuth}
              >
                Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
