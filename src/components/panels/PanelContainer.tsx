import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PanelContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("px-4 sm:px-6 lg:px-8 py-5 sm:py-6 max-w-[1400px] w-full mx-auto space-y-5 sm:space-y-6", className)}>
      {children}
    </div>
  );
}
