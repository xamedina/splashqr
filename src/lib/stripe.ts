import Stripe from 'stripe';

export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key);
}

/** Stripe price ids, set in Vercel. Monthly and yearly for each paid plan. */
export function priceId(plan: 'starter' | 'pro', period: 'mo' | 'yr') {
  const env = {
    starter_mo: process.env.STRIPE_PRICE_STARTER_MONTHLY, starter_yr: process.env.STRIPE_PRICE_STARTER_YEARLY,
    pro_mo: process.env.STRIPE_PRICE_PRO_MONTHLY, pro_yr: process.env.STRIPE_PRICE_PRO_YEARLY,
  } as Record<string, string | undefined>;
  return env[`${plan}_${period}`];
}

export function planForPrice(price: string | undefined | null): 'starter' | 'pro' | null {
  if (!price) return null;
  if ([process.env.STRIPE_PRICE_PRO_MONTHLY, process.env.STRIPE_PRICE_PRO_YEARLY].includes(price)) return 'pro';
  if ([process.env.STRIPE_PRICE_STARTER_MONTHLY, process.env.STRIPE_PRICE_STARTER_YEARLY].includes(price)) return 'starter';
  return null;
}
