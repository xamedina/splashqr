import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { requireUser } from '@/lib/session';

export const metadata = { title: 'Account · SplashQR' };

const NAMES = { free: 'Free', starter: 'Starter', pro: 'Pro' } as const;

export default async function AccountPage() {
  const { user, profile, ent, pastDue } = await requireUser('/account');
  const paid = profile?.plan && profile.plan !== 'free';
  return (
    <AppShell active="account" ent={ent} pastDue={pastDue}>
      <div className="wrap">
        <div className="page-head"><div><h1>Account</h1><p className="muted">{user.email}</p></div></div>
        <div className="panel" style={{ display: 'grid', gap: 14, maxWidth: 640 }}>
          <h2>Your plan: {ent.onTrial ? `Pro trial (${ent.trialDaysLeft} day${ent.trialDaysLeft === 1 ? '' : 's'} left)` : NAMES[ent.plan]}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {ent.onTrial ? 'After the trial you move to Free unless you choose a plan. Every code you made keeps working.'
              : paid ? 'Change your plan, update your card or cancel any time. If you cancel, your printed codes keep working.'
                : 'You’re on Free. Upgrade to edit more dynamic codes, add a loading screen and see full stats.'}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {paid
              ? <form action="/api/stripe/portal" method="post"><button className="btn primary" type="submit">Manage billing</button></form>
              : <Link className="btn primary" href="/pricing">See plans</Link>}
            <form action="/auth/signout" method="post"><button className="btn" type="submit">Sign out</button></form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
