import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Sparkles, CalendarClock } from "lucide-react";

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  className?: string;
  hideBreadcrumbs?: boolean;
  breadcrumbOverride?: Record<string, string>;
}

/**
 * Executive page header — sober B2B admin surface.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  icon,
  className,
  hideBreadcrumbs,
  breadcrumbOverride,
}: Props) {
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  return (
    <header className={cn("relative px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8 pb-4 sm:pb-6 space-y-4 sm:space-y-6 border-b border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.02)]", className)}>
      {!hideBreadcrumbs && <Breadcrumbs override={breadcrumbOverride} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-6">
        <div className="flex items-start gap-4 sm:gap-5 min-w-0 flex-1">
          {icon && (
            <div className="relative shrink-0 pt-0.5">
              <div className="size-11 sm:size-12 lg:size-14 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg ring-1 ring-slate-950/5">
                {icon}
              </div>
              <div className="absolute -bottom-1 -right-1 size-3.5 rounded-full bg-emerald-500 ring-2 ring-white shadow-sm" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && (
                <div className="flex items-center gap-2 text-[10px] sm:text-[10.5px] uppercase tracking-[0.18em] font-bold text-slate-500/80 flex-wrap mb-1.5">
                <CalendarClock className="size-3 text-indigo-500" />
                <span>{eyebrow}</span>
                <span className="hidden sm:inline size-1 rounded-full bg-slate-200" />
                <Sparkles className="hidden sm:inline size-3.5 text-indigo-500" />
              </div>
            )}
            <h1 className="text-2xl sm:text-[26px] lg:text-[32px] font-bold text-slate-900 tracking-tight leading-tight font-display">
              {title}
            </h1>
            {description && (
              <p className="text-[13px] sm:text-[14px] text-slate-500 mt-1.5 max-w-3xl leading-relaxed line-clamp-2 sm:line-clamp-none">
                {description}
              </p>
            )}
            <p className="hidden sm:block text-[11px] font-medium text-slate-400 mt-2 capitalize">{today}</p>
            {meta && <div className="flex flex-wrap items-center gap-2 pt-2.5">{meta}</div>}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2.5 sm:shrink-0 flex-wrap w-full sm:w-auto mt-2 sm:mt-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
