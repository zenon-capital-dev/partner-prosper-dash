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
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="size-10 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin" />
          <div className="absolute inset-0 size-10 rounded-full border border-primary/10 blur-md animate-pulse" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60 animate-pulse">
          Identificando perfil...
        </p>
      </div>
    );
  }

  // Admin and Admin Secondary go to Admin Dashboard
  if (isAdmin || isAdminSecondary) return <Navigate to="/admin" replace />;

  // Specific role panels
  if (isColaborador) return <Navigate to="/colaborador" replace />;
  if (isParceiro) return <Navigate to="/parceiro" replace />;
  if (isPrestador) return <Navigate to="/prestador" replace />;
  if (isCliente || isLead) return <Navigate to="/cliente" replace />;

  // fallback
  return <Navigate to="/cliente" replace />;
}
