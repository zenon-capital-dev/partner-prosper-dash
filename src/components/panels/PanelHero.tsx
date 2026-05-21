import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PanelRole, ROLE_THEME } from "./types";

interface HeroStat { label: string; value: ReactNode; sub?: string }
interface Props {
  role: PanelRole;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  stats?: HeroStat[];
  actions?: ReactNode;
  children?: ReactNode;
}

export function PanelHero({ role, eyebrow, title, subtitle, stats, actions, children }: Props) {
  const theme = ROLE_THEME[role];
  return (
    <section className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-lg shadow-slate-900/5", theme.gradient)}>
      {/* decorative blobs */}
      <div className="absolute -top-20 -right-16 size-72 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-24 -left-10 size-80 rounded-full bg-black/10 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />

      <div className="relative px-5 sm:px-8 py-7 sm:py-9">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            {eyebrow && (
              <p className="text-[10.5px] font-semibold tracking-[0.22em] uppercase text-white/80">{eyebrow}</p>
            )}
            <h1 className="mt-1.5 text-2xl sm:text-[28px] lg:text-[32px] font-semibold tracking-tight leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-[13.5px] sm:text-sm text-white/85 leading-relaxed">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>

        {stats && stats.length > 0 && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {stats.map((s, i) => (
              <div key={i} className="rounded-xl bg-white/12 backdrop-blur-sm border border-white/15 px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/75">{s.label}</p>
                <p className="mt-1 font-mono text-xl sm:text-[22px] font-semibold tabular-nums leading-none">{s.value}</p>
                {s.sub && <p className="mt-1 text-[11px] text-white/70">{s.sub}</p>}
              </div>
            ))}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
