import { useId } from 'react';

/**
 * The Patrimonia mark: a roof (real estate) over rising bars (wealth that
 * grows), the tallest in gold. Same drawing as public/favicon.svg — change
 * both together.
 */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  // Several logos on one page must not share a gradient id.
  const fond = useId();
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={fond} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${fond})`} />
      <polyline
        points="12,31 32,14 52,31"
        fill="none"
        stroke="#fff"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="17" y="39" width="8.5" height="12" rx="2.25" fill="#fff" />
      <rect x="27.75" y="34.5" width="8.5" height="16.5" rx="2.25" fill="#fff" />
      <rect x="38.5" y="30.5" width="8.5" height="20.5" rx="2.25" fill="#fbbf24" />
    </svg>
  );
}
