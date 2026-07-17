import {
  CheckCircle,
  LockKey,
  HardDrives,
  ShieldWarning,
  SpinnerGap,
  X,
} from '@phosphor-icons/react';
import { normalizeServerUrl, type NormalizedServerAddress } from '@iina-jellyfin/core';
import { useEffect, useState } from 'react';
import type { CatalogBridge } from '../bridge/contracts';

interface ConnectionScreenProps {
  bridge: CatalogBridge;
  onConnected: () => void;
}

type AuthMode = 'password' | 'quick-connect';

interface PendingInsecureAuth {
  mode: AuthMode;
  serverUrl: string;
}

export const DEFAULT_JELLYFIN_SERVER_URL = 'http://localhost:8096';

function inspectServerUrl(serverUrl: string): NormalizedServerAddress | undefined {
  try {
    return normalizeServerUrl(serverUrl, { allowInsecureRemote: true });
  } catch {
    return undefined;
  }
}

function normalizedServerUrl(serverUrl: string): NormalizedServerAddress {
  try {
    return normalizeServerUrl(serverUrl, { allowInsecureRemote: true });
  } catch (reason) {
    throw reason instanceof Error ? reason : new Error('The Jellyfin server URL is not valid.');
  }
}

export function ConnectionScreen({ bridge, onConnected }: ConnectionScreenProps) {
  const [serverUrl, setServerUrl] = useState(DEFAULT_JELLYFIN_SERVER_URL);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [quickCode, setQuickCode] = useState<string>();
  const [quickExpires, setQuickExpires] = useState<number>();
  const [pendingInsecureAuth, setPendingInsecureAuth] = useState<PendingInsecureAuth>();
  const [acknowledgedInsecure, setAcknowledgedInsecure] = useState(false);
  const inspectedServer = inspectServerUrl(serverUrl);

  useEffect(() => {
    if (!quickCode) return;
    let active = true;
    let polling = false;
    const timer = window.setInterval(() => {
      if (polling) return;
      polling = true;
      void bridge
        .request('connection.quickConnect.poll', {})
        .then((result) => {
          if (!active) return;
          if (result.authenticated) onConnected();
        })
        .catch((reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason.message : 'Quick Connect failed.');
        })
        .finally(() => {
          polling = false;
        });
    }, 2_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [bridge, onConnected, quickCode]);

  function beginAuthentication(mode: AuthMode): void {
    let address: NormalizedServerAddress;
    try {
      address = normalizedServerUrl(serverUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The Jellyfin server URL is not valid.');
      return;
    }
    setServerUrl(address.url);
    setError(undefined);
    if (address.policy === 'remote-http-accepted' && !acknowledgedInsecure) {
      setPendingInsecureAuth({ mode, serverUrl: address.url });
      return;
    }
    if (mode === 'password') void authenticateWithPassword(address.url);
    else void startQuickConnect(address.url);
  }

  async function authenticateWithPassword(
    normalizedUrl: string,
    allowInsecure = acknowledgedInsecure,
  ): Promise<void> {
    if (!username.trim() || !password) {
      setError('Enter your Jellyfin username and password.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await bridge.request('connection.probe', {
        serverUrl: normalizedUrl,
        allowInsecureRemote: allowInsecure,
      });
      await bridge.request('connection.login.password', {
        serverUrl: normalizedUrl,
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

  async function startQuickConnect(
    normalizedUrl: string,
    allowInsecure = acknowledgedInsecure,
  ): Promise<void> {
    setBusy(true);
    setError(undefined);
    try {
      await bridge.request('connection.probe', {
        serverUrl: normalizedUrl,
        allowInsecureRemote: allowInsecure,
      });
      const result = await bridge.request('connection.quickConnect.start', {
        serverUrl: normalizedUrl,
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
    const pending = pendingInsecureAuth;
    setPendingInsecureAuth(undefined);
    if (pending.mode === 'password') void authenticateWithPassword(pending.serverUrl, true);
    else void startQuickConnect(pending.serverUrl, true);
  }

  function dismissInsecureAuth(): void {
    setPendingInsecureAuth(undefined);
    setAcknowledgedInsecure(false);
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
            beginAuthentication('password');
          }}
        >
          <label className="form-field">
            <span>Server address</span>
            <input
              value={serverUrl}
              onChange={(event) => {
                setServerUrl(event.target.value);
                setAcknowledgedInsecure(false);
                setPendingInsecureAuth(undefined);
                setQuickCode(undefined);
                setError(undefined);
              }}
              onBlur={() => {
                const address = inspectServerUrl(serverUrl);
                if (address !== undefined) setServerUrl(address.url);
              }}
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              placeholder={DEFAULT_JELLYFIN_SERVER_URL}
            />
          </label>
          {inspectedServer?.policy === 'local-http-warning' ? (
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
            beginAuthentication('quick-connect');
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
              onClick={dismissInsecureAuth}
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
              <button className="secondary-button" type="button" onClick={dismissInsecureAuth}>
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
