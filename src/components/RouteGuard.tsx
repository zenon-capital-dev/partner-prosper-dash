import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/LoadingScreen";

type AppRole =
  | "admin"
  | "admin_secondary"
  | "colaborador"
  | "vendedor"
  | "parceiro"
  | "prestador"
  | "cliente"
  | "lead"
  | "indicador";

interface Props {
  /** If provided, only these roles may enter. Empty = any authenticated user. */
  allow?: AppRole[];
  children: ReactNode;
}

/**
 * Devolve a home canônica de cada role. Usado para mandar o usuário
 * direto pro painel dele quando ele tentar entrar em área proibida.
 */
function homeForRoles(roles: string[]): string {
  if (roles.includes("admin") || roles.includes("admin_secondary") || roles.includes("vendedor")) return "/admin";
  if (roles.includes("colaborador")) return "/colaborador";
  if (roles.includes("parceiro")) return "/parceiro";
  if (roles.includes("prestador")) return "/prestador";
  if (roles.includes("indicador")) return "/indicador";
  if (roles.includes("cliente") || roles.includes("lead")) return "/portal-cliente";
  return "/";
}

/**
 * Single source of truth for auth + role gating.
 * - Waits for session AND roles to be fully loaded before deciding.
 * - Redirects unauthenticated users to /auth.
 * - Redirects authenticated users without the required role direto pro painel deles.
 */
export function RouteGuard({ allow, children }: Props) {
  const { user, loading, roles } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return <LoadingScreen message="Validando sessão..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: pathname }} />;
  }

  if (allow && allow.length > 0) {
    const ok = roles.some((r) => allow.includes(r as AppRole));
    if (!ok) {
      const home = homeForRoles(roles);
      // Se já estamos na home da role, evita loop e cai pra "/".
      if (home === pathname) return <Navigate to="/" replace />;
      return <Navigate to={home} replace />;
    }
  }

  return <>{children}</>;
}
