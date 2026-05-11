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
          "h-svh sticky top-0 shrink-0 flex flex-col transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] z-50 relative",
          "bg-white dark:bg-[#08080b] border-r border-slate-200 dark:border-white/[0.05] shadow-2xl shadow-slate-200/50 dark:shadow-none",
          collapsed ? "w-[72px]" : "w-[260px]"
        )}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[300px] bg-gradient-to-b from-indigo-500/[0.04] dark:from-indigo-600/[0.07] via-transparent to-transparent" />
        </div>

        {/* Workspace / Brand */}
        <div className={cn("relative h-[72px] flex items-center border-b border-slate-100 dark:border-white/[0.05] shrink-0", collapsed ? "px-2 justify-center" : "px-4")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "h-12 flex items-center gap-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all group",
                  collapsed ? "w-12 justify-center" : "w-full px-2"
                )}
              >
                <div className="relative shrink-0">
                  <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-[0_6px_16px_-4px_rgba(99,102,241,0.5)] ring-1 ring-white/30 dark:ring-white/15">
                    <Crown className="size-5 text-white" strokeWidth={2.2} />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#08080b] shadow-sm" />
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[15px] font-black text-slate-900 dark:text-white leading-tight tracking-tighter uppercase italic">Prosper</p>
                      <p className="text-[9.5px] text-indigo-500 dark:text-indigo-400/80 leading-tight truncate tracking-widest font-black mt-0.5">EXECUTIVE</p>
                    </div>
                    <ChevronDown className="size-4 text-slate-300 dark:text-white/20 group-hover:text-slate-500 dark:group-hover:text-white/50 transition-colors shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 bg-white dark:bg-[#0c0c14] border-slate-200 dark:border-white/[0.08] p-1.5 rounded-2xl shadow-2xl">
              <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/35">Ecossistema</DropdownMenuLabel>
              <div className="px-2 py-2.5 flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.05] mb-1">
                <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center ring-1 ring-white/20 shadow-lg shadow-indigo-500/20"><Crown className="size-5 text-white" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Prosper CRM</p>
                  <p className="text-[10.5px] text-slate-500 dark:text-zinc-500 font-medium">Workspace Corporativo</p>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-slate-100 dark:bg-white/[0.06] my-1.5" />
              <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="gap-3 px-3 py-2.5 text-[13px] font-semibold rounded-lg focus:bg-slate-50 dark:focus:bg-white/[0.06] cursor-pointer text-slate-700 dark:text-zinc-300">
                <Settings className="size-4 opacity-50" /> Configurações Gerais
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/usuarios")} className="gap-3 px-3 py-2.5 text-[13px] font-semibold rounded-lg focus:bg-slate-50 dark:focus:bg-white/[0.06] cursor-pointer text-slate-700 dark:text-zinc-300">
                <UserCog className="size-4 opacity-50" /> Membros da Equipe
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search */}
        <div className="px-4 pt-4 pb-2">
          {!collapsed ? (
            <button
              onClick={() => setCmdOpen(true)}
              className="w-full h-10 rounded-xl bg-slate-100/80 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.06] hover:border-indigo-500/30 hover:bg-white dark:hover:bg-white/[0.05] flex items-center gap-3 px-3.5 text-[13px] text-slate-500 dark:text-white/40 transition-all group shadow-inner"
            >
              <Search className="size-4 group-hover:text-indigo-500 transition-colors" />
              <span className="flex-1 text-left font-semibold tracking-tight">Buscar Comando...</span>
              <kbd className="text-[10px] font-bold bg-white dark:bg-white/[0.06] border border-slate-300/50 dark:border-white/[0.08] rounded-md px-1.5 py-0.5 text-slate-400 dark:text-white/50 shadow-sm">⌘K</kbd>
            </button>
          ) : (
            <button
              onClick={() => setCmdOpen(true)}
              className="size-11 mx-auto rounded-xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] hover:bg-white dark:hover:bg-white/[0.06] flex items-center justify-center text-slate-400 dark:text-white/50 hover:text-indigo-500 transition-all shadow-sm"
            >
              <Search className="size-4" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="relative flex-1 overflow-y-auto px-2 py-4 space-y-7 vx-sidebar-scroll">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              {!collapsed ? (
                <div className="px-4 mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-indigo-400/40">{section.label}</span>
                </div>
              ) : (
                <div className="h-px bg-slate-100 dark:bg-white/[0.05] mx-4 mb-3" />
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
                        "group relative flex items-center gap-3 rounded-xl text-[13.5px] font-bold transition-all duration-300 h-10",
                        collapsed ? "justify-center mx-2" : "mx-2 px-3",
                        active
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-lg shadow-slate-900/10 dark:shadow-white/5"
                          : "text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-[18px] shrink-0 transition-all",
                          active ? "scale-110" : "opacity-60 group-hover:opacity-100 group-hover:scale-110"
                        )}
                        strokeWidth={active ? 2.5 : 2}
                      />
                      {!collapsed && (
                        <>
                          <span className="truncate flex-1 tracking-tight">{item.title}</span>
                          {item.badge && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500 text-white shadow-sm">
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
          <div className="relative px-3 pb-3">
            <div className="relative overflow-hidden rounded-xl border border-indigo-500/15 bg-gradient-to-br from-indigo-500/[0.08] via-violet-500/[0.04] to-transparent p-3.5">
              <div className="absolute -top-8 -right-8 size-20 rounded-full bg-indigo-500/15 blur-2xl" />
              <div className="relative flex items-start gap-2.5">
                <div className="size-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center ring-1 ring-white/15 shrink-0">
                  <Sparkles className="size-3.5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-[Fraunces,serif] text-[12px] font-medium text-white leading-tight">Edição Executive</p>
                  <p className="text-[10px] text-zinc-400 leading-snug mt-0.5">
                    Acesso total liberado · <Link to="/configuracoes" className="text-indigo-300 hover:text-indigo-200 font-semibold">gerenciar</Link>
                  </p>
                </div>
              </div>
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
