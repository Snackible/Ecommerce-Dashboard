/** Minimal mark: an orange shopping cart on a dark tile. */
export default function Logo({ size = 28 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Snackible">
      <rect width="32" height="32" rx="8" fill="#15171e" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="#f97316" strokeOpacity="0.35" />
      <path d="M9.1 10.8h15.7l-2.3 9.3H10.9z" fill="#f97316" fillOpacity="0.28" />
      <path d="M5 7.5h3.4l2.5 12.6h11.6l2.3-9.3H9.1" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12.6" cy="24.8" r="1.9" fill="#f97316" />
      <circle cx="21.4" cy="24.8" r="1.9" fill="#f97316" />
    </svg>
  );
}
