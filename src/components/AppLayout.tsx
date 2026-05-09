import { Outlet, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const [showTimeout, setShowTimeout] = useState(false);

  // Safety timeout for loading state
  useEffect(() => {
    let timer: any;
    if (loading) {
      timer = setTimeout(() => {
        setShowTimeout(true);
      }, 8000); // 8 seconds
    } else {
      setShowTimeout(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="relative mb-6">
          <div className="size-12 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin" />
          <div className="absolute inset-0 size-12 rounded-full border border-primary/10 blur-sm" />
        </div>
        
        {showTimeout ? (
          <div className="animate-fade-up max-w-sm">
            <h3 className="text-lg font-bold mb-2">Identificamos um atraso...</h3>
            <p className="text-sm text-muted-foreground mb-6">Não conseguimos carregar suas permissões a tempo. Pode ser instabilidade na conexão.</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => window.location.reload()} className="btn-premium py-2 px-6 rounded-xl text-sm font-bold">
                Tentar Novamente
              </button>
              <button onClick={() => signOut()} className="text-sm font-medium text-muted-foreground hover:text-foreground underline">
                Sair do sistema
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60 animate-pulse">
            Preparando seu painel...
          </p>
        )}
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider style={{ "--sidebar-width": "18.5rem" } as React.CSSProperties}>
      <div className="min-h-screen flex w-full bg-background selection:bg-primary selection:text-primary-foreground">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 bg-[hsl(var(--background))]">
          <header className="glass-header h-14 flex items-center px-4 lg:px-6 gap-3 no-print">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
            <div className="h-5 w-px bg-border/60 hidden sm:block" />
            <div className="flex-1 max-w-xl">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <NotificationBell />
              <div className="h-5 w-px bg-border/60 mx-1 hidden sm:block" />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden animate-fade-up scroll-smooth">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

