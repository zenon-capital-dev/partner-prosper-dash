import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/Breadcrumbs";

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
  /** Hide auto breadcrumbs (shown by default) */
  hideBreadcrumbs?: boolean;
  /** Override dynamic segment labels in the breadcrumb */
  breadcrumbOverride?: Record<string, string>;
}

/**
 * Premium corporate page header.
 * Breadcrumbs · Title · Subtitle · Right-aligned actions.
 * Used at the top of every interior page for a consistent shell across portals.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
  hideBreadcrumbs,
  breadcrumbOverride,
}: Props) {
  return (
    <header className={cn("mb-7 space-y-3", className)}>
      {!hideBreadcrumbs && <Breadcrumbs override={breadcrumbOverride} />}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0 space-y-1.5 flex-1">
          {eyebrow && (
            <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/90">
              <span className="size-1 rounded-full bg-primary" />
              {eyebrow}
            </span>
          )}
          <h1 className="font-display text-[24px] lg:text-[26px] font-semibold tracking-tight text-foreground leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-[13.5px] text-muted-foreground max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
          {meta && <div className="flex flex-wrap items-center gap-2 pt-1.5">{meta}</div>}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
        )}
      </div>
      <div className="h-px bg-border/70" />
    </header>
  );
}
