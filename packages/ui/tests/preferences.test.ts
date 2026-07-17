import { fireEvent } from '@testing-library/react';
import {
  CATALOG_OPEN_REQUEST_PREFERENCE_KEY,
  DIAGNOSTIC_LOG_REVEAL_REQUEST_PREFERENCE_KEY,
} from '@iina-jellyfin/core/preference-contracts';
import { describe, expect, it, vi } from 'vitest';
import { bindPreferencesPage } from '../src/preferences/preferences';

function renderPreferencesControls() {
  document.body.innerHTML = `
    <button type="button" data-open-catalog>Open Jellyfin Library</button>
    <p data-open-status></p>
  `;
  return {
    button: document.querySelector<HTMLButtonElement>('[data-open-catalog]')!,
    status: document.querySelector<HTMLElement>('[data-open-status]')!,
  };
}

function renderDiagnosticControls() {
  document.body.innerHTML = `
    <button type="button" data-reveal-diagnostics>Reveal Diagnostic Log</button>
    <p data-diagnostics-status></p>
  `;
  return {
    button: document.querySelector<HTMLButtonElement>('[data-reveal-diagnostics]')!,
    status: document.querySelector<HTMLElement>('[data-diagnostics-status]')!,
  };
}

describe('plugin preferences', () => {
  it('writes a one-shot catalog request when the launch button is clicked', () => {
    const { button, status } = renderPreferencesControls();
    const set = vi.fn();
    bindPreferencesPage(document, { set }, () => 1_800_000_000_000);

    fireEvent.click(button);

    expect(set).toHaveBeenCalledWith(CATALOG_OPEN_REQUEST_PREFERENCE_KEY, 1_800_000_000_000);
    expect(status).toHaveTextContent('Opening the Jellyfin Library');
  });

  it('shows the menu fallback outside IINA', () => {
    const { button, status } = renderPreferencesControls();
    bindPreferencesPage(document, undefined);

    fireEvent.click(button);

    expect(status).toHaveTextContent('Plugins menu');
    expect(status).toHaveAttribute('data-state', 'error');
  });

  it('writes a one-shot request to reveal the rotating diagnostic log', () => {
    const { button, status } = renderDiagnosticControls();
    const set = vi.fn();
    bindPreferencesPage(document, { set }, () => 1_800_000_000_000);

    fireEvent.click(button);

    expect(set).toHaveBeenCalledWith(
      DIAGNOSTIC_LOG_REVEAL_REQUEST_PREFERENCE_KEY,
      1_800_000_000_000,
    );
    expect(status).toHaveTextContent('Revealing the diagnostic log in Finder');
  });
});
