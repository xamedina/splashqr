# SplashQR

Free QR codes that never expire. Static and dynamic QR codes with a custom loading screen, a links page and scan stats.

Built with Next.js 14, Supabase (database, logins, logo storage) and Stripe (subscriptions). Hosted on Vercel.

## How it works

- **Dynamic codes** encode `https://splashqr.com/r/<slug>`. That route counts the scan, then sends the visitor to the loading screen and page at `/p/<slug>`, or straight to the website.
- **Static codes** encode the destination itself (or `/p/<slug>` for a links page). They're never tracked.
- **Plans** live in `src/lib/plans.ts`. New accounts get 14 days of Pro, then Free. When a plan lapses, codes keep working; codes over the plan's limit become read-only ("frozen").

## Setup

1. **Supabase:** create a project, open SQL Editor, paste `supabase/migrations/0001_init.sql` and run it. Under Authentication > URL Configuration, set Site URL to your app address and add `https://<your-domain>/auth/callback` to Redirect URLs.
2. **Stripe:** create two products, Starter ($4.99/month, $39/year) and Pro ($9.99/month, $79/year). Copy the four price ids. Add a webhook to `https://<your-domain>/api/stripe/webhook` for `checkout.session.completed` and `customer.subscription.created/updated/deleted`, and copy its signing secret. Turn on the customer portal (Settings > Billing > Customer portal).
3. **Vercel:** import the GitHub repo and add every variable from `.env.example`.

## Local development

```
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```
