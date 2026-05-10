import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "./LoadingScreen";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function RoleClientRedirect() {
  const { user } = useAuth();
  const { data: client, isLoading } = useQuery({
    queryKey: ["client-redirect-check", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("onboarding_status")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user
  });

  if (isLoading) return <LoadingScreen message="Redirecionando..." />;

  if (client?.onboarding_status !== 'completo') {
    return <Navigate to="/cliente/onboarding" replace />;
  }

  return <Navigate to="/cliente" replace />;
}

/**
 * Redireciona o usuário para o painel certo baseado no papel,
 * sem precisar digitar URL.
 */
export default function RoleHome() {
  const { 
    loading, 
    isAdmin, 
    isAdminSecondary, 
    isColaborador, 
    isParceiro, 
    isPrestador, 
    isCliente, 
    isLead,
    isIndicador 
  } = useAuth();

  if (loading) {
    return <LoadingScreen message="Identificando perfil..." />;
  }

  // Admin and Admin Secondary go to Admin Dashboard
  if (isAdmin || isAdminSecondary) return <Navigate to="/admin" replace />;

  // Specific role panels
  if (isColaborador) return <Navigate to="/colaborador" replace />;
  if (isParceiro) return <Navigate to="/parceiro" replace />;
  if (isIndicador) return <Navigate to="/indicador" replace />;
  if (isPrestador) return <Navigate to="/prestador" replace />;
  if (isCliente || isLead) {
    // Check if onboarding is completed
    return <RoleClientRedirect />;
  }

  // fallback
  return <Navigate to="/cliente" replace />;
}
