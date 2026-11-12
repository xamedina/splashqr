import Link from 'next/link';

/** The SplashQR wordmark with the red scanner corners. */
export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="SplashQR home">
      <span className="wm" aria-hidden="true">
        <span className="wm-s">SPLASH</span><span className="wm-q">QR</span>
        <i className="cb tl" /><i className="cb tr" /><i className="cb bl" /><i className="cb br" />
      </span>
    </Link>
  );
}
