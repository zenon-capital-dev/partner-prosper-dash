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
      if (!user?.id) return null;
      const [{ data, error }, { data: profile }] = await Promise.all([
        supabase
        .from("clients")
        .select("onboarding_status, status")
        .eq("user_id", user.id)
        .maybeSingle(),
        supabase.from("profiles").select("onboarding_completed").eq("id", user.id).maybeSingle(),
      ]);
      
      if (error) {
        console.error("[RoleClientRedirect] Error checking onboarding:", error);
        return null;
      }
      return { client: data, profile };
    },
    enabled: !!user?.id,
    staleTime: 0, // Always check fresh for redirection
  });

  if (isLoading) return <LoadingScreen message="Redirecionando..." />;

  const clientRow = client?.client;
  const released = client?.profile?.onboarding_completed || ["completo", "concluido"].includes(clientRow?.onboarding_status) || clientRow?.status === "ativo";

  if (clientRow && !released) {
    return <Navigate to="/cliente/onboarding" replace />;
  }

  return <Navigate to="/portal-cliente" replace />;
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
    isVendedor,
    isParceiro, 
    isPrestador, 
    isCliente, 
    isLead,
    isIndicador 
  } = useAuth();

  if (loading) {
    return <LoadingScreen message="Identificando perfil..." />;
  }

  // Admin, Admin Secondary e Vendedor (Comercial) usam o painel administrativo
  if (isAdmin || isAdminSecondary || isVendedor) return <Navigate to="/admin" replace />;
  if (isColaborador) return <Navigate to="/colaborador" replace />;

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
