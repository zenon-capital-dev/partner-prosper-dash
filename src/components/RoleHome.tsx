import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

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
    isLead 
  } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Admin and Staff go to Admin Dashboard
  if (isAdmin || isAdminSecondary || isColaborador) return <Navigate to="/admin" replace />;
  
  // Specific role panels
  if (isParceiro) return <Navigate to="/parceiro" replace />;
  if (isPrestador) return <Navigate to="/prestador" replace />;
  if (isCliente || isLead) return <Navigate to="/cliente" replace />;

  // fallback
  return <Navigate to="/cliente" replace />;
}
