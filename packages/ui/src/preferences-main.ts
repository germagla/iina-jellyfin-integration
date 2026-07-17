import { bindPreferencesPage, type PreferencesPageBridge } from './preferences/preferences';

const preferences = (window as unknown as { iina?: { preferences?: PreferencesPageBridge } }).iina
  ?.preferences;

bindPreferencesPage(document, preferences);
