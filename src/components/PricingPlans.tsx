'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PRICES } from '@/lib/plans';

const PLANS = [
  { id: 'free', n: 'Free', f: ['Starts with 14 days of Pro', 'Unlimited static codes', '1 dynamic code you can edit', 'Links page with SplashQR branding', 'Scan count'] },
  { id: 'starter', n: 'Starter', f: ['10 dynamic codes', 'Custom links page', 'Custom loading screen with your logo, colors and message', 'Full scan stats', 'PNG and SVG downloads'] },
  { id: 'pro', n: 'Pro', pop: true, f: ['Everything in Starter', 'Unlimited dynamic codes', 'Your logo in the code', 'All loading screen animations', 'No SplashQR branding', 'Stats by city and device'] },
] as const;

export function PricingPlans({ signedIn, current }: { signedIn: boolean; current: string | null }) {
  const [bill, setBill] = useState<'mo' | 'yr'>('yr');
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Simple pricing. Your codes never stop working.</h1>
          <p className="muted">Static codes stay free forever, and printed codes keep working even if you cancel.</p>
        </div>
        <div className="toggle-bill" role="group" aria-label="Billing period">
          <button type="button" aria-pressed={bill === 'mo'} onClick={() => setBill('mo')}>Monthly</button>
          <button type="button" aria-pressed={bill === 'yr'} onClick={() => setBill('yr')}>Yearly (save ~35%)</button>
        </div>
      </div>
      {!signedIn && (
        <div className="note info" style={{ marginBottom: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span><b>Every new account starts with 14 days of Pro, free.</b> No credit card needed. After 14 days you stay on Free unless you choose a plan, and every code you made keeps working.</span>
          <Link className="btn primary small" href="/login">Sign up free</Link>
        </div>
      )}
      <div className="plans">
        {PLANS.map(p => {
          const paid = p.id !== 'free';
          const pr = paid ? PRICES[p.id as 'starter' | 'pro'] : null;
          const price = !pr ? '$0' : bill === 'mo' ? `$${pr.mo.toFixed(2)}` : `$${(pr.yr / 12).toFixed(2)}`;
          const sub = !pr ? 'forever' : bill === 'mo' ? 'per month' : `per month, $${pr.yr} billed yearly`;
          const isCurrent = current === p.id;
          return (
            <div key={p.id} className={`plan${'pop' in p && p.pop ? ' pop' : ''}`}>
              <h2>{p.n}{'pop' in p && p.pop && <span className="badge">Most popular</span>}</h2>
              <div className="price">{price} <small>{sub}</small></div>
              <ul>{p.f.map(x => <li key={x}>{x}</li>)}</ul>
              {isCurrent ? <span className="btn" aria-disabled="true">Your plan</span>
                : !paid ? (signedIn ? <span className="btn" aria-disabled="true">Included</span> : <Link className="btn" href="/login">Sign up free</Link>)
                  : signedIn ? (
                    <form action="/api/stripe/checkout" method="post">
                      <input type="hidden" name="plan" value={p.id} /><input type="hidden" name="period" value={bill} />
                      <button className={`btn ${'pop' in p && p.pop ? 'primary' : ''}`} type="submit" style={{ width: '100%' }}>Choose {p.n}</button>
                    </form>
                  ) : <Link className={`btn ${'pop' in p && p.pop ? 'primary' : ''}`} href="/login?next=/pricing">Choose {p.n}</Link>}
            </div>
          );
        })}
      </div>
    </>
  );
}
