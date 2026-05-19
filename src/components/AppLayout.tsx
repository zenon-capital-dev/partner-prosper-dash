import { Outlet, Navigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { QuickCreateButton } from "@/components/QuickCreateButton";
import { EnvBadge } from "@/components/EnvBadge";
import { RouteGuard } from "@/components/RouteGuard";
import { initials } from "@/lib/format";
import { useOnboardingGuard } from "@/hooks/useOnboardingGuard";
import { LoadingScreen } from "./LoadingScreen";
import { useEffect } from "react";

export default function AppLayout() {
  return (
    <RouteGuard>
      <AppLayoutInner />
    </RouteGuard>
  );
}

function AppLayoutInner() {
  const {
    user,
    isAdmin, isAdminSecondary, isColaborador, isVendedor,
    isParceiro, isPrestador, isCliente, isLead, isIndicador,
  } = useAuth();
  const { pathname } = useLocation();

  // 🔒 Cada role só pode entrar no seu próprio painel.
  // Admin, Colaborador e Vendedor (Comercial) usam o painel administrativo (/admin).
  const isStaff = isAdmin || isAdminSecondary || isColaborador || isVendedor;
  const allowedPrefix = (() => {
    if (isStaff) return "/admin";
    if (isParceiro) return "/parceiro";
    if (isPrestador) return "/prestador";
    if (isIndicador) return "/indicador";
    if (isCliente || isLead) return "/cliente";
    return null;
  })();

  if (isStaff && !pathname.startsWith("/admin")) {
    return <Navigate to="/admin" replace />;
  }

  // Bloqueia acesso a painéis de outras roles (mas permite "/" raiz para RoleHome)
  if (allowedPrefix && pathname !== "/" && !pathname.startsWith(allowedPrefix)) {
    return <Navigate to={allowedPrefix} replace />;
  }

  const fullName = user?.user_metadata?.full_name || user?.email || "Usuário";
  const firstName = String(fullName).split(/[ @]/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // QuickCreate is only meaningful for staff/admin profiles
  const showQuickCreate = isStaff;

  return (
    <SidebarProvider style={{ "--sidebar-width": "17rem" } as React.CSSProperties}>
      <div className="min-h-screen flex w-full bg-background selection:bg-primary/15 selection:text-primary relative">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
          <header className="glass-header h-14 flex items-center px-5 lg:px-7 gap-5 no-print">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors -ml-1" />

            <div className="hidden md:flex items-center gap-2.5 min-w-0 pl-4 border-l border-border">
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
              <EnvBadge />
            </div>

            <div className="flex-1 max-w-xl mx-auto">
              <GlobalSearch />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {showQuickCreate && (
                <>
                  <QuickCreateButton />
                  <div className="h-5 w-px bg-border mx-1.5 hidden sm:block" />
                </>
              )}
              <NotificationBell />
              <div className="h-5 w-px bg-border mx-1 hidden sm:block" />
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
