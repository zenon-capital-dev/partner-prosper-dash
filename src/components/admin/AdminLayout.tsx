import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { QuickCreateFab } from "@/components/QuickCreateFab";
import { Button } from "@/components/ui/button";
import { Bell, ChevronRight, Slash, RefreshCcw, LogOut } from "lucide-react";

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
  const { user, loading, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [showTimeout, setShowTimeout] = useState(false);

  // Safety timeout for loading state
  useEffect(() => {
    let timer: any;
    if (loading) {
      timer = setTimeout(() => {
        setShowTimeout(true);
      }, 8000); // 8 seconds
    } else {
      setShowTimeout(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="size-12 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin mb-6" />
        
        {showTimeout ? (
          <div className="animate-fade-up max-w-sm px-4">
            <h3 className="text-xl font-bold mb-2 text-foreground">Identificamos um atraso...</h3>
            <p className="text-sm text-muted-foreground mb-8">
              Não conseguimos carregar suas permissões a tempo. Pode ser instabilidade na conexão.
            </p>
            <div className="flex flex-col gap-3">
              <Button onClick={() => window.location.reload()} size="lg" className="w-full">
                <RefreshCcw className="size-4 mr-2" /> Tentar Novamente
              </Button>
              <Button onClick={() => signOut()} variant="ghost" size="lg" className="w-full text-muted-foreground hover:text-foreground">
                <LogOut className="size-4 mr-2" /> Sair do sistema
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60 animate-pulse">
            Sincronizando ambiente seguro...
          </p>
        )}
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
        <QuickCreateFab />
      </div>
    </div>
  );
}
