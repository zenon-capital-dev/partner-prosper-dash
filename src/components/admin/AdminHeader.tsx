import { Search, Bell, Command } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/utils";

interface AdminHeaderProps {
  onSearchClick: () => void;
}

export function AdminHeader({ onSearchClick }: AdminHeaderProps) {
  return (
    <header className="h-16 border-b border-border/40 bg-background/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <button
            onClick={onSearchClick}
            className="w-full h-10 pl-10 pr-4 bg-muted/50 hover:bg-muted border border-border/50 rounded-lg text-sm text-muted-foreground flex items-center justify-between transition-all"
          >
            <span>Buscar clientes, parceiros, produtos...</span>
            <div className="flex items-center gap-1 opacity-60">
              <Command className="size-3" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">K</span>
            </div>
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-2 border-r border-border/60">
          <NotificationBell />
        </div>
        
        <ThemeToggle />
      </div>
    </header>
  );
}
