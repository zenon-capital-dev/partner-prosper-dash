interface Props {
  className?: string;
  size?: number;
}

export function VendxLogo({ className, size = 28 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="vendx-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <path
        d="M4 5 L16 27 L28 5 L23 5 L16 18 L9 5 Z"
        fill="url(#vendx-grad)"
        stroke="url(#vendx-grad)"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
