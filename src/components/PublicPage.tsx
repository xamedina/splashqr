'use client';

import { useEffect, useState } from 'react';
import type { CodeDesign, CodeKind } from '@/lib/types';
import { LINK_KINDS, linkHref, monogram } from '@/lib/defaults';
import { Icon } from './Icon';

interface Props {
  kind: CodeKind;
  design: CodeDesign;
  showSplash: boolean;
  branding: boolean;
  /** Preview inside the builder: links do not navigate, nothing redirects. */
  preview?: boolean;
  /** Change this number to play the loading screen again. 0 = start with it already finished. */
  replayKey?: number;
  onPreviewAction?: (msg: string) => void;
}

function LogoMark({ design, size, bg }: { design: CodeDesign; size: number; bg: string }) {
  const c = design.content;
  if (c.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="logo-img s-logo" src={c.logoUrl} alt="" style={{ width: size, height: size }} />;
  }
  return (
    <div className="monogram s-logo" style={{ width: size, height: size, background: bg, fontSize: Math.round(size * 0.4) }}>
      {monogram(c.title)}
    </div>
  );
}

export function PublicPage({ kind, design, showSplash, branding, preview, replayKey = 1, onPreviewAction }: Props) {
  const { content: c, page: p, splash: sp } = design;
  const [splashDone, setSplashDone] = useState(!showSplash || replayKey === 0);

  useEffect(() => {
    if (!showSplash || replayKey === 0) { setSplashDone(true); return; }
    setSplashDone(false);
    const t = setTimeout(() => setSplashDone(true), sp.secs * 1000);
    return () => clearTimeout(t);
  }, [replayKey, showSplash, sp.secs]);

  // Live website codes: after the loading screen, send the visitor on.
  useEffect(() => {
    if (preview || kind !== 'web' || !splashDone || !c.url) return;
    window.location.replace(linkHref('web', c.url));
  }, [preview, kind, splashDone, c.url]);

  const guard = (msg: string) => (e: React.MouseEvent) => {
    if (preview) { e.preventDefault(); onPreviewAction?.(msg); }
  };

  const share = async (e: React.MouseEvent) => {
    if (preview) { guard('Opens the share sheet on the visitor’s phone')(e); return; }
    try { await navigator.share?.({ title: c.title, url: window.location.href }); } catch { /* cancelled */ }
  };

  let body: React.ReactNode;
  if (kind === 'links') {
    body = (
      <>
        <div className="lp" style={{ background: p.bg }}>
          <div className="lp-head"><LogoMark design={design} size={76} bg={p.primary} /><h3>{c.title}</h3></div>
          <div className="lp-banner" style={{ background: p.primary }}>{c.tagline}</div>
          <div className="lp-list">
            {c.links.map((l, i) => (
              <a key={i} className="lp-item" href={linkHref(l.kind, l.value)} target={l.kind === 'phone' || l.kind === 'email' ? undefined : '_blank'} rel="noopener noreferrer"
                onClick={guard(`In the live page this opens ${LINK_KINDS[l.kind].name}: ${l.value || '(no link yet)'}`)}>
                <span className="lp-ic" style={{ background: LINK_KINDS[l.kind].color, color: '#fff' }}><Icon name={l.kind} /></span>
                <span className="lp-txt"><b>{l.label}</b><small>{l.value}</small></span>
              </a>
            ))}
          </div>
          {branding && <a className="lp-foot" href="/" onClick={guard('Links to SplashQR')}>Made with SplashQR</a>}
        </div>
        <button type="button" className="lp-fab" style={{ background: p.button }} aria-label="Share this page" onClick={share}><Icon name="share" /></button>
      </>
    );
  } else if (kind === 'web') {
    body = (
      <div className="redirect" style={{ background: p.bg }}>
        <b>Opening</b>
        <a className="mono" style={{ fontSize: 12, wordBreak: 'break-all', color: 'inherit' }} href={linkHref('web', c.url)} onClick={guard('Sends the visitor to your website')}>{c.url.replace(/^https?:\/\//, '')}</a>
        <div className="bar"><i style={{ background: p.primary }} /></div>
      </div>
    );
  } else {
    const isPhone = kind === 'phone';
    const value = isPhone ? c.phone : c.email;
    body = (
      <div className="redirect" style={{ background: p.bg }}>
        <LogoMark design={design} size={64} bg={p.primary} />
        <b>{c.title}</b>
        <a className="ask" style={{ background: p.button }} href={linkHref(isPhone ? 'phone' : 'email', value)}
          onClick={guard('Opens the phone’s dialer or mail app')}>{isPhone ? 'Call' : 'Email'} {value}</a>
        {branding && <span className="lp-foot">Made with SplashQR</span>}
      </div>
    );
  }

  return (
    <>
      {showSplash && (
        <div className={`splash anim-${sp.anim}${splashDone ? ' done' : ''}`} style={{ background: sp.bg, color: sp.fg }} aria-hidden={splashDone}>
          <div className="s-wrap">
            {sp.anim === 'spin' && <div className="s-ring" />}
            <LogoMark design={design} size={sp.anim === 'spin' ? 78 : 96} bg={sp.bg === p.primary ? 'rgba(255,255,255,.2)' : p.primary} />
          </div>
          <p>{sp.msg}</p>
          {sp.anim === 'bar' && <div className="bar"><i style={{ animation: `fill ${sp.secs}s linear forwards` }} /></div>}
        </div>
      )}
      {body}
    </>
  );
}
