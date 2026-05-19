import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/LoadingScreen";

/**
 * Hook to block access for clients that haven't completed onboarding.
 * Admins and other roles are never blocked.
 */
export function useOnboardingGuard() {
  const { user, roles, loading: authLoading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const isClient = roles.includes("cliente") || roles.includes("lead");
  
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["onboarding-guard-check", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed, onboarding_step")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && isClient,
  });

  const isLoading = authLoading || (isClient && profileLoading);

  const checkAccess = () => {
    if (isLoading) return true; // Still loading, don't redirect yet
    if (!isClient) return true; // Non-clients are never blocked
    
    const isCompleted = profile?.onboarding_completed;
    const isOnOnboardingPage = pathname.startsWith("/cliente/onboarding");
    const isSupportPage = pathname.includes("/suporte");
    const isDocsPage = pathname.includes("/documentos");
    const isFinancePage = pathname.includes("/financeiro");
    const isContractsPage = pathname.includes("/contratos");

    // Only allow specific pages if onboarding is NOT completed
    if (!isCompleted) {
      if (!isOnOnboardingPage && !isSupportPage && !isDocsPage && !isFinancePage && !isContractsPage) {
        navigate("/cliente/onboarding", { replace: true });
        return false;
      }
    } else {
      // If completed but still on onboarding page, move to dashboard
      if (isOnOnboardingPage) {
        navigate("/cliente", { replace: true });
        return false;
      }
    }

    return true;
  };

  return { isLoading, checkAccess, profile };
}
