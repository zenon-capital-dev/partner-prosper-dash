import { Outlet, useLocation, Navigate } from "react-router-dom";
import { useState } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";

// Rotas que SOMENTE admin pleno pode acessar. Colaborador fica restrito a operação.
const ADMIN_ONLY_PREFIXES = [
  "/clientes", "/vendas", "/propostas", "/produtos", "/projetos", "/templates",
  "/parceiros", "/prestadores", "/indicadores", "/colaboradores",
  "/financeiro", "/comissoes", "/contratos", "/documentos", "/atuacoes",
  "/relatorios", "/auditoria", "/usuarios", "/automacoes", "/suporte", "/configuracoes",
];

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

function AdminShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAdmin, isAdminSecondary } = useAuth();
  const { pathname } = useLocation();
  const isFullAdmin = isAdmin || isAdminSecondary;
  const blocked = !isFullAdmin && ADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const handleSearchClick = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }));
  };

  if (blocked) return <Navigate to="/admin" replace />;

  return (
    <div className="min-h-screen flex w-full text-foreground bg-background admin-shell">
        <div className="hidden md:block shrink-0">
          <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        </div>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-[min(88vw,300px)] p-0 bg-card text-foreground [&>button]:hidden">
            <AdminSidebar
              collapsed={false}
              onToggle={() => setMobileMenuOpen(false)}
              onNavigate={() => setMobileMenuOpen(false)}
              className="w-full border-r-0 shadow-none"
            />
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex flex-col min-w-0 relative">
          <AdminHeader onSearchClick={handleSearchClick} onMenuClick={() => setMobileMenuOpen(true)} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-transparent">
            <Outlet />
          </main>
        </div>
      </div>
  );
}

export default function AdminLayout() {
  return (
    <RouteGuard allow={["admin", "admin_secondary", "colaborador"]}>
      <AdminShell />
    </RouteGuard>
  );
}

