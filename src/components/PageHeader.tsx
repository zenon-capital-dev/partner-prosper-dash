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
 * Executive page header — light gradient orbs + gradient icon (mesma linha do Dashboard Admin).
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
    <header className={cn("relative px-5 lg:px-8 pt-6 lg:pt-8 pb-5 space-y-5", className)}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        <div className="absolute -top-32 -left-32 size-[500px] rounded-full bg-indigo-200/30 dark:bg-indigo-600/[0.06] blur-[140px]" />
        <div className="absolute top-1/3 -right-32 size-[400px] rounded-full bg-violet-200/25 dark:bg-violet-600/[0.04] blur-[140px]" />
      </div>

      {!hideBreadcrumbs && <Breadcrumbs override={breadcrumbOverride} />}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          {icon && (
            <div className="relative shrink-0">
              <div className="size-12 lg:size-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-[0_8px_24px_-6px_rgba(99,102,241,0.5)] ring-1 ring-white/40">
                {icon}
              </div>
              <div className="absolute -bottom-1 -right-1 size-3.5 rounded-full bg-emerald-400 ring-2 ring-background shadow-md" />
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] font-bold text-slate-400 dark:text-zinc-600">
                <CalendarClock className="size-3" />
                <span className="text-slate-500 dark:text-zinc-500">{eyebrow}</span>
                <span className="size-1 rounded-full bg-slate-300 dark:bg-zinc-700" />
                <Sparkles className="size-3 text-indigo-500" />
                <span className="text-indigo-500 dark:text-indigo-400">Operacional</span>
              </div>
            )}
            <h1 className="text-[22px] lg:text-[28px] font-bold text-slate-900 dark:text-white tracking-tight mt-1 leading-tight font-display">
              {title}
            </h1>
            {description && (
              <p className="text-[13px] text-slate-500 dark:text-zinc-500 mt-1 max-w-2xl leading-relaxed">
                {description}
              </p>
            )}
            <p className="text-[11px] text-slate-400 dark:text-zinc-600 mt-1 capitalize">{today}</p>
            {meta && <div className="flex flex-wrap items-center gap-2 pt-2">{meta}</div>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
      </div>
    </header>
  );
}
