import { NavLink, useLocation, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Package, Handshake, Wallet, FileSignature, FileText,
  Banknote, BarChart3, Settings, UserCog, LifeBuoy, LogOut, Search,
  Briefcase, CircleDollarSign, ClipboardList, History, UserCircle, Truck, Target,
  PanelLeftClose, PanelLeftOpen, Activity, Zap, MessageSquare, ChevronRight, ChevronDown,
  Crown, Bell,
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
  {
    label: "Visão Geral",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
      { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
      { title: "SLA & Prazos", url: "/sla", icon: Zap },
      { title: "Auditoria", url: "/auditoria", icon: History },
    ],
  },
  {
    label: "Comercial",
    items: [
      { title: "Clientes", url: "/clientes", icon: Users },
      { title: "Leads", url: "/leads", icon: Target },
      { title: "Produtos", url: "/produtos", icon: Package },
      { title: "Vendas", url: "/vendas", icon: CircleDollarSign },
      { title: "Propostas", url: "/propostas", icon: FileText },
      { title: "Parceiros", url: "/parceiros", icon: Handshake },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Demandas", url: "/demandas", icon: ClipboardList },
      { title: "Tarefas", url: "/tarefas", icon: ClipboardList },
      { title: "Documentos", url: "/documentos", icon: FileText },
      { title: "Contratos", url: "/contratos", icon: FileSignature },
      { title: "Projetos", url: "/projetos", icon: Briefcase },
      { title: "Templates", url: "/templates", icon: MessageSquare },
      { title: "Colaboradores", url: "/colaboradores", icon: UserCircle },
      { title: "Prestadores", url: "/prestadores", icon: Truck },
      { title: "Indicadores", url: "/indicadores", icon: Activity },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro", url: "/financeiro", icon: Banknote },
      { title: "Central", url: "/financeiro/central", icon: BarChart3 },
      { title: "Comissões", url: "/comissoes", icon: Wallet },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Usuários", url: "/usuarios", icon: UserCog },
      { title: "Suporte", url: "/suporte", icon: LifeBuoy },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export function AdminSidebar({ collapsed, onToggle }: Props) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
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
        "bg-white border-r border-slate-200/80",
        collapsed ? "w-[80px]" : "w-[260px]"
      )}
    >
      {/* ============ BRAND HEADER ============ */}
      <div className={cn(
        "relative shrink-0 h-[78px] flex items-center",
        collapsed ? "px-3 justify-center" : "px-5"
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "flex items-center gap-3 rounded-xl transition-colors group",
              collapsed ? "w-12 h-12 justify-center hover:bg-slate-100" : "w-full px-1 py-1 hover:bg-slate-50"
            )}>
              <div className="relative shrink-0">
                <div className="size-11 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg">
                  <BarChart3 className="size-[22px] text-white" strokeWidth={2.5} />
                </div>
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[17px] font-extrabold text-slate-900 leading-tight tracking-tight">Admin</p>
                  <p className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase leading-tight mt-0.5">
                    Direct Response
                  </p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[240px] p-2 rounded-2xl border-slate-200 shadow-xl">
            <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="gap-2.5 px-2.5 py-2 text-[13px] font-medium rounded-lg cursor-pointer">
              <Settings className="size-4 text-slate-500" /> Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/usuarios")} className="gap-2.5 px-2.5 py-2 text-[13px] font-medium rounded-lg cursor-pointer">
              <UserCog className="size-4 text-slate-500" /> Membros
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {!collapsed && (
          <button
            onClick={onToggle}
            className="absolute -right-3 top-1/2 -translate-y-1/2 size-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-violet-600 hover:border-violet-300 transition-all z-10"
            title="Recolher"
          >
            <PanelLeftClose className="size-3" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={onToggle}
          className="mx-auto size-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors mb-1"
          title="Expandir"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}

      {/* ============ NAV ============ */}
      <nav className="relative flex-1 overflow-y-auto px-3 py-2 space-y-5 vx-sidebar-scroll">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed ? (
              <div className="px-3 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  {section.label}
                </span>
              </div>
            ) : (
              <div className="h-px bg-slate-100 mx-3 my-2" />
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.url);
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    title={collapsed ? item.title : undefined}
                    className={cn(
                      "group relative flex items-center rounded-xl text-[13.5px] font-semibold transition-all duration-200",
                      collapsed ? "justify-center mx-auto size-11" : "px-3 h-11 gap-3",
                      active
                        ? "bg-slate-900 text-white shadow-md"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/70"
                    )}
                  >
                    <Icon
                      className={cn(
                        "shrink-0 transition-transform",
                        collapsed ? "size-[19px]" : "size-[18px]",
                        active ? "text-white" : "text-slate-400 group-hover:text-slate-700",
                      )}
                      strokeWidth={active ? 2.4 : 2}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate tracking-tight">{item.title}</span>
                        {item.badge && (
                          <span className={cn(
                            "text-[10px] font-bold tabular-nums px-1.5 h-5 rounded-md flex items-center",
                            active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                          )}>
                            {item.badge}
                          </span>
                        )}
                        {active && !item.badge && (
                          <ChevronRight className="size-4 text-white/90 shrink-0" strokeWidth={2.5} />
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ============ FOOTER / USER ============ */}
      <div className="shrink-0 border-t border-slate-100 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "w-full flex items-center gap-3 rounded-xl p-2 hover:bg-slate-100/70 transition-colors group",
              collapsed && "justify-center"
            )}>
              <div className="size-9 rounded-xl bg-slate-900 flex items-center justify-center text-white text-[12px] font-bold shadow-sm shrink-0">
                {initials(displayName)}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[13px] font-bold text-slate-800 truncate leading-tight">{displayName}</p>
                    <p className="text-[10.5px] text-slate-400 truncate font-medium leading-tight mt-0.5">{displayEmail}</p>
                  </div>
                  <ChevronDown className="size-3.5 text-slate-400 shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-[230px] p-2 rounded-2xl border-slate-200 shadow-xl">
            <DropdownMenuLabel className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Conta</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate("/perfil")} className="gap-2.5 px-2.5 py-2 text-[13px] font-medium rounded-lg cursor-pointer">
              <UserCircle className="size-4 text-slate-500" /> Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="gap-2.5 px-2.5 py-2 text-[13px] font-medium rounded-lg cursor-pointer">
              <Settings className="size-4 text-slate-500" /> Preferências
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="gap-2.5 px-2.5 py-2 text-[13px] font-medium rounded-lg cursor-pointer text-rose-600 focus:text-rose-700 focus:bg-rose-50">
              <LogOut className="size-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
