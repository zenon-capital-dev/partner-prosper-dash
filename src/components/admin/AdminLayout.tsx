import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { AdminSidebar } from "./AdminSidebar";
import { NotificationBell } from "@/components/NotificationBell";
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
  useTheme();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08090c]">
        <div className="size-6 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.length === 0 ? ["admin"] : segments;

  return (
    <div className="min-h-screen flex w-full bg-[#0a0b0f] text-white admin-shell">
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 sticky top-0 z-40 border-b border-white/[0.06] bg-[#0a0b0f]/85 backdrop-blur-xl flex items-center px-5 gap-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 font-mono text-[12px]">
            <span className="text-white/30">/</span>
            {crumbs.map((seg, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className={i === crumbs.length - 1 ? "text-white font-semibold" : "text-white/40"}>
                  {ROUTE_LABEL[seg] ?? seg}
                </span>
                {i < crumbs.length - 1 && <Slash className="size-3 text-white/20" />}
              </span>
            ))}
          </div>

          <div className="flex-1" />

          {/* Status indicators */}
          <div className="hidden md:flex items-center gap-3 mr-2">
            <div className="flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-widest text-white/40">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
              all systems operational
            </div>
            <div className="h-3 w-px bg-white/10" />
            <span className="text-[10.5px] font-mono text-white/40">
              v1.0.0
            </span>
          </div>

          <NotificationBell />
        </header>

        <main className="flex-1 overflow-y-auto bg-[#0a0b0f]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
