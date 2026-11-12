import qrcode from 'qrcode-generator';
import type { QrSettings } from './types';

interface Matrix { n: number; dark: (r: number, c: number) => boolean }

function matrix(text: string, high: boolean): Matrix {
  const q = qrcode(0, high ? 'H' : 'M');
  q.addData(text || ' ');
  q.make();
  return { n: q.getModuleCount(), dark: (r, c) => q.isDark(r, c) };
}

interface Layout {
  W: number; H: number; pad: number; labelH: number; area: number; cell: number; ox: number; oy: number;
  n: number; dark: Matrix['dark']; isEye: (r: number, c: number) => boolean; inLogo: (r: number, c: number) => boolean;
  lc: number; ls: number; frame: boolean; bare: boolean;
}

function layout(text: string, q: QrSettings, size: number, bare: boolean): Layout {
  const { n, dark } = matrix(text, q.logo);
  const frame = q.frame === 'label' && !bare;
  const pad = frame ? Math.round(size * 0.045) : 0;
  const labelH = frame ? Math.round(size * 0.19) : 0;
  const area = size - pad * 2;
  const quiet = bare ? 1.5 : 2.5;
  const cell = area / (n + quiet * 2);
  const lc = q.logo ? (Math.ceil(n * 0.24) | 1) : 0;
  const ls = Math.floor((n - lc) / 2);
  return {
    W: size, H: size + labelH, pad, labelH, area, cell, ox: pad + quiet * cell, oy: pad + quiet * cell, n, dark, lc, ls, frame, bare,
    isEye: (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7),
    inLogo: (r, c) => q.logo && r >= ls && r < ls + lc && c >= ls && c < ls + lc,
  };
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export interface DrawOpts { bare?: boolean; logoImg?: HTMLImageElement | null; monogram?: string; scale?: number }

/** Draw a styled QR code onto a canvas. */
export function drawQR(canvas: HTMLCanvasElement, text: string, q: QrSettings, size: number, opts: DrawOpts = {}) {
  const L = layout(text, q, size, !!opts.bare);
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const dpr = opts.scale ?? Math.max(1, Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
  canvas.width = L.W * dpr; canvas.height = L.H * dpr;
  canvas.style.width = L.W + 'px'; canvas.style.aspectRatio = `${L.W} / ${L.H}`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, L.W, L.H);
  if (L.frame) { ctx.fillStyle = q.frameColor; rr(ctx, 0, 0, L.W, L.H, size * 0.08); ctx.fill(); }
  ctx.fillStyle = q.bg; rr(ctx, L.pad, L.pad, L.area, L.area, L.frame ? size * 0.05 : (L.bare ? 0 : size * 0.04)); ctx.fill();
  const { cell, ox, oy, n } = L;
  ctx.fillStyle = q.fg;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!L.dark(r, c) || L.isEye(r, c) || L.inLogo(r, c)) continue;
    const x = ox + c * cell, y = oy + r * cell;
    if (q.dots === 'dots') { ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, cell * 0.44, 0, Math.PI * 2); ctx.fill(); }
    else if (q.dots === 'rounded') { rr(ctx, x + cell * 0.04, y + cell * 0.04, cell * 0.92, cell * 0.92, cell * 0.32); ctx.fill(); }
    else ctx.fillRect(x, y, cell + 0.4, cell + 0.4);
  }
  for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    const x = ox + c * cell, y = oy + r * cell;
    const shape = (px: number, py: number, s: number, rad: number, col: string) => {
      ctx.fillStyle = col;
      if (q.eyes === 'circle') { ctx.beginPath(); ctx.arc(px + s / 2, py + s / 2, s / 2, 0, Math.PI * 2); ctx.fill(); }
      else if (q.eyes === 'rounded') { rr(ctx, px, py, s, s, rad); ctx.fill(); }
      else ctx.fillRect(px, py, s, s);
    };
    shape(x, y, 7 * cell, cell * 2.3, q.eye); shape(x + cell, y + cell, 5 * cell, cell * 1.6, q.bg); shape(x + 2 * cell, y + 2 * cell, 3 * cell, cell, q.eye);
  }
  if (q.logo) {
    const s = L.lc * cell, x = ox + L.ls * cell, y = oy + L.ls * cell, ins = s * 0.12;
    ctx.fillStyle = q.bg; rr(ctx, x, y, s, s, s * 0.28); ctx.fill();
    if (opts.logoImg && opts.logoImg.complete && opts.logoImg.naturalWidth) {
      ctx.drawImage(opts.logoImg, x + ins, y + ins, s - ins * 2, s - ins * 2);
    } else {
      ctx.fillStyle = q.eye; ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, (s - ins * 2) / 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 ${s * 0.34}px "Bricolage Grotesque", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(opts.monogram || '', x + s / 2, y + s / 2 + s * 0.02);
    }
  }
  if (L.frame) {
    ctx.fillStyle = '#fff'; ctx.font = `800 ${L.labelH * 0.36}px "Bricolage Grotesque", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((q.frameText || '').toUpperCase(), L.W / 2, size + L.labelH * 0.42 - L.pad * 0.2);
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function rrPath(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  const f = (v: number) => +v.toFixed(2);
  return `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`;
}

/** The same design as an SVG file, for print. logoHref should be a data: URL so the file stands alone. */
export function qrSvg(text: string, q: QrSettings, size = 1024, logoHref?: string | null, mono = ''): string {
  const L = layout(text, q, size, false);
  const { cell, ox, oy, n } = L;
  const parts: string[] = [];
  if (L.frame) parts.push(`<path d="${rrPath(0, 0, L.W, L.H, size * 0.08)}" fill="${q.frameColor}"/>`);
  parts.push(`<path d="${rrPath(L.pad, L.pad, L.area, L.area, L.frame ? size * 0.05 : size * 0.04)}" fill="${q.bg}"/>`);
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!L.dark(r, c) || L.isEye(r, c) || L.inLogo(r, c)) continue;
    const x = ox + c * cell, y = oy + r * cell;
    if (q.dots === 'dots') { const cx = x + cell / 2, cy = y + cell / 2, rad = cell * 0.44; d += `M${(cx - rad).toFixed(2)} ${cy.toFixed(2)}a${rad.toFixed(2)} ${rad.toFixed(2)} 0 1 0 ${(rad * 2).toFixed(2)} 0a${rad.toFixed(2)} ${rad.toFixed(2)} 0 1 0 ${(-rad * 2).toFixed(2)} 0Z`; }
    else if (q.dots === 'rounded') d += rrPath(x + cell * 0.04, y + cell * 0.04, cell * 0.92, cell * 0.92, cell * 0.32);
    else d += `M${x.toFixed(2)} ${y.toFixed(2)}h${(cell + 0.2).toFixed(2)}v${(cell + 0.2).toFixed(2)}h${(-cell - 0.2).toFixed(2)}Z`;
  }
  parts.push(`<path d="${d}" fill="${q.fg}"/>`);
  const shape = (px: number, py: number, s: number, rad: number, col: string) =>
    q.eyes === 'circle' ? `<circle cx="${px + s / 2}" cy="${py + s / 2}" r="${s / 2}" fill="${col}"/>`
      : `<path d="${rrPath(px, py, s, s, q.eyes === 'rounded' ? rad : 0)}" fill="${col}"/>`;
  for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    const x = ox + c * cell, y = oy + r * cell;
    parts.push(shape(x, y, 7 * cell, cell * 2.3, q.eye), shape(x + cell, y + cell, 5 * cell, cell * 1.6, q.bg), shape(x + 2 * cell, y + 2 * cell, 3 * cell, cell, q.eye));
  }
  if (q.logo) {
    const s = L.lc * cell, x = ox + L.ls * cell, y = oy + L.ls * cell, ins = s * 0.12;
    parts.push(`<path d="${rrPath(x, y, s, s, s * 0.28)}" fill="${q.bg}"/>`);
    if (logoHref) parts.push(`<image href="${esc(logoHref)}" x="${x + ins}" y="${y + ins}" width="${s - ins * 2}" height="${s - ins * 2}" preserveAspectRatio="xMidYMid meet"/>`);
    else parts.push(`<circle cx="${x + s / 2}" cy="${y + s / 2}" r="${(s - ins * 2) / 2}" fill="${q.eye}"/><text x="${x + s / 2}" y="${y + s / 2}" dy="0.35em" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="${s * 0.34}" fill="#fff">${esc(mono)}</text>`);
  }
  if (L.frame) parts.push(`<text x="${L.W / 2}" y="${size + L.labelH * 0.42 - L.pad * 0.2}" dy="0.35em" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="${L.labelH * 0.36}" fill="#fff">${esc((q.frameText || '').toUpperCase())}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.W} ${L.H}" width="${L.W}" height="${L.H}">${parts.join('')}</svg>`;
}
