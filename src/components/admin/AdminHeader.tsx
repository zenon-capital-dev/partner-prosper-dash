import { Search } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { InternalChat } from "@/components/chat/InternalChat";
import { QuickCreateButton } from "@/components/QuickCreateButton";
import { EnvBadge } from "@/components/EnvBadge";
import { Breadcrumbs } from "@/components/Breadcrumbs";

interface AdminHeaderProps {
  onSearchClick: () => void;
}

export function AdminHeader({ onSearchClick }: AdminHeaderProps) {
  return (
    <header className="h-[56px] px-5 lg:px-7 flex items-center gap-5 sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-slate-200/70">
      {/* Breadcrumb on left */}
      <div className="hidden lg:flex items-center gap-3 min-w-0 flex-1">
        <Breadcrumbs />
        <div className="h-3.5 w-px bg-border/80" />
        <EnvBadge />
      </div>

      {/* Global Command Center */}
      <div className="flex-1 max-w-[460px]">
        <button
          onClick={onSearchClick}
          className="w-full h-10 pl-10 pr-3 bg-muted/40 hover:bg-muted/70 border border-border/70 hover:border-foreground/25 rounded-xl text-[12.5px] flex items-center justify-between transition-all group relative shadow-sm hover:shadow-md"
        >
          <Search className="absolute left-3.5 size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate tracking-tight">
            Comando Inteligente — busque qualquer coisa
          </span>
          <div className="flex items-center gap-1 opacity-50 group-hover:opacity-90 transition-opacity">
            <kbd className="text-[9.5px] font-mono font-bold bg-background/80 border border-border rounded-md px-1.5 py-0.5 text-muted-foreground">
              ⌘K
            </kbd>
          </div>
        </button>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-2 shrink-0 flex-1 justify-end">
        <QuickCreateButton />
        <div className="size-9 flex items-center justify-center rounded-lg hover:bg-muted/60 transition-colors">
          <InternalChat />
        </div>
        <div className="size-9 flex items-center justify-center rounded-lg hover:bg-muted/60 transition-colors">
          <NotificationBell />
        </div>
        <div className="h-5 w-px bg-border/80 mx-1.5" />
        <ThemeToggle />
      </div>
    </header>
  );
}
