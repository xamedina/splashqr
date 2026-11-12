import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { stripe, planForPrice } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/** Stripe tells us when someone subscribes, changes plan or cancels. */
export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new NextResponse('Missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), sig, secret);
  } catch {
    return new NextResponse('Bad signature', { status: 400 });
  }

  const db = createAdminClient();
  const setFromSubscription = async (sub: Stripe.Subscription) => {
    const userId = sub.metadata?.user_id;
    const active = ['active', 'trialing', 'past_due'].includes(sub.status);
    const plan = active ? planForPrice(sub.items.data[0]?.price?.id) ?? 'free' : 'free';
    const patch = { plan, stripe_subscription_id: active ? sub.id : null, stripe_customer_id: String(sub.customer) };
    if (userId) await db.from('profiles').update(patch).eq('id', userId);
    else await db.from('profiles').update(patch).eq('stripe_customer_id', String(sub.customer));
  };

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.subscription) await setFromSubscription(await stripe().subscriptions.retrieve(String(s.subscription)));
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await setFromSubscription(event.data.object as Stripe.Subscription);
      break;
  }
  return NextResponse.json({ received: true });
}
