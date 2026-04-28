import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  delta?: { value: string; positive?: boolean };
  icon: LucideIcon;
  iconColor?: "primary" | "success" | "warning" | "info" | "destructive";
}

const colorMap = {
  primary: "bg-primary-muted text-primary",
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  info: "bg-info-muted text-info",
  destructive: "bg-destructive-muted text-destructive",
};

export function StatCard({ label, value, delta, icon: Icon, iconColor = "primary" }: Props) {
  return (
    <div className="vx-stat-card group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-bold mt-3 vx-mono">{value}</p>
          {delta && (
            <div className={cn("flex items-center gap-1 mt-2 text-xs font-medium", delta.positive ? "text-success" : "text-destructive")}>
              <span>{delta.positive ? "↑" : "↓"} {delta.value}</span>
              <span className="text-muted-foreground font-normal">vs. período anterior</span>
            </div>
          )}
        </div>
        <div className={cn("size-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105", colorMap[iconColor])}>
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}
