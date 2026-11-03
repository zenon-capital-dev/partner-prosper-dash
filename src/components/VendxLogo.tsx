import { cn } from "@/lib/utils";
import { ZenonLogo } from "@/components/ZenonLogo";

interface Props {
  className?: string;
  size?: number;
}

/** Mantido por compatibilidade de imports: exibe o selo oficial da ZENON. */
export function ProsperLogo({ className, size = 28 }: Props) {
  return (
    <span className={cn("inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <ZenonLogo variant="selo-azul" height={size} />
    </span>
  );
}
