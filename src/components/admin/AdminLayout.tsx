import { Outlet, useLocation, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { GlobalSearch } from "@/components/GlobalSearch";


// Rotas em que colaborador pode entrar (somente leitura via UI + RLS).
const COLABORADOR_ALLOWED_PREFIXES = ["/clientes"];

// Rotas que SOMENTE admin pleno pode acessar.
const ADMIN_ONLY_PREFIXES = [
  "/vendas", "/propostas", "/produtos", "/templates",
  "/parceiros", "/indicadores", "/colaboradores",
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
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd/Ctrl+K abre a busca global.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 🔒 Painel admin sempre LIGHT (regra fixa do projeto — feedback explícito do usuário).
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("light");
    html.classList.remove("dark");
    html.style.colorScheme = "light";
    // Limpa qualquer preferência de tema escuro que tenha vazado para o admin.
    try { localStorage.setItem("crm-theme", '"light"'); } catch {}
    return () => {
      // Não restauramos dark aqui — painéis externos (cliente/prestador/etc) gerenciam o próprio tema via ThemeProvider.
    };
  }, []);

  const { isAdmin, isAdminSecondary, isColaborador } = useAuth();
  const { pathname } = useLocation();
  const isFullAdmin = isAdmin || isAdminSecondary;

  // Colaborador NÃO tem acesso ao painel admin. Redireciona para o painel dele.
  if (isColaborador && !isFullAdmin) return <Navigate to="/colaborador" replace />;

  // Vendedores são staff interno mas com escopo restrito (RLS já bloqueia dados sensíveis).
  const blocked = !isFullAdmin && ADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const handleSearchClick = () => setSearchOpen(true);

  if (blocked) return <Navigate to="/admin" replace />;


  return (
    <div className="admin-shell min-h-dvh flex w-full text-foreground">
        <div className="hidden md:block shrink-0 relative z-30">
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
          </main>
        </div>

        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} showTrigger={false} />
      </div>
  );
}

export default function AdminLayout() {
  return (
    <RouteGuard allow={["admin", "admin_secondary", "vendedor"]}>
      <AdminShell />
    </RouteGuard>
  );
}
