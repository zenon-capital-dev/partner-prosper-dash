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
  const { isLoading: onboardingLoading, checkAccess } = useOnboardingGuard();

  useEffect(() => {
    checkAccess();
  }, [pathname, onboardingLoading]);

  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/clientes") || pathname.startsWith("/demandas")) {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    }
  }, [pathname]);

  if (onboardingLoading) {
    return <LoadingScreen message="Verificando acesso..." />;
  }

  // 🔒 Cada role só pode entrar no seu próprio painel.
  // Admin e Vendedor (Comercial) usam o painel administrativo (/admin).
  const isStaff = isAdmin || isAdminSecondary || isVendedor;
  const allowedPrefixes = (() => {
    if (isStaff) return ["/admin"];
    if (isColaborador) return ["/colaborador", "/perfil"];
    if (isParceiro) return ["/parceiro"];
    if (isPrestador) return ["/prestador"];
    if (isIndicador) return ["/indicador"];
    if (isCliente || isLead) return ["/portal-cliente", "/cliente"];
    return null;
  })();
  const primaryRedirect = allowedPrefixes?.[0] ?? null;

  if (isStaff && !pathname.startsWith("/admin")) {
    return <Navigate to="/admin" replace />;
  }

  // Bloqueia acesso a painéis de outras roles (mas permite "/" raiz para RoleHome)
  if (allowedPrefixes && primaryRedirect && pathname !== "/" &&
      !allowedPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return <Navigate to={primaryRedirect} replace />;
  }

  const fullName = user?.user_metadata?.full_name || user?.email || "Usuário";
  const firstName = String(fullName).split(/[ @]/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // QuickCreate is only meaningful for staff/admin profiles
  const showQuickCreate = isStaff;

  return (
    <SidebarProvider style={{ "--sidebar-width": "17rem" } as React.CSSProperties}>
      <div className="min-h-dvh flex w-full bg-background selection:bg-primary/15 selection:text-primary relative">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 relative">
          <header className="glass-header h-14 flex items-center px-3 sm:px-6 gap-2 sm:gap-4 no-print shrink-0">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors -ml-1 shrink-0" />

            <div className="hidden lg:flex items-center gap-2.5 min-w-0 pl-4 border-l border-border shrink-0">
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

            <div className="flex-1 min-w-0 max-w-xl mx-auto px-2">
              {isStaff && <GlobalSearch />}
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {showQuickCreate && (
                <div className="hidden sm:flex items-center gap-2">
                  <QuickCreateButton />
                  <div className="h-5 w-px bg-border mx-1" />
                </div>
              )}
              <NotificationBell />
              <div className="h-5 w-px bg-border mx-1 hidden xs:block" />
              <ThemeToggle />
            </div>
          </header>
          <main className={`flex-1 overflow-y-auto overflow-x-hidden animate-fade-up scroll-smooth ${pathname.startsWith("/admin") || pathname.startsWith("/clientes") || pathname.startsWith("/demandas") ? "admin-shell" : ""}`}>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
