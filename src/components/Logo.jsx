/** Snackible mark: a bold S on an orange tile, with a small "bite" spark. */
export default function Logo({ size = 28 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Snackible">
      <defs>
        <linearGradient id="snk-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffa24a" />
          <stop offset="1" stopColor="#e8530a" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#snk-g)" />
      <rect width="32" height="15" rx="9" fill="#fff" opacity="0.1" />
      <path
        d="M21.4 11.2c-.7-2.1-2.8-3.2-5.4-3.2-3.1 0-5.1 1.5-5.1 3.7 0 5.3 10.6 2.4 10.6 7.8 0 2.4-2.3 4-5.6 4-2.8 0-5-1.1-5.8-3.4"
        fill="none" stroke="#fff" strokeWidth="3.1" strokeLinecap="round"
      />
      <circle cx="24.8" cy="7.6" r="1.9" fill="#fff" opacity="0.9" />
    </svg>
  );
}
