import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "./LoadingScreen";

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
  if (isCliente || isLead) return <Navigate to="/cliente" replace />;

  // fallback
  return <Navigate to="/cliente" replace />;
}
