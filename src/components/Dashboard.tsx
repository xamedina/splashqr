'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CodeRow } from '@/lib/types';
import type { Entitlements } from '@/lib/plans';
import { CODE_TYPES } from '@/lib/defaults';
import { drawQR } from '@/lib/qr';

export interface ScanLite { code_id: string; scanned_at: string; device: string | null; city: string | null; region: string | null; visitor: string | null }
type Code = CodeRow & { frozen: boolean };

const DAY = 86400000;
const fmt = (n: number) => n.toLocaleString('en-US');

function dailySeries(scans: ScanLite[], days = 30) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = today.getTime() - (days - 1) * DAY;
  const out = Array(days).fill(0) as number[];
  for (const s of scans) {
    const t = new Date(s.scanned_at); t.setHours(0, 0, 0, 0);
    const i = Math.round((t.getTime() - start) / DAY);
    if (i >= 0 && i < days) out[i]++;
  }
  return { out, start };
}

function niceMax(v: number) { if (v <= 4) return 4; const p = Math.pow(10, Math.floor(Math.log10(v))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p; return 10 * p; }

function Chart({ data, start }: { data: number[]; start: number }) {
  const W = 700, H = 240, L = 40, R = 8, T = 12, B = 30, iw = W - L - R, ih = H - T - B, bw = iw / data.length;
  const mx = niceMax(Math.max(1, ...data));
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scans per day for the last 30 days">
      {[0, 1, 2, 3, 4].map(i => { const y = T + ih - (ih * i) / 4; return (
        <g key={i}><line x1={L} x2={W - R} y1={y} y2={y} stroke="var(--line)" /><text x={L - 8} y={y + 4} textAnchor="end" fill="var(--muted)" fontSize="13" fontFamily="JetBrains Mono, monospace">{Math.round((mx * i) / 4)}</text></g>); })}
      {data.map((v, i) => {
        const h = (ih * v) / mx, x = L + i * bw + bw * 0.16;
        const label = i % 7 === 1 || i === data.length - 1 ? new Date(start + i * DAY).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
        return (
          <g key={i}>
            <rect x={x} y={T + ih - h} width={bw * 0.68} height={h} rx={2.5} fill="var(--accent)" opacity={i === data.length - 1 ? 1 : 0.72}><title>{v} scans</title></rect>
            {label && <text x={L + i * bw + bw / 2} y={H - 10} textAnchor="middle" fill="var(--muted)" fontSize="13" fontFamily="Inter, sans-serif">{label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function Spark({ s }: { s: number[] }) {
  const w = 110, h = 30, max = Math.max(...s), min = Math.min(...s);
  const pts = s.map((v, i) => [i * (w / (s.length - 1)), h - 3 - ((v - min) / (max - min || 1)) * (h - 6)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`${d} L${w} ${h} L0 ${h}Z`} fill="var(--accent-soft)" /><path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill="var(--accent)" />
    </svg>
  );
}

function Thumb({ code, siteUrl }: { code: Code; siteUrl: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) drawQR(ref.current, `${siteUrl}/r/${code.slug}`, { ...code.design.qr, frame: 'none', logo: false }, 44, { bare: true }); }, [code, siteUrl]);
  return <canvas ref={ref} width={44} height={44} />;
}

function Bars({ rows }: { rows: [string, number][] }) {
  if (!rows.length) return <p className="hint">No scans yet.</p>;
  return <div className="bars">{rows.map(([k, v]) => (
    <div className="bar-row" key={k}><div className="top-l"><span>{k}</span><span className="muted">{v}%</span></div><div className="track"><i style={{ width: `${v}%` }} /></div></div>
  ))}</div>;
}

function share(list: (string | null)[], top = 5): [string, number][] {
  const m = new Map<string, number>(); list.forEach(v => m.set(v || 'Unknown', (m.get(v || 'Unknown') || 0) + 1));
  const total = list.length || 1;
  const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, top).map(([k, v]) => [k, Math.round((v / total) * 100)] as [string, number]);
  const rest = sorted.slice(top).reduce((a, [, v]) => a + v, 0);
  if (rest) head.push(['Other', Math.round((rest / total) * 100)]);
  return head;
}

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24); return d === 1 ? 'Yesterday' : `${d} days ago`;
}

export function Dashboard({ codes, scans, ent, siteUrl, upgraded }: { codes: Code[]; scans: ScanLite[]; ent: Entitlements; siteUrl: string; upgraded: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const cutoff = Date.now() - 30 * DAY;
  const recent = useMemo(() => scans.filter(s => new Date(s.scanned_at).getTime() >= cutoff), [scans, cutoff]);
  const prevCount = scans.length - recent.length;
  const byCode = useMemo(() => {
    const m = new Map<string, ScanLite[]>(); recent.forEach(s => { const a = m.get(s.code_id) || []; a.push(s); m.set(s.code_id, a); }); return m;
  }, [recent]);

  const sel = codes.find(c => c.id === selected) || null;
  const focus = sel ? (byCode.get(sel.id) || []) : recent;
  const series = dailySeries(focus);
  const unique = new Set(recent.map(s => s.visitor)).size;
  const change = prevCount ? Math.round(((recent.length - prevCount) / prevCount) * 100) : null;
  const top = [...byCode.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const topCode = top ? codes.find(c => c.id === top[0]) : null;

  if (!codes.length) {
    return (
      <div className="wrap">
        <div className="page-head"><div><h1>My codes</h1><p className="muted">Your QR codes and their scans show up here.</p></div></div>
        <div className="panel empty">
          <h2>Make your first QR code</h2>
          <p className="muted">Pick what it opens, style it, and download it. Dynamic codes count every scan.</p>
          <Link className="btn primary" href="/codes/new">Create a QR code</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="page-head">
        <div><h1>My codes</h1><p className="muted">Scans from the last 30 days. Click a code to see its numbers.</p></div>
        <Link className="btn primary" href="/codes/new">+ New code</Link>
      </div>
      {upgraded && <div className="note info" style={{ marginBottom: 12 }}><span><b>You’re upgraded.</b> Thanks for supporting SplashQR. Your new features are on.</span></div>}
      <div className="tiles">
        <div className="tile"><span className="k">Scans</span><span className="v">{fmt(recent.length)}</span><span className="d">{change === null ? 'Last 30 days' : <><b style={change < 0 ? { color: 'var(--warn)' } : undefined}>{change >= 0 ? '+' : ''}{change}%</b> vs previous 30 days</>}</span></div>
        <div className="tile"><span className="k">Unique people</span><span className="v">{ent.fullStats ? fmt(unique) : '—'}</span><span className="d">{ent.fullStats ? 'Counted once per day' : <Link href="/pricing">Upgrade to see</Link>}</span></div>
        <div className="tile"><span className="k">Codes</span><span className="v">{codes.length}</span><span className="d">{codes.filter(c => c.mode === 'dynamic').length} dynamic · {codes.filter(c => c.mode === 'static').length} static</span></div>
        <div className="tile"><span className="k">Top code</span><span className="v" style={{ fontSize: 20, paddingBlock: 6 }}>{topCode?.name ?? '—'}</span><span className="d">{top ? `${fmt(top[1].length)} scans` : 'No scans yet'}</span></div>
      </div>

      {ent.fullStats ? (
        <div className="grid2">
          <div className="panel">
            <div className="panel-head"><h2>{sel ? sel.name : 'Scans per day, all codes'}</h2><span className="muted" style={{ fontSize: 13 }}>{sel ? (sel.mode === 'static' ? 'Static code' : `${fmt(focus.length)} scans · click again for all codes`) : 'Last 30 days'}</span></div>
            {sel?.mode === 'static' ? <p className="hint" style={{ padding: '40px 0', textAlign: 'center' }}>Static codes can’t be tracked. Make a dynamic code to see scans.</p> : <Chart data={series.out} start={series.start} />}
          </div>
          <div className="panel">
            <div className="panel-head"><h2>Where scans come from</h2></div>
            <p className="lbl">Device</p><Bars rows={share(focus.map(s => s.device), 3)} />
            <p className="lbl" style={{ marginTop: 18 }}>Top cities</p><Bars rows={share(focus.map(s => s.city ? `${s.city}${s.region ? ', ' + s.region : ''}` : null), 4)} />
          </div>
        </div>
      ) : (
        <div className="note info" style={{ marginTop: 12 }}><span><b>{fmt(recent.length)} scans in the last 30 days.</b> Upgrade to see them by day, device and city. <Link href="/pricing">See plans</Link></span></div>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Type</th><th>Scans (30 days)</th><th>Trend</th><th>Last scan</th><th /></tr></thead>
          <tbody>
            {codes.map(c => {
              const list = byCode.get(c.id) || [];
              return (
                <tr key={c.id} aria-selected={selected === c.id} tabIndex={0} onClick={() => setSelected(s => (s === c.id ? null : c.id))}
                  onKeyDown={e => { if (e.key === 'Enter') setSelected(s => (s === c.id ? null : c.id)); }}>
                  <td><div className="code-name"><Thumb code={c} siteUrl={siteUrl} /><div><b>{c.name}</b><small className="mono">{c.mode === 'dynamic' ? `${siteUrl.replace(/^https?:\/\//, '')}/r/${c.slug}` : 'Fixed destination'}</small></div></div></td>
                  <td><span className={`chip ${c.mode === 'dynamic' ? 'dyn' : 'sta'}`}>{c.mode === 'dynamic' ? 'Dynamic' : 'Static'}</span>
                    {c.frozen && <span className="chip sta" style={{ marginLeft: 6 }}>Frozen</span>}
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{CODE_TYPES.find(t => t.v === c.kind)?.name}</div></td>
                  <td className="num">{c.mode === 'static' ? <span className="muted" style={{ fontWeight: 400 }}>Not tracked</span> : fmt(list.length)}</td>
                  <td>{c.mode === 'dynamic' && list.length ? <Spark s={dailySeries(list).out} /> : <span className="muted">—</span>}</td>
                  <td className="muted">{list[0] ? ago(list[0].scanned_at) : '—'}</td>
                  <td><Link className="btn small" href={`/codes/${c.id}`} onClick={e => e.stopPropagation()}>{c.frozen ? 'View' : 'Edit'}</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ height: 64 }} />
    </div>
  );
}
