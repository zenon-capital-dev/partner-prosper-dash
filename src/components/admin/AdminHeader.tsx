import { Command, Menu, Search } from "lucide-react";
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
    <header className="h-[64px] px-3 sm:px-5 lg:px-8 flex items-center gap-3 sm:gap-5 sticky top-0 z-40 bg-white/90 dark:bg-background/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-border/60">
      <button
        type="button"
        onClick={onMenuClick}
        className="md:hidden size-10 shrink-0 rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card text-slate-600 dark:text-muted-foreground hover:text-slate-950 dark:hover:text-foreground hover:bg-slate-50 dark:hover:bg-accent transition-colors flex items-center justify-center shadow-sm"
        aria-label="Abrir menu"
      >
        <Menu className="size-4" />
      </button>

      <div className="hidden lg:flex items-center gap-3 min-w-0 shrink-0">
        <Breadcrumbs />
        <div className="h-5 w-px bg-slate-200 dark:bg-border" />
        <EnvBadge />
      </div>

      <div className="flex-1 min-w-0 max-w-[640px] mx-auto">
        <button
          onClick={onSearchClick}
          className="w-full h-11 pl-11 pr-2 bg-slate-50/80 dark:bg-card/70 hover:bg-white dark:hover:bg-card border border-slate-200/80 dark:border-border/70 hover:border-indigo-300 dark:hover:border-primary/60 rounded-xl text-[13px] flex items-center justify-between transition-all group relative shadow-[0_1px_0_rgba(15,23,42,0.02)] hover:shadow-[0_0_0_4px_hsl(231_72%_46%/0.08),0_8px_24px_-12px_hsl(222_47%_11%/0.18)]"
        >
          <Search className="absolute left-4 size-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-primary transition-colors" />
          <span className="font-medium text-slate-500 dark:text-muted-foreground group-hover:text-slate-700 dark:group-hover:text-foreground transition-colors truncate text-left">
            <span className="hidden sm:inline">Buscar clientes, demandas, contratos…</span>
            <span className="sm:hidden">Buscar…</span>
          </span>
          <kbd className="hidden sm:flex text-[10px] font-mono font-semibold bg-white dark:bg-muted border border-slate-200 dark:border-border rounded-md px-1.5 py-1 text-slate-500 dark:text-muted-foreground items-center gap-1 shadow-[0_1px_0_rgba(15,23,42,0.04)] shrink-0 ml-2">
            <Command className="size-2.5" /> K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 justify-end">
        <ThemeToggle />
        <QuickCreateButton />
        <div className="size-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-border/60 bg-white dark:bg-card shadow-sm hover:border-slate-300 dark:hover:border-border hover:bg-slate-50 dark:hover:bg-accent transition-colors text-slate-600 dark:text-muted-foreground hover:text-slate-950 dark:hover:text-foreground">
          <InternalChat />
        </div>
        <div className="size-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-border/60 bg-white dark:bg-card shadow-sm hover:border-slate-300 dark:hover:border-border hover:bg-slate-50 dark:hover:bg-accent transition-colors text-slate-600 dark:text-muted-foreground hover:text-slate-950 dark:hover:text-foreground">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
