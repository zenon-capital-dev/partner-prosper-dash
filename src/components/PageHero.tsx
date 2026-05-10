import { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
}

const toneText: Record<string, string> = {
  primary: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  danger: "text-destructive",
  default: "text-foreground",
};

const toneAccent: Record<string, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  danger: "bg-destructive",
  default: "bg-primary",
};

export function PageHero({ eyebrow, category, title, description, actions, kpis, icon }: Props) {
  return (
    <section className="hero-v4">
      <div className="relative px-6 lg:px-8 py-7 lg:py-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          {/* Title block */}
          <div className="space-y-3 min-w-0 flex-1">
            {(eyebrow || category) && (
              <div className="flex items-center gap-2.5 h-4">
                {eyebrow && <span className="eyebrow">{eyebrow}</span>}
                {category && (
                  <>
                    <span className="text-border/80">·</span>
                    <span className="eyebrow-muted">{category}</span>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-3.5">
              {icon && (
                <div className="size-11 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary flex items-center justify-center shrink-0 border border-primary/15 shadow-sm">
                  {icon}
                </div>
              )}
              <div>
                <h1 className="font-display text-[26px] lg:text-[30px] font-semibold tracking-tight text-foreground leading-[1.1]">
                  {title}
                </h1>
                {description && (
                  <p className="text-[13px] text-muted-foreground max-w-2xl leading-relaxed mt-1.5">{description}</p>
                )}
              </div>
            </div>
          </div>

          {actions && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
          )}
        </div>

        {/* KPI strip */}
        {kpis && kpis.length > 0 && (
          <div
            className="mt-7 grid gap-px bg-border/70 rounded-xl overflow-hidden border border-border"
            style={{ gridTemplateColumns: `repeat(${kpis.length}, minmax(0, 1fr))` }}
          >
            {kpis.map((k, i) => {
              const tone = k.tone || "default";
              return (
                <div key={i} className="relative bg-card px-5 py-4 group transition-colors hover:bg-muted/30">
                  <div className={cn("absolute left-0 top-3 bottom-3 w-[2px] rounded-r", toneAccent[tone], "opacity-50 group-hover:opacity-100 transition-opacity")} />
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">
                      {k.label}
                    </p>
                    {k.icon && (
                      <div className={cn("opacity-50 group-hover:opacity-100 transition-opacity", toneText[tone])}>
                        {k.icon}
                      </div>
                    )}
                  </div>
                  <p className={cn("font-display text-[22px] lg:text-[24px] font-semibold tracking-tight tabular-nums leading-tight", toneText[tone])}>
                    {k.value}
                  </p>
                  {k.hint && (
                    <p className="text-[10.5px] text-muted-foreground/60 mt-1 truncate">{k.hint}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
