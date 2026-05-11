import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/Breadcrumbs";

interface KpiItem {
  label: string;
  value: ReactNode;
  tone?: "primary" | "success" | "warning" | "info" | "danger" | "default";
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

const toneAccentMap: Record<string, string> = {
  primary: "from-indigo-300 via-purple-300 to-pink-300",
  success: "from-emerald-300 to-teal-300",
  warning: "from-amber-300 to-orange-300",
  info: "from-sky-300 to-cyan-300",
  danger: "from-rose-300 to-pink-300",
  default: "from-white to-white/70",
};

const toneDot: Record<string, string> = {
  primary: "bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.7)]",
  success: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]",
  warning: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.7)]",
  info: "bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.7)]",
  danger: "bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.7)]",
  default: "bg-white/60",
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
  return (
    <section className="px-6 lg:px-12 pt-8 lg:pt-10 pb-2 space-y-7">
      {!hideBreadcrumbs && <Breadcrumbs />}

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
        {/* Title block */}
        <div className="space-y-4 min-w-0 flex-1">
          {(eyebrow || category) && (
            <span className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/70">
                {eyebrow}
                {category && (
                  <>
                    <span className="text-white/30 mx-2">·</span>
                    {category}
                  </>
                )}
              </span>
            </span>
          )}
          <div className="flex items-start gap-5">
            {icon && (
              <div className="size-14 lg:size-16 rounded-2xl bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-pink-500/20 text-white flex items-center justify-center shrink-0 border border-white/10 backdrop-blur-md shadow-[0_8px_24px_-8px_rgba(139,92,246,0.5)]">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-display text-[36px] lg:text-[52px] xl:text-[60px] font-bold tracking-tighter text-white leading-[0.95]">
                {title}
              </h1>
              {description && (
                <p className="text-[14px] lg:text-[15px] text-white/55 max-w-2xl leading-relaxed mt-4">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
        )}
      </div>

      {/* KPI strip — glass */}
      {kpis && kpis.length > 0 && (
        <div
          className="grid gap-3 lg:gap-4"
          style={{ gridTemplateColumns: `repeat(${Math.min(kpis.length, 6)}, minmax(0, 1fr))` }}
        >
          {kpis.map((k, i) => {
            const tone = k.tone || "default";
            return (
              <div
                key={i}
                className="vx-card p-5 group relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-1.5 rounded-full", toneDot[tone])} />
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-white/40 truncate">
                      {k.label}
                    </p>
                  </div>
                  {k.icon && (
                    <div className="text-white/40 group-hover:text-white/70 transition-colors">
                      {k.icon}
                    </div>
                  )}
                </div>
                <p
                  className={cn(
                    "font-display text-[26px] lg:text-[32px] font-bold tracking-tighter tabular-nums leading-none bg-gradient-to-br bg-clip-text text-transparent truncate",
                    toneAccentMap[tone]
                  )}
                >
                  {k.value}
                </p>
                {k.hint && (
                  <p className="text-[10.5px] text-white/40 mt-2 truncate">{k.hint}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
