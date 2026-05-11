import { ReactNode } from "react";
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

const toneCfg: Record<string, { text: string; bg: string; ring: string; dot: string; grad: string }> = {
  primary: { text: "text-indigo-600 dark:text-indigo-300", bg: "bg-indigo-50 dark:bg-indigo-500/10", ring: "ring-indigo-200/60 dark:ring-indigo-500/20", dot: "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]", grad: "from-indigo-500 to-indigo-600" },
  success: { text: "text-emerald-600 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-500/10", ring: "ring-emerald-200/60 dark:ring-emerald-500/20", dot: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]", grad: "from-emerald-500 to-emerald-600" },
  warning: { text: "text-amber-600 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-500/10", ring: "ring-amber-200/60 dark:ring-amber-500/20", dot: "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]", grad: "from-amber-500 to-amber-600" },
  info: { text: "text-sky-600 dark:text-sky-300", bg: "bg-sky-50 dark:bg-sky-500/10", ring: "ring-sky-200/60 dark:ring-sky-500/20", dot: "bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.6)]", grad: "from-sky-500 to-sky-600" },
  danger: { text: "text-rose-600 dark:text-rose-300", bg: "bg-rose-50 dark:bg-rose-500/10", ring: "ring-rose-200/60 dark:ring-rose-500/20", dot: "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]", grad: "from-rose-500 to-rose-600" },
  violet: { text: "text-violet-600 dark:text-violet-300", bg: "bg-violet-50 dark:bg-violet-500/10", ring: "ring-violet-200/60 dark:ring-violet-500/20", dot: "bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.6)]", grad: "from-violet-500 to-violet-600" },
  default: { text: "text-slate-700 dark:text-zinc-200", bg: "bg-slate-100 dark:bg-white/5", ring: "ring-slate-200 dark:ring-white/10", dot: "bg-slate-400", grad: "from-slate-500 to-slate-600" },
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
    <section className="relative px-5 lg:px-8 pt-6 lg:pt-8 pb-2 space-y-6">
      {/* ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        <div className="absolute -top-32 -left-32 size-[500px] rounded-full bg-indigo-200/30 dark:bg-indigo-600/[0.06] blur-[140px]" />
        <div className="absolute top-1/3 -right-32 size-[400px] rounded-full bg-violet-200/25 dark:bg-violet-600/[0.04] blur-[140px]" />
      </div>

      {!hideBreadcrumbs && <Breadcrumbs />}

      <header className="flex flex-wrap items-start justify-between gap-4">
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
            {(eyebrow || category) && (
              <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] font-bold text-slate-400 dark:text-zinc-600">
                <CalendarClock className="size-3" />
                <span className="text-slate-500 dark:text-zinc-500">{eyebrow}</span>
                {category && (
                  <>
                    <span className="size-1 rounded-full bg-slate-300 dark:bg-zinc-700" />
                    <Sparkles className="size-3 text-indigo-500" />
                    <span className="text-indigo-500 dark:text-indigo-400">{category}</span>
                  </>
                )}
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
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
        )}
      </header>

      {kpis && kpis.length > 0 && (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(kpis.length, 6)}, minmax(0, 1fr))` }}
        >
          {kpis.map((k, i) => {
            const cfg = toneCfg[k.tone || "default"];
            return (
              <div
                key={i}
                className={cn(
                  "relative overflow-hidden rounded-2xl border bg-card p-4 transition-all group hover:shadow-md hover:-translate-y-0.5",
                  "border-slate-200 dark:border-white/[0.06]"
                )}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("size-1.5 rounded-full shrink-0", cfg.dot)} />
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500 truncate">
                      {k.label}
                    </p>
                  </div>
                  {k.icon && (
                    <div className={cn("size-7 rounded-lg flex items-center justify-center shrink-0", cfg.bg, cfg.text)}>
                      {k.icon}
                    </div>
                  )}
                </div>
                <p className={cn("font-display text-[22px] lg:text-[26px] font-bold tracking-tight tabular-nums leading-none truncate text-slate-900 dark:text-white")}>
                  {k.value}
                </p>
                {k.hint && (
                  <p className="text-[10.5px] text-slate-400 dark:text-zinc-600 mt-1.5 truncate">{k.hint}</p>
                )}
                <div className={cn("absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r opacity-60", cfg.grad)} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
