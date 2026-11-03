import { cn } from "@/lib/utils";
import { ZenonLogo } from "@/components/ZenonLogo";

interface Props { className?: string; size?: number; }

// Preserve the existing import contract for callers.
export function ProsperLogo({ className, size = 28 }: Props) {
  return <div className={cn("flex items-center justify-center bg-[#172d44] rounded-lg", className)} style={{ width: size, height: size }}>
    <ZenonLogo compact tone="light" className="w-full h-full p-1" />
  </div>;
}
