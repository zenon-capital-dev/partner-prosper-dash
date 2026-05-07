import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="relative">
          <div className="size-12 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin" />
          <div className="absolute inset-0 size-12 rounded-full border border-primary/10 blur-sm" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider style={{ "--sidebar-width": "18.5rem" } as React.CSSProperties}>
      <div className="min-h-screen flex w-full bg-background bg-premium selection:bg-primary selection:text-primary-foreground">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc] dark:bg-[#020617]/50">
          <header className="glass-header h-16 flex items-center px-8 gap-6 no-print">
            <SidebarTrigger className="text-muted-foreground transition-all hover:text-foreground active:scale-90" />
            <div className="h-6 w-px bg-border/10 mx-1 hidden sm:block" />
            <div className="flex-1 max-w-2xl">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-muted/40 rounded-full p-1 border border-border/5">
                <ThemeToggle />
              </div>
              <NotificationBell />
              <div className="h-8 w-px bg-border/10 mx-1 hidden sm:block" />
              <div className="flex items-center gap-3 pl-2">
                <div className="flex flex-col items-end hidden md:flex">
                  <span className="text-[11px] font-black uppercase tracking-widest text-foreground/80 leading-none">Status</span>
                  <span className="text-[10px] font-bold text-success mt-1 flex items-center gap-1">
                    <div className="size-1 rounded-full bg-success animate-pulse" />
                    SISTEMA ONLINE
                  </span>
                </div>
              </div>
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

