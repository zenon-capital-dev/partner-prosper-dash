import { Outlet } from "react-router-dom";
import { useState } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { RouteGuard } from "@/components/RouteGuard";

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
  const [collapsed, setCollapsed] = useState(false);

  const handleSearchClick = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }));
  };

  return (
    <RouteGuard allow={["admin", "admin_secondary"]}>
      <div className="min-h-screen flex w-full text-foreground admin-shell">
        <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        <div className="flex-1 flex flex-col min-w-0 relative">
          <AdminHeader onSearchClick={handleSearchClick} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </RouteGuard>
  );
}
