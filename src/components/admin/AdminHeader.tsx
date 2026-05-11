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
    <header className="h-[56px] px-6 lg:px-10 flex items-center gap-6 sticky top-0 z-40 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/[0.04]">
      {/* Breadcrumb on left */}
      <div className="hidden lg:flex items-center gap-3 min-w-0 flex-1">
        <Breadcrumbs />
        <div className="h-3 w-px bg-white/[0.08]" />
        <EnvBadge />
      </div>

      {/* Search — center */}
      <div className="flex-1 max-w-[480px]">
        <button
          onClick={onSearchClick}
          className="w-full h-9 pl-9 pr-3 bg-zinc-900/40 hover:bg-zinc-900/60 border border-white/[0.05] hover:border-white/[0.1] rounded-xl text-[12px] flex items-center justify-between transition-all group relative"
        >
          <Search className="absolute left-3 size-3.5 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
          <span className="font-medium text-zinc-600 group-hover:text-zinc-400 transition-colors truncate">Comando inteligente...</span>
          <div className="flex items-center gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
            <kbd className="text-[9px] font-mono font-bold bg-white/[0.05] border border-white/[0.08] rounded px-1.5 py-0.5 text-zinc-400">
              ⌘K
            </kbd>
          </div>
        </button>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-2 shrink-0 flex-1 justify-end">
        <QuickCreateButton />
        <InternalChat />
        <NotificationBell />
        <div className="h-4 w-px bg-white/[0.08] mx-1" />
        <ThemeToggle />
      </div>
    </header>
  );
}
