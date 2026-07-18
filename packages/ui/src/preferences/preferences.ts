import {
  CATALOG_OPEN_REQUEST_PREFERENCE_KEY,
  CHAPTER_SKIP_MODE_PREFERENCE_KEY,
  DIAGNOSTIC_LOG_REVEAL_REQUEST_PREFERENCE_KEY,
} from '@iina-jellyfin/core/preference-contracts';

type ChapterSkipMode = 'on' | 'prompt' | 'off';

function isChapterSkipMode(value: unknown): value is ChapterSkipMode {
  return value === 'on' || value === 'prompt' || value === 'off';
}

export interface PreferencesPageBridge {
  set(key: string, value: unknown): void;
  get?(key: string, callback: (value: unknown) => void): void;
}

function bindChapterSkipMode(root: Document, preferences: PreferencesPageBridge | undefined): void {
  const inputs = Array.from(
    root.querySelectorAll<HTMLInputElement>('input[type="radio"][name="chapterSkipMode"]'),
  ).filter((input) => isChapterSkipMode(input.value));
  if (inputs.length !== 3) return;

  const select = (mode: ChapterSkipMode): void => {
    for (const input of inputs) input.checked = input.value === mode;
  };

  // Keep the safe package default visible while IINA resolves the persisted
  // value through its callback-only preferences bridge.
  let changedByUser = false;
  select('prompt');
  for (const input of inputs) {
    input.addEventListener('change', () => {
      if (input.checked && preferences !== undefined) {
        changedByUser = true;
        preferences.set(CHAPTER_SKIP_MODE_PREFERENCE_KEY, input.value);
      }
    });
  }

  if (preferences?.get === undefined) return;
  try {
    preferences.get(CHAPTER_SKIP_MODE_PREFERENCE_KEY, (value) => {
      if (!changedByUser) select(isChapterSkipMode(value) ? value : 'prompt');
    });
  } catch {
    select('prompt');
  }
}

export function bindPreferencesPage(
  root: Document,
  preferences: PreferencesPageBridge | undefined,
  now: () => number = Date.now,
): void {
  bindChapterSkipMode(root, preferences);

  const button = root.querySelector<HTMLButtonElement>('[data-open-catalog]');
  const status = root.querySelector<HTMLElement>('[data-open-status]');
  if (button !== null && status !== null) {
    button.addEventListener('click', () => {
      if (preferences === undefined) {
        status.dataset.state = 'error';
        status.textContent = 'Use IINA’s Plugins menu → Open Jellyfin Library.';
        return;
      }

      try {
        preferences.set(CATALOG_OPEN_REQUEST_PREFERENCE_KEY, now());
        delete status.dataset.state;
        status.textContent = 'Opening the Jellyfin Library…';
      } catch {
        status.dataset.state = 'error';
        status.textContent = 'Could not open the library. Use IINA’s Plugins menu instead.';
      }
    });
  }

  const diagnosticButton = root.querySelector<HTMLButtonElement>('[data-reveal-diagnostics]');
  const diagnosticStatus = root.querySelector<HTMLElement>('[data-diagnostics-status]');
  if (diagnosticButton === null || diagnosticStatus === null) return;
  diagnosticButton.addEventListener('click', () => {
    if (preferences === undefined) {
      diagnosticStatus.dataset.state = 'error';
      diagnosticStatus.textContent = 'Use IINA’s Plugins menu → Reveal Jellyfin Diagnostic Log.';
      return;
    }

    try {
      preferences.set(DIAGNOSTIC_LOG_REVEAL_REQUEST_PREFERENCE_KEY, now());
      delete diagnosticStatus.dataset.state;
      diagnosticStatus.textContent = 'Revealing the diagnostic log in Finder…';
    } catch {
      diagnosticStatus.dataset.state = 'error';
      diagnosticStatus.textContent = 'Could not reveal the log. Use IINA’s Plugins menu instead.';
    }
  });
}
