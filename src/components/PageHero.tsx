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
  primary: { text: "text-slate-900", bg: "bg-slate-100", ring: "ring-slate-200/60", dot: "bg-slate-600 shadow-sm", grad: "from-slate-700 to-slate-900" },
  success: { text: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200/60", dot: "bg-emerald-500 shadow-sm", grad: "from-emerald-500 to-emerald-600" },
  warning: { text: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-200/60", dot: "bg-amber-500 shadow-sm", grad: "from-amber-500 to-amber-600" },
  info: { text: "text-sky-600", bg: "bg-sky-50", ring: "ring-sky-200/60", dot: "bg-sky-500 shadow-sm", grad: "from-sky-500 to-sky-600" },
  danger: { text: "text-rose-600", bg: "bg-rose-50", ring: "ring-rose-200/60", dot: "bg-rose-500 shadow-sm", grad: "from-rose-500 to-rose-600" },
  violet: { text: "text-slate-900", bg: "bg-slate-100", ring: "ring-slate-200/60", dot: "bg-slate-600 shadow-sm", grad: "from-slate-700 to-slate-900" },
  default: { text: "text-slate-700", bg: "bg-slate-100", ring: "ring-slate-200", dot: "bg-slate-400", grad: "from-slate-500 to-slate-600" },
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
    <section className="relative px-5 lg:px-8 pt-7 lg:pt-9 pb-3 space-y-7">
      {/* ambient orbs — refined */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 size-[560px] rounded-full bg-slate-200/25 blur-[160px]" />
        <div className="absolute top-1/3 -right-40 size-[440px] rounded-full bg-slate-200/20 blur-[160px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
      </div>

      {!hideBreadcrumbs && <Breadcrumbs />}

      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-5 min-w-0 flex-1">
          {icon && (
            <div className="relative shrink-0">
              <div className="size-14 lg:size-16 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xl ring-1 ring-white/10">
                {icon}
              </div>
              <div className="absolute -bottom-1 -right-1 size-3.5 rounded-full bg-emerald-400 ring-2 ring-background shadow-md" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
            </div>
          )}
          <div className="min-w-0">
            {(eyebrow || category) && (
              <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.24em] font-bold text-slate-400">
                <CalendarClock className="size-3" />
                <span className="text-slate-500">{eyebrow}</span>
                {category && (
                  <>
                    <span className="size-1 rounded-full bg-slate-300" />
                    <Sparkles className="size-3 text-slate-500" />
                    <span className="text-slate-700">{category}</span>
                  </>
                )}
              </div>
            )}
            <h1 className="text-[26px] lg:text-[32px] font-bold text-slate-900 tracking-[-0.02em] mt-1.5 leading-[1.1] font-display">
              {title}
            </h1>
            {description && (
              <p className="text-[13.5px] text-slate-500 mt-2 max-w-2xl leading-relaxed">
                {description}
              </p>
            )}
            <p className="text-[10.5px] text-slate-400 mt-2 capitalize tracking-wide">{today}</p>
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
        )}
      </header>

      {kpis && kpis.length > 0 && (
        <div
          className="grid gap-3.5"
          style={{ gridTemplateColumns: `repeat(${Math.min(kpis.length, 6)}, minmax(0, 1fr))` }}
        >
          {kpis.map((k, i) => {
            const cfg = toneCfg[k.tone || "default"];
            return (
              <div
                key={i}
                className={cn(
                  "group/kpi relative overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300",
                  "border-slate-200/80",
                  "hover:shadow-[0_8px_28px_-12px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 hover:border-slate-300"
                )}
              >
                {/* subtle radial glow on hover */}
                <div className={cn(
                  "absolute inset-0 opacity-0 group-hover/kpi:opacity-100 transition-opacity duration-500 pointer-events-none",
                  "bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_60%)]"
                )} />
                <div className="flex items-center justify-between mb-3 relative">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("size-1.5 rounded-full shrink-0", cfg.dot)} />
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-slate-500 truncate">
                      {k.label}
                    </p>
                  </div>
                  {k.icon && (
                    <div className={cn(
                      "size-8 rounded-xl flex items-center justify-center shrink-0 ring-1 transition-transform group-hover/kpi:scale-110",
                      cfg.bg, cfg.text, cfg.ring
                    )}>
                      {k.icon}
                    </div>
                  )}
                </div>
                <p className="font-display text-[24px] lg:text-[30px] font-bold tracking-[-0.02em] tabular-nums leading-none truncate text-slate-900 relative">
                  {k.value}
                </p>
                {k.hint && (
                  <p className="text-[11px] text-slate-400 mt-2 truncate relative">{k.hint}</p>
                )}
                <div className={cn(
                  "absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r opacity-70 group-hover/kpi:opacity-100 transition-opacity",
                  cfg.grad
                )} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
