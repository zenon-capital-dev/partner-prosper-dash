import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PremiumCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  hover?: boolean;
}

export function PremiumCard({
  children,
  className,
  title,
  subtitle,
  icon,
  right,
  onClick,
  hover = true,
}: PremiumCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300",
        hover && "hover:border-primary/20 hover:shadow-md",
        onClick && "cursor-pointer active:scale-[0.99]",
        className
      )}
    >
      {/* Subtle top gradient */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
      
      {(title || right) && (
        <div className="px-6 py-5 flex items-center justify-between border-b border-border/50">
          <div className="flex items-center gap-3">
            {icon && <div className="p-2 rounded-lg bg-primary/5 text-primary">{icon}</div>}
            <div className="space-y-0.5">
              {title && (
                <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-[11.5px] text-muted-foreground leading-none">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {right && <div>{right}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

interface KpiTileProps {
  label: string;
  value: string | number;
  delta?: number | null;
  icon: any;
  tone?: "primary" | "success" | "warning" | "danger" | "info" | "neutral";
  hint?: string;
}

export function KpiTile({ label, value, delta, icon: Icon, tone = "primary", hint }: KpiTileProps) {
  const tones = {
    primary: "text-primary bg-primary/5 border-primary/10",
    success: "text-success bg-success-muted border-success/10",
    warning: "text-warning bg-warning-muted border-warning/10",
    danger: "text-destructive bg-destructive-muted border-destructive/10",
    info: "text-info bg-info-muted border-info/10",
    neutral: "text-muted-foreground bg-muted/40 border-border/50",
  };

  return (
    <div className="relative group rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/20 hover:shadow-lg">
      <div className="absolute left-0 top-6 bottom-6 w-0.5 rounded-r bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex items-start justify-between">
        <div className={cn("p-2 rounded-xl border", tones[tone])}>
          <Icon className="size-5" />
        </div>
        {delta !== null && delta !== undefined && (
          <div className={cn(
            "flex items-center gap-0.5 px-2 py-1 rounded-full text-[10px] font-bold",
            delta >= 0 ? "bg-success-muted text-success" : "bg-destructive-muted text-destructive"
          )}>
            {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
          </div>
        )}
      </div>

      <div className="mt-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl lg:text-3xl font-bold tracking-tight text-foreground tabular-nums">
            {value}
          </span>
        </div>
        {hint && (
          <p className="text-[10.5px] text-muted-foreground/70">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
