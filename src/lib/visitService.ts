import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { db, isConfigured } from './firebase';

// Page views for the admin's Visitors page. One document per page view in `visits`;
// no IP address or personal data, only an anonymous per-tab session id.
export interface Visit {
  sid: string; path: string; ref: string; device: 'mobile' | 'tablet' | 'desktop'; browser: string;
  lang: string; first: boolean; at: Date;
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

let lastPath = '';
export function trackVisit(path: string) {
  if (!isConfigured || !db || path === lastPath) return;
  if (/^(localhost|127\.|\[::1\])/.test(location.hostname) || path.startsWith('/admin') || store('local', ADMIN_FLAG)) return;
  lastPath = path;
  let sid = store('session', 'ljw-sid');
  const first = !sid;
  if (!sid) sid = store('session', 'ljw-sid', Math.random().toString(36).slice(2, 12)) || 'x';
  let ref = '';
  if (first && document.referrer) {
    try { const host = new URL(document.referrer).hostname; if (host !== location.hostname) ref = host; } catch { /* unreadable referrer */ }
  }
  addDoc(collection(db, 'visits'), {
    sid, path, ref, device: device(), browser: browser(), lang: navigator.language || '', first, at: serverTimestamp(),
  }).catch(() => { /* visits are best-effort; the site never waits on them */ });
}

export async function loadVisits(days: number): Promise<Visit[]> {
  if (!db) return [];
  const since = Timestamp.fromDate(new Date(Date.now() - days * 864e5));
  const snap = await getDocs(query(collection(db, 'visits'), where('at', '>=', since), orderBy('at', 'desc')));
  return snap.docs.map(d => {
    const v = d.data();
    return { ...(v as Omit<Visit, 'at'>), at: (v.at as Timestamp | null)?.toDate() ?? new Date() };
  });
}
