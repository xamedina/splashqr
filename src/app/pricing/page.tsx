import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Logo } from '@/components/Logo';
import { PricingPlans } from '@/components/PricingPlans';
import { createClient } from '@/lib/supabase/server';
import { entitlements } from '@/lib/plans';
import type { Profile } from '@/lib/types';

export const metadata = { title: 'Pricing · SplashQR', description: 'Free QR codes that never expire. Dynamic codes, custom loading screens and scan stats from $4.99 a month.' };

export default async function PricingPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const setupNote = searchParams.error === 'setup' && <div className="note warn" style={{ marginBottom: 12 }}><span>Payments aren’t switched on yet. Please try again soon.</span></div>;
  if (!user) {
    return (
      <>
        <header className="top"><div className="wrap"><Logo /><nav className="nav"><Link href="/login?mode=signin">Sign in</Link></nav></div></header>
        <main><div className="wrap">{setupNote}<PricingPlans signedIn={false} current={null} /></div></main>
      </>
    );
  }
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
  const ent = entitlements(profile);
  return (
    <AppShell active="pricing" ent={ent}>
      <div className="wrap">{setupNote}<PricingPlans signedIn current={profile?.plan === 'free' ? null : profile?.plan ?? null} /></div>
    </AppShell>
  );
}
