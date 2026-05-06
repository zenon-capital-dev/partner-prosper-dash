import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Redireciona o usuário para o painel certo baseado no papel,
 * sem precisar digitar URL.
 */
export default function RoleHome() {
  const { loading, isAdmin, isVendedor, isParceiro, isCliente, isColaborador, isPrestador } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isAdmin || isVendedor || isColaborador) return <Navigate to="/admin" replace />;
  if (isParceiro) return <Navigate to="/parceiro" replace />;
  if (isPrestador) return <Navigate to="/prestador" replace />;
  if (isCliente) return <Navigate to="/cliente" replace />;

  // sem papel ainda — manda pra área do cliente como fallback
  return <Navigate to="/cliente" replace />;
}
