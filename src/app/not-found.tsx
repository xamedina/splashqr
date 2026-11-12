import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Logo />
        <div className="auth-body">
          <h1>This code isn’t set up</h1>
          <p className="muted">The QR code or page you opened doesn’t exist, or its owner deleted it.</p>
          <Link className="btn primary" href="/">Make your own QR code</Link>
        </div>
      </div>
    </div>
  );
}
