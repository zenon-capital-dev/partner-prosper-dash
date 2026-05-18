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
        .maybeSingle();
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

  // Admin, Admin Secondary e Colaborador usam o painel administrativo
  if (isAdmin || isAdminSecondary || isColaborador) return <Navigate to="/admin" replace />;

  // Specific role panels
  if (isParceiro) return <Navigate to="/parceiro" replace />;
  if (isIndicador) return <Navigate to="/indicador" replace />;
  if (isPrestador) return <Navigate to="/prestador" replace />;
  if (isCliente || isLead) {
    // Check if onboarding is completed
    return <RoleClientRedirect />;
  }

  // No role assigned — do NOT default to /cliente (would show waiting screen).
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background text-foreground">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">Conta sem perfil atribuído</h1>
        <p className="text-muted-foreground">
          Sua conta ainda não tem um papel definido. Contate o administrador para liberar seu acesso.
        </p>
      </div>
    </div>
  );
}
