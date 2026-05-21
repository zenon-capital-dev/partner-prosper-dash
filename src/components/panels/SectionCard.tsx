import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface Props {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
  padding?: "default" | "tight" | "none";
}

export function SectionCard({ title, subtitle, icon: Icon, action, className, children, padding = "default" }: Props) {
  return (
    <section className={cn(
      "bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden",
      className
    )}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <div className="size-8 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-500 shrink-0">
                <Icon className="size-[15px]" />
              </div>
            )}
            <div className="min-w-0">
              {title && <h3 className="text-[14px] font-semibold text-slate-900 leading-tight truncate">{title}</h3>}
              {subtitle && <p className="text-[11.5px] text-slate-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn(
        padding === "default" && "p-4 sm:p-5",
        padding === "tight" && "p-2",
        padding === "none" && ""
      )}>
        {children}
      </div>
    </section>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      {Icon && (
        <div className="mx-auto size-12 rounded-full bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-400 mb-3">
          <Icon className="size-5" />
        </div>
      )}
      <p className="text-[14px] font-semibold text-slate-800">{title}</p>
      {description && <p className="text-[12.5px] text-slate-500 mt-1 max-w-xs mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
