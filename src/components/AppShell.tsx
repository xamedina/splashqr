import Link from 'next/link';
import { Logo } from './Logo';
import type { Entitlements } from '@/lib/plans';

export function AppShell({ active, ent, pastDue, children }: { active: 'create' | 'codes' | 'pricing' | 'account'; ent?: Entitlements; pastDue?: boolean; children: React.ReactNode }) {
  const nav = [
    { k: 'create', href: '/codes/new', label: 'Create' },
    { k: 'codes', href: '/dashboard', label: 'My codes' },
    { k: 'pricing', href: '/pricing', label: 'Pricing' },
    { k: 'account', href: '/account', label: 'Account' },
  ];
  return (
    <>
      <header className="top">
        <div className="wrap">
          <Logo href="/dashboard" />
          <nav className="nav" aria-label="Main">
            {nav.map(n => <Link key={n.k} href={n.href} aria-current={active === n.k ? 'page' : undefined}>{n.label}</Link>)}
          </nav>
          {ent?.onTrial && <Link href="/pricing" className="chip dyn" style={{ textDecoration: 'none' }}>Pro trial: {ent.trialDaysLeft} day{ent.trialDaysLeft === 1 ? '' : 's'} left</Link>}
        </div>
      </header>
      {pastDue && (
        <div className="wrap" style={{ paddingTop: 12 }}>
          <div className="note warn"><span><b>Your last payment didn’t go through.</b> We’ll try your card again over the next few days. To keep your plan, <Link href="/account">update your card</Link>.</span></div>
        </div>
      )}
      <main>{children}</main>
    </>
  );
}
