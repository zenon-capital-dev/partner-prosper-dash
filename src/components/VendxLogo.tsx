import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface Props {
  className?: string;
  size?: number;
}

export function ProsperLogo({ className, size = 28 }: Props) {
  return (
    <div 
      className={cn(
        "relative flex items-center justify-center rounded-xl bg-[#09090b] text-white shadow-2xl border border-white/10 group overflow-hidden", 
        className
      )}
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <TrendingUp 
        className="relative size-1/2 text-primary transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3" 
        strokeWidth={2.5}
      />
      <div className="absolute -bottom-1 -right-1 size-3 bg-primary blur-md opacity-20 group-hover:opacity-40 transition-opacity" />
    </div>
  );
}
