import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { entitlements } from './plans';
import type { Profile } from './types';

/** For signed-in pages: the user, their profile and what their plan allows. */
export async function requireUser(next = '/dashboard') {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
  return { supabase, user, profile, ent: entitlements(profile), pastDue: profile?.subscription_status === 'past_due' };
}
