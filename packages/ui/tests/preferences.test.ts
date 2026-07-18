import { fireEvent } from '@testing-library/react';
import {
  CATALOG_OPEN_REQUEST_PREFERENCE_KEY,
  CHAPTER_SKIP_MODE_PREFERENCE_KEY,
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

function renderChapterSkipModes() {
  document.body.innerHTML = `
    <input type="radio" name="chapterSkipMode" value="on" />
    <input type="radio" name="chapterSkipMode" value="prompt" />
    <input type="radio" name="chapterSkipMode" value="off" />
  `;
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[name="chapterSkipMode"]'));
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

  it('restores and persists the chapter skip mode through IINA custom binding', () => {
    const inputs = renderChapterSkipModes();
    const set = vi.fn();
    const get = vi.fn((_key: string, callback: (value: unknown) => void) => callback('off'));

    bindPreferencesPage(document, { get, set });

    expect(get).toHaveBeenCalledWith(CHAPTER_SKIP_MODE_PREFERENCE_KEY, expect.any(Function));
    expect(inputs.find((input) => input.checked)?.value).toBe('off');
    fireEvent.click(inputs[0]!);
    expect(set).toHaveBeenCalledWith(CHAPTER_SKIP_MODE_PREFERENCE_KEY, 'on');
  });

  it('uses Prompt when the stored chapter skip mode is absent or invalid', () => {
    const inputs = renderChapterSkipModes();
    bindPreferencesPage(document, {
      set: vi.fn(),
      get: (_key, callback) => callback('automatic'),
    });

    expect(inputs.find((input) => input.checked)?.value).toBe('prompt');
  });

  it('does not let a delayed preference read overwrite a newer choice', () => {
    const inputs = renderChapterSkipModes();
    const set = vi.fn();
    let resolvePreference: ((value: unknown) => void) | undefined;
    bindPreferencesPage(document, {
      set,
      get: (_key, callback) => {
        resolvePreference = callback;
      },
    });

    fireEvent.click(inputs[0]!);
    resolvePreference?.('off');

    expect(set).toHaveBeenCalledWith(CHAPTER_SKIP_MODE_PREFERENCE_KEY, 'on');
    expect(inputs.find((input) => input.checked)?.value).toBe('on');
  });

  it('restores the previous mode when IINA cannot persist a change', () => {
    const inputs = renderChapterSkipModes();
    let resolvePreference: ((value: unknown) => void) | undefined;
    bindPreferencesPage(document, {
      set: () => {
        throw new Error('preferences unavailable');
      },
      get: (_key, callback) => {
        resolvePreference = callback;
      },
    });

    fireEvent.click(inputs[0]!);
    expect(inputs.find((input) => input.checked)?.value).toBe('prompt');

    resolvePreference?.('off');
    expect(inputs.find((input) => input.checked)?.value).toBe('off');
  });
});
