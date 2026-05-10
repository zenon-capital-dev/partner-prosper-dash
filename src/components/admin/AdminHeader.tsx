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
    <header className="h-14 glass-header px-5 lg:px-8 flex items-center justify-between gap-6">
      {/* Greeting */}
      <div className="hidden md:flex items-center gap-2.5 min-w-0">
        <div className="size-8 rounded-md bg-muted border border-border flex items-center justify-center text-[10.5px] font-bold text-muted-foreground shrink-0">
          {initials(fullName)}
        </div>
        <div className="leading-tight min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60">{greeting}</p>
          <p className="text-[12.5px] font-semibold text-foreground truncate capitalize">{firstName}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-lg">
        <button
          onClick={onSearchClick}
          className="w-full h-9 pl-10 pr-3 bg-muted/40 hover:bg-muted/60 border border-border hover:border-border/80 rounded-lg text-[13px] text-muted-foreground flex items-center justify-between transition-all group relative"
        >
          <Search className="absolute left-3 size-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
          <span className="font-medium opacity-80">Buscar clientes, parceiros, produtos…</span>
          <kbd className="text-[9.5px] font-mono font-semibold tracking-wider bg-background/80 border border-border rounded px-1.5 py-0.5 flex items-center gap-1 text-muted-foreground/70">
            <Command className="size-2.5" /> K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 pr-2 border-r border-border/60">
          <InternalChat />
          <NotificationBell />
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
