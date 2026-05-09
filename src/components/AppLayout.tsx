import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoadingScreen } from "@/components/LoadingScreen";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Preparando seu painel..." />;
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider style={{ "--sidebar-width": "18.5rem" } as React.CSSProperties}>
      <div className="min-h-screen flex w-full bg-background selection:bg-primary selection:text-primary-foreground relative">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 bg-[hsl(var(--background))] relative overflow-hidden">
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

