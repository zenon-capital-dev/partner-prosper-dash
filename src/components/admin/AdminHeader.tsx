import { Search, Command, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { InternalChat } from "@/components/chat/InternalChat";
import { useAuth } from "@/hooks/useAuth";

interface AdminHeaderProps {
  onSearchClick: () => void;
}

export function AdminHeader({ onSearchClick }: AdminHeaderProps) {
  const { user } = useAuth();
  const firstName = (user?.user_metadata?.full_name || user?.email || "Admin").split(/[ @]/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <header className="h-20 glass-header px-6 lg:px-10 flex items-center justify-between gap-6">
      {/* Greeting */}
      <div className="hidden md:flex items-center gap-2.5">
        <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-md shadow-primary/30">
          <Sparkles className="size-4 text-primary-foreground" />
        </div>
        <div className="leading-tight">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">{greeting}</p>
          <p className="text-sm font-semibold text-foreground capitalize">{firstName}</p>
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
