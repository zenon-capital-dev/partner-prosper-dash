import { Search, Command } from "lucide-react";
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
    <header className="h-[52px] px-6 lg:px-8 flex items-center gap-4 sticky top-0 z-40 bg-background/70 backdrop-blur-xl border-b border-border">
      {/* Breadcrumb on left */}
      <div className="hidden lg:flex items-center gap-3 min-w-0 flex-1">
        <Breadcrumbs />
        <div className="h-3 w-px bg-border" />
        <EnvBadge />
      </div>

      {/* Global Command Center */}
      <div className="flex-1 max-w-[400px]">
        <button
          onClick={onSearchClick}
          className="w-full h-8 pl-8 pr-3 bg-muted/50 hover:bg-muted border border-border hover:border-foreground/20 rounded-lg text-[11px] flex items-center justify-between transition-all group relative"
        >
          <Search className="absolute left-2.5 size-3 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate">Comando Inteligente...</span>
          <div className="flex items-center gap-1 opacity-40 group-hover:opacity-80 transition-opacity">
            <kbd className="text-[8px] font-mono font-bold bg-background border border-border rounded px-1 py-0.5 text-muted-foreground">
              ⌘K
            </kbd>
          </div>
        </button>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-1.5 shrink-0 flex-1 justify-end">
        <QuickCreateButton />
        <div className="size-8 flex items-center justify-center">
          <InternalChat />
        </div>
        <div className="size-8 flex items-center justify-center">
          <NotificationBell />
        </div>
        <div className="h-3 w-px bg-border mx-1" />
        <ThemeToggle />
      </div>
    </header>
  );
}
