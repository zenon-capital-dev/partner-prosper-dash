import { Search, Command } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { InternalChat } from "@/components/chat/InternalChat";
import { QuickCreateButton } from "@/components/QuickCreateButton";
import { EnvBadge } from "@/components/EnvBadge";
import { useAuth } from "@/hooks/useAuth";
import { initials } from "@/lib/format";

interface AdminHeaderProps {
  onSearchClick: () => void;
}

export function AdminHeader({ onSearchClick }: AdminHeaderProps) {
  const { user } = useAuth();
  const fullName = user?.user_metadata?.full_name || user?.email || "Admin";
  const firstName = String(fullName).split(/[ @]/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <header className="glass-header px-6 lg:px-10 flex items-center justify-between gap-6">
      {/* Greeting + Identity */}
      <div className="hidden md:flex items-center gap-3 min-w-0 shrink-0">
        <div className="relative size-9 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center text-[11px] font-bold text-white shadow-[0_4px_20px_-6px_rgba(139,92,246,0.6)]">
          {initials(fullName)}
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 border-2 border-[#0a0a14] shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
        </div>
        <div className="leading-tight min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/40">
            {greeting}
          </p>
          <p className="text-[13.5px] font-semibold text-white truncate capitalize">
            {firstName}
          </p>
        </div>
        <EnvBadge />
      </div>

      {/* Global Search */}
      <div className="flex-1 max-w-2xl">
        <button
          onClick={onSearchClick}
          className="w-full h-11 pl-11 pr-3 bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 hover:border-white/20 rounded-2xl text-[13px] flex items-center justify-between transition-all group relative backdrop-blur-md"
        >
          <Search className="absolute left-4 size-4 text-white/40 group-hover:text-white/80 transition-colors" />
          <span className="font-medium text-white/50 truncate">
            Buscar clientes, empresas, demandas, documentos…
          </span>
          <kbd className="text-[10px] font-mono font-semibold bg-white/[0.06] border border-white/10 rounded-md px-1.5 py-0.5 flex items-center gap-1 text-white/50 shrink-0">
            <Command className="size-2.5" /> K
          </kbd>
        </button>
      </div>

      {/* Right cluster — actions */}
      <div className="flex items-center gap-2 shrink-0">
        <QuickCreateButton />
        <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />
        <InternalChat />
        <NotificationBell />
        <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />
        <ThemeToggle />
      </div>
    </header>
  );
}
