import { NavLink, useLocation, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Package, Handshake, Wallet, FileSignature, FileText,
  Banknote, BarChart3, Settings, UserCog, LifeBuoy, LogOut, Search,
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

type NavItem = { title: string; url: string; icon: any; badge?: string; tone?: string };
type NavSection = { label: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    label: "Overview",
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

  const allItems = SECTIONS.flatMap((s) => s.items.map((i) => ({ ...i, group: s.label })));
  const displayName = user?.user_metadata?.full_name || user?.email || "Admin";

  return (
    <>
      <aside
        className={cn(
          "h-svh sticky top-0 shrink-0 flex flex-col z-50 transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          "bg-[#fafaf9] dark:bg-[#0a0a0c] border-r border-slate-200/70 dark:border-white/[0.04]",
          collapsed ? "w-[76px]" : "w-[264px]"
        )}
      >
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-20 size-[280px] rounded-full bg-indigo-500/[0.06] dark:bg-indigo-600/[0.08] blur-[80px]" />
          <div className="absolute top-1/2 -right-20 size-[200px] rounded-full bg-violet-500/[0.04] dark:bg-violet-600/[0.05] blur-[80px]" />
        </div>

        {/* Vertical accent line */}
        <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-slate-200 dark:via-white/[0.06] to-transparent" />

        {/* ============ BRAND HEADER ============ */}
        <div className={cn(
          "relative shrink-0 h-[72px] flex items-center border-b border-slate-200/60 dark:border-white/[0.04]",
          collapsed ? "px-3 justify-center" : "px-4"
        )}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "h-12 flex items-center gap-3 rounded-xl transition-all group",
                "hover:bg-white dark:hover:bg-white/[0.04] hover:shadow-sm",
                collapsed ? "w-12 justify-center" : "w-full px-2"
              )}>
                <div className="relative shrink-0">
                  {/* Outer ambient ring */}
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-indigo-500/30 via-violet-500/20 to-fuchsia-500/30 blur-md opacity-60 group-hover:opacity-100 transition-opacity" />
                  {/* Logo */}
                  <div className="relative size-10 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-[0_4px_14px_-2px_rgba(99,102,241,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] ring-1 ring-white/40">
                    <Crown className="size-[18px] text-white drop-shadow-sm" strokeWidth={2.4} />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 ring-[2.5px] ring-[#fafaf9] dark:ring-[#0a0a0c] shadow-md">
                    <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                  </span>
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-[15.5px] font-black text-slate-900 dark:text-white leading-none tracking-tight">Prosper</p>
                        <span className="text-[8.5px] font-black text-indigo-600 dark:text-indigo-400 px-1 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 tracking-widest leading-none">PRO</span>
                      </div>
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-zinc-500 mt-1 tracking-tight leading-none">CRM Executivo</p>
                    </div>
                    <ChevronDown className="size-3.5 text-slate-400 dark:text-zinc-600 group-hover:text-slate-700 dark:group-hover:text-zinc-300 transition-colors shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[260px] p-2 rounded-2xl border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0c0c14] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)]">
              <DropdownMenuLabel className="px-2 py-1.5 text-[9.5px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-600">Workspace</DropdownMenuLabel>
              <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-50 via-violet-50/50 to-transparent dark:from-indigo-500/[0.08] dark:via-violet-500/[0.04] dark:to-transparent border border-indigo-100 dark:border-indigo-500/15 mb-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg ring-1 ring-white/30">
                    <Crown className="size-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-black text-slate-900 dark:text-white tracking-tight">Prosper CRM</p>
                    <p className="text-[10.5px] font-semibold text-slate-500 dark:text-zinc-500">Edition Executive · 12 seats</p>
                  </div>
                </div>
              </div>
              <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="gap-2.5 px-2.5 py-2 text-[12.5px] font-semibold rounded-lg cursor-pointer text-slate-700 dark:text-zinc-300">
                <Settings className="size-3.5 opacity-60" /> Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/usuarios")} className="gap-2.5 px-2.5 py-2 text-[12.5px] font-semibold rounded-lg cursor-pointer text-slate-700 dark:text-zinc-300">
                <UserCog className="size-3.5 opacity-60" /> Membros & permissões
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {!collapsed && (
            <button
              onClick={onToggle}
              className="absolute -right-3 top-1/2 -translate-y-1/2 size-6 rounded-full bg-white dark:bg-[#1a1a20] border border-slate-200 dark:border-white/[0.08] shadow-md flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all z-10"
              title="Recolher"
            >
              <PanelLeftClose className="size-3" />
            </button>
          )}
        </div>

        {/* ============ SEARCH ============ */}
        <div className="relative px-3 pt-3 pb-2 shrink-0">
          {!collapsed ? (
            <button
              onClick={() => setCmdOpen(true)}
              className="w-full h-9 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:shadow-md hover:shadow-indigo-500/5 flex items-center gap-2.5 px-3 text-[12px] text-slate-500 dark:text-zinc-500 transition-all group shadow-sm"
            >
              <Search className="size-3.5 text-slate-400 dark:text-zinc-600 group-hover:text-indigo-500 transition-colors" />
              <span className="flex-1 text-left font-medium tracking-tight">Buscar...</span>
              <kbd className="text-[9px] font-mono font-bold bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.06] rounded px-1.5 py-0.5 text-slate-500 dark:text-zinc-500">⌘K</kbd>
            </button>
          ) : (
            <button
              onClick={() => setCmdOpen(true)}
              className="size-10 mx-auto rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] hover:border-indigo-300 hover:shadow-md flex items-center justify-center text-slate-500 dark:text-zinc-500 hover:text-indigo-500 transition-all shadow-sm"
              title="Buscar (⌘K)"
            >
              <Search className="size-3.5" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            onClick={onToggle}
            className="mx-auto size-7 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] flex items-center justify-center text-slate-400 dark:text-zinc-600 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors mt-1 mb-1"
            title="Expandir"
          >
            <PanelLeftOpen className="size-3.5" />
          </button>
        )}

        {/* ============ NAV ============ */}
        <nav className="relative flex-1 overflow-y-auto px-2 py-2 space-y-4 vx-sidebar-scroll">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              {!collapsed ? (
                <div className="px-3 mb-1.5 flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-600">{section.label}</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-white/[0.06] to-transparent" />
                </div>
              ) : (
                <div className="h-px bg-slate-200/60 dark:bg-white/[0.04] mx-3 my-2" />
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
                        "group relative flex items-center rounded-lg text-[12.5px] font-semibold transition-all duration-200",
                        collapsed ? "justify-center mx-2 size-11" : "mx-1.5 px-2.5 h-9 gap-2.5",
                        active
                          ? "text-indigo-700 dark:text-white"
                          : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      {/* Active background */}
                      {active && (
                        <span className={cn(
                          "absolute inset-0 rounded-lg",
                          "bg-gradient-to-r from-indigo-50 via-violet-50/60 to-transparent",
                          "dark:from-indigo-500/[0.12] dark:via-violet-500/[0.06] dark:to-transparent",
                          "ring-1 ring-inset ring-indigo-200/60 dark:ring-indigo-500/15",
                          "shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-none"
                        )} />
                      )}
                      {/* Hover background */}
                      {!active && (
                        <span className="absolute inset-0 rounded-lg bg-slate-100 dark:bg-white/[0.03] opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                      {/* Active accent rail */}
                      {active && !collapsed && (
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-gradient-to-b from-indigo-500 via-violet-500 to-fuchsia-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]" />
                      )}

                      {/* Icon container */}
                      <span className={cn(
                        "relative flex items-center justify-center rounded-md shrink-0 transition-all",
                        collapsed ? "size-9" : "size-6",
                        active
                          ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_4px_10px_-2px_rgba(99,102,241,0.5)] ring-1 ring-white/20"
                          : "text-slate-500 dark:text-zinc-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-300"
                      )}>
                        <Icon className={cn("transition-all", collapsed ? "size-[18px]" : "size-[14px]", active && "drop-shadow-sm")} strokeWidth={active ? 2.4 : 2} />
                      </span>

                      {!collapsed && (
                        <>
                          <span className="relative truncate flex-1 tracking-tight">{item.title}</span>
                          {item.badge && (
                            <span className="relative text-[9px] font-black tabular-nums px-1.5 h-[17px] rounded-full bg-indigo-500 text-white border border-indigo-400/50 flex items-center shadow-sm">
                              {item.badge}
                            </span>
                          )}
                          {active && !item.badge && (
                            <span className="relative size-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.7)]" />
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}

          {/* CTA Card */}
          {!collapsed && (
            <div className="px-1.5 pt-2">
              <Link
                to="/configuracoes"
                className="relative block overflow-hidden rounded-xl p-3 group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 dark:from-indigo-600 dark:via-violet-600 dark:to-fuchsia-700" />
                <div className="absolute -top-10 -right-10 size-24 rounded-full bg-fuchsia-500/30 blur-2xl group-hover:bg-fuchsia-500/50 transition-colors" />
                <div className="absolute -bottom-10 -left-10 size-24 rounded-full bg-indigo-500/30 blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="size-6 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
                      <Sparkles className="size-3 text-white" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/70">Edition</span>
                  </div>
                  <p className="text-[13px] font-black text-white tracking-tight leading-tight">Executive Mode</p>
                  <p className="text-[10px] text-white/60 mt-0.5 leading-snug">Acesso completo ativado</p>
                  <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-white/90 group-hover:text-white">
                    <span>Gerenciar plano</span>
                    <ChevronDown className="size-3 -rotate-90 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            </div>
          )}
        </nav>

        {/* ============ USER ============ */}
        <div className="relative shrink-0 border-t border-slate-200/60 dark:border-white/[0.04] p-2 bg-slate-50/50 dark:bg-white/[0.01]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "w-full flex items-center gap-2.5 rounded-xl p-1.5 hover:bg-white dark:hover:bg-white/[0.04] hover:shadow-sm transition-all group",
                collapsed && "justify-center"
              )}>
                <div className="relative shrink-0">
                  <div className="size-9 rounded-xl bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 dark:from-zinc-700 dark:to-zinc-900 flex items-center justify-center text-[11.5px] font-black text-white ring-1 ring-white/10 shadow-md">
                    {initials(displayName)}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-[2px] ring-slate-50 dark:ring-[#0a0a0c]" />
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[12px] font-bold text-slate-900 dark:text-white truncate leading-tight tracking-tight">
                        {String(displayName).split(/[@ ]/)[0]}
                      </p>
                      <p className="text-[10px] font-medium text-slate-500 dark:text-zinc-500 truncate mt-0.5">{user?.email}</p>
                    </div>
                    <ChevronDown className="size-3.5 text-slate-400 dark:text-zinc-600 group-hover:text-slate-700 transition-colors shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={collapsed ? "right" : "top"}
              align="end"
              className="w-[260px] p-2 rounded-2xl border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0c0c14] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)]"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-slate-50 to-white dark:from-white/[0.03] dark:to-transparent border border-slate-100 dark:border-white/[0.05] mb-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="size-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 dark:from-zinc-700 dark:to-zinc-900 flex items-center justify-center text-[13px] font-black text-white shadow-md ring-1 ring-white/10">{initials(displayName)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate tracking-tight">{displayName}</p>
                    <p className="text-[10.5px] font-medium text-slate-500 dark:text-zinc-500 truncate">{user?.email}</p>
                  </div>
                </div>
              </div>
              <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="gap-2.5 px-2.5 py-2 text-[12.5px] font-semibold rounded-lg cursor-pointer text-slate-700 dark:text-zinc-300">
                <Settings className="size-3.5 opacity-60" /> Preferências
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/suporte")} className="gap-2.5 px-2.5 py-2 text-[12.5px] font-semibold rounded-lg cursor-pointer text-slate-700 dark:text-zinc-300">
                <LifeBuoy className="size-3.5 opacity-60" /> Ajuda & suporte
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-100 dark:bg-white/[0.06] my-1" />
              <DropdownMenuItem onClick={signOut} className="gap-2.5 px-2.5 py-2 text-[12.5px] font-bold rounded-lg text-rose-600 dark:text-rose-400 focus:bg-rose-50 dark:focus:bg-rose-500/10 cursor-pointer">
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
