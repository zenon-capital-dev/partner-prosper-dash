import { NavLink, useLocation, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Package, Handshake, Wallet, FileSignature, FileText,
  Banknote, BarChart3, Settings, UserCog, LifeBuoy, LogOut, Search, Command,
  Briefcase, CircleDollarSign, ClipboardList, History, UserCircle, Truck, Target,
  PanelLeftClose, PanelLeftOpen, Activity, Zap, MessageSquare, ChevronDown, Sparkles, Crown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalSearch } from "@/components/GlobalSearch";
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
      { title: "Central Financeira", url: "/financeiro/central", icon: BarChart3 },
      { title: "Comissões", url: "/comissoes", icon: Wallet },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Usuários & Acessos", url: "/usuarios", icon: UserCog },
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

  const allItems = SECTIONS.flatMap((s) => s.items.map((i) => ({ ...i, group: s.label })));
  const displayName = user?.user_metadata?.full_name || user?.email || "Admin";

  return (
    <>
      <aside
        className={cn(
          "h-svh sticky top-0 shrink-0 flex flex-col text-sidebar-foreground transition-[width] duration-200 ease-in-out z-50",
          "bg-[#09090b] border-r border-white/[0.04]",
          collapsed ? "w-[64px]" : "w-[240px]"
        )}
      >
        {/* Workspace / Brand */}
        <div className={cn("h-[60px] flex items-center border-b border-white/[0.05] shrink-0", collapsed ? "px-2 justify-center" : "px-3")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "h-10 flex items-center gap-2.5 rounded-lg hover:bg-white/[0.04] transition-colors group",
                  collapsed ? "w-10 justify-center" : "w-full px-2"
                )}
              >
                <div className="size-8 rounded-lg bg-zinc-800 border border-white/[0.08] flex items-center justify-center shrink-0 shadow-inner">
                  <Zap className="size-4 text-zinc-300" strokeWidth={2} />
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[13px] font-semibold text-white leading-tight truncate">Prosper</p>
                      <p className="text-[10.5px] text-white/40 leading-tight truncate">Workspace · Pro</p>
                    </div>
                    <ChevronDown className="size-3.5 text-white/35 group-hover:text-white/70 transition-colors shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 bg-[#0c0c14] border-white/[0.08] text-white p-1.5 rounded-xl shadow-2xl">
              <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Workspace</DropdownMenuLabel>
              <div className="px-2 py-2 flex items-center gap-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] mb-1">
                <div className="size-8 rounded-lg bg-zinc-800 border border-white/[0.08] flex items-center justify-center"><Zap className="size-4 text-zinc-300" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-white">Prosper</p>
                  <p className="text-[10.5px] text-zinc-500">Plano Pro · 12 usuários</p>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-white/[0.06] my-1" />
              <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="gap-2.5 px-2 py-2 text-[12.5px] rounded-md focus:bg-white/[0.06] cursor-pointer">
                <Settings className="size-3.5 text-white/45" /> Configurações da empresa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/usuarios")} className="gap-2.5 px-2 py-2 text-[12.5px] rounded-md focus:bg-white/[0.06] cursor-pointer">
                <UserCog className="size-3.5 text-white/45" /> Membros & permissões
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/relatorios")} className="gap-2.5 px-2 py-2 text-[12.5px] rounded-md focus:bg-white/[0.06] cursor-pointer">
                <Sparkles className="size-3.5 text-white/45" /> Faturamento & plano
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search & Collapse */}
        <div className="px-2 pt-2.5 pb-1.5 flex items-center gap-1.5">
          {!collapsed ? (
            <button
              onClick={() => setCmdOpen(true)}
              className="flex-1 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05] flex items-center gap-2 px-2.5 text-[12px] text-white/50 transition-colors group"
            >
              <Search className="size-3.5 group-hover:text-white/80 transition-colors" />
              <span className="flex-1 text-left font-medium">Buscar...</span>
              <kbd className="text-[9.5px] font-mono bg-white/[0.06] border border-white/[0.08] rounded px-1 py-0 leading-[14px] text-white/60">⌘K</kbd>
            </button>
          ) : (
            <button
              onClick={() => setCmdOpen(true)}
              className="size-9 mx-auto rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] flex items-center justify-center text-white/55 hover:text-white transition-colors"
            >
              <Search className="size-3.5" />
            </button>
          )}
          {!collapsed && (
            <button
              onClick={onToggle}
              className="size-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white transition-colors shrink-0"
              title="Recolher"
            >
              <PanelLeftClose className="size-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            onClick={onToggle}
            className="mx-auto size-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white transition-colors mt-0.5"
            title="Expandir"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 vx-sidebar-scroll">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              {!collapsed ? (
                <div className="px-2.5 mb-1 text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/30">
                  {section.label}
                </div>
              ) : (
                <div className="h-px bg-white/[0.05] mx-3 mb-1.5" />
              )}
              <div className="space-y-px">
                {section.items.map((item) => {
                  const active = isActive(item.url);
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.url}
                      to={item.url}
                      title={collapsed ? item.title : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-all duration-150 px-2.5 h-8",
                        collapsed ? "justify-center h-9 mx-1" : "mx-2",
                        active
                          ? "bg-white/[0.06] text-white"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-[16px] shrink-0 transition-colors",
                          active ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                        )}
                        strokeWidth={active ? 2 : 1.5}
                      />
                      {!collapsed && (
                        <>
                          <span className="truncate flex-1">{item.title}</span>
                          {item.badge && (
                            <span className="text-[9.5px] font-bold tabular-nums px-1.5 h-[16px] rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center">
                              {item.badge}
                            </span>
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

        {/* Info Box */}
        {!collapsed && (
          <div className="px-3 pb-4">
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
              <p className="text-[10px] text-zinc-500 leading-snug">
                Você está usando a versão Pro. <Link to="/configuracoes" className="text-zinc-300 hover:text-white underline underline-offset-2">Ver detalhes</Link>
              </p>
            </div>
          </div>
        )}

        {/* User */}
        <div className="border-t border-white/[0.05] p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-white/[0.04] transition-colors group",
                  collapsed && "justify-center"
                )}
              >
                <div className="relative shrink-0">
                  <div className="size-8 rounded-lg bg-zinc-800 border border-white/[0.08] flex items-center justify-center text-[11px] font-bold text-zinc-300">
                    {initials(displayName)}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 border-2 border-[#09090b]" />
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[12.5px] font-semibold text-white truncate leading-tight">
                      {String(displayName).split(/[@ ]/)[0]}
                    </p>
                    <p className="text-[10.5px] text-white/40 truncate mt-0.5">{user?.email}</p>
                  </div>
                )}
                {!collapsed && <ChevronDown className="size-3.5 text-white/30 group-hover:text-white/60 transition-colors shrink-0" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={collapsed ? "right" : "top"}
              align="end"
              className="w-60 bg-[#0c0c14] border-white/[0.08] text-white p-1.5 rounded-xl shadow-2xl"
            >
              <div className="px-2 py-2 flex items-center gap-2.5">
                <div className="size-9 rounded-lg bg-zinc-800 border border-white/[0.08] flex items-center justify-center text-[12px] font-bold text-white">{initials(displayName)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold truncate">{displayName}</p>
                  <p className="text-[10.5px] text-white/45 truncate">{user?.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-white/[0.06] my-1" />
              <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="gap-2.5 px-2 py-2 text-[12.5px] rounded-md focus:bg-white/[0.06] cursor-pointer">
                <Settings className="size-3.5 text-white/45" /> Preferências
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/suporte")} className="gap-2.5 px-2 py-2 text-[12.5px] rounded-md focus:bg-white/[0.06] cursor-pointer">
                <LifeBuoy className="size-3.5 text-white/45" /> Ajuda & suporte
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.06] my-1" />
              <DropdownMenuItem onClick={signOut} className="gap-2.5 px-2 py-2 text-[12.5px] rounded-md text-rose-300 focus:bg-rose-500/10 focus:text-rose-200 cursor-pointer">
                <LogOut className="size-3.5" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <GlobalSearch open={cmdOpen} onOpenChange={setCmdOpen} navItems={allItems} />
    </>
  );
}
