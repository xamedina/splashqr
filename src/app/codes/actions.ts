'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { newSlug } from '@/lib/slug';
import { entitlements, editableIds } from '@/lib/plans';
import { LINK_KINDS, isHex } from '@/lib/defaults';
import type { CodeDesign, CodeKind, CodeMode, LinkKind, Profile } from '@/lib/types';


type Result = { ok: true; id: string } | { ok: false; error: string };

const str = (v: unknown, max: number) => String(v ?? '').slice(0, max);
const hex = (v: unknown, fallback: string) => (typeof v === 'string' && isHex(v) ? v : fallback);
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

function clean(d: CodeDesign): CodeDesign {
  const c = d?.content ?? ({} as CodeDesign['content']);
  const logo = typeof c.logoUrl === 'string' && /^https:\/\//.test(c.logoUrl) ? c.logoUrl.slice(0, 500) : null;
  return {
    content: {
      title: str(c.title, 80), tagline: str(c.tagline, 120), logoUrl: logo,
      links: (Array.isArray(c.links) ? c.links : []).slice(0, 30).map(l => ({
        kind: pick<LinkKind>(l?.kind, Object.keys(LINK_KINDS) as LinkKind[], 'web'),
        label: str(l?.label, 60), value: str(l?.value, 500),
      })),
      url: str(c.url, 1000), phone: str(c.phone, 40), email: str(c.email, 200),
    },
    splash: {
      on: !!d?.splash?.on, bg: hex(d?.splash?.bg, '#1c1c1c'), fg: hex(d?.splash?.fg, '#ffffff'),
      anim: pick(d?.splash?.anim, ['pulse', 'rise', 'spin', 'bar'] as const, 'rise'),
      secs: Math.min(5, Math.max(1, Number(d?.splash?.secs) || 2)), msg: str(d?.splash?.msg, 40),
    },
    page: { primary: hex(d?.page?.primary, '#1c1c1c'), button: hex(d?.page?.button, '#fc3131'), bg: hex(d?.page?.bg, '#f6f6f6') },
    qr: {
      fg: hex(d?.qr?.fg, '#1c1c1c'), bg: hex(d?.qr?.bg, '#ffffff'), eye: hex(d?.qr?.eye, '#1c1c1c'),
      dots: pick(d?.qr?.dots, ['square', 'rounded', 'dots'] as const, 'square'),
      eyes: pick(d?.qr?.eyes, ['square', 'rounded', 'circle'] as const, 'square'),
      logo: !!d?.qr?.logo, frame: pick(d?.qr?.frame, ['none', 'label'] as const, 'none'),
      frameText: str(d?.qr?.frameText, 18), frameColor: hex(d?.qr?.frameColor, '#1c1c1c'),
    },
  };
}

export async function saveCode(input: { id: string | null; slug: string; name: string; kind: CodeKind; mode: CodeMode; design: CodeDesign }): Promise<Result> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You’ve been signed out. Sign in again to save.' };

  const kind = pick(input.kind, ['links', 'web', 'phone', 'email'] as const, 'links');
  const design = clean(input.design);
  const name = str(input.name, 80).trim() || 'Untitled code';

  if (kind === 'web' && !/^(https?:\/\/)?[^\s/$.?#].[^\s]*$/i.test(design.content.url.trim())) return { ok: false, error: 'Add a website address, like https://yoursite.com' };
  if (kind === 'phone' && design.content.phone.replace(/\D/g, '').length < 7) return { ok: false, error: 'Add a phone number with the area code.' };
  if (kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(design.content.email.trim())) return { ok: false, error: 'Add an email address, like you@business.com' };

  const [{ data: profile }, { data: codes }] = await Promise.all([
    supabase.from('profiles').select('plan, trial_ends_at').eq('id', user.id).single<Pick<Profile, 'plan' | 'trial_ends_at'>>(),
    supabase.from('codes').select('id, mode, created_at').eq('user_id', user.id),
  ]);
  const ent = entitlements(profile);

  // Keep what their plan includes; the rest is switched off rather than rejected.
  if (!ent.customSplash) design.splash.on = false;
  if (!ent.allAnimations) design.splash.anim = 'rise';
  if (!ent.logoInCode) design.qr.logo = false;

  if (input.id) {
    const existing = (codes ?? []).find(c => c.id === input.id);
    if (!existing) return { ok: false, error: 'That code wasn’t found. It may have been deleted.' };
    if (existing.mode === 'dynamic' && !editableIds(codes ?? [], ent).has(existing.id)) {
      return { ok: false, error: 'This code is frozen on your plan. It still works, but you’ll need to upgrade to edit it.' };
    }
    const { error } = await supabase.from('codes').update({ name, kind, design, updated_at: new Date().toISOString() }).eq('id', input.id);
    if (error) return { ok: false, error: 'Couldn’t save. Please try again.' };
    revalidatePath('/dashboard');
    return { ok: true, id: input.id };
  }

  const mode = pick(input.mode, ['dynamic', 'static'] as const, 'dynamic');
  const dynCount = (codes ?? []).filter(c => c.mode === 'dynamic').length;
  if (mode === 'dynamic' && dynCount >= ent.editableDynamic) {
    return { ok: false, error: `Your plan includes ${ent.editableDynamic} dynamic code${ent.editableDynamic === 1 ? '' : 's'}. Upgrade for more, or make this a static code.` };
  }

  let slug = /^[A-Za-z0-9]{7}$/.test(input.slug) ? input.slug : newSlug();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.from('codes').insert({ user_id: user.id, name, kind, mode, slug, design }).select('id').single();
    if (!error && data) { revalidatePath('/dashboard'); return { ok: true, id: data.id }; }
    if (error?.code !== '23505') return { ok: false, error: 'Couldn’t save. Please try again.' };
    slug = newSlug();
  }
  return { ok: false, error: 'Couldn’t save. Please try again.' };
}

export async function deleteCode(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase.from('codes').delete().eq('id', id);
  if (error) return { ok: false, error: 'Couldn’t delete. Please try again.' };
  revalidatePath('/dashboard');
  return { ok: true };
}
