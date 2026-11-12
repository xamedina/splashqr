import { AppShell } from '@/components/AppShell';
import { Builder } from '@/components/Builder';
import { defaultDesign } from '@/lib/defaults';
import { requireUser } from '@/lib/session';
import { newSlug } from '@/lib/slug';

export const metadata = { title: 'Create a QR code · SplashQR' };

export default async function NewCodePage() {
  const { user, ent } = await requireUser('/codes/new');
  const design = defaultDesign();
  if (!ent.customSplash) design.splash.on = false;
  return (
    <AppShell active="create" ent={ent}>
      <Builder userId={user.id} codeId={null} slug={newSlug()} ent={ent} frozen={false}
        initial={{ name: 'Untitled code', kind: 'links', mode: 'dynamic', design }} />
    </AppShell>
  );
}
