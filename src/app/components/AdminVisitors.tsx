import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { User } from 'firebase/auth';
import { onAuthChange, isAdmin } from '../../lib/authService';
import { loadVisits, markAdminBrowser, type Visit } from '../../lib/visitService';
import { usePortfolio } from '../../lib/usePortfolio';

const RANGES = [7, 30, 90];
const pad = (n: number) => String(n).padStart(2, '0');
const day = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const time = (d: Date) => (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
const secs = (s: number | null) => s == null ? '—' : s < 60 ? Math.round(s) + 's' : Math.floor(s / 60) + 'm ' + pad(Math.round(s % 60)) + 's';
const pct = (n: number) => Math.round(n * 100) + '%';
const avg = (list: number[]) => list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
const count = (keys: string[]) => {
  const m = new Map<string, number>();
  keys.forEach(k => m.set(k, (m.get(k) || 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
type Session = { sid: string; start: Date; pages: Visit[]; dur: number | null; ref: string; device: string };

// Admin: where visitors came from, how they moved through the site, how long they stayed and what they pressed
// (logged by lib/visitService). Everything is computed here from the raw page views of the chosen range.
export default function AdminVisitors() {
  const navigate = useNavigate();
  const projects = usePortfolio();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [range, setRange] = useState(7);
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [pageFilter, setPageFilter] = useState('');
  const [sortKey, setSortKey] = useState<'views' | 'people' | 'dur' | 'depth' | 'exit'>('views');

  useEffect(() => onAuthChange(u => { setUser(u); setChecked(true); }), []);
  useEffect(() => { if (checked && (!user || !isAdmin(user))) navigate('/'); }, [checked, user, navigate]);
  useEffect(() => {
    if (!user || !isAdmin(user)) return;
    markAdminBrowser();
    setVisits(null); setError('');
    loadVisits(range).then(setVisits).catch(err => { setError(String(err?.message || err)); setVisits([]); });
  }, [user, range]);

  const pageName = useMemo(() => {
    const titles = new Map(projects.map(p => ['/project/' + p.category + '/' + p.id, p.title]));
    const fixed: Record<string, string> = { '/': 'Space (home)', '/projects': 'Projects', '/about': 'About', '/motion': 'Motion' };
    return (path: string) => titles.get(path) || fixed[path] || (path.startsWith('/motion/') ? 'Motion · ' + path.slice(8) : path);
  }, [projects]);

  const a = useMemo(() => {
    if (!visits) return null;
    // sessions: the page views of one tab visit, in order
    const bySid = new Map<string, Visit[]>();
    visits.forEach(v => bySid.set(v.sid, [...(bySid.get(v.sid) || []), v]));
    const sessions: Session[] = [...bySid.entries()].map(([sid, list]) => {
      const pages = [...list].sort((x, y) => x.at.getTime() - y.at.getTime() || x.seq - y.seq);
      const timed = pages.filter(p => p.dur != null);
      return { sid, start: pages[0].at, pages, dur: timed.length ? timed.reduce((t, p) => t + (p.dur || 0), 0) : null,
        ref: pages.find(p => p.ref)?.ref || '', device: pages[0].device + ' · ' + pages[0].browser };
    }).sort((x, y) => y.start.getTime() - x.start.getTime());
    const exitOf = new Set(sessions.map(s => s.pages[s.pages.length - 1]));

    // per page: views, visitors, time, depth and how often it was the last page seen
    const pages = count(visits.map(v => v.path)).map(([path, views]) => {
      const list = visits.filter(v => v.path === path);
      return { path, name: pageName(path), views, people: new Set(list.map(v => v.sid)).size,
        dur: avg(list.flatMap(v => v.dur == null ? [] : [v.dur])), depth: avg(list.flatMap(v => v.depth == null ? [] : [v.depth])),
        exit: list.filter(v => exitOf.has(v)).length / views };
    });

    const transitions = count(sessions.flatMap(s => s.pages.slice(1).map((p, i) => pageName(s.pages[i].path) + '  →  ' + pageName(p.path))));
    const journeys = count(sessions.map(s => {
      const names = s.pages.map(p => pageName(p.path)).filter((n, i, all) => n !== all[i - 1]);
      return names.slice(0, 5).join('  →  ') + (names.length > 5 ? '  → …' : '');
    }));
    const clicks = count(visits.filter(v => !pageFilter || v.path === pageFilter).flatMap(v => v.clicks));
    const hours = [...Array(24)].map((_, h) => visits.filter(v => v.at.getHours() === h).length);
    const now = Date.now();
    const days = [...Array(Math.min(range, 30))].map((_, i) => day(new Date(now - (Math.min(range, 30) - 1 - i) * 864e5)));
    const perDay = days.map(d => ({ d, views: visits.filter(v => day(v.at) === d).length, people: sessions.filter(s => day(s.start) === d).length }));
    const timed = sessions.flatMap(s => s.dur == null ? [] : [s.dur]);
    return {
      sessions, pages, transitions: transitions.slice(0, 12), journeys: journeys.slice(0, 10), clicks: clicks.slice(0, 20),
      entries: count(sessions.map(s => pageName(s.pages[0].path))).slice(0, 8),
      exits: count(sessions.map(s => pageName(s.pages[s.pages.length - 1].path))).slice(0, 8),
      refs: count(sessions.map(s => s.ref || 'Direct / unknown')).slice(0, 8),
      devices: count(sessions.map(s => s.device)).slice(0, 8),
      hours, hourPeak: Math.max(1, ...hours), perDay, dayPeak: Math.max(1, ...perDay.map(p => p.views)),
      kpi: {
        visitors: sessions.length, views: visits.length,
        avgTime: avg(timed), pagesPer: sessions.length ? visits.length / sessions.length : 0,
        bounce: sessions.length ? sessions.filter(s => s.pages.length === 1).length / sessions.length : 0,
      },
    };
  }, [visits, pageName, pageFilter, range]);

  const sortedPages = useMemo(() => a ? [...a.pages].sort((x, y) => ((y[sortKey] ?? -1) as number) - ((x[sortKey] ?? -1) as number)) : [], [a, sortKey]);

  // raw page views as a spreadsheet, for analysis elsewhere
  const exportCsv = () => {
    if (!visits) return;
    const head = ['time', 'session', 'order', 'page', 'path', 'seconds', 'scroll %', 'pressed', 'from', 'device', 'browser', 'language'];
    const rows = visits.map(v => [v.at.toISOString(), v.sid, v.seq, pageName(v.path), v.path, v.dur ?? '', v.depth ?? '', v.clicks.join(' | '), v.ref, v.device, v.browser, v.lang]);
    const csv = '﻿' + [head, ...rows].map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'jaydne-visits-' + day(new Date()) + '-' + range + 'd.csv';
    link.click(); URL.revokeObjectURL(link.href);
  };

  if (!checked || !user || !isAdmin(user)) return <div className="min-h-screen bg-[#f7f6f0]" />;
  const label = 'text-[10px] uppercase tracking-widest opacity-40';
  const List = ({ title, rows, note }: { title: string; rows: Array<[string, number]>; note?: string }) => {
    const top = Math.max(1, ...rows.map(r => r[1]));
    return <section>
      <h3 className={label + ' mb-1'}>{title}</h3>
      {note && <p className="text-[11px] opacity-40 mb-3">{note}</p>}
      {rows.length ? <ul className="text-[12px] border-t border-[#111]/10">
        {rows.map(([k, n]) => <li key={k} className="relative flex justify-between py-2 gap-4 border-b border-[#111]/10">
          <span className="absolute left-0 bottom-0 h-[2px] bg-[#111]/15" style={{ width: (n / top * 100) + '%' }} />
          <span className="truncate">{k}</span><span className="tabular-nums opacity-60">{n}</span></li>)}
      </ul> : <p className="text-[12px] opacity-40">—</p>}
    </section>;
  };
  const Th = ({ k, children }: { k: typeof sortKey; children: React.ReactNode }) => (
    <th className="font-normal text-right pl-4"><button onClick={() => setSortKey(k)} className={sortKey === k ? 'opacity-100 underline' : 'hover:opacity-100'}>{children}</button></th>
  );

  return (
    <div className="min-h-screen bg-[#f7f6f0] text-[#111]">
      <nav className="sticky top-0 z-50 bg-[#f7f6f0] border-b border-[#111]/10 px-6 md:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/admin')} className={label + ' hover:opacity-100 transition-opacity'}>← Admin</button>
          <span className="text-[10px] uppercase tracking-[0.3em] opacity-40">Visitors</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            {RANGES.map(r => <button key={r} onClick={() => setRange(r)}
              className={'px-3 py-1 text-[10px] uppercase tracking-widest ' + (range === r ? 'border-b-2 border-[#111]' : 'opacity-30 hover:opacity-60')}>{r}d</button>)}
          </div>
          <button onClick={exportCsv} disabled={!visits?.length} className={label + ' hover:opacity-100 disabled:opacity-10'}>CSV ↓</button>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 md:px-12 py-10 space-y-14">
        {error && <p className="text-[12px] text-red-600">방문 기록을 불러오지 못했습니다: {error}</p>}
        {!a ? <p className={label}>Loading…</p> : <>
          {/* 1. Overview */}
          <section className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              ['Visitors', String(a.kpi.visitors), '방문(탭 기준)'],
              ['Page views', String(a.kpi.views), '열어본 페이지 수'],
              ['Avg. time', secs(a.kpi.avgTime), '방문 한 번에 머문 시간'],
              ['Pages / visit', a.kpi.pagesPer.toFixed(1), '한 번에 본 페이지 수'],
              ['Bounce', pct(a.kpi.bounce), '한 페이지만 보고 나감'],
            ].map(([name, value, hint]) => <div key={name} className="border-t border-[#111] pt-3">
              <p className={label}>{name}</p>
              <p className="mt-2 text-[28px] leading-none tabular-nums">{value}</p>
              <p className="mt-1 text-[11px] opacity-40">{hint}</p>
            </div>)}
          </section>

          {/* 2. When */}
          <section className="grid md:grid-cols-[2fr_1fr] gap-10">
            <div>
              <h3 className={label + ' mb-4'}>Daily · visitors / views</h3>
              <div className="flex items-end gap-[3px] h-36">
                {a.perDay.map(p => <div key={p.d} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={p.d + ' — ' + p.people + ' visitors, ' + p.views + ' views'}>
                  <span className="text-[9px] tabular-nums opacity-50">{p.people || ''}</span>
                  <div className="w-full bg-[#111]" style={{ height: (p.views / a.dayPeak * 100) + '%', minHeight: p.views ? 2 : 0 }} />
                  <span className="text-[8px] tabular-nums opacity-40">{p.d.slice(8)}</span>
                </div>)}
              </div>
            </div>
            <div>
              <h3 className={label + ' mb-4'}>Hour of day</h3>
              <div className="flex items-end gap-[2px] h-36">
                {a.hours.map((n, h) => <div key={h} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={h + '시 — ' + n + ' views'}>
                  <div className="w-full bg-[#111]/70" style={{ height: (n / a.hourPeak * 100) + '%', minHeight: n ? 2 : 0 }} />
                  <span className="text-[8px] tabular-nums opacity-40">{h % 6 ? '' : h}</span>
                </div>)}
              </div>
            </div>
          </section>

          {/* 3. Content */}
          <section>
            <h3 className={label + ' mb-1'}>Pages</h3>
            <p className="text-[11px] opacity-40 mb-3">머문 시간·스크롤은 확장 이후 기록부터 계산됩니다. 열 제목을 누르면 정렬, 페이지를 누르면 아래 클릭을 그 페이지로 거릅니다.</p>
            <table className="w-full text-[12px]">
              <thead><tr className="text-left opacity-40 text-[10px] uppercase tracking-widest">
                <th className="py-2 font-normal">Page</th><Th k="views">Views</Th><Th k="people">Visitors</Th><Th k="dur">Avg. time</Th><Th k="depth">Scroll</Th><Th k="exit">Exit</Th>
              </tr></thead>
              <tbody className="border-t border-[#111]/10">
                {sortedPages.map(p => <tr key={p.path} className={'border-b border-[#111]/10 cursor-pointer ' + (pageFilter === p.path ? 'bg-[#111]/5' : 'hover:bg-[#111]/[.03]')}
                  onClick={() => setPageFilter(pageFilter === p.path ? '' : p.path)}>
                  <td className="py-2 pr-4">{p.name}</td>
                  <td className="text-right tabular-nums pl-4">{p.views}</td>
                  <td className="text-right tabular-nums pl-4">{p.people}</td>
                  <td className="text-right tabular-nums pl-4">{secs(p.dur)}</td>
                  <td className="text-right tabular-nums pl-4">{p.depth == null ? '—' : Math.round(p.depth) + '%'}</td>
                  <td className="text-right tabular-nums pl-4">{pct(p.exit)}</td>
                </tr>)}
              </tbody>
            </table>
          </section>

          {/* 4. Flow */}
          <div className="grid md:grid-cols-2 gap-10">
            <List title="Common journeys" note="방문 한 번의 이동 순서(앞 5페이지)" rows={a.journeys} />
            <List title="Next step" note="한 페이지에서 바로 다음에 간 곳" rows={a.transitions} />
            <List title="Entry pages" note="처음 들어온 페이지" rows={a.entries} />
            <List title="Exit pages" note="마지막으로 보고 나간 페이지" rows={a.exits} />
          </div>

          {/* 5. Interactions + sources */}
          <div className="grid md:grid-cols-3 gap-10">
            <List title={'Pressed' + (pageFilter ? ' · ' + pageName(pageFilter) : '')} note="누른 카드·링크·버튼, 재생한 영상, 만져본 Motion" rows={a.clicks} />
            <List title="Came from" rows={a.refs} />
            <List title="Device · browser" rows={a.devices} />
          </div>

          {/* 6. Each visit */}
          <section>
            <h3 className={label + ' mb-3'}>Visits</h3>
            <ul className="text-[12px] border-t border-[#111]/10">
              {a.sessions.slice(0, 100).map(s => <li key={s.sid} className="border-b border-[#111]/10">
                <button onClick={() => setOpen(open === s.sid ? null : s.sid)} className="w-full grid grid-cols-[90px_1fr_70px_70px_1fr] gap-4 py-2 text-left hover:bg-[#111]/[.03]">
                  <span className="tabular-nums opacity-60">{time(s.start)}</span>
                  <span className="truncate">{s.pages.map(p => pageName(p.path)).join(' → ')}</span>
                  <span className="tabular-nums opacity-60 text-right">{s.pages.length}p</span>
                  <span className="tabular-nums opacity-60 text-right">{secs(s.dur)}</span>
                  <span className="truncate opacity-50">{s.device}{s.ref ? ' · ' + s.ref : ''}</span>
                </button>
                {open === s.sid && <ol className="pl-[106px] pb-4 space-y-2">
                  {s.pages.map((p, i) => <li key={i} className="grid grid-cols-[60px_1fr] gap-3">
                    <span className="tabular-nums opacity-50">{pad(p.at.getHours())}:{pad(p.at.getMinutes())}:{pad(p.at.getSeconds())}</span>
                    <span>
                      <b className="font-medium">{pageName(p.path)}</b>
                      <span className="opacity-50"> · {secs(p.dur)}{p.depth != null ? ' · scroll ' + p.depth + '%' : ''}</span>
                      {p.clicks.length > 0 && <span className="block opacity-60">pressed: {p.clicks.join(', ')}</span>}
                    </span>
                  </li>)}
                </ol>}
              </li>)}
            </ul>
            {!a.sessions.length && !error && <p className="text-[12px] opacity-40 mt-3">아직 기록된 방문이 없습니다.</p>}
          </section>
        </>}
      </main>
    </div>
  );
}
