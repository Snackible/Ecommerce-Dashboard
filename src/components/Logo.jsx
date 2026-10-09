/** Shopping bag with a rising line: ecommerce + performance, on the brand orange tile. */
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
      <path d="M12.6 13.6V12a3.4 3.4 0 0 1 6.8 0v1.6" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M8.6 12.4h14.8l1.1 11.2a2.2 2.2 0 0 1-2.2 2.4H9.7a2.2 2.2 0 0 1-2.2-2.4z" fill="#fff" />
      <path d="M12.2 22.2l2.7-3.1 2.1 2 3.2-4" fill="none" stroke="#ea580c" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
