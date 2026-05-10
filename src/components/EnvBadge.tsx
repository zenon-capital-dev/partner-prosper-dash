/**
 * Environment badge — shown only when explicitly non-production.
 * Reads VITE_ENV (or falls back to MODE). Hidden in production.
 */
export function EnvBadge() {
  const raw =
    (import.meta.env.VITE_ENV as string | undefined) ||
    (import.meta.env.MODE as string | undefined) ||
    "production";

  const env = raw.toLowerCase();
  if (env === "production" || env === "prod") return null;

  const map: Record<string, { label: string; cls: string }> = {
    development: { label: "DEV", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
    dev: { label: "DEV", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
    staging: { label: "STAGING", cls: "bg-info-muted text-info border-info/30" },
    test: { label: "TEST", cls: "bg-info-muted text-info border-info/30" },
    preview: { label: "PREVIEW", cls: "bg-primary-muted text-primary border-primary/30" },
  };

  const cfg = map[env] || { label: env.toUpperCase(), cls: "bg-muted text-muted-foreground border-border" };

  return (
    <span
      className={`hidden md:inline-flex items-center gap-1.5 h-6 px-2 rounded-md border text-[9.5px] font-bold uppercase tracking-[0.18em] ${cfg.cls}`}
    >
      <span className="size-1 rounded-full bg-current opacity-70" />
      {cfg.label}
    </span>
  );
}
