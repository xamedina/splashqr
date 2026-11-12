import type { CodeKind, CodeMode, CodeDesign } from './types';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

/** What actually gets encoded into the printed QR code. */
export function encodedUrl(slug: string, kind: CodeKind, mode: CodeMode, design: CodeDesign): string {
  if (mode === 'dynamic') return `${SITE_URL}/r/${slug}`;
  if (kind === 'links') return `${SITE_URL}/p/${slug}`;
  const c = design.content;
  if (kind === 'web') return c.url;
  if (kind === 'phone') return 'tel:' + (c.phone || '').replace(/[^\d+]/g, '');
  return 'mailto:' + (c.email || '');
}

export function splashAllowed(kind: CodeKind, mode: CodeMode) {
  return kind === 'links' || mode === 'dynamic';
}
