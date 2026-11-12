import type { CodeDesign, LinkKind } from './types';

export const LINK_KINDS: Record<LinkKind, { name: string; color: string; placeholder: string }> = {
  web: { name: 'Website', color: '#5f6368', placeholder: 'https://yoursite.com' },
  instagram: { name: 'Instagram', color: '#d6336c', placeholder: '@yourhandle' },
  tiktok: { name: 'TikTok', color: '#000000', placeholder: '@yourhandle' },
  facebook: { name: 'Facebook', color: '#3b5998', placeholder: 'facebook.com/yourpage' },
  youtube: { name: 'YouTube', color: '#e62117', placeholder: 'youtube.com/@channel' },
  x: { name: 'X', color: '#111111', placeholder: '@yourhandle' },
  phone: { name: 'Phone', color: '#11805b', placeholder: '(555) 000-0000' },
  email: { name: 'Email', color: '#b4570a', placeholder: 'you@business.com' },
};

export const CODE_TYPES = [
  { v: 'links', name: 'Links page', desc: 'A page with all your links, like a mini website' },
  { v: 'web', name: 'Website', desc: 'Send people straight to one web address' },
  { v: 'phone', name: 'Phone call', desc: 'Opens the dialer with your number' },
  { v: 'email', name: 'Email', desc: 'Opens a new email to you' },
] as const;

export const THEMES = [
  { p: '#1c1c1c', b: '#fc3131' },
  { p: '#000000', b: '#f2c744' },
  { p: '#0abab5', b: '#e91e63' },
  { p: '#4f7cba', b: '#e0335f' },
  { p: '#3d4f5c', b: '#e0335f' },
  { p: '#5aa55a', b: '#8bc98b' },
  { p: '#6d4c41', b: '#f08a55' },
];

export function defaultDesign(): CodeDesign {
  return {
    content: {
      title: 'My Business',
      tagline: 'Connect with us',
      logoUrl: null,
      links: [
        { kind: 'web', label: 'Visit our website', value: 'https://' },
        { kind: 'instagram', label: 'Instagram', value: '@' },
      ],
      url: 'https://',
      phone: '',
      email: '',
    },
    splash: { on: true, bg: '#1c1c1c', fg: '#ffffff', anim: 'rise', secs: 2, msg: 'Welcome' },
    page: { primary: '#1c1c1c', button: '#fc3131', bg: '#f6f6f6' },
    qr: {
      fg: '#1c1c1c', bg: '#ffffff', eye: '#fc3131', dots: 'rounded', eyes: 'rounded',
      logo: false, frame: 'label', frameText: 'SCAN ME', frameColor: '#1c1c1c',
    },
  };
}

/** Turn what the user typed (a handle, a bare domain, a phone number) into a real link. */
export function linkHref(kind: LinkKind, raw: string): string {
  const v = (raw || '').trim();
  const handle = v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?[^/]+\/@?/i, '');
  const asUrl = (s: string) => (/^https?:\/\//i.test(s) ? s : 'https://' + s.replace(/^\/+/, ''));
  switch (kind) {
    case 'phone': return 'tel:' + v.replace(/[^\d+]/g, '');
    case 'email': return 'mailto:' + v;
    case 'instagram': return /instagram\.com/i.test(v) ? asUrl(v) : `https://instagram.com/${handle}`;
    case 'tiktok': return /tiktok\.com/i.test(v) ? asUrl(v) : `https://tiktok.com/@${handle}`;
    case 'x': return /(x|twitter)\.com/i.test(v) ? asUrl(v) : `https://x.com/${handle}`;
    case 'facebook': return /facebook\.com/i.test(v) ? asUrl(v) : `https://facebook.com/${handle}`;
    case 'youtube': return /youtube\.com|youtu\.be/i.test(v) ? asUrl(v) : `https://youtube.com/@${handle}`;
    default: return asUrl(v);
  }
}

export function monogram(title: string): string {
  const w = (title || '').trim().split(/\s+/).filter(Boolean);
  return ((w[0] || 'S')[0] + (w[1] ? w[1][0] : (w[0] || 'Q')[1] || '')).toUpperCase();
}

export const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);
