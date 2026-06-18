import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { RouteGuard } from "@/components/RouteGuard";
import { useOnboardingGuard } from "@/hooks/useOnboardingGuard";
import { LoadingScreen } from "@/components/LoadingScreen";

/**
 * Layout enxuto para os painéis de usuário final (cliente, parceiro,
 * colaborador, indicador, prestador). NÃO renderiza a AppSidebar do admin
 * — cada painel desenha sua própria navegação interna (PanelShell), evitando
 * sidebar duplicada e poluição visual.
 */
export default function PanelLayout() {
  return (
    <RouteGuard>
      <PanelLayoutInner />
    </RouteGuard>
  );
}

function PanelLayoutInner() {
  const { pathname } = useLocation();
  const { isLoading: onboardingLoading, checkAccess } = useOnboardingGuard();

  useEffect(() => {
    checkAccess();
  }, [pathname, onboardingLoading]);

  // Painéis de cliente/parceiro/etc usam tema claro
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
  }, [pathname]);

  if (onboardingLoading) {
    return <LoadingScreen message="Carregando painel..." />;
  }

  return (
    <div className="min-h-dvh bg-slate-50/70">
      <Outlet />
    </div>
  );
}
