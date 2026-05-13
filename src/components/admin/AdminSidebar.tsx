import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Package, Handshake, Wallet, FileSignature, FileText,
  Banknote, BarChart3, Settings, UserCog, LifeBuoy, LogOut, Briefcase,
  CircleDollarSign, ClipboardList, History, UserCircle, Truck, Target,
  PanelLeftClose, PanelLeftOpen, Activity, Zap, MessageSquare, ChevronDown,
  Building2, Sparkles, Box,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/format";

type NavItem = { title: string; url: string; icon: any; badge?: string };
type NavSection = { label: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  { label: "Operação", items: [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    { title: "Cockpit", url: "/cockpit", icon: Activity },
    { title: "Demandas", url: "/demandas", icon: ClipboardList },
    { title: "Tarefas", url: "/tarefas", icon: Target },
    { title: "SLA & Prazos", url: "/sla", icon: Zap },
  ]},
  { label: "Clientes", items: [
    { title: "Clientes", url: "/clientes", icon: Users },
    { title: "Vendas", url: "/vendas", icon: CircleDollarSign },
    { title: "Propostas", url: "/propostas", icon: FileText },
  ]},
  { label: "Catálogo", items: [
    { title: "Produtos", url: "/produtos", icon: Package },
    { title: "Projetos", url: "/projetos", icon: Briefcase },
    { title: "Templates", url: "/templates", icon: MessageSquare },
  ]},
  { label: "Rede", items: [
    { title: "Parceiros", url: "/parceiros", icon: Handshake },
    { title: "Prestadores", url: "/prestadores", icon: Truck },
    { title: "Indicadores", url: "/indicadores", icon: Sparkles },
    { title: "Colaboradores", url: "/colaboradores", icon: UserCircle },
  ]},
  { label: "Financeiro", items: [
    { title: "Financeiro", url: "/financeiro", icon: Banknote },
    { title: "Central", url: "/financeiro/central", icon: BarChart3 },
    { title: "Comissões", url: "/comissoes", icon: Wallet },
    { title: "Contratos", url: "/contratos", icon: FileSignature },
    { title: "Documentos", url: "/documentos", icon: FileText },
  ]},
  { label: "Sistema", items: [
    { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
    { title: "Auditoria", url: "/auditoria", icon: History },
    { title: "Usuários", url: "/usuarios", icon: UserCog },
    { title: "Automações", url: "/automacoes", icon: Zap },
    { title: "Suporte", url: "/suporte", icon: LifeBuoy },
    { title: "Configurações", url: "/configuracoes", icon: Settings },
  ]},
];

interface Props { collapsed: boolean; onToggle: () => void; }

export function AdminSidebar({ collapsed, onToggle }: Props) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [, setCmdOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (path: string) =>
    path === "/admin" ? pathname === "/admin" : pathname === path || pathname.startsWith(path + "/");

  const displayName = user?.user_metadata?.full_name || user?.email || "Admin";
  const displayEmail = user?.email || "";

  return (
    <aside
      className={cn(
        "h-svh sticky top-0 shrink-0 flex flex-col z-50 transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "bg-white border-r border-slate-200/70",
        collapsed ? "w-[72px]" : "w-[248px]"
      )}
    >
      {/* BRAND */}
      <div className={cn(
        "relative shrink-0 h-[60px] flex items-center border-b border-slate-200/70",
        collapsed ? "px-3 justify-center" : "px-4"
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "flex items-center gap-2.5 rounded-lg transition-colors group",
              collapsed ? "size-10 justify-center hover:bg-slate-100" : "w-full px-1.5 py-1.5 hover:bg-slate-50"
            )}>
              <div className="size-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-sm shrink-0">
                <Box className="size-4 text-white" strokeWidth={2.5} />
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13.5px] font-semibold text-slate-900 leading-tight tracking-tight truncate">VendxCRM</p>
                  <p className="text-[10px] font-medium text-slate-500 leading-tight mt-0.5 truncate">
                    Painel Administrativo
                  </p>
                </div>
              )}
              {!collapsed && <ChevronDown className="size-3.5 text-slate-400 shrink-0" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]">
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Workspace</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate("/configuracoes")}>
              <Settings className="size-4 mr-2" /> Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/usuarios")}>
              <UserCog className="size-4 mr-2" /> Membros
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {!collapsed && (
          <button
            onClick={onToggle}
            className="absolute -right-3 top-1/2 -translate-y-1/2 size-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all z-10"
            title="Recolher"
          >
            <PanelLeftClose className="size-3" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={onToggle}
          className="mx-auto mt-2 size-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
          title="Expandir"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}

      {/* NAV */}
      <nav className="relative flex-1 overflow-y-auto px-2.5 py-3 space-y-4 vx-sidebar-scroll">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed ? (
              <div className="px-2.5 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {section.label}
                </span>
              </div>
            ) : (
              <div className="h-px bg-slate-200 mx-3 my-2" />
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.url);
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    title={collapsed ? item.title : undefined}
                    className={cn(
                      "group relative flex items-center rounded-md text-[13px] font-medium transition-all duration-150",
                      collapsed ? "justify-center mx-auto size-10" : "px-2.5 h-8 gap-2.5",
                      active
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    {active && !collapsed && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-indigo-600" />
                    )}
                    <Icon
                      className={cn(
                        "shrink-0",
                        collapsed ? "size-[18px]" : "size-[15px]",
                        active ? "text-indigo-600" : "text-slate-500 group-hover:text-slate-700",
                      )}
                      strokeWidth={2}
                    />
                    {!collapsed && (
                      <span className="flex-1 truncate">{item.title}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* USER */}
      <div className="shrink-0 border-t border-slate-200/70 p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "w-full flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-slate-50 transition-colors group",
              collapsed && "justify-center"
            )}>
              <div className="size-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-700 text-[11px] font-bold shrink-0 ring-1 ring-slate-200">
                {initials(displayName)}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[12.5px] font-semibold text-slate-800 truncate leading-tight">{displayName}</p>
                    <p className="text-[10.5px] text-slate-500 truncate leading-tight mt-0.5">{displayEmail}</p>
                  </div>
                  <ChevronDown className="size-3.5 text-slate-400 shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-[220px]">
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Conta</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate("/perfil")}>
              <UserCircle className="size-4 mr-2" /> Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/configuracoes")}>
              <Settings className="size-4 mr-2" /> Preferências
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-rose-600 focus:text-rose-700 focus:bg-rose-50">
              <LogOut className="size-4 mr-2" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
