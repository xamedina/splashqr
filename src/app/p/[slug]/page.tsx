import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { entitlements } from '@/lib/plans';
import { splashAllowed } from '@/lib/site';
import { PublicPage } from '@/components/PublicPage';
import type { CodeRow, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function load(slug: string) {
  const db = createAdminClient();
  const { data: code } = await db.from('codes').select('slug, kind, mode, design, user_id').eq('slug', slug).single<CodeRow>();
  if (!code) return null;
  const { data: owner } = await db.from('profiles').select('plan, trial_ends_at').eq('id', code.user_id).single<Pick<Profile, 'plan' | 'trial_ends_at'>>();
  return { code, ent: entitlements(owner) };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const r = await load(params.slug);
  const t = r?.code.design.content.title;
  return { title: t || 'SplashQR', description: r?.code.design.content.tagline || undefined, robots: { index: false } };
}

/** The page people land on after scanning. */
export default async function LivePage({ params }: { params: { slug: string } }) {
  const r = await load(params.slug);
  if (!r) notFound();
  const { code, ent } = r;
  const showSplash = splashAllowed(code.kind, code.mode) && ent.customSplash && code.design.splash.on;
  return (
    <div className="live" style={{ background: code.design.page.bg }}>
      <PublicPage kind={code.kind} design={code.design} showSplash={showSplash} branding={!ent.removeBranding} />
    </div>
  );
}
