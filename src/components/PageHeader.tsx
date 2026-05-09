import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

/**
 * Premium editorial page header.
 * - eyebrow: small uppercase label (module/section)
 * - title: large editorial heading
 * - description: supporting paragraph
 * - meta: inline metadata strip below description (badges, counts)
 * - actions: right-side primary actions
 */
export function PageHeader({ eyebrow, title, description, actions, meta, className }: Props) {
  return (
    <header className={cn("flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8", className)}>
      <div className="min-w-0 space-y-2">
        {eyebrow && (
          <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
            <span className="size-1 rounded-full bg-primary" />
            {eyebrow}
          </span>
        )}
        <h1 className="font-display text-3xl lg:text-[34px] font-bold tracking-tight text-foreground leading-[1.1]">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">{description}</p>
        )}
        {meta && <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
