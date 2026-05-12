import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/LoadingScreen";

type AppRole =
  | "admin"
  | "admin_secondary"
  | "colaborador"
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
 * Single source of truth for auth + role gating.
 * - Waits for session AND roles to be fully loaded before deciding.
 * - Redirects unauthenticated users to /auth.
 * - Redirects authenticated users without the required role to their own home.
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
      // Send the user to root, where RoleHome routes them to their own panel.
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
