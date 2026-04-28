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
      <rect x="1" y="1" width="30" height="30" rx="8" fill="hsl(var(--sidebar-primary))" />
      <path
        d="M8 10 L16 23 L24 10"
        stroke="hsl(var(--sidebar-primary-foreground))"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
