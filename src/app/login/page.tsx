import { Suspense } from 'react';
import { LoginForm } from './LoginForm';
import { Logo } from '@/components/Logo';

export const metadata = { title: 'Sign in · SplashQR' };

export default function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Logo />
        <Suspense><LoginForm /></Suspense>
      </div>
    </div>
  );
}
