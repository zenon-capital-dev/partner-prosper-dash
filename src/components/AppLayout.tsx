import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoadingScreen } from "@/components/LoadingScreen";
import { initials } from "@/lib/format";

export default function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Preparando seu painel..." />;
  }

  if (!user) return <Navigate to="/auth" replace />;

  const fullName = user?.user_metadata?.full_name || user?.email || "Usuário";
  const firstName = String(fullName).split(/[ @]/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <SidebarProvider style={{ "--sidebar-width": "17rem" } as React.CSSProperties}>
      <div className="min-h-screen flex w-full bg-background selection:bg-primary/15 selection:text-primary relative">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
          <header className="glass-header h-14 flex items-center px-5 lg:px-7 gap-5 no-print">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors -ml-1" />

            {/* Greeting block — corporate identity strip */}
            <div className="hidden md:flex items-center gap-2.5 min-w-0 pl-1 border-l border-border/70 pl-4">
              <div className="size-8 rounded-md bg-muted border border-border flex items-center justify-center text-[10.5px] font-bold text-muted-foreground shrink-0">
                {initials(fullName)}
              </div>
              <div className="leading-tight min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60">
                  {greeting}
                </p>
                <p className="text-[12.5px] font-semibold text-foreground truncate capitalize">
                  {firstName}
                </p>
              </div>
            </div>

            <div className="flex-1 max-w-xl mx-auto">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-1.5">
              <NotificationBell />
              <div className="h-5 w-px bg-border/70 mx-1 hidden sm:block" />
              <ThemeToggle />
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
