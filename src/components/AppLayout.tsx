import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const { user, loading } = useAuth();
  useTheme();

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
    <SidebarProvider style={{ "--sidebar-width": "18rem" } as React.CSSProperties}>
      <div className="min-h-screen flex w-full bg-background bg-premium">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="glass-header h-14 flex items-center px-6 gap-4 no-print">
            <SidebarTrigger className="text-muted-foreground transition-colors hover:text-foreground active:scale-95" />
            <div className="h-4 w-px bg-border/40 mx-1 hidden sm:block" />
            <div className="flex-1">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden animate-fade-up">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
