import { Outlet, useLocation, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
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

  // 🔒 Painel admin é SEMPRE light premium (decisão fixa do produto).
  // Forçamos modo claro enquanto o shell estiver montado e restauramos ao sair.
  useEffect(() => {
    const html = document.documentElement;
    const hadDark = html.classList.contains("dark");
    html.classList.remove("dark");
    html.classList.add("light");
    html.style.colorScheme = "light";
    return () => {
      html.classList.remove("light");
      html.style.colorScheme = "";
      if (hadDark) html.classList.add("dark");
    };
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
    <div className="min-h-screen flex w-full text-slate-900 admin-shell bg-[radial-gradient(1200px_600px_at_-10%_-20%,rgba(99,102,241,0.06),transparent_60%),radial-gradient(900px_500px_at_110%_10%,rgba(14,165,233,0.05),transparent_55%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
        <div className="hidden md:block shrink-0">
          <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        </div>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-[min(88vw,300px)] p-0 bg-white text-slate-900 [&>button]:hidden">
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
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <Outlet />
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

