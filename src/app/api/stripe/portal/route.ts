import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

/** "Manage billing": Stripe's own page for changing plan, card or cancelling. */
export async function POST(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login?next=/account', origin), 303);
  const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
  if (!profile?.stripe_customer_id) return NextResponse.redirect(new URL('/pricing', origin), 303);
  const session = await stripe().billingPortal.sessions.create({ customer: profile.stripe_customer_id, return_url: `${origin}/account` });
  return NextResponse.redirect(session.url, 303);
}
