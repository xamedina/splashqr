import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Builder } from '@/components/Builder';
import { requireUser } from '@/lib/session';
import { editableIds } from '@/lib/plans';
import type { CodeRow } from '@/lib/types';

export const metadata = { title: 'Edit QR code · SplashQR' };

export default async function EditCodePage({ params }: { params: { id: string } }) {
  const { supabase, user, ent } = await requireUser(`/codes/${params.id}`);
  const { data: codes } = await supabase.from('codes').select('*').eq('user_id', user.id);
  const code = (codes as CodeRow[] | null)?.find(c => c.id === params.id);
  if (!code) notFound();
  const frozen = code.mode === 'dynamic' && !editableIds(codes as CodeRow[], ent).has(code.id);
  return (
    <AppShell active="codes" ent={ent}>
      <Builder key={code.updated_at} userId={user.id} codeId={code.id} slug={code.slug} ent={ent} frozen={frozen}
        initial={{ name: code.name, kind: code.kind, mode: code.mode, design: code.design }} />
    </AppShell>
  );
}
