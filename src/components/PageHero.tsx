import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Sparkles, CalendarClock } from "lucide-react";

interface KpiItem {
  label: string;
  value: ReactNode;
  tone?: "primary" | "success" | "warning" | "info" | "danger" | "violet" | "default";
  icon?: ReactNode;
  hint?: string;
}

interface Props {
  eyebrow?: string;
  category?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  kpis?: KpiItem[];
  icon?: ReactNode;
  hideBreadcrumbs?: boolean;
}

const toneCfg: Record<string, { text: string; bg: string; ring: string; dot: string; grad: string; iconBg: string }> = {
  primary: { text: "text-indigo-700 dark:text-indigo-300", bg: "bg-indigo-50 dark:bg-indigo-500/10", ring: "ring-indigo-100 dark:ring-indigo-500/20", dot: "bg-indigo-500", grad: "from-indigo-500 to-indigo-600", iconBg: "bg-indigo-600" },
  success: { text: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-500/10", ring: "ring-emerald-100 dark:ring-emerald-500/20", dot: "bg-emerald-500", grad: "from-emerald-500 to-emerald-600", iconBg: "bg-emerald-600" },
  warning: { text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-500/10", ring: "ring-amber-100 dark:ring-amber-500/20", dot: "bg-amber-500", grad: "from-amber-500 to-amber-600", iconBg: "bg-amber-600" },
  info: { text: "text-sky-700 dark:text-sky-300", bg: "bg-sky-50 dark:bg-sky-500/10", ring: "ring-sky-100 dark:ring-sky-500/20", dot: "bg-sky-500", grad: "from-sky-500 to-sky-600", iconBg: "bg-sky-600" },
  danger: { text: "text-rose-700 dark:text-rose-300", bg: "bg-rose-50 dark:bg-rose-500/10", ring: "ring-rose-100 dark:ring-rose-500/20", dot: "bg-rose-500", grad: "from-rose-500 to-rose-600", iconBg: "bg-rose-600" },
  violet: { text: "text-violet-700 dark:text-violet-300", bg: "bg-violet-50 dark:bg-violet-500/10", ring: "ring-violet-100 dark:ring-violet-500/20", dot: "bg-violet-500", grad: "from-violet-500 to-violet-600", iconBg: "bg-violet-600" },
  default: { text: "text-slate-700 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-500/10", ring: "ring-slate-200 dark:ring-slate-500/20", dot: "bg-slate-400", grad: "from-slate-400 to-slate-500", iconBg: "bg-slate-700" },
};

export function PageHero({
  eyebrow,
  category,
  title,
  description,
  actions,
  kpis,
  icon,
  hideBreadcrumbs,
}: Props) {
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <section className="relative max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 pt-5 sm:pt-8 lg:pt-10 pb-2 space-y-5 sm:space-y-7">
      {/* ambient — soft indigo wash, almost invisible */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-300/40 dark:via-indigo-500/20 to-transparent" />
      </div>

      {!hideBreadcrumbs && <Breadcrumbs />}

      <header className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-start justify-between gap-4 sm:gap-6">
        <div className="flex items-start gap-3 sm:gap-5 min-w-0 flex-1">
          {icon && (
            <div className="relative shrink-0">
              <div className="size-11 sm:size-14 lg:size-[60px] rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-lg ring-1 ring-white/10">
                {icon}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/25 via-transparent to-transparent pointer-events-none" />
              <div className="absolute -bottom-1 -right-1 size-3.5 rounded-full bg-emerald-400 ring-[2.5px] ring-white dark:ring-background shadow-sm" />
            </div>
          )}
          <div className="min-w-0">
            {(eyebrow || category) && (
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] font-bold">
                <CalendarClock className="size-3 text-slate-800 dark:text-muted-foreground" />
                <span className="text-slate-600 dark:text-muted-foreground">{eyebrow}</span>
                {category && (
                  <>
                    <span className="size-1 rounded-full bg-slate-300" />
                    <Sparkles className="size-3 text-indigo-500" />
                    <span className="text-indigo-700 dark:text-primary">{category}</span>
                  </>
                )}
              </div>
            )}
            <h1 className="text-[24px] sm:text-[26px] lg:text-[32px] font-extrabold text-slate-950 dark:text-foreground mt-2 leading-[1.08] font-display">
              {title}
            </h1>
            {description && (
              <p className="text-[13.5px] text-slate-700 dark:text-muted-foreground mt-2 max-w-2xl leading-relaxed font-medium">
                {description}
              </p>
            )}
            <p className="text-[10.5px] text-slate-800 dark:text-muted-foreground mt-2.5 capitalize tracking-wide font-bold">{today}</p>
          </div>
        </div>

        {actions && (
          <div className="w-full sm:w-auto min-w-0 pb-1 -mb-1 scrollbar-hide">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 [&>*]:shrink-0 [&>button]:h-10 [&>a]:h-10">
              {actions}
            </div>
          </div>
        )}
      </header>

      {kpis && kpis.length > 0 && (
        <div
          className="grid grid-cols-2 lg:[grid-template-columns:var(--hero-kpi-cols)] gap-3 lg:gap-4 lg:[grid-template-columns:var(--hero-kpi-cols)]"
          style={{ "--hero-kpi-cols": `repeat(${Math.min(kpis.length, 6)}, minmax(0, 1fr))` } as CSSProperties}
        >
          {kpis.map((k, i) => {
            const cfg = toneCfg[k.tone || "default"];
            return (
              <div
                key={i}
                className={cn(
                  "group/kpi relative min-w-0 overflow-hidden rounded-xl border bg-white dark:bg-card p-3 sm:p-4 lg:p-[18px] transition-all duration-300",
                  "border-slate-200/70 dark:border-border shadow-[0_1px_0_rgba(15,23,42,0.04)]",
                  "hover:shadow-[0_8px_28px_-12px_rgba(15,23,42,0.15)] hover:-translate-y-[1px] hover:border-slate-300/80"
                )}
              >
                {/* soft top accent — coloured by tone */}
                <div className={cn("absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r opacity-80", cfg.grad)} />
                {/* radial glow on hover */}
                <div className={cn(
                  "absolute inset-0 opacity-0 group-hover/kpi:opacity-100 transition-opacity duration-500 pointer-events-none",
                  "bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.07),transparent_60%)]"
                )} />
                <div className="flex items-center justify-between mb-3 relative">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("size-1.5 rounded-full shrink-0", cfg.dot)} />
                    <p className="text-[9px] sm:text-[9.5px] font-extrabold uppercase tracking-[0.14em] sm:tracking-[0.18em] text-slate-600 dark:text-muted-foreground truncate">
                      {k.label}
                    </p>
                  </div>
                  {k.icon && (
                    <div className={cn(
                      "hidden sm:flex size-8 rounded-lg items-center justify-center shrink-0 ring-1 transition-all group-hover/kpi:scale-[1.08]",
                      cfg.bg, cfg.text, cfg.ring
                    )}>
                      {k.icon}
                    </div>
                  )}
                </div>
                <p className="font-display text-[20px] sm:text-[24px] lg:text-[28px] font-extrabold tabular-nums leading-tight break-words text-slate-950 dark:text-foreground relative">
                  {k.value}
                </p>
                {k.hint && (
                  <p className="text-[11px] text-slate-600 dark:text-muted-foreground mt-2 truncate relative font-bold">{k.hint}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
