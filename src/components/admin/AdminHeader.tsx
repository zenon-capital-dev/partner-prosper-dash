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
    <header className="h-14 glass-header px-5 lg:px-7 flex items-center justify-between gap-5">
      {/* Greeting + Identity */}
      <div className="hidden md:flex items-center gap-2.5 min-w-0 shrink-0">
        <div className="size-8 rounded-md bg-muted border border-border flex items-center justify-center text-[10.5px] font-bold text-muted-foreground">
          {initials(fullName)}
        </div>
        <div className="leading-tight min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60">
            {greeting}
          </p>
          <p className="text-[12.5px] font-semibold text-foreground truncate capitalize">
            {firstName}
          </p>
        </div>
        <EnvBadge />
      </div>

      {/* Global Search */}
      <div className="flex-1 max-w-xl">
        <button
          onClick={onSearchClick}
          className="w-full h-9 pl-9 pr-2 bg-muted/50 hover:bg-muted/80 border border-border hover:border-foreground/20 rounded-md text-[13px] flex items-center justify-between transition-colors group relative"
        >
          <Search className="absolute left-3 size-3.5 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
          <span className="font-medium text-muted-foreground/80 truncate">
            Buscar clientes, empresas, demandas, documentos...
          </span>
          <kbd className="text-[10px] font-mono font-semibold bg-background border border-border rounded px-1.5 py-0.5 flex items-center gap-1 text-muted-foreground/70 shrink-0">
            <Command className="size-2.5" /> K
          </kbd>
        </button>
      </div>

      {/* Right cluster — actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <QuickCreateButton />
        <div className="h-5 w-px bg-border mx-1.5 hidden sm:block" />
        <InternalChat />
        <NotificationBell />
        <div className="h-5 w-px bg-border mx-1 hidden sm:block" />
        <ThemeToggle />
      </div>
    </header>
  );
}
