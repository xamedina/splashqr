import type { Profile } from './types';

export type PlanId = 'free' | 'starter' | 'pro';

export interface Entitlements {
  plan: PlanId;          // what they effectively get right now
  onTrial: boolean;
  trialDaysLeft: number;
  editableDynamic: number; // how many dynamic codes can be edited (Infinity = all)
  customSplash: boolean;   // own logo, colors and message on the loading screen
  allAnimations: boolean;
  fullStats: boolean;      // city/device breakdowns and charts
  removeBranding: boolean;
  logoInCode: boolean;
}

const TABLE: Record<PlanId, Omit<Entitlements, 'plan' | 'onTrial' | 'trialDaysLeft'>> = {
  free:    { editableDynamic: 1,        customSplash: false, allAnimations: false, fullStats: false, removeBranding: false, logoInCode: false },
  starter: { editableDynamic: 10,       customSplash: true,  allAnimations: false, fullStats: true,  removeBranding: false, logoInCode: false },
  pro:     { editableDynamic: Infinity, customSplash: true,  allAnimations: true,  fullStats: true,  removeBranding: true,  logoInCode: true },
};

export function entitlements(profile: Pick<Profile, 'plan' | 'trial_ends_at'> | null, now = new Date()): Entitlements {
  const paid = profile?.plan ?? 'free';
  const ends = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const msLeft = ends ? ends.getTime() - now.getTime() : 0;
  const onTrial = paid === 'free' && msLeft > 0;
  const plan: PlanId = onTrial ? 'pro' : paid;
  return { plan, onTrial, trialDaysLeft: onTrial ? Math.ceil(msLeft / 86400000) : 0, ...TABLE[plan] };
}

/** The dynamic codes a user may still edit: the oldest N. Everything else keeps working but is frozen. */
export function editableIds(codes: { id: string; mode: string; created_at: string }[], ent: Entitlements): Set<string> {
  const dyn = codes.filter(c => c.mode === 'dynamic').sort((a, b) => a.created_at.localeCompare(b.created_at));
  return new Set(dyn.slice(0, ent.editableDynamic === Infinity ? dyn.length : ent.editableDynamic).map(c => c.id));
}

export const PRICES = {
  starter: { mo: 4.99, yr: 39 },
  pro: { mo: 9.99, yr: 79 },
};
