import { Search, Bell, Command } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/utils";

interface AdminHeaderProps {
  onSearchClick: () => void;
}

export function AdminHeader({ onSearchClick }: AdminHeaderProps) {
  return (
    <header className="h-20 border-b border-border/40 bg-background/60 backdrop-blur-xl px-10 flex items-center justify-between sticky top-0 z-40 transition-all duration-500">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50 transition-colors group-focus-within:text-primary" />
          <button
            onClick={onSearchClick}
            className="w-full h-11 pl-11 pr-4 bg-muted/20 hover:bg-muted/40 border border-border/40 rounded-xl text-sm text-muted-foreground flex items-center justify-between transition-all shadow-sm hover:shadow-md"
          >
            <span className="font-medium opacity-70">Buscar clientes, parceiros, produtos...</span>
            <div className="flex items-center gap-1.5 opacity-40 group-hover:opacity-60 transition-opacity">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-background border border-border/50 rounded px-1.5 py-0.5">⌘ K</span>
            </div>
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 pr-2 border-r border-border/60">
          <NotificationBell />
        </div>
        
        <ThemeToggle />
      </div>
    </header>
  );
}
