import { Navigate } from "react-router-dom";

// Cadastro público desativado: apenas o admin cria contas via painel.
export default function SignupPage() {
  return <Navigate to="/auth" replace />;
}
