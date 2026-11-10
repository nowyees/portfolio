import { useSyncExternalStore } from 'react';
import { storyEn } from './storyTranslations';

// The site's language: Korean or English, switched from the nav and remembered on this browser. A first visit
// follows the browser's language. Text written in Korean (the project pages, the portfolio data) is shown in English
// through `storyEn`; text written in English for the site itself carries its Korean beside it (`useT`).
export type Lang = 'ko' | 'en';
const KEY = 'ljw-lang';

const initial = (): Lang => {
  try { const saved = localStorage.getItem(KEY); if (saved === 'ko' || saved === 'en') return saved; } catch { /* storage is optional */ }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
};
let lang: Lang = typeof window === 'undefined' ? 'en' : initial();
if (typeof document !== 'undefined') document.documentElement.lang = lang;
const listeners = new Set<() => void>();

export const getLang = () => lang;
export function setLang(next: Lang) {
  if (next === lang) return;
  lang = next;
  try { localStorage.setItem(KEY, next); } catch { /* storage is optional */ }
  document.documentElement.lang = next;
  listeners.forEach(listener => listener());
}
export function useLang(): Lang {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getLang, getLang);
}
/** `t(korean, english)`: the one for the current language. */
export function useT() {
  const current = useLang();
  return (ko: string, en: string) => current === 'ko' ? ko : en;
}

const hangul = /[가-힣]/;
/** A Korean text in English, if it has a translation (otherwise as written). */
export const toEnglish = (text: string) => storyEn[text] ?? storyEn[text.trim()] ?? text;
/** A copy of `value` with every Korean string shown in English (plain objects and arrays are walked; file paths and
 *  anything without a translation stay as they are). In Korean it is `value` itself. */
export function localize<T>(value: T, current: Lang): T {
  if (current === 'ko') return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return hangul.test(v) ? toEnglish(v) : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype)
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}
