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

export function PageHero({ eyebrow, category, title, description, actions, kpis, icon }: Props) {
  return (
    <section className="page-hero aurora">
      <div className="hero-mesh" />
      <div className="page-hero-inner">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          {/* Left: title block */}
          <div className="space-y-2.5 min-w-0 flex-1">
            <div className="flex items-center gap-3 h-5">
              {eyebrow && <span className="eyebrow">{eyebrow}</span>}
              {category && (
                <>
                  <span className="text-border">/</span>
                  <span className="eyebrow-muted">{category}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {icon && (
                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/15">
                  {icon}
                </div>
              )}
              <h1 className="font-display text-[28px] lg:text-[32px] font-bold tracking-tight text-foreground leading-none">
                {title}
              </h1>
            </div>
            {description && (
              <p className="text-[13px] text-muted-foreground max-w-2xl leading-relaxed">{description}</p>
            )}
          </div>

          {/* Right: actions */}
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>

        {/* KPIs strip */}
        {kpis && kpis.length > 0 && (
          <div className="mt-7 pt-6 border-t border-border grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px bg-border rounded-xl overflow-hidden border border-border"
            style={{
              gridTemplateColumns: `repeat(${Math.min(kpis.length, 5)}, minmax(0, 1fr))`,
            }}
          >
            {kpis.map((k, i) => (
              <div key={i} className="bg-card px-5 py-4 group transition-colors hover:bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
                    {k.label}
                  </p>
                  {k.icon && (
                    <div className={cn("opacity-40 group-hover:opacity-100 transition-opacity", toneText[k.tone || "primary"])}>
                      {k.icon}
                    </div>
                  )}
                </div>
                <p
                  className={cn(
                    "font-display text-[22px] font-bold tracking-tight tabular-nums leading-tight",
                    toneText[k.tone || "default"],
                  )}
                >
                  {k.value}
                </p>
                {k.hint && (
                  <p className="text-[10.5px] text-muted-foreground/60 mt-1 truncate">{k.hint}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
