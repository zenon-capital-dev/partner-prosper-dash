import { Outlet, useLocation, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { AIAssistant } from "@/components/chat/AIAssistant";

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

  // 🔒 Painel admin é majoritariamente light por padrão, mas permitimos o dark mode se o usuário desejar.
  useEffect(() => {
    // Verificamos se há preferência de tema salva ou do sistema
    const savedTheme = localStorage.getItem("crm-theme");
    const html = document.documentElement;
    
    // Se não houver preferência salva e o sistema preferir dark, ou se a preferência for dark:
    const shouldBeDark = savedTheme === "\"dark\"" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    
    if (shouldBeDark) {
      html.classList.add("dark");
      html.classList.remove("light");
      html.style.colorScheme = "dark";
    } else {
      html.classList.add("light");
      html.classList.remove("dark");
      html.style.colorScheme = "light";
    }
  }, []);

  const { isAdmin, isAdminSecondary } = useAuth();
  const { pathname } = useLocation();
  const isFullAdmin = isAdmin || isAdminSecondary;
  // Colaboradores e Vendedores são staff interno mas com escopo restrito (RLS já bloqueia dados sensíveis).
  const blocked = !isFullAdmin && ADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const handleSearchClick = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }));
  };

  if (blocked) return <Navigate to="/admin" replace />;

  return (
    <div className="admin-shell min-h-screen flex w-full text-foreground">
        <div className="hidden md:block shrink-0 relative z-50">
          <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        </div>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-[min(88vw,300px)] p-0 bg-white dark:bg-card text-slate-900 dark:text-foreground [&>button]:hidden border-r border-slate-200 dark:border-border">
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
          <main className="flex-1 overflow-y-auto overflow-x-hidden admin-content-scroll relative">
            <Outlet />
            <AIAssistant />
          </main>
        </div>
      </div>
  );
}

export default function AdminLayout() {
  return (
    <RouteGuard allow={["admin", "admin_secondary", "colaborador", "vendedor"]}>
      <AdminShell />
    </RouteGuard>
  );
}
