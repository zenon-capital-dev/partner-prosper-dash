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
  hideBreadcrumbs?: boolean;
  breadcrumbOverride?: Record<string, string>;
}

/**
 * Premium aurora-glass page header.
 * Editorial scale, gradient accents, breadcrumbs + title + actions.
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
    <header className={cn("px-6 lg:px-12 pt-8 lg:pt-10 pb-7 space-y-5", className)}>
      {!hideBreadcrumbs && <Breadcrumbs override={breadcrumbOverride} />}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div className="min-w-0 space-y-3 flex-1">
          {eyebrow && (
            <span className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/70">
                {eyebrow}
              </span>
            </span>
          )}
          <h1 className="font-display text-[34px] lg:text-[44px] xl:text-[52px] font-bold tracking-tighter text-white leading-[0.95]">
            {title}
          </h1>
          {description && (
            <p className="text-[14px] lg:text-[15px] text-white/55 max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
          {meta && (
            <div className="flex flex-wrap items-center gap-2 pt-2">{meta}</div>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
        )}
      </div>
      <div className="h-px bg-white/[0.06]" />
    </header>
  );
}
