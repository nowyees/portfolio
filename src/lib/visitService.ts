import { collection, getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db, isConfigured } from './firebase';

// Page views for the admin's Visitors page. One document per page view in `visits`, written when the
// visitor leaves that page (next page, tab hidden or closed) so it can carry how long they stayed, how
// far they scrolled and what they pressed. No IP address or personal data, only a per-tab session id.
export interface Visit {
  sid: string; path: string; ref: string; device: 'mobile' | 'tablet' | 'desktop'; browser: string;
  lang: string; first: boolean; at: Date;
  seq: number; dur: number | null; depth: number | null; clicks: string[];
}

const ADMIN_FLAG = 'ljw-admin';
const store = (kind: 'local' | 'session', key: string, value?: string) => {
  try {
    const s = kind === 'local' ? localStorage : sessionStorage;
    if (value === undefined) return s.getItem(key);
    s.setItem(key, value); return value;
  } catch { return null; }
};

// The admin's own browsing is left out once they have opened /admin on that browser.
export const markAdminBrowser = () => { store('local', ADMIN_FLAG, '1'); };

const device = (): Visit['device'] => {
  const w = Math.min(screen.width, screen.height);
  return /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : w >= 700 && 'ontouchend' in document ? 'tablet' : 'desktop';
};
const browser = () => {
  const ua = navigator.userAgent;
  if (/KAKAOTALK/i.test(ua)) return 'KakaoTalk';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/NAVER/i.test(ua)) return 'Naver';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/SamsungBrowser/.test(ua)) return 'Samsung';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  if (/Firefox\//.test(ua)) return 'Firefox';
  return 'Other';
};

// --- the page being viewed ---------------------------------------------------------------
type Current = { path: string; ref: string; first: boolean; seq: number; start: number; depth: number; clicks: string[] };
let current: Current | null = null;
let listening = false;

const scrollDepth = () => {
  const el = document.documentElement, total = Math.max(el.scrollHeight, document.body?.scrollHeight || 0);
  return total <= innerHeight ? 100 : Math.min(100, Math.round((scrollY + innerHeight) / total * 100));
};
const note = (label: string) => {
  if (!current || !label) return;
  const clean = label.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (clean && current.clicks[current.clicks.length - 1] !== clean && current.clicks.length < 30) current.clicks.push(clean);
};
// What a press was on: an explicit data-track, else the link/button's label, text or address.
const labelOf = (target: EventTarget | null) => {
  const el = (target as Element | null)?.closest?.('[data-track], a, button, video, .motion-stage') as HTMLElement | null;
  if (!el) return '';
  if (el.dataset.track) return el.dataset.track;
  if (el.classList.contains('motion-stage')) return 'motion: ' + (location.pathname.split('/')[2] || 'astronaut-tail');
  if (el.tagName === 'VIDEO') return '';
  const aria = el.getAttribute('aria-label')?.replace(/^Open /, '');
  const href = el.getAttribute('href');
  return (aria || el.textContent?.trim() || href || el.tagName.toLowerCase()).slice(0, 60);
};

const listen = () => {
  if (listening) return;
  listening = true;
  addEventListener('scroll', () => { if (current) current.depth = Math.max(current.depth, scrollDepth()); }, { passive: true });
  document.addEventListener('click', event => note(labelOf(event.target)), true);
  document.addEventListener('pointerdown', event => {
    if ((event.target as Element)?.closest?.('.motion-stage')) note(labelOf(event.target));
  }, true);
  document.addEventListener('play', event => {
    const v = event.target as HTMLVideoElement;
    if (v.tagName === 'VIDEO' && !v.muted) note('play: ' + (v.getAttribute('aria-label') || v.currentSrc.split('/').pop() || 'video'));
  }, true);
  // leaving the tab or the site ends the current page view
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('pagehide', flush);
};

// Sent with fetch keepalive to the Firestore REST API so a view still lands when the tab is closing.
function flush() {
  const c = current;
  if (!c) return;
  current = null;
  const key = import.meta.env.VITE_FIREBASE_API_KEY, project = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!key || !project) return;
  const s = (v: string) => ({ stringValue: v }), n = (v: number) => ({ integerValue: String(Math.round(v)) });
  const fields = {
    sid: s(store('session', 'ljw-sid') || 'x'), path: s(c.path), ref: s(c.ref), device: s(device()), browser: s(browser()),
    lang: s(navigator.language || ''), first: { booleanValue: c.first }, at: { timestampValue: new Date(c.start).toISOString() },
    seq: n(c.seq), dur: n(Math.min(86399, (Date.now() - c.start) / 1000)), depth: n(Math.max(c.depth, scrollDepth())),
    clicks: { arrayValue: { values: c.clicks.map(s) } },
  };
  fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/visits?key=${key}`, {
    method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
  }).catch(() => { /* visits are best-effort; the site never waits on them */ });
}

export function trackVisit(path: string) {
  if (!isConfigured || current?.path === path) return;
  // a page shown inside the Lab's frame is part of the Lab visit, not a visit of its own
  if (window.top !== window.self) { current = null; return; }
  if (/^(localhost|127\.|\[::1\])/.test(location.hostname) || store('local', ADMIN_FLAG)) { current = null; return; }
  flush();
  if (path.startsWith('/admin')) return;
  listen();
  let sid = store('session', 'ljw-sid');
  const first = !sid;
  if (!sid) store('session', 'ljw-sid', Math.random().toString(36).slice(2, 12));
  const seq = Number(store('session', 'ljw-seq') || 0) + 1;
  store('session', 'ljw-seq', String(seq));
  let ref = '';
  if (first && document.referrer) {
    try { const host = new URL(document.referrer).hostname; if (host !== location.hostname) ref = host; } catch { /* unreadable referrer */ }
  }
  current = { path, ref, first, seq, start: Date.now(), depth: 0, clicks: [] };
}

export async function loadVisits(days: number): Promise<Visit[]> {
  if (!db) return [];
  const since = Timestamp.fromDate(new Date(Date.now() - days * 864e5));
  const snap = await getDocs(query(collection(db, 'visits'), where('at', '>=', since), orderBy('at', 'desc')));
  return snap.docs.map(d => {
    const v = d.data();
    return {
      sid: v.sid || '', path: v.path || '', ref: v.ref || '', device: v.device || 'desktop', browser: v.browser || '',
      lang: v.lang || '', first: !!v.first, at: (v.at as Timestamp | null)?.toDate() ?? new Date(),
      // views logged before the extension carry no time, depth or presses
      seq: typeof v.seq === 'number' ? v.seq : 0, dur: typeof v.dur === 'number' ? v.dur : null,
      depth: typeof v.depth === 'number' ? v.depth : null, clicks: Array.isArray(v.clicks) ? v.clicks : [],
    };
  });
}
