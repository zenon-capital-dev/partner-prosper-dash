import { Navigate, useLocation, useParams } from "react-router-dom";

/** Keep bookmarks and client links pointing at the requested portal section. */
export function LegacyClientRedirect() {
  const { tab } = useParams<{ tab?: string }>();
  const { search, hash } = useLocation();
  const section = tab === "financeiro" ? "pagamentos" : tab === "docs" ? "documentos" : tab;
  const pathname = section ? `/portal-cliente/${encodeURIComponent(section)}` : "/portal-cliente";

  return <Navigate to={{ pathname, search, hash }} replace />;
}
