import { Navigate } from "react-router-dom";

// Colaborador agora usa o painel administrativo (/admin) com escopo restrito
// pelas RLS e pela própria sidebar. Esta rota legada apenas redireciona.
export default function CollaboratorPanel() {
  return <Navigate to="/admin" replace />;
}
