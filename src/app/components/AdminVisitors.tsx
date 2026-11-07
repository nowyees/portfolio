import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { User } from 'firebase/auth';
import { onAuthChange, isAdmin } from '../../lib/authService';
import { loadVisits, markAdminBrowser, type Visit } from '../../lib/visitService';
import { usePortfolio } from '../../lib/usePortfolio';

const RANGES = [7, 30, 90];
const INK = '#111';
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
const label = 'text-[11px] uppercase tracking-widest text-[#6b6a66]';

// --- charts (single ink hue; names are always written, never colour-coded) ----------------------

// How visits move: each column is a step (1st page, 2nd page…), bands are visits going from one page to the next.
function FlowChart({ paths }: { paths: string[][] }) {
  const STEPS = 4, W = 1000, H = 340, NODE = 10, GAP = 14, EXIT = 'Left the site';
  const [hover, setHover] = useState<string | null>(null);
  const layout = useMemo(() => {
    // the five most common pages at each step keep their name; the rest fold into "Other"
    const keyAt = paths.map(() => [] as string[]);
    for (let s = 0; s < STEPS; s++) {
      const top = new Set(count(paths.flatMap(p => p[s] ? [p[s]] : [])).slice(0, 5).map(([k]) => k));
      // a visit that ended at the previous step shows up here once, as "Left the site"
      paths.forEach((p, i) => { keyAt[i][s] = p[s] ? (top.has(p[s]) ? p[s] : 'Other') : s > 0 && p[s - 1] ? EXIT : ''; });
    }
    const columns = [...Array(STEPS)].map((_, s) => count(keyAt.flatMap(k => k[s] ? [k[s]] : [])).sort((a, b) => (a[0] === EXIT ? 1 : 0) - (b[0] === EXIT ? 1 : 0) || b[1] - a[1]));
    const k = Math.min(30, (H - GAP * 6) / Math.max(1, ...columns.map(c => c.reduce((t, [, n]) => t + n, 0))));
    const x = (s: number) => s * (W - 190) / (STEPS - 1);
    const nodes = new Map<string, { s: number; key: string; n: number; x: number; y: number; h: number; outY: number; inY: number }>();
    columns.forEach((col, s) => {
      let y = 0;
      col.forEach(([key, n]) => { const h = n * k; nodes.set(s + '|' + key, { s, key, n, x: x(s), y, h, outY: y, inY: y }); y += h + GAP; });
    });
    const links = count(keyAt.flatMap(kk => kk.slice(0, STEPS - 1).flatMap((from, s) => from && from !== EXIT && kk[s + 1] ? [s + '|' + from + '>>' + (s + 1) + '|' + kk[s + 1]] : [])))
      .map(([id, n]) => { const [a, b] = id.split('>>'); return { id, a: nodes.get(a)!, b: nodes.get(b)!, n }; })
      .sort((p, q) => p.a.y - q.a.y || p.b.y - q.b.y)
      .map(l => { const w = l.n * k, y0 = l.a.outY + w / 2, y1 = l.b.inY + w / 2; l.a.outY += w; l.b.inY += w; return { ...l, w, y0, y1 }; });
    return { nodes: [...nodes.values()], links, height: Math.max(...[...nodes.values()].map(n => n.y + n.h), 40) + 4 };
  }, [paths]);
  if (!paths.length) return <p className="text-[12px] text-[#6b6a66]">—</p>;
  return (
    <div>
      <div className="flex justify-between text-[11px] uppercase tracking-widest text-[#6b6a66] mb-2 pr-[190px]">
        {[...Array(STEPS)].map((_, s) => <span key={s}>{s === 0 ? '1st page' : s + 1 + (s === 1 ? 'nd' : s === 2 ? 'rd' : 'th') + ' page'}</span>)}
      </div>
      <svg viewBox={`0 0 ${W} ${layout.height}`} className="w-full h-auto overflow-visible" role="img" aria-label="Visitor flow between pages">
        {layout.links.map(l => {
          const x0 = l.a.x + NODE, x1 = l.b.x, mid = (x0 + x1) / 2;
          const on = hover === null || hover === l.a.key || hover === l.b.key;
          return <path key={l.id} d={`M${x0},${l.y0} C${mid},${l.y0} ${mid},${l.y1} ${x1},${l.y1}`} fill="none"
            stroke={l.b.key === EXIT ? '#bbb' : INK} strokeOpacity={on ? (l.b.key === EXIT ? .35 : .18) : .05} strokeWidth={Math.max(1, l.w)}>
            <title>{l.a.key} → {l.b.key}: {l.n}</title>
          </path>;
        })}
        {layout.nodes.map(n => <g key={n.s + n.key} onMouseEnter={() => setHover(n.key)} onMouseLeave={() => setHover(null)} className="cursor-default">
          <rect x={n.x} y={n.y} width={NODE} height={Math.max(2, n.h)} rx={2} fill={n.key === EXIT ? '#c8c8c8' : INK} />
          <text x={n.x + NODE + 6} y={n.y + Math.max(2, n.h) / 2} dominantBaseline="middle" fontSize="12" fill={n.key === EXIT ? '#6b6a66' : INK}>
            {n.key.length > 22 ? n.key.slice(0, 21) + '…' : n.key} <tspan fill="#6b6a66">{n.n}</tspan>
          </text>
          <title>{n.key}: {n.n} visits at this step</title>
        </g>)}
      </svg>
    </div>
  );
}

// Horizontal bars with the value written at the end; `max` lets several columns share one scale.
function Bar({ value, max, text, muted }: { value: number; max: number; text: string; muted?: boolean }) {
  return <div className="flex items-center gap-2 min-w-0">
    <div className="flex-1 h-[10px] bg-[#111]/[.06] rounded-[2px] overflow-hidden">
      <div className="h-full rounded-[2px]" style={{ width: Math.max(value ? 2 : 0, value / Math.max(1, max) * 100) + '%', background: muted ? '#999' : INK }} />
    </div>
    <span className="w-[52px] text-right tabular-nums text-[11px] opacity-70">{text}</span>
  </div>;
}

function Ranked({ title, note, rows, limit = 8 }: { title: string; note?: string; rows: Array<[string, number]>; limit?: number }) {
  const top = Math.max(1, ...rows.map(r => r[1]));
  return <section>
    <h3 className={label}>{title}</h3>
    {note && <p className="text-[11px] text-[#6b6a66] mt-1">{note}</p>}
    <div className="mt-3 space-y-2">
      {rows.length ? rows.slice(0, limit).map(([k, n]) => <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3 items-center text-[12px]">
        <span className="truncate" title={k}>{k}</span><Bar value={n} max={top} text={String(n)} />
      </div>) : <p className="text-[12px] text-[#6b6a66]">—</p>}
    </div>
  </section>;
}

// Admin: where visitors came from, how they moved through the site, how long they stayed and what they pressed
// (logged by lib/visitService). Everything is computed here from the raw page views of the chosen range.
export default function AdminVisitors({ demo }: { demo?: Visit[] }) {
  const navigate = useNavigate();
  const projects = usePortfolio();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [range, setRange] = useState(7);
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [pageFilter, setPageFilter] = useState('');

  useEffect(() => onAuthChange(u => { setUser(u); setChecked(true); }), []);
  useEffect(() => { if (!demo && checked && (!user || !isAdmin(user))) navigate('/'); }, [demo, checked, user, navigate]);
  useEffect(() => { if (demo) setVisits(demo.filter(v => Date.now() - v.at.getTime() < range * 864e5)); }, [demo, range]);
  useEffect(() => {
    if (demo || !user || !isAdmin(user)) return;
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

    const now = Date.now(), span = Math.min(range, 30);
    const days = [...Array(span)].map((_, i) => day(new Date(now - (span - 1 - i) * 864e5)));
    const perDay = days.map(d => ({ d, views: visits.filter(v => day(v.at) === d).length, people: sessions.filter(s => day(s.start) === d).length }));
    const hours = [...Array(24)].map((_, h) => visits.filter(v => v.at.getHours() === h).length);
    const timed = sessions.flatMap(s => s.dur == null ? [] : [s.dur]);
    const paths = sessions.map(s => s.pages.map(p => pageName(p.path)).filter((n, i, all) => n !== all[i - 1]));
    const clicks = count(visits.filter(v => !pageFilter || v.path === pageFilter).flatMap(v => v.clicks));
    const refs = count(sessions.map(s => s.ref || 'Direct / unknown')), devices = count(sessions.map(s => s.device));
    const share = (rows: Array<[string, number]>) => rows.length ? rows[0][0] + ' ' + pct(rows[0][1] / Math.max(1, sessions.length)) : '—';
    const step = count(paths.flatMap(p => p.length > 1 ? [p[0] + ' → ' + p[1]] : []))[0];
    const longest = [...pages].filter(p => p.dur != null && p.views >= 2).sort((x, y) => (y.dur || 0) - (x.dur || 0))[0];
    const busiestDay = [...perDay].sort((x, y) => y.people - x.people)[0];
    const peakHour = hours.indexOf(Math.max(...hours));
    const longestVisit = [...sessions].filter(s => s.dur != null).sort((x, y) => (y.dur || 0) - (x.dur || 0))[0];
    const insight = {
      flow: step ? `가장 많은 흐름은 ${step[0]} (${step[1]}회), 첫 페이지만 보고 나간 방문은 ${pct(sessions.length ? sessions.filter(s => s.pages.length === 1).length / sessions.length : 0)}` : '아직 이동 기록이 없어요',
      pages: pages.length ? (pages.find(p => p.path.startsWith('/project/')) ? `가장 많이 본 프로젝트는 ${pages.find(p => p.path.startsWith('/project/'))!.name} (${pages.find(p => p.path.startsWith('/project/'))!.views}회)` : `가장 많이 본 곳은 ${pages[0].name} (${pages[0].views}회)`) + (longest ? `, 가장 오래 머문 곳은 ${longest.name} (평균 ${secs(longest.dur)})` : '') : '아직 기록이 없어요',
      clicks: clicks.length ? `가장 많이 누른 것은 ${clicks[0][0]} (${clicks[0][1]}회)` : '아직 누른 기록이 없어요',
      when: busiestDay?.people ? `가장 붐빈 날은 ${busiestDay.d.slice(5).replace('-', '/')} (${busiestDay.people}명), 주로 ${peakHour}시대에 들어와요` : '아직 기록이 없어요',
      who: refs.length ? `${share(refs)}, 기기는 ${share(devices)}` : '아직 기록이 없어요',
      visits: longestVisit ? `가장 길게 본 방문은 ${secs(longestVisit.dur)} 동안 ${longestVisit.pages.length}페이지` : '머문 시간은 확장 이후 방문부터 쌓여요',
    };
    return {
      sessions, pages, perDay, hours,
      paths, clicks, refs, devices, insight,
      kpi: {
        visitors: sessions.length, views: visits.length,
        avgTime: avg(timed), pagesPer: sessions.length ? visits.length / sessions.length : 0,
        bounce: sessions.length ? sessions.filter(s => s.pages.length === 1).length / sessions.length : 0,
      },
    };
  }, [visits, pageName, pageFilter, range]);

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

  if (!demo && (!checked || !user || !isAdmin(user))) return <div className="min-h-screen bg-[#f7f6f0]" />;
  // each chart opens with its takeaway in a sentence, then how to read it
  const Head = ({ title, insight, note }: { title: string; insight: string; note: string }) => <header className="mb-6 border-t border-[#111] pt-4">
    <h2 className={label}>{title}</h2>
    <p className="mt-2 text-[20px] leading-snug tracking-[-.01em]">{insight}</p>
    <p className="mt-1 text-[12px] text-[#6b6a66]">{note}</p>
  </header>;

  return (
    <div className="min-h-screen bg-[#f7f6f0] text-[#111]">
      <nav className="sticky top-0 z-50 bg-[#f7f6f0] border-b border-[#111]/10 px-6 md:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/admin')} className={label + ' hover:opacity-100 transition-opacity'}>← Admin</button>
          <span className="text-[11px] uppercase tracking-[0.3em] text-[#6b6a66]">Visitors</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            {RANGES.map(r => <button key={r} onClick={() => setRange(r)}
              className={'px-3 py-1 text-[11px] uppercase tracking-widest ' + (range === r ? 'border-b-2 border-[#111]' : 'text-[#6b6a66] hover:text-[#111]')}>{r}d</button>)}
          </div>
          <button onClick={exportCsv} disabled={!visits?.length} className={label + ' hover:opacity-100 disabled:opacity-10'}>CSV ↓</button>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 md:px-12 py-10 space-y-16">
        {error && <p className="text-[12px] text-red-600">방문 기록을 불러오지 못했습니다: {error}</p>}
        {!a ? <p className={label}>Loading…</p> : <>
          {/* overview */}
          <section className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              ['Visitors', String(a.kpi.visitors), '방문 수(탭 기준)'],
              ['Page views', String(a.kpi.views), '열어본 페이지 수'],
              ['Avg. time', secs(a.kpi.avgTime), '방문 한 번에 머문 시간'],
              ['Pages / visit', a.kpi.pagesPer.toFixed(1), '한 번에 본 페이지 수'],
              ['Bounce', pct(a.kpi.bounce), '한 페이지만 보고 나감'],
            ].map(([name, value, hint]) => <div key={name}>
              <p className={label}>{name}</p>
              <p className="mt-2 text-[32px] leading-none tabular-nums">{value}</p>
              <p className="mt-2 text-[11px] text-[#6b6a66]">{hint}</p>
            </div>)}
          </section>

          {/* 01 flow */}
          <section>
            <Head title="Flow · 어떻게 이동했나" insight={a.insight.flow} note="왼쪽부터 첫 페이지 → 두 번째 → … · 띠 두께 = 방문 수 · 회색은 거기서 나감 · 페이지에 마우스를 올리면 그 흐름만 보여요" />
            <FlowChart paths={a.paths} />
          </section>

          {/* 02 pages */}
          <section>
            <Head title="Pages · 어디에 머물렀나" insight={a.insight.pages} note="페이지마다 조회수 · 평균 머문 시간 · 평균 스크롤 깊이 · 행을 누르면 아래 '무엇을 눌렀나'가 그 페이지로 걸러져요" />
            <div className="grid grid-cols-[minmax(0,1.1fr)_repeat(3,minmax(0,1fr))] gap-x-6 text-[11px] uppercase tracking-widest text-[#6b6a66] pb-2">
              <span>Page</span><span>Views</span><span>Avg. time</span><span>Scroll depth</span>
            </div>
            {(() => {
              const maxV = Math.max(1, ...a.pages.map(p => p.views)), maxT = Math.max(1, ...a.pages.map(p => p.dur || 0));
              return a.pages.map(p => <button key={p.path} onClick={() => setPageFilter(pageFilter === p.path ? '' : p.path)}
                className={'w-full grid grid-cols-[minmax(0,1.1fr)_repeat(3,minmax(0,1fr))] gap-x-6 items-center py-[7px] text-left text-[12px] border-t border-[#111]/[.07] ' + (pageFilter === p.path ? 'bg-[#111]/[.05]' : 'hover:bg-[#111]/[.03]')}>
                <span className="truncate">{p.name}</span>
                <Bar value={p.views} max={maxV} text={String(p.views)} />
                <Bar value={p.dur || 0} max={maxT} text={secs(p.dur)} />
                <Bar value={p.depth || 0} max={100} text={p.depth == null ? '—' : Math.round(p.depth) + '%'} />
              </button>);
            })()}
          </section>

          {/* 03 presses */}
          <section>
            <Head title={'Pressed · 무엇을 눌렀나' + (pageFilter ? ' · ' + pageName(pageFilter) : '')} insight={a.insight.clicks} note="카드·링크·메뉴, 소리 켜고 본 영상, 만져본 Motion" />
            <div className="max-w-3xl"><Ranked title="" rows={a.clicks} limit={15} /></div>
          </section>

          {/* 04 when */}
          <section>
            <Head title="When · 언제 왔나" insight={a.insight.when} note="막대 = 페이지뷰 · 숫자 = 방문 수" />
            <div className="grid md:grid-cols-[2fr_1fr] gap-10">
              <div className="flex items-end gap-[3px] h-40">
                {a.perDay.map(p => {
                  const peak = Math.max(1, ...a.perDay.map(q => q.views));
                  return <div key={p.d} className="group flex-1 flex flex-col items-center justify-end h-full gap-1" title={p.d + ' — 방문 ' + p.people + ' · 페이지뷰 ' + p.views}>
                    <span className="text-[11px] tabular-nums text-[#6b6a66]">{p.people || ''}</span>
                    <div className="w-full rounded-t-[3px] bg-[#111] group-hover:bg-[#111]/70" style={{ height: (p.views / peak * 100) + '%', minHeight: p.views ? 2 : 0 }} />
                    <span className="text-[11px] tabular-nums text-[#6b6a66] h-[14px]">{a.perDay.length <= 10 || Number(p.d.slice(8)) % 5 === 0 ? Number(p.d.slice(8)) : ''}</span>
                  </div>;
                })}
              </div>
              <div>
                <div className="flex items-end gap-[2px] h-40">
                  {a.hours.map((n, h) => {
                    const peak = Math.max(1, ...a.hours);
                    return <div key={h} className="flex-1 flex flex-col justify-end h-full" title={h + '시 — 페이지뷰 ' + n}>
                      <div className="w-full rounded-t-[2px] bg-[#111]/70" style={{ height: (n / peak * 100) + '%', minHeight: n ? 2 : 0 }} />
                    </div>;
                  })}
                </div>
                <div className="flex justify-between text-[11px] tabular-nums text-[#6b6a66] mt-1"><span>0시</span><span>6</span><span>12</span><span>18</span><span>23</span></div>
              </div>
            </div>
          </section>

          {/* 05 who */}
          <section>
            <Head title="Source · 어디서 왔나" insight={a.insight.who} note="방문 기준" />
            <div className="grid md:grid-cols-2 gap-10">
              <Ranked title="Came from" rows={a.refs} />
              <Ranked title="Device · browser" rows={a.devices} />
            </div>
          </section>

          {/* 06 each visit */}
          <section>
            <Head title="Visits · 방문 한 건씩" insight={a.insight.visits} note="막대 길이 = 머문 시간(가장 긴 방문 기준, 최대 10분) · 칸 = 본 페이지 · 점 = 누른 횟수 · 누르면 자세히" />
            <ul className="space-y-[6px]">
              {a.sessions.slice(0, 80).map((s, _, shown) => {
                // one time scale for every row (the longest visit, at most 10 minutes, fills the width)
                const length = (x: Session) => x.pages.reduce((t, p) => t + (p.dur ?? 20), 0);
                const total = Math.max(1, length(s)), scale = Math.min(600, Math.max(...shown.map(length)));
                return <li key={s.sid}>
                  <button onClick={() => setOpen(open === s.sid ? null : s.sid)} className="w-full grid grid-cols-[84px_minmax(0,1fr)_120px] gap-3 items-center text-left text-[11px] hover:opacity-80">
                    <span className="tabular-nums text-[#6b6a66]">{time(s.start)}</span>
                    <span className="flex gap-[2px] min-w-0" style={{ width: Math.max(8, Math.min(1, total / scale) * 100) + '%' }}>
                      {s.pages.map((p, i) => <span key={i} className="relative min-w-[22px] h-[22px] rounded-[3px] bg-[#111] text-[#f7f6f0] px-1.5 flex items-center overflow-hidden"
                        style={{ flex: `${(p.dur ?? 20) / total} 1 0` }} title={pageName(p.path) + ' · ' + secs(p.dur) + (p.depth != null ? ' · scroll ' + p.depth + '%' : '')}>
                        <span className="truncate text-[11px]">{pageName(p.path)}</span>
                        {p.clicks.length > 0 && <span className="absolute right-1 bottom-[2px] flex gap-[2px]">{p.clicks.slice(0, 5).map((_, j) => <i key={j} className="block w-[3px] h-[3px] rounded-full bg-[#f7f6f0]/70" />)}</span>}
                      </span>)}
                    </span>
                    <span className="truncate text-[#6b6a66] text-right">{secs(s.dur)} · {s.device.split(' · ')[0]}</span>
                  </button>
                  {open === s.sid && <ol className="ml-[96px] mt-2 mb-3 space-y-1 text-[12px]">
                    <li className="text-[#6b6a66]">{s.device}{s.ref ? ' · from ' + s.ref : ''}</li>
                    {s.pages.map((p, i) => <li key={i} className="grid grid-cols-[60px_1fr] gap-3">
                      <span className="tabular-nums text-[#6b6a66]">{pad(p.at.getHours())}:{pad(p.at.getMinutes())}:{pad(p.at.getSeconds())}</span>
                      <span><b className="font-medium">{pageName(p.path)}</b><span className="text-[#6b6a66]"> · {secs(p.dur)}{p.depth != null ? ' · scroll ' + p.depth + '%' : ''}</span>
                        {p.clicks.length > 0 && <span className="block opacity-60">눌렀음: {p.clicks.join(', ')}</span>}</span>
                    </li>)}
                  </ol>}
                </li>;
              })}
            </ul>
            {!a.sessions.length && !error && <p className="text-[12px] text-[#6b6a66] mt-3">아직 기록된 방문이 없습니다.</p>}
          </section>
        </>}
      </main>
    </div>
  );
}
