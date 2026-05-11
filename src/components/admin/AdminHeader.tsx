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
    <header className="glass-header h-[60px] px-5 lg:px-8 flex items-center gap-4 sticky top-0 z-40">
      {/* Breadcrumb on left */}
      <div className="hidden md:flex items-center gap-3 min-w-0 flex-1">
        <Breadcrumbs />
        <EnvBadge />
      </div>

      {/* Search — center/right on desktop */}
      <div className="flex-1 md:flex-none md:w-[420px]">
        <button
          onClick={onSearchClick}
          className="w-full h-9 pl-9 pr-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.14] rounded-lg text-[12.5px] flex items-center justify-between transition-colors group relative"
        >
          <Search className="absolute left-3 size-3.5 text-white/40 group-hover:text-white/70 transition-colors" />
          <span className="font-medium text-white/45 truncate">Buscar clientes, demandas, documentos…</span>
          <kbd className="text-[9.5px] font-mono font-semibold bg-white/[0.05] border border-white/[0.08] rounded px-1.5 py-0.5 flex items-center gap-1 text-white/55 shrink-0">
            <Command className="size-2.5" />K
          </kbd>
        </button>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-1 shrink-0">
        <QuickCreateButton />
        <div className="h-5 w-px bg-white/[0.08] mx-1.5 hidden sm:block" />
        <InternalChat />
        <NotificationBell />
        <div className="h-5 w-px bg-white/[0.08] mx-1.5 hidden sm:block" />
        <ThemeToggle />
      </div>
    </header>
  );
}
