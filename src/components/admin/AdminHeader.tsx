import { Activity, Command, Search } from "lucide-react";
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
    <header className="h-[64px] px-5 lg:px-7 flex items-center gap-5 sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border/80 shadow-sm">
      <div className="hidden lg:flex items-center gap-3 min-w-0 flex-1">
        <Breadcrumbs />
        <div className="h-4 w-px bg-border" />
        <EnvBadge />
        <div className="hidden xl:flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-success/20 bg-success-muted text-success text-[10px] font-bold uppercase tracking-[0.12em]">
          <Activity className="size-3" /> Operação online
        </div>
      </div>

      <div className="flex-1 max-w-[520px]">
        <button
          onClick={onSearchClick}
          className="w-full h-10 pl-10 pr-3 bg-background hover:bg-muted/60 border border-border hover:border-primary/30 rounded-lg text-[12.5px] flex items-center justify-between transition-all group relative shadow-sm"
        >
          <Search className="absolute left-3.5 size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate tracking-tight">
            Buscar clientes, demandas, contratos e documentos
          </span>
          <div className="flex items-center gap-1 opacity-50 group-hover:opacity-90 transition-opacity">
            <kbd className="text-[9.5px] font-mono font-bold bg-card border border-border rounded px-1.5 py-0.5 text-muted-foreground flex items-center gap-1">
              <Command className="size-2.5" /> K
            </kbd>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-1 justify-end">
        <QuickCreateButton />
        <div className="size-9 flex items-center justify-center rounded-lg border border-transparent hover:border-border hover:bg-muted/60 transition-colors">
          <InternalChat />
        </div>
        <div className="size-9 flex items-center justify-center rounded-lg border border-transparent hover:border-border hover:bg-muted/60 transition-colors">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
