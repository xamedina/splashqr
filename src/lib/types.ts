export type LinkKind = 'web' | 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'x' | 'phone' | 'email';
export type CodeKind = 'links' | 'web' | 'phone' | 'email';
export type CodeMode = 'dynamic' | 'static';
export type SplashAnim = 'pulse' | 'rise' | 'spin' | 'bar';

export interface LinkItem {
  kind: LinkKind;
  label: string;
  value: string;
}

export interface CodeContent {
  title: string;
  tagline: string;
  logoUrl: string | null;
  links: LinkItem[];
  url: string;
  phone: string;
  email: string;
}

export interface SplashSettings {
  on: boolean;
  bg: string;
  fg: string;
  anim: SplashAnim;
  secs: number;
  msg: string;
}

export interface PageSettings {
  primary: string;
  button: string;
  bg: string;
}

export interface QrSettings {
  fg: string;
  bg: string;
  eye: string;
  dots: 'square' | 'rounded' | 'dots';
  eyes: 'square' | 'rounded' | 'circle';
  logo: boolean;
  frame: 'none' | 'label';
  frameText: string;
  frameColor: string;
}

export interface CodeDesign {
  content: CodeContent;
  splash: SplashSettings;
  page: PageSettings;
  qr: QrSettings;
}

export interface CodeRow {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  kind: CodeKind;
  mode: CodeMode;
  design: CodeDesign;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  plan: 'free' | 'starter' | 'pro';
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
}
