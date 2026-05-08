import { Search, Command } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { InternalChat } from "@/components/chat/InternalChat";
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
    <header className="h-16 glass-header px-6 lg:px-10 flex items-center justify-between gap-6">
      {/* Greeting */}
      <div className="hidden md:flex items-center gap-3 min-w-0">
        <div className="size-9 rounded-lg bg-muted border border-border flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0">
          {initials(fullName)}
        </div>
        <div className="leading-tight min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">{greeting}</p>
          <p className="text-[13px] font-semibold text-foreground truncate capitalize">{firstName}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-xl">
        <button
          onClick={onSearchClick}
          className="w-full h-11 pl-11 pr-3 bg-muted/40 hover:bg-muted/60 border border-border/60 hover:border-primary/30 rounded-xl text-sm text-muted-foreground flex items-center justify-between transition-all shadow-sm hover:shadow-md group relative"
        >
          <Search className="absolute left-3.5 size-4 text-muted-foreground/60 group-hover:text-primary transition-colors" />
          <span className="font-medium opacity-80">Buscar clientes, parceiros, produtos…</span>
          <kbd className="text-[10px] font-mono font-bold tracking-wider bg-background/80 border border-border/60 rounded-md px-1.5 py-0.5 flex items-center gap-1 text-muted-foreground/70">
            <Command className="size-3" /> K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 pr-2 border-r border-border/60">
          <InternalChat />
          <NotificationBell />
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
