import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Package, Handshake, Wallet, FileSignature, FileText,
  Banknote, BarChart3, Settings, UserCog, LifeBuoy, LogOut, Briefcase,
  CircleDollarSign, ClipboardList, History, UserCircle, Truck, Target,
  PanelLeftClose, PanelLeftOpen, Activity, Zap, MessageSquare, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/format";

type NavItem = { title: string; url: string; icon: any };
type NavSection = { label: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  { label: "Visão Geral", items: [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
    { title: "SLA & Prazos", url: "/sla", icon: Zap },
    { title: "Auditoria", url: "/auditoria", icon: History },
  ]},
  { label: "Comercial", items: [
    { title: "Clientes", url: "/clientes", icon: Users },
    { title: "Leads", url: "/leads", icon: Target },
    { title: "Produtos", url: "/produtos", icon: Package },
    { title: "Vendas", url: "/vendas", icon: CircleDollarSign },
    { title: "Propostas", url: "/propostas", icon: FileText },
    { title: "Parceiros", url: "/parceiros", icon: Handshake },
  ]},
  { label: "Operação", items: [
    { title: "Demandas", url: "/demandas", icon: ClipboardList },
    { title: "Tarefas", url: "/tarefas", icon: ClipboardList },
    { title: "Documentos", url: "/documentos", icon: FileText },
    { title: "Contratos", url: "/contratos", icon: FileSignature },
    { title: "Projetos", url: "/projetos", icon: Briefcase },
    { title: "Templates", url: "/templates", icon: MessageSquare },
    { title: "Colaboradores", url: "/colaboradores", icon: UserCircle },
    { title: "Prestadores", url: "/prestadores", icon: Truck },
    { title: "Indicadores", url: "/indicadores", icon: Activity },
  ]},
  { label: "Financeiro", items: [
    { title: "Financeiro", url: "/financeiro", icon: Banknote },
    { title: "Central", url: "/financeiro/central", icon: BarChart3 },
    { title: "Comissões", url: "/comissoes", icon: Wallet },
  ]},
  { label: "Sistema", items: [
    { title: "Usuários", url: "/usuarios", icon: UserCog },
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
        "bg-[#08080a]/95 backdrop-blur-xl border-r border-white/[0.06]",
        collapsed ? "w-[76px]" : "w-[252px]"
      )}
      style={{
        backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.015) 0%, transparent 100%)",
      }}
    >
      {/* BRAND */}
      <div className={cn(
        "relative shrink-0 h-[68px] flex items-center border-b border-white/[0.05]",
        collapsed ? "px-3 justify-center" : "px-4"
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "flex items-center gap-2.5 rounded-lg transition-colors group",
              collapsed ? "size-11 justify-center hover:bg-white/[0.04]" : "w-full px-1.5 py-1.5 hover:bg-white/[0.03]"
            )}>
              <div className="relative shrink-0">
                <div className="size-9 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center">
                  <div className="size-4 rounded-sm bg-cyan-400" style={{ boxShadow: "0 0 12px hsla(187,92%,55%,0.7)" }} />
                </div>
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[14px] font-bold text-white leading-tight tracking-tight">Admin</p>
                  <p className="text-[9px] font-mono font-bold text-zinc-500 tracking-[0.22em] uppercase leading-tight mt-0.5">
                    Direct Response
                  </p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[230px] p-1.5 rounded-xl bg-zinc-950 border-white/10 shadow-2xl">
            <DropdownMenuLabel className="px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-zinc-500">Workspace</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="gap-2.5 px-2.5 py-2 text-[13px] font-medium rounded-md cursor-pointer text-zinc-300 focus:bg-white/[0.06] focus:text-white">
              <Settings className="size-4" /> Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/usuarios")} className="gap-2.5 px-2.5 py-2 text-[13px] font-medium rounded-md cursor-pointer text-zinc-300 focus:bg-white/[0.06] focus:text-white">
              <UserCog className="size-4" /> Membros
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {!collapsed && (
          <button
            onClick={onToggle}
            className="absolute -right-3 top-1/2 -translate-y-1/2 size-6 rounded-full bg-zinc-900 border border-white/10 shadow-md flex items-center justify-center text-zinc-500 hover:text-cyan-400 hover:border-cyan-500/40 transition-all z-10"
            title="Recolher"
          >
            <PanelLeftClose className="size-3" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={onToggle}
          className="mx-auto mt-2 size-8 rounded-md hover:bg-white/[0.05] flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors"
          title="Expandir"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}

      {/* NAV */}
      <nav className="relative flex-1 overflow-y-auto px-3 py-4 space-y-5 vx-sidebar-scroll">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed ? (
              <div className="px-2 mb-2">
                <span className="text-[9px] font-mono font-bold uppercase tracking-[0.22em] text-zinc-600">
                  {section.label}
                </span>
              </div>
            ) : (
              <div className="h-px bg-white/[0.05] mx-3 my-2" />
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
                      collapsed ? "justify-center mx-auto size-10" : "px-2.5 h-9 gap-2.5",
                      active
                        ? "bg-white/[0.07] text-white ring-1 ring-inset ring-white/[0.08]"
                        : "text-zinc-400 hover:text-white hover:bg-white/[0.035]"
                    )}
                  >
                    {active && !collapsed && (
                      <span
                        className="absolute -left-3 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-full bg-cyan-400"
                        style={{ boxShadow: "0 0 10px hsla(187,92%,55%,0.8)" }}
                      />
                    )}
                    <Icon
                      className={cn(
                        "shrink-0 transition-colors",
                        collapsed ? "size-[18px]" : "size-[16px]",
                        active ? "text-cyan-400" : "text-zinc-500 group-hover:text-zinc-200",
                      )}
                      strokeWidth={1.75}
                    />
                    {!collapsed && (
                      <span className="flex-1 truncate tracking-tight">{item.title}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* USER */}
      <div className="shrink-0 border-t border-white/[0.05] p-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "w-full flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-white/[0.04] transition-colors group",
              collapsed && "justify-center"
            )}>
              <div className="size-8 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-200 text-[11px] font-bold shrink-0">
                {initials(displayName)}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[12px] font-semibold text-zinc-100 truncate leading-tight">{displayName}</p>
                    <p className="text-[10px] text-zinc-500 truncate font-mono leading-tight mt-0.5">{displayEmail}</p>
                  </div>
                  <ChevronDown className="size-3.5 text-zinc-500 shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-[220px] p-1.5 rounded-xl bg-zinc-950 border-white/10 shadow-2xl">
            <DropdownMenuLabel className="px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-zinc-500">Conta</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate("/perfil")} className="gap-2.5 px-2.5 py-2 text-[13px] font-medium rounded-md cursor-pointer text-zinc-300 focus:bg-white/[0.06] focus:text-white">
              <UserCircle className="size-4" /> Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="gap-2.5 px-2.5 py-2 text-[13px] font-medium rounded-md cursor-pointer text-zinc-300 focus:bg-white/[0.06] focus:text-white">
              <Settings className="size-4" /> Preferências
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            <DropdownMenuItem onClick={signOut} className="gap-2.5 px-2.5 py-2 text-[13px] font-medium rounded-md cursor-pointer text-rose-400 focus:bg-rose-500/10 focus:text-rose-300">
              <LogOut className="size-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
