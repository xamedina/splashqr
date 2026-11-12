import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { stripe, planForPrice } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * Stripe tells us when someone subscribes, changes plan, pays, fails to pay or cancels.
 * Every event re-reads the subscription from Stripe and copies its state onto the profile,
 * so events arriving out of order or twice can't leave the plan wrong.
 */
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
  const sync = async (subscriptionId: string) => {
    const sub = await stripe().subscriptions.retrieve(subscriptionId);
    const userId = sub.metadata?.user_id;
    // past_due keeps access while Stripe's Smart Retries try the card again.
    const active = ['active', 'trialing', 'past_due'].includes(sub.status);
    const plan = active ? planForPrice(sub.items.data[0]?.price?.id) ?? 'free' : 'free';
    const patch = {
      plan,
      subscription_status: sub.status,
      stripe_subscription_id: active ? sub.id : null,
      stripe_customer_id: String(sub.customer),
    };
    if (userId) await db.from('profiles').update(patch).eq('id', userId);
    else await db.from('profiles').update(patch).eq('stripe_customer_id', String(sub.customer));
  };

  const invoiceSubscription = (inv: Stripe.Invoice) => {
    const s = inv.parent?.subscription_details?.subscription;
    return s ? (typeof s === 'string' ? s : s.id) : null;
  };

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.subscription) await sync(String(s.subscription));
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await sync((event.data.object as Stripe.Subscription).id);
      break;
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      // Stripe emails the customer and retries the card; we just keep the status current
      // so the app can show "update your card" while a payment is failing.
      const id = invoiceSubscription(event.data.object as Stripe.Invoice);
      if (id) await sync(id);
      break;
    }
  }
  return NextResponse.json({ received: true });
}
