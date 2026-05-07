interface Props {
  className?: string;
  size?: number;
}

export function ProsperLogo({ className, size = 28 }: Props) {
  return (
    <div 
      className={cn(
        "flex items-center justify-center rounded-xl bg-slate-950 text-white shadow-xl border border-white/10", 
        className
      )}
      style={{ width: size, height: size }}
    >
      <TrendingUp className="size-1/2 text-primary animate-pulse-gentle" />
    </div>
  );
}

import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";
