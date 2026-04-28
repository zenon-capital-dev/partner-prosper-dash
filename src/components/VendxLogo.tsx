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
      <path
        d="M5 6 L16 26 L27 6"
        stroke="#F5C518"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M11 6 L16 15 L21 6"
        stroke="#F5C518"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.55"
      />
    </svg>
  );
}
