import { Navigate } from "react-router-dom";

// Legado: colaborador agora vive dentro do /admin com permissões restritas via RLS.
export default function CollaboratorPanel() {
  return <Navigate to="/admin" replace />;
}
