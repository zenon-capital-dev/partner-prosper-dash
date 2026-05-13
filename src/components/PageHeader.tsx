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
    <header className={cn("relative px-5 lg:px-7 pt-6 pb-4 space-y-4 border-b border-border/70 bg-card/40", className)}>
      {!hideBreadcrumbs && <Breadcrumbs override={breadcrumbOverride} />}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          {icon && (
            <div className="relative shrink-0">
              <div className="size-11 lg:size-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm ring-1 ring-primary/15">
                {icon}
              </div>
              <div className="absolute -bottom-1 -right-1 size-3 rounded-full bg-success ring-2 ring-background" />
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && (
                <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
                <CalendarClock className="size-3" />
                <span>{eyebrow}</span>
                <span className="size-1 rounded-full bg-border" />
                <Sparkles className="size-3 text-primary" />
                <span className="text-primary">Operacional</span>
              </div>
            )}
            <h1 className="text-[22px] lg:text-[28px] font-bold text-foreground tracking-tight mt-1 leading-tight font-display">
              {title}
            </h1>
            {description && (
              <p className="text-[13px] text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                {description}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground/70 mt-1 capitalize">{today}</p>
            {meta && <div className="flex flex-wrap items-center gap-2 pt-2">{meta}</div>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
      </div>
    </header>
  );
}
