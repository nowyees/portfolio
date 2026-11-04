import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { User } from 'firebase/auth';
import { onAuthChange, isAdmin } from '../../lib/authService';
import { loadVisits, markAdminBrowser, type Visit } from '../../lib/visitService';
import { usePortfolio } from '../../lib/usePortfolio';

const RANGES = [7, 30, 90];
const day = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const time = (d: Date) => (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
const count = <T,>(list: T[], key: (item: T) => string) => {
  const m = new Map<string, number>();
  list.forEach(item => m.set(key(item), (m.get(key(item)) || 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

// Admin: who visited, when, and what they looked at (from lib/visitService).
export default function AdminVisitors() {
  const navigate = useNavigate();
  const projects = usePortfolio();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [range, setRange] = useState(30);
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [error, setError] = useState('');

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
    return (path: string) => titles.get(path) || (path === '/' ? 'Space (home)' : path);
  }, [projects]);

  const stats = useMemo(() => {
    if (!visits) return null;
    const now = Date.now(), within = (h: number) => visits.filter(v => now - v.at.getTime() < h * 36e5);
    const people = (list: Visit[]) => new Set(list.map(v => v.sid)).size;
    const days = [...Array(14)].map((_, i) => day(new Date(now - (13 - i) * 864e5)));
    const perDay = days.map(d => {
      const list = visits.filter(v => day(v.at) === d);
      return { d, views: list.length, people: people(list) };
    });
    return {
      today: { views: within(24).length, people: people(within(24)) },
      week: { views: within(24 * 7).length, people: people(within(24 * 7)) },
      all: { views: visits.length, people: people(visits) },
      perDay, peak: Math.max(1, ...perDay.map(p => p.views)),
      pages: count(visits, v => pageName(v.path)).slice(0, 12),
      refs: count(visits.filter(v => v.first), v => v.ref || 'Direct / unknown').slice(0, 8),
      devices: count(visits.filter(v => v.first), v => v.device + ' · ' + v.browser).slice(0, 8),
    };
  }, [visits, pageName]);

  if (!checked || !user || !isAdmin(user)) return <div className="min-h-screen bg-[#f7f6f0]" />;
  const label = 'text-[10px] uppercase tracking-widest opacity-40';
  const Table = ({ title, rows }: { title: string; rows: Array<[string, number]> }) => (
    <section>
      <h3 className={label + ' mb-3'}>{title}</h3>
      {rows.length ? <ul className="text-[12px] divide-y divide-[#111]/10 border-t border-[#111]/10">
        {rows.map(([k, n]) => <li key={k} className="flex justify-between py-2 gap-4"><span className="truncate">{k}</span><span className="tabular-nums opacity-60">{n}</span></li>)}
      </ul> : <p className="text-[12px] opacity-40">—</p>}
    </section>
  );

  return (
    <div className="min-h-screen bg-[#f7f6f0] text-[#111]">
      <nav className="sticky top-0 z-50 bg-[#f7f6f0] border-b border-[#111]/10 px-6 md:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/admin')} className={label + ' hover:opacity-100 transition-opacity'}>← Admin</button>
          <span className="text-[10px] uppercase tracking-[0.3em] opacity-40">Visitors</span>
        </div>
        <div className="flex gap-1">
          {RANGES.map(r => <button key={r} onClick={() => setRange(r)}
            className={'px-3 py-1 text-[10px] uppercase tracking-widest ' + (range === r ? 'border-b-2 border-[#111]' : 'opacity-30 hover:opacity-60')}>{r}d</button>)}
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 md:px-12 py-10 space-y-12">
        {error && <p className="text-[12px] text-red-600">방문 기록을 불러오지 못했습니다: {error}<br />Firestore 규칙에서 visits 읽기 권한을 확인해 주세요.</p>}
        {!stats ? <p className={label}>Loading…</p> : <>
          <section className="grid grid-cols-3 gap-6">
            {[['Today', stats.today], ['Last 7 days', stats.week], ['Last ' + range + ' days', stats.all]].map(([name, s]) => {
              const v = s as { views: number; people: number };
              return <div key={name as string} className="border-t border-[#111] pt-3">
                <p className={label}>{name as string}</p>
                <p className="mt-2 text-[28px] leading-none tabular-nums">{v.people}<span className="text-[12px] opacity-50 ml-2">visitors</span></p>
                <p className="mt-1 text-[12px] opacity-50 tabular-nums">{v.views} page views</p>
              </div>;
            })}
          </section>
          <section>
            <h3 className={label + ' mb-4'}>Last 14 days</h3>
            <div className="flex items-end gap-2 h-40">
              {stats.perDay.map(p => <div key={p.d} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={p.d + ' — ' + p.people + ' visitors, ' + p.views + ' views'}>
                <span className="text-[9px] tabular-nums opacity-50">{p.people || ''}</span>
                <div className="w-full bg-[#111]" style={{ height: (p.views / stats.peak * 100) + '%', minHeight: p.views ? 2 : 0 }} />
                <span className="text-[9px] tabular-nums opacity-40">{p.d.slice(5)}</span>
              </div>)}
            </div>
          </section>
          <div className="grid md:grid-cols-3 gap-10">
            <Table title="Pages" rows={stats.pages} />
            <Table title="Came from" rows={stats.refs} />
            <Table title="Device · browser" rows={stats.devices} />
          </div>
          <section>
            <h3 className={label + ' mb-3'}>Recent visits</h3>
            <table className="w-full text-[12px]">
              <thead><tr className="text-left opacity-40 text-[10px] uppercase tracking-widest"><th className="py-2 font-normal">Time</th><th className="font-normal">Page</th><th className="font-normal">Visitor</th><th className="font-normal">Device</th><th className="font-normal">From</th></tr></thead>
              <tbody className="divide-y divide-[#111]/10 border-t border-[#111]/10">
                {visits!.slice(0, 80).map((v, i) => <tr key={i}>
                  <td className="py-2 tabular-nums opacity-60 whitespace-nowrap pr-4">{time(v.at)}</td>
                  <td className="pr-4">{pageName(v.path)}</td>
                  <td className="pr-4 font-mono text-[10px] opacity-50">{v.sid.slice(0, 6)}</td>
                  <td className="pr-4 opacity-60 whitespace-nowrap">{v.device} · {v.browser}</td>
                  <td className="opacity-60">{v.ref}</td>
                </tr>)}
              </tbody>
            </table>
            {!visits!.length && !error && <p className="text-[12px] opacity-40 mt-3">아직 기록된 방문이 없습니다.</p>}
          </section>
        </>}
      </main>
    </div>
  );
}
