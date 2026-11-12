import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { stripe, priceId } from '@/lib/stripe';

/** Pricing page buttons post here. Sends the user to Stripe's hosted checkout. */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const plan = form.get('plan') === 'pro' ? 'pro' : 'starter';
  const period = form.get('period') === 'mo' ? 'mo' : 'yr';
  const origin = new URL(req.url).origin;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login?next=/pricing', origin), 303);

  const price = priceId(plan, period);
  if (!price) return NextResponse.redirect(new URL('/pricing?error=setup', origin), 303);

  const s = stripe();
  const db = createAdminClient();
  const { data: profile } = await db.from('profiles').select('stripe_customer_id, stripe_subscription_id').eq('id', user.id).single();
  let customer = profile?.stripe_customer_id as string | null;

  // Already subscribed: change plans in Stripe's billing page instead of starting a second subscription.
  if (customer && profile?.stripe_subscription_id) {
    const portal = await s.billingPortal.sessions.create({ customer, return_url: `${origin}/account` });
    return NextResponse.redirect(portal.url, 303);
  }
  if (!customer) {
    customer = (await s.customers.create({ email: user.email, metadata: { user_id: user.id } })).id;
    await db.from('profiles').update({ stripe_customer_id: customer }).eq('id', user.id);
  }

  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${origin}/dashboard?upgraded=1`,
    cancel_url: `${origin}/pricing`,
  });
  return NextResponse.redirect(session.url!, 303);
}
