import { AppShell } from '@/components/AppShell';
import { Dashboard, type ScanLite } from '@/components/Dashboard';
import { requireUser } from '@/lib/session';
import { editableIds } from '@/lib/plans';
import { SITE_URL } from '@/lib/site';
import type { CodeRow } from '@/lib/types';

export const metadata = { title: 'My codes · SplashQR' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage({ searchParams }: { searchParams: { upgraded?: string } }) {
  const { supabase, user, ent, pastDue } = await requireUser('/dashboard');
  const { data: codes } = await supabase.from('codes').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  const list = (codes ?? []) as CodeRow[];
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const ids = list.filter(c => c.mode === 'dynamic').map(c => c.id);
  let scans: ScanLite[] = [];
  if (ids.length) {
    const { data } = await supabase.from('scans').select('code_id, scanned_at, device, city, region, visitor')
      .in('code_id', ids).gte('scanned_at', since).order('scanned_at', { ascending: false }).limit(50000);
    scans = (data ?? []) as ScanLite[];
  }
  const editable = editableIds(list, ent);
  return (
    <AppShell active="codes" ent={ent} pastDue={pastDue}>
      <Dashboard codes={list.map(c => ({ ...c, frozen: c.mode === 'dynamic' && !editable.has(c.id) }))} scans={scans} ent={ent}
        siteUrl={SITE_URL} upgraded={searchParams.upgraded === '1'} />
    </AppShell>
  );
}
