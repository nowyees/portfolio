import React from 'react';
import AdminVisitors from './AdminVisitors';
import type { Visit } from '../../lib/visitService';

// Local-only preview of the Visitors page with made-up visits (routes.ts mounts it in dev only).
const PAGES = ['/', '/projects', '/project/portfolio/4', '/project/portfolio/6', '/project/portfolio/2', '/motion', '/motion/horse', '/about'];
const NEXT: Record<string, string[]> = {
  '/': ['/projects', '/project/portfolio/4', '/motion', '/about', ''], '/projects': ['/project/portfolio/6', '/project/portfolio/2', '/project/portfolio/4', ''],
  '/motion': ['/motion/horse', '/', ''], '/motion/horse': ['/about', ''], '/about': ['', '/'],
};
let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
const demo: Visit[] = [];
for (let i = 0; i < 60; i++) {
  const sid = 'demo' + i, start = Date.now() - rand() * 9 * 864e5, device = pick(['mobile', 'mobile', 'desktop'] as const);
  let path = pick(['/', '/', '/', '/project/portfolio/4']), t = start;
  for (let seq = 1; path && seq < 7; seq++) {
    const dur = Math.round(5 + rand() * 120);
    demo.push({ sid, path, ref: seq === 1 ? pick(['l.instagram.com', '', 'www.facebook.com', '']) : '', device, browser: device === 'mobile' ? pick(['Instagram', 'Safari']) : 'Chrome',
      lang: 'ko-KR', first: seq === 1, at: new Date(t), seq, dur, depth: Math.round(20 + rand() * 80),
      clicks: rand() > .5 ? [pick(['Projects', 'EXIT', 'Lunaris', 'Motion', 'play: zero-gravity'])] : [] });
    t += dur * 1000; path = pick(NEXT[path] || ['']);
    if (!PAGES.includes(path)) path = '';
  }
}

export default function AdminVisitorsDemo() { return <AdminVisitors demo={demo} />; }
