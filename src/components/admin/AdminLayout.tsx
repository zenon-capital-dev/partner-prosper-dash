import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { QuickCreateFab } from "@/components/QuickCreateFab";
import { Bell, ChevronRight, Slash } from "lucide-react";

const ROUTE_LABEL: Record<string, string> = {
  admin: "Dashboard",
  clientes: "Clientes",
  leads: "Leads",
  produtos: "Produtos",
  vendas: "Vendas",
  parceiros: "Parceiros",
  tarefas: "Tarefas",
  documentos: "Documentos",
  contratos: "Contratos",
  projetos: "Projetos",
  colaboradores: "Colaboradores",
  prestadores: "Prestadores",
  indicadores: "Indicadores",
  financeiro: "Financeiro",
  comissoes: "Comissões",
  usuarios: "Usuários",
  suporte: "Suporte",
  configuracoes: "Configurações",
  relatorios: "Relatórios",
  auditoria: "Auditoria",
};

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="size-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const handleSearchClick = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }));
  };

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground admin-shell overflow-hidden">
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader onSearchClick={handleSearchClick} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
