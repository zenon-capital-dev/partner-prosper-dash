import { Command, Menu, Search, Sparkles } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { InternalChat } from "@/components/chat/InternalChat";
import { QuickCreateButton } from "@/components/QuickCreateButton";
import { EnvBadge } from "@/components/EnvBadge";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AdminHeaderProps {
  onSearchClick: () => void;
  onMenuClick?: () => void;
}

export function AdminHeader({ onSearchClick, onMenuClick }: AdminHeaderProps) {
  return (
    <header className="h-[66px] px-3 sm:px-5 lg:px-8 flex items-center gap-2 sm:gap-5 sticky top-0 z-40 bg-white/88 dark:bg-card/88 backdrop-blur-2xl border-b border-slate-200/75 dark:border-border/75 shadow-[0_1px_0_hsl(220_13%_88%/0.65),0_18px_44px_-34px_hsl(222_47%_11%/0.32)]">
      <button
        type="button"
        onClick={onMenuClick}
        className="md:hidden size-10 shrink-0 rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card text-slate-600 dark:text-muted-foreground hover:text-slate-950 dark:hover:text-foreground hover:bg-slate-50 dark:hover:bg-accent transition-colors flex items-center justify-center shadow-sm"
        aria-label="Abrir menu"
      >
        <Menu className="size-4" />
      </button>
      <div className="hidden lg:flex items-center gap-3 min-w-0 flex-1">
        <Breadcrumbs />
        <div className="h-5 w-px bg-slate-200 dark:bg-border" />
        <EnvBadge />
        <div className="hidden xl:flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-emerald-200/70 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase tracking-[0.14em] shadow-sm">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500" />
          </span>
          Operação online
        </div>
      </div>

      <div className="flex-1 min-w-0 max-w-[520px]">
        <button
          onClick={onSearchClick}
          className="w-full h-10 pl-10 pr-3 bg-white/90 dark:bg-card/90 hover:bg-white dark:hover:bg-card border border-slate-200 dark:border-border hover:border-indigo-300 dark:hover:border-primary hover:shadow-[0_0_0_4px_hsl(231_72%_46%/0.08),0_10px_24px_-18px_hsl(222_47%_11%/0.32)] rounded-lg text-[12.5px] flex items-center justify-between transition-all group relative shadow-sm"
        >
          <Search className="absolute left-3.5 size-3.5 text-slate-500 group-hover:text-indigo-800 transition-colors" />
          <span className="font-bold text-slate-600 dark:text-muted-foreground group-hover:text-slate-800 dark:group-hover:text-foreground transition-colors truncate tracking-tight text-left">
            <span className="hidden sm:inline">Buscar clientes, demandas, contratos e documentos</span>
            <span className="sm:hidden">Buscar…</span>
          </span>
          <div className="hidden sm:flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
            <kbd className="text-[9.5px] font-mono font-bold bg-white dark:bg-muted border border-slate-200 dark:border-border rounded px-1.5 py-0.5 text-slate-800 dark:text-foreground flex items-center gap-1 shadow-sm">
              <Command className="size-2.5" /> K
            </kbd>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 sm:flex-1 justify-end">
        <ThemeToggle />
        <div className="hidden 2xl:flex h-9 items-center gap-2 rounded-lg border border-indigo-200/70 dark:border-primary/30 bg-indigo-50 dark:bg-primary/10 px-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo-700 dark:text-primary shadow-sm">
          <Sparkles className="size-3.5" />
          Central Admin
        </div>
        <QuickCreateButton />
        <div className="size-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card shadow-sm hover:border-slate-300 dark:hover:border-border/80 hover:bg-slate-50 dark:hover:bg-accent transition-colors text-slate-600 dark:text-muted-foreground hover:text-slate-950 dark:hover:text-foreground">
          <InternalChat />
        </div>
        <div className="size-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card shadow-sm hover:border-slate-300 dark:hover:border-border/80 hover:bg-slate-50 dark:hover:bg-accent transition-colors text-slate-600 dark:text-muted-foreground hover:text-slate-950 dark:hover:text-foreground">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
