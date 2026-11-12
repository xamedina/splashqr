import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'SplashQR · Free QR codes that never expire',
  description: 'Make free QR codes with your own loading screen and links page. Dynamic codes you can edit after printing, with scan stats.',
};

export default async function Home() {
  const { data: { user } } = await createClient().auth.getUser();
  if (user) redirect('/dashboard');
  return (
    <>
      <header className="top"><div className="wrap"><Logo /><nav className="nav"><Link href="/pricing">Pricing</Link><Link href="/login?mode=signin">Sign in</Link></nav></div></header>
      <main className="wrap home">
        <section className="hero">
          <p className="eyebrow">Free QR code generator</p>
          <h1>QR codes that open with a splash.</h1>
          <p className="lead">Your logo and colors on a loading screen, then a page with every link you need. Change where it goes after it’s printed, and see who scans it.</p>
          <div className="hero-cta"><Link className="btn primary" href="/login">Make a free QR code</Link><Link className="btn" href="/pricing">See pricing</Link></div>
          <p className="hint">Unlimited static codes free. 14 days of Pro included, no card needed.</p>
        </section>
        <section className="features">
          <div className="panel"><h2>Loading screen</h2><p className="muted">Show your brand for a second or two before your page opens.</p></div>
          <div className="panel"><h2>Links page</h2><p className="muted">Booking, Instagram, TikTok, phone and email in one place.</p></div>
          <div className="panel"><h2>Edit after printing</h2><p className="muted">Dynamic codes point to a short link, so flyers never go out of date.</p></div>
          <div className="panel"><h2>Never switched off</h2><p className="muted">If you cancel, your printed codes keep working.</p></div>
        </section>
      </main>
    </>
  );
}
