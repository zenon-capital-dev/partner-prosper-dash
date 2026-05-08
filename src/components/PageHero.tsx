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
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  danger: "text-destructive",
  default: "text-foreground",
};

export function PageHero({ eyebrow, category, title, description, actions, kpis, icon }: Props) {
  return (
    <section className="page-hero aurora animate-fade-up">
      <div className="hero-mesh" />
      <div className="page-hero-inner">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-3">
              {eyebrow && <span className="eyebrow">{eyebrow}</span>}
              {category && <span className="eyebrow-muted">{category}</span>}
            </div>
            <div className="flex items-center gap-4">
              {icon && (
                <div className="size-12 rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
                  {icon}
                </div>
              )}
              <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
            </div>
            {description && (
              <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">{description}</p>
            )}
          </div>

          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>

        {kpis && kpis.length > 0 && (
          <div
            className={cn(
              "mt-8 grid gap-3",
              kpis.length === 2 && "grid-cols-2",
              kpis.length === 3 && "grid-cols-2 md:grid-cols-3",
              kpis.length === 4 && "grid-cols-2 lg:grid-cols-4",
              kpis.length === 5 && "grid-cols-2 lg:grid-cols-5",
              kpis.length === 6 && "grid-cols-2 lg:grid-cols-6",
            )}
          >
            {kpis.map((k, i) => (
              <div key={i} className="kpi-tile group" data-tone={k.tone || "primary"}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                    {k.label}
                  </p>
                  {k.icon && (
                    <div className={cn("size-7 rounded-lg flex items-center justify-center bg-muted/40 group-hover:bg-primary/10 transition-colors", toneText[k.tone || "primary"])}>
                      {k.icon}
                    </div>
                  )}
                </div>
                <p
                  className={cn(
                    "font-display text-2xl font-bold tracking-tight tabular-nums",
                    toneText[k.tone || "default"],
                  )}
                >
                  {k.value}
                </p>
                {k.hint && (
                  <p className="text-[11px] text-muted-foreground/60 mt-1.5">{k.hint}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
