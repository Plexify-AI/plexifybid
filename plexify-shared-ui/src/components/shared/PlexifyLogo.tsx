export default function PlexifyLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="8" fill="#4f46e5" />
      <path
        d="M10 8h8c3.314 0 6 2.686 6 6s-2.686 6-6 6h-4v4h-4V8z"
        fill="white"
      />
      <circle cx="18" cy="14" r="2" fill="#4f46e5" />
    </svg>
  );
}
