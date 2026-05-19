import { Command, Menu, Search } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { InternalChat } from "@/components/chat/InternalChat";
import { QuickCreateButton } from "@/components/QuickCreateButton";
import { EnvBadge } from "@/components/EnvBadge";
import { Breadcrumbs } from "@/components/Breadcrumbs";

interface AdminHeaderProps {
  onSearchClick: () => void;
  onMenuClick?: () => void;
}

export function AdminHeader({ onSearchClick, onMenuClick }: AdminHeaderProps) {
  return (
    <header className="h-[60px] sm:h-[62px] px-3 sm:px-5 lg:px-7 flex items-center gap-2 sm:gap-5 sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <button
        type="button"
        onClick={onMenuClick}
        className="md:hidden size-10 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-950 hover:bg-slate-50 transition-colors flex items-center justify-center"
        aria-label="Abrir menu"
      >
        <Menu className="size-4" />
      </button>
      <div className="hidden lg:flex items-center gap-3 min-w-0 flex-1">
        <Breadcrumbs />
        <div className="h-4 w-px bg-slate-200" />
        <EnvBadge />
        <div className="hidden xl:flex items-center gap-1.5 h-6 px-2 rounded-full border border-emerald-200/70 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-[0.12em]">
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
          className="w-full h-10 pl-10 pr-3 bg-slate-50/80 hover:bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] rounded-lg text-[12.5px] flex items-center justify-between transition-all group relative"
        >
          <Search className="absolute left-3.5 size-3.5 text-slate-800 group-hover:text-indigo-800 transition-colors" />
          <span className="font-bold text-slate-600 group-hover:text-slate-800 transition-colors truncate tracking-tight text-left">
            <span className="hidden sm:inline">Buscar clientes, demandas, contratos e documentos</span>
            <span className="sm:hidden">Buscar…</span>
          </span>
          <div className="hidden sm:flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
            <kbd className="text-[9.5px] font-mono font-bold bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-800 flex items-center gap-1 shadow-sm">
              <Command className="size-2.5" /> K
            </kbd>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 sm:flex-1 justify-end">
        <QuickCreateButton />
        <div className="size-9 flex items-center justify-center rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-colors text-slate-600 hover:text-slate-950">
          <InternalChat />
        </div>
        <div className="size-9 flex items-center justify-center rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-colors text-slate-600 hover:text-slate-950">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
