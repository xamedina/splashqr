'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { CodeDesign, CodeKind, CodeMode, LinkKind, SplashAnim } from '@/lib/types';
import { CODE_TYPES, LINK_KINDS, THEMES, isHex, monogram } from '@/lib/defaults';
import { drawQR, qrSvg } from '@/lib/qr';
import { encodedUrl, splashAllowed } from '@/lib/site';
import type { Entitlements } from '@/lib/plans';
import { createClient } from '@/lib/supabase/client';
import { saveCode, deleteCode } from '@/app/codes/actions';
import { PublicPage } from './PublicPage';
import { Icon } from './Icon';

export interface BuilderProps {
  userId: string;
  codeId: string | null;
  slug: string;
  initial: { name: string; kind: CodeKind; mode: CodeMode; design: CodeDesign };
  ent: Entitlements;
  frozen: boolean;
}

type Tab = 'qr' | 'phone';

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="f" htmlFor={id}><span>{label}</span>
      <div className="color">
        <input type="text" id={id} value={text} onChange={e => { setText(e.target.value); if (isHex(e.target.value)) onChange(e.target.value); }} />
        <input type="color" id={id + '-c'} value={isHex(value) ? value : '#000000'} onChange={e => onChange(e.target.value)} aria-label={`Pick ${label.toLowerCase()} color`} />
      </div>
    </label>
  );
}

function Seg<T extends string>({ value, options, onChange, locked }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; locked?: (v: T) => boolean }) {
  return (
    <div className="seg">
      {options.map(o => {
        const isLocked = locked?.(o.v) ?? false;
        return (
          <button key={o.v} type="button" aria-pressed={value === o.v} disabled={isLocked} title={isLocked ? 'Included in Pro' : undefined}
            onClick={() => onChange(o.v)}>{o.label}{isLocked && <span className="pro-tag">Pro</span>}</button>
        );
      })}
    </div>
  );
}

export function Builder({ userId, codeId, slug, initial, ent, frozen }: BuilderProps) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [kind, setKind] = useState<CodeKind>(initial.kind);
  const [mode, setMode] = useState<CodeMode>(initial.mode);
  const [d, setD] = useState<CodeDesign>(initial.design);
  const [tab, setTab] = useState<Tab>('phone');
  const [replay, setReplay] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoImg = useRef<HTMLImageElement | null>(null);
  const [logoTick, setLogoTick] = useState(0);
  const isNew = !codeId;

  const say = useCallback((msg: string) => { setToast(msg); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2800); return () => clearTimeout(t); }, [toast]);

  const setContent = (patch: Partial<CodeDesign['content']>) => setD(x => ({ ...x, content: { ...x.content, ...patch } }));
  const setSplash = (patch: Partial<CodeDesign['splash']>) => { setD(x => ({ ...x, splash: { ...x.splash, ...patch } })); setReplay(r => r + 1); };
  const setPage = (patch: Partial<CodeDesign['page']>) => setD(x => ({ ...x, page: { ...x.page, ...patch } }));
  const setQr = (patch: Partial<CodeDesign['qr']>) => setD(x => ({ ...x, qr: { ...x.qr, ...patch } }));

  const encoded = useMemo(() => encodedUrl(slug, kind, mode, d), [slug, kind, mode, d]);
  const canSplash = splashAllowed(kind, mode) && ent.customSplash;
  const showSplash = canSplash && d.splash.on;
  const qrForPlan = useMemo(() => ({ ...d.qr, logo: d.qr.logo && ent.logoInCode }), [d.qr, ent.logoInCode]);

  // Load the logo once so it can be drawn into the QR code.
  useEffect(() => {
    if (!d.content.logoUrl) { logoImg.current = null; setLogoTick(t => t + 1); return; }
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { logoImg.current = img; setLogoTick(t => t + 1); };
    img.src = d.content.logoUrl;
  }, [d.content.logoUrl]);

  useEffect(() => {
    if (!canvasRef.current || tab !== 'qr') return;
    drawQR(canvasRef.current, encoded, qrForPlan, 260, { logoImg: logoImg.current, monogram: monogram(d.content.title) });
  }, [encoded, qrForPlan, tab, logoTick, d.content.title]);

  const onUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { say('That image is over 2 MB. Try a smaller file.'); return; }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('logos').upload(path, file, { cacheControl: '31536000', upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('logos').getPublicUrl(path);
      setContent({ logoUrl: data.publicUrl });
    } catch {
      say('The logo didn’t upload. Check your connection and try again.');
    } finally { setUploading(false); }
  };

  const onSave = async () => {
    setSaving(true);
    const res = await saveCode({ id: codeId, slug, name, kind, mode, design: d });
    setSaving(false);
    if (!res.ok) { say(res.error); return; }
    say(isNew ? 'Saved. Your code is ready to download.' : 'Saved. Your printed code now shows the changes.');
    if (isNew) router.replace(`/codes/${res.id}`); else router.refresh();
  };

  const onDelete = async () => {
    if (!codeId) return;
    const res = await deleteCode(codeId);
    if (!res.ok) { say(res.error); return; }
    router.push('/dashboard');
  };

  const download = async (type: 'png' | 'svg') => {
    const file = (name || 'splashqr-code').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let href: string;
    if (type === 'png') {
      const c = document.createElement('canvas');
      drawQR(c, encoded, qrForPlan, 1024, { logoImg: logoImg.current, monogram: monogram(d.content.title), scale: 1 });
      try { href = c.toDataURL('image/png'); } catch { say('Couldn’t export the logo inside the code. Try SVG instead.'); return; }
    } else {
      let logoData: string | null = null;
      if (qrForPlan.logo && d.content.logoUrl) {
        try {
          const blob = await (await fetch(d.content.logoUrl)).blob();
          logoData = await new Promise<string>(ok => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.readAsDataURL(blob); });
        } catch { /* falls back to the monogram */ }
      }
      href = URL.createObjectURL(new Blob([qrSvg(encoded, qrForPlan, 1024, logoData, monogram(d.content.title))], { type: 'image/svg+xml' }));
    }
    const a = document.createElement('a'); a.href = href; a.download = `${file}.${type}`; a.click();
    if (type === 'svg') setTimeout(() => URL.revokeObjectURL(href), 2000);
  };

  const linkCount = d.content.links.length;
  const typeName = CODE_TYPES.find(t => t.v === kind)!.name;
  const animName: Record<SplashAnim, string> = { pulse: 'Pulse', rise: 'Slide up', spin: 'Spinner', bar: 'Progress bar' };

  const focusTab = (t: Tab) => () => setTab(t);

  return (
    <div className="wrap">
      <div className="create-head">
        <div>
          <h1>{isNew ? 'Create a QR code' : 'Edit QR code'}</h1>
          <p className="muted">Every change shows up in the preview right away.</p>
        </div>
        <div className="name-row">
          <label className="f" htmlFor="code-name"><span>Code name (only you see this)</span>
            <input type="text" id="code-name" value={name} onChange={e => setName(e.target.value)} />
          </label>
          <button className="btn primary" type="button" onClick={onSave} disabled={saving || frozen}>{saving ? 'Saving…' : 'Save code'}</button>
        </div>
      </div>

      {frozen && (
        <div className="note warn" style={{ marginTop: 12 }}>
          <span><b>This code is frozen.</b> It still works and sends people to the same place, but your plan can’t edit it. <Link href="/pricing">Upgrade</Link> to make changes.</span>
        </div>
      )}

      <div className="builder">
        <form id="editor" autoComplete="off" onSubmit={e => e.preventDefault()}>
          <fieldset disabled={frozen} style={{ border: 0, padding: 0, margin: 0, display: 'contents' }}>
            <details className="sec" open onFocus={focusTab('phone')}>
              <summary><span className="step">1</span>What should it open? <span className="sum-note">{typeName} · {mode === 'dynamic' ? 'Dynamic' : 'Static'}</span></summary>
              <div className="sec-body">
                <div className="cards">
                  {CODE_TYPES.map(t => (
                    <button key={t.v} type="button" className="card-opt" aria-pressed={kind === t.v} onClick={() => { setKind(t.v); setTab('phone'); setReplay(r => r + 1); }}>
                      <span className="ic"><Icon name={t.v} /></span><b>{t.name}</b><small>{t.desc}</small>
                    </button>
                  ))}
                </div>
                <div>
                  <p className="lbl">Code type</p>
                  <div className="cards">
                    <button type="button" className="card-opt" aria-pressed={mode === 'dynamic'} disabled={!isNew} onClick={() => setMode('dynamic')}>
                      <span className="ic"><Icon name="dyn" /></span><b>Dynamic</b><small>Change where it goes anytime, without reprinting. Counts every scan.</small>
                    </button>
                    <button type="button" className="card-opt" aria-pressed={mode === 'static'} disabled={!isNew} onClick={() => setMode('static')}>
                      <span className="ic"><Icon name="sta" /></span><b>Static</b><small>Free forever. The destination is locked into the code and scans aren’t counted.</small>
                    </button>
                  </div>
                </div>
                {!isNew && <p className="hint">The code type can’t change after saving, because it’s part of the printed code. Make a new code to switch.</p>}
                {mode === 'static' && kind !== 'links'
                  ? <div className="note warn"><span><b>Static codes open the destination directly,</b> so they can’t show a loading screen. Pick Dynamic or Links page to get one.</span></div>
                  : mode === 'static'
                    ? <div className="note info"><span><b>Static links page:</b> you can still edit the page, but the code itself is fixed and scans aren’t counted.</span></div>
                    : <div className="note info"><span>The code points to a short link we control, so you can change the destination later and see scan stats in <b>My codes</b>.</span></div>}
              </div>
            </details>

            <details className="sec" open onFocus={focusTab('phone')}>
              <summary><span className="step">2</span>Content <span className="sum-note">{kind === 'links' ? `${linkCount} links` : ''}</span></summary>
              <div className="sec-body">
                {kind === 'links' ? (
                  <>
                    <div className="logo-row">
                      <div className="logo-thumb">
                        {d.content.logoUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={d.content.logoUrl} alt="" />
                          : <div className="monogram" style={{ width: 44, height: 44, background: d.page.primary, fontSize: 18 }}>{monogram(d.content.title)}</div>}
                      </div>
                      <label className="btn small file-btn" htmlFor="logo-file">{uploading ? 'Uploading…' : 'Upload logo'}
                        <input type="file" id="logo-file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
                      </label>
                      {d.content.logoUrl && <button type="button" className="btn small ghost" onClick={() => setContent({ logoUrl: null })}>Remove</button>}
                      <span className="hint">PNG or SVG, square works best. Up to 2 MB.</span>
                    </div>
                    <div className="row2">
                      <label className="f" htmlFor="pg-title"><span>Page title</span><input type="text" id="pg-title" value={d.content.title} onChange={e => setContent({ title: e.target.value })} /></label>
                      <label className="f" htmlFor="pg-tag"><span>Banner text</span><input type="text" id="pg-tag" value={d.content.tagline} onChange={e => setContent({ tagline: e.target.value })} /></label>
                    </div>
                    <div>
                      <p className="lbl">Links ({linkCount})</p>
                      <div className="links">
                        {d.content.links.map((l, i) => (
                          <div className="link-item" key={i}>
                            <select id={`li-kind-${i}`} aria-label="Link type" value={l.kind} onChange={e => {
                              const k = e.target.value as LinkKind;
                              const links = [...d.content.links];
                              const autoLabel = !l.label || Object.values(LINK_KINDS).some(x => x.name === l.label);
                              links[i] = { ...l, kind: k, label: autoLabel ? LINK_KINDS[k].name : l.label };
                              setContent({ links });
                            }}>
                              {Object.entries(LINK_KINDS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
                            </select>
                            <input className="li-label" type="text" id={`li-label-${i}`} aria-label="Button text" placeholder="Button text" value={l.label}
                              onChange={e => { const links = [...d.content.links]; links[i] = { ...l, label: e.target.value }; setContent({ links }); }} />
                            <input className="li-value" type="text" id={`li-value-${i}`} aria-label="Link" placeholder={LINK_KINDS[l.kind].placeholder} value={l.value}
                              onChange={e => { const links = [...d.content.links]; links[i] = { ...l, value: e.target.value }; setContent({ links }); }} />
                            <button type="button" className="icon-btn" aria-label={`Remove ${l.label}`} onClick={() => setContent({ links: d.content.links.filter((_, j) => j !== i) })}><Icon name="trash" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div><button type="button" className="btn small" onClick={() => setContent({ links: [...d.content.links, { kind: 'web', label: 'Website', value: '' }] })}>+ Add link</button></div>
                  </>
                ) : (
                  <>
                    {kind === 'web' && <label className="f" htmlFor="c-url"><span>Website address</span><input type="url" id="c-url" value={d.content.url} onChange={e => setContent({ url: e.target.value })} /></label>}
                    {kind === 'phone' && <label className="f" htmlFor="c-phone"><span>Phone number</span><input type="tel" id="c-phone" value={d.content.phone} onChange={e => setContent({ phone: e.target.value })} /></label>}
                    {kind === 'email' && <label className="f" htmlFor="c-email"><span>Email address</span><input type="email" id="c-email" value={d.content.email} onChange={e => setContent({ email: e.target.value })} /></label>}
                    {kind !== 'web' && <label className="f" htmlFor="c-title"><span>Name shown on the page</span><input type="text" id="c-title" value={d.content.title} onChange={e => setContent({ title: e.target.value })} /></label>}
                    <p className="hint">{mode === 'dynamic' ? 'You can change this later. The printed code keeps working.' : 'This gets locked into the code. To change it later you would need to print a new code.'}</p>
                  </>
                )}
              </div>
            </details>

            <details className="sec" onToggle={e => { if ((e.target as HTMLDetailsElement).open) { setTab('phone'); setReplay(r => r + 1); } }} onFocus={focusTab('phone')}>
              <summary><span className="step">3</span>Loading screen <span className="sum-note">{!splashAllowed(kind, mode) ? 'Not available' : !ent.customSplash ? 'Starter and Pro' : d.splash.on ? `${d.splash.secs}s · ${animName[d.splash.anim]}` : 'Off'}</span></summary>
              <div className="sec-body">
                {!splashAllowed(kind, mode) ? (
                  <div className="note warn"><span>Loading screens need a <b>Dynamic</b> code or a <b>Links page</b>.</span></div>
                ) : !ent.customSplash ? (
                  <div className="note info"><span><b>Loading screens come with Starter and Pro.</b> Show your logo, colors and a welcome message before your page opens. <Link href="/pricing">See plans</Link></span></div>
                ) : (
                  <>
                    <label className="toggle" htmlFor="sp-on"><input type="checkbox" id="sp-on" checked={d.splash.on} onChange={e => setSplash({ on: e.target.checked })} /> Show a loading screen first</label>
                    <label className="f" htmlFor="sp-msg"><span>Message</span><input type="text" id="sp-msg" maxLength={40} value={d.splash.msg} onChange={e => setSplash({ msg: e.target.value })} /></label>
                    <div><p className="lbl">Animation</p>
                      <Seg<SplashAnim> value={d.splash.anim} onChange={v => setSplash({ anim: v })} locked={v => !ent.allAnimations && v !== 'rise'}
                        options={[{ v: 'rise', label: 'Slide up' }, { v: 'pulse', label: 'Pulse' }, { v: 'spin', label: 'Spinner' }, { v: 'bar', label: 'Progress bar' }]} />
                    </div>
                    <div className="row2">
                      <ColorField id="sp-bg" label="Background" value={d.splash.bg} onChange={v => setSplash({ bg: v })} />
                      <ColorField id="sp-fg" label="Text" value={d.splash.fg} onChange={v => setSplash({ fg: v })} />
                    </div>
                    <label className="f" htmlFor="sp-secs"><span>Show for <b>{d.splash.secs}</b> seconds</span>
                      <input type="range" id="sp-secs" min={1} max={5} step={0.5} value={d.splash.secs} onChange={e => setSplash({ secs: +e.target.value })} /></label>
                  </>
                )}
              </div>
            </details>

            <details className="sec" onFocus={focusTab('phone')}>
              <summary><span className="step">4</span>Page colors</summary>
              <div className="sec-body">
                <div><p className="lbl">Color themes</p>
                  <div className="swatches">
                    {THEMES.map((t, i) => (
                      <button key={i} type="button" className="swatch" aria-label={`Theme ${i + 1}`} aria-pressed={d.page.primary === t.p && d.page.button === t.b} onClick={() => setPage({ primary: t.p, button: t.b })}>
                        <i style={{ background: t.p }} /><em style={{ background: t.b }} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="row2">
                  <ColorField id="pg-primary" label="Primary" value={d.page.primary} onChange={v => setPage({ primary: v })} />
                  <ColorField id="pg-button" label="Button" value={d.page.button} onChange={v => setPage({ button: v })} />
                  <ColorField id="pg-bg" label="Background" value={d.page.bg} onChange={v => setPage({ bg: v })} />
                </div>
              </div>
            </details>

            <details className="sec" onToggle={e => { if ((e.target as HTMLDetailsElement).open) setTab('qr'); }} onFocus={focusTab('qr')}>
              <summary><span className="step">5</span>QR code design</summary>
              <div className="sec-body">
                <div className="row2">
                  <ColorField id="qr-fg" label="Dots" value={d.qr.fg} onChange={v => setQr({ fg: v })} />
                  <ColorField id="qr-eye" label="Corners" value={d.qr.eye} onChange={v => setQr({ eye: v })} />
                  <ColorField id="qr-bg" label="Background" value={d.qr.bg} onChange={v => setQr({ bg: v })} />
                </div>
                <div><p className="lbl">Dot shape</p><Seg value={d.qr.dots} onChange={v => setQr({ dots: v })} options={[{ v: 'square', label: 'Square' }, { v: 'rounded', label: 'Rounded' }, { v: 'dots', label: 'Dots' }]} /></div>
                <div><p className="lbl">Corner shape</p><Seg value={d.qr.eyes} onChange={v => setQr({ eyes: v })} options={[{ v: 'square', label: 'Square' }, { v: 'rounded', label: 'Rounded' }, { v: 'circle', label: 'Circle' }]} /></div>
                <label className="toggle" htmlFor="qr-logo"><input type="checkbox" id="qr-logo" checked={d.qr.logo && ent.logoInCode} disabled={!ent.logoInCode} onChange={e => setQr({ logo: e.target.checked })} /> Put my logo in the middle {!ent.logoInCode && <span className="pro-tag">Pro</span>}</label>
                <div><p className="lbl">Frame</p><Seg value={d.qr.frame} onChange={v => setQr({ frame: v })} options={[{ v: 'none', label: 'No frame' }, { v: 'label', label: 'Frame with text' }]} /></div>
                {d.qr.frame === 'label' && (
                  <div className="row2">
                    <label className="f" htmlFor="qr-frametext"><span>Frame text</span><input type="text" id="qr-frametext" maxLength={18} value={d.qr.frameText} onChange={e => setQr({ frameText: e.target.value })} /></label>
                    <ColorField id="qr-framecolor" label="Frame color" value={d.qr.frameColor} onChange={v => setQr({ frameColor: v })} />
                  </div>
                )}
                <p className="hint">Keep the dots darker than the background so every phone camera can read the code.</p>
              </div>
            </details>
          </fieldset>

          {!isNew && !frozen && (
            <div className="danger-row">
              {confirmDelete ? (
                <><span>Delete this code? Printed copies will stop working.</span>
                  <button type="button" className="btn small danger" onClick={onDelete}>Yes, delete it</button>
                  <button type="button" className="btn small ghost" onClick={() => setConfirmDelete(false)}>Keep it</button></>
              ) : <button type="button" className="btn small ghost" onClick={() => setConfirmDelete(true)}>Delete code</button>}
            </div>
          )}
        </form>

        <aside className="preview" aria-label="Live preview">
          <div className="pv-head">
            <h2>Preview</h2>
            <div className="tabs" role="tablist">
              <button type="button" role="tab" aria-selected={tab === 'qr'} onClick={() => setTab('qr')}>QR code</button>
              <button type="button" role="tab" aria-selected={tab === 'phone'} onClick={() => { setTab('phone'); }}>What people see</button>
            </div>
          </div>
          {tab === 'qr' ? (
            <div>
              <div className="qr-stage">
                <canvas ref={canvasRef} width={260} height={260} aria-label="QR code preview" />
                <div className="dest">
                  <span className={`chip ${mode === 'dynamic' ? 'dyn' : 'sta'}`}>{mode === 'dynamic' ? 'Dynamic · editable · tracks scans' : 'Static · fixed · no tracking'}</span>
                  <div className="mono">{encoded}</div>
                  <small className="muted">{mode === 'dynamic' ? 'This short link stays the same. You change where it sends people.' : 'This is exactly what the code contains.'}</small>
                </div>
              </div>
              <div className="pv-actions" style={{ marginTop: 12 }}>
                {isNew ? <span className="hint">Save the code to download it.</span> : <>
                  <button className="btn small" type="button" onClick={() => download('png')}>Download PNG</button>
                  <button className="btn small" type="button" onClick={() => download('svg')}>Download SVG (for print)</button>
                </>}
              </div>
            </div>
          ) : (
            <div>
              <div className="phone"><div className="screen">
                <PublicPage kind={kind} design={d} showSplash={showSplash} branding={!ent.removeBranding} preview replayKey={replay} onPreviewAction={say} />
              </div></div>
              <div className="replay-row" style={{ marginTop: 12 }}>
                {showSplash && <button className="btn small" type="button" onClick={() => setReplay(r => r + 1)}>Replay loading screen</button>}
              </div>
            </div>
          )}
        </aside>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
