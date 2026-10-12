import { usePrefs } from '../store/prefs';
import { t } from './index';

/** Call in every component that renders text: it re-renders the component when the language changes. */
export function useT(): typeof t {
  usePrefs(s => s.lang);
  return t;
}
