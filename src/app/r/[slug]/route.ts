import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { entitlements } from '@/lib/plans';
import { linkHref } from '@/lib/defaults';
import type { CodeRow, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

function device(ua: string) {
  if (/iphone|ipad|ipod/i.test(ua)) return 'iPhone';
  if (/android/i.test(ua)) return 'Android';
  if (/windows|macintosh|linux|cros/i.test(ua)) return 'Computer';
  return 'Other';
}

async function visitorId(ip: string, ua: string) {
  // Changes every day and can't be turned back into an IP address.
  const day = new Date().toISOString().slice(0, 10);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}|${ua}|${day}|${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-12)}`));
  return Array.from(new Uint8Array(buf).slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Every dynamic code points here. Count the scan, then send the visitor on. */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const db = createAdminClient();
  const { data: code } = await db.from('codes').select('id, slug, kind, mode, design, user_id').eq('slug', params.slug).single<CodeRow>();
  if (!code) return NextResponse.redirect(new URL('/missing', req.url));

  const ua = req.headers.get('user-agent') || '';
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const h = (k: string) => { const v = req.headers.get(k); return v ? decodeURIComponent(v) : null; };
  const isBot = /bot|crawl|spider|preview|facebookexternalhit|slurp/i.test(ua);

  const [{ data: owner }] = await Promise.all([
    db.from('profiles').select('plan, trial_ends_at').eq('id', code.user_id).single<Pick<Profile, 'plan' | 'trial_ends_at'>>(),
    isBot ? Promise.resolve() : db.from('scans').insert({
      code_id: code.id, device: device(ua), visitor: await visitorId(ip, ua),
      country: h('x-vercel-ip-country'), region: h('x-vercel-ip-country-region'), city: h('x-vercel-ip-city'),
    }),
  ]);
  const ent = entitlements(owner);

  const needsPage = code.kind !== 'web' || (code.design.splash.on && ent.customSplash);
  const target = needsPage ? new URL(`/p/${code.slug}`, req.url).toString() : linkHref('web', code.design.content.url);
  const res = NextResponse.redirect(target, 302);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
