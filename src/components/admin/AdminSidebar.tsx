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
          "bg-[hsl(var(--admin-sidebar-bg))] border-r border-[hsl(var(--admin-sidebar-border))] shadow-[18px_0_50px_hsl(240_20%_2%/0.28)]",
          collapsed ? "w-[76px]" : "w-[264px]"
        )}
      >
        {/* Vertical accent line */}
        <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[hsl(var(--admin-sidebar-border))] to-transparent" />

        {/* ============ BRAND HEADER ============ */}
        <div className={cn(
          "relative shrink-0 h-[74px] flex items-center border-b border-[hsl(var(--admin-sidebar-border))]",
          collapsed ? "px-3 justify-center" : "px-4"
        )}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "h-12 flex items-center gap-3 rounded-xl transition-all group",
                "hover:bg-[hsl(var(--admin-sidebar-surface-strong))]",
                collapsed ? "w-12 justify-center" : "w-full px-2"
              )}>
                <div className="relative shrink-0">
                  {/* Outer ambient ring */}
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-[hsl(var(--admin-sidebar-active)/0.45)] via-[hsl(var(--admin-sidebar-active-2)/0.28)] to-[hsl(var(--admin-sidebar-active)/0.22)] blur-md opacity-70 group-hover:opacity-100 transition-opacity" />
                  {/* Logo */}
                  <div className="relative size-10 rounded-xl bg-gradient-to-br from-[hsl(var(--admin-sidebar-active))] to-[hsl(var(--admin-sidebar-active-2))] flex items-center justify-center shadow-[0_10px_26px_-10px_hsl(var(--admin-sidebar-active)/0.9),inset_0_1px_0_hsl(0_0%_100%/0.28)] ring-1 ring-[hsl(0_0%_100%/0.18)]">
                    <Crown className="size-[18px] text-[hsl(var(--primary-foreground))] drop-shadow-sm" strokeWidth={2.4} />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-[hsl(var(--admin-sidebar-online))] ring-[2.5px] ring-[hsl(var(--admin-sidebar-bg))] shadow-md">
                    <span className="absolute inset-0 rounded-full bg-[hsl(var(--admin-sidebar-online))] animate-ping opacity-75" />
                  </span>
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-[15.5px] font-black text-[hsl(var(--primary-foreground))] leading-none tracking-tight">Prosper</p>
                        <span className="text-[8.5px] font-black text-[hsl(var(--primary-foreground))] px-1 py-0.5 rounded bg-[hsl(var(--admin-sidebar-active)/0.18)] tracking-widest leading-none">PRO</span>
                      </div>
                      <p className="text-[10px] font-semibold text-[hsl(var(--admin-sidebar-muted))] mt-1 tracking-tight leading-none">CRM Executivo</p>
                    </div>
                    <ChevronDown className="size-3.5 text-[hsl(var(--admin-sidebar-muted))] group-hover:text-[hsl(var(--admin-sidebar-text))] transition-colors shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[260px] p-2 rounded-2xl border-[hsl(var(--admin-sidebar-border))] bg-[hsl(var(--admin-sidebar-surface))] shadow-[0_24px_70px_-22px_hsl(240_20%_2%/0.9)]">
              <DropdownMenuLabel className="px-2 py-1.5 text-[9.5px] font-black uppercase tracking-[0.18em] text-[hsl(var(--admin-sidebar-heading))]">Workspace</DropdownMenuLabel>
              <div className="p-3 rounded-xl bg-gradient-to-br from-[hsl(var(--admin-sidebar-active)/0.14)] via-[hsl(var(--admin-sidebar-active-2)/0.08)] to-transparent border border-[hsl(var(--admin-sidebar-active)/0.18)] mb-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="size-10 rounded-xl bg-gradient-to-br from-[hsl(var(--admin-sidebar-active))] to-[hsl(var(--admin-sidebar-active-2))] flex items-center justify-center shadow-lg ring-1 ring-[hsl(0_0%_100%/0.2)]">
                    <Crown className="size-5 text-[hsl(var(--primary-foreground))]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-black text-[hsl(var(--primary-foreground))] tracking-tight">Prosper CRM</p>
                    <p className="text-[10.5px] font-semibold text-[hsl(var(--admin-sidebar-muted))]">Edition Executive · 12 seats</p>
                  </div>
                </div>
              </div>
              <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="gap-2.5 px-2.5 py-2 text-[12.5px] font-semibold rounded-lg cursor-pointer text-[hsl(var(--admin-sidebar-text))] focus:bg-[hsl(var(--admin-sidebar-surface-strong))] focus:text-[hsl(var(--primary-foreground))]">
                <Settings className="size-3.5 opacity-60" /> Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/usuarios")} className="gap-2.5 px-2.5 py-2 text-[12.5px] font-semibold rounded-lg cursor-pointer text-[hsl(var(--admin-sidebar-text))] focus:bg-[hsl(var(--admin-sidebar-surface-strong))] focus:text-[hsl(var(--primary-foreground))]">
                <UserCog className="size-3.5 opacity-60" /> Membros & permissões
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {!collapsed && (
            <button
              onClick={onToggle}
              className="absolute -right-3 top-1/2 -translate-y-1/2 size-6 rounded-full bg-[hsl(var(--admin-sidebar-surface-strong))] border border-[hsl(var(--admin-sidebar-border))] shadow-md flex items-center justify-center text-[hsl(var(--admin-sidebar-muted))] hover:text-[hsl(var(--primary-foreground))] hover:border-[hsl(var(--admin-sidebar-active)/0.5)] transition-all z-10"
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
              className="w-full h-9 rounded-xl bg-[hsl(var(--admin-sidebar-surface))] border border-[hsl(var(--admin-sidebar-border))] hover:border-[hsl(var(--admin-sidebar-active)/0.45)] hover:shadow-md hover:shadow-[hsl(var(--admin-sidebar-active)/0.08)] flex items-center gap-2.5 px-3 text-[12px] text-[hsl(var(--admin-sidebar-muted))] transition-all group shadow-sm"
            >
              <Search className="size-3.5 text-[hsl(var(--admin-sidebar-muted))] group-hover:text-[hsl(var(--admin-sidebar-active))] transition-colors" />
              <span className="flex-1 text-left font-medium tracking-tight">Buscar...</span>
              <kbd className="text-[9px] font-mono font-bold bg-[hsl(var(--admin-sidebar-surface-strong))] border border-[hsl(var(--admin-sidebar-border))] rounded px-1.5 py-0.5 text-[hsl(var(--admin-sidebar-muted))]">⌘K</kbd>
            </button>
          ) : (
            <button
              onClick={() => setCmdOpen(true)}
              className="size-10 mx-auto rounded-xl bg-[hsl(var(--admin-sidebar-surface))] border border-[hsl(var(--admin-sidebar-border))] hover:border-[hsl(var(--admin-sidebar-active)/0.45)] hover:shadow-md flex items-center justify-center text-[hsl(var(--admin-sidebar-muted))] hover:text-[hsl(var(--admin-sidebar-active))] transition-all shadow-sm"
              title="Buscar (⌘K)"
            >
              <Search className="size-3.5" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            onClick={onToggle}
            className="mx-auto size-7 rounded-lg hover:bg-[hsl(var(--admin-sidebar-surface-strong))] flex items-center justify-center text-[hsl(var(--admin-sidebar-muted))] hover:text-[hsl(var(--admin-sidebar-text))] transition-colors mt-1 mb-1"
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
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[hsl(var(--admin-sidebar-heading))]">{section.label}</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-[hsl(var(--admin-sidebar-border))] to-transparent" />
                </div>
              ) : (
                <div className="h-px bg-[hsl(var(--admin-sidebar-border))] mx-3 my-2" />
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
                          ? "text-[hsl(var(--primary-foreground))]"
                          : "text-[hsl(var(--admin-sidebar-text))] hover:text-[hsl(var(--primary-foreground))]"
                      )}
                    >
                      {/* Active background */}
                      {active && (
                        <span className={cn(
                          "absolute inset-0 rounded-lg",
                          "bg-gradient-to-r from-[hsl(var(--admin-sidebar-active)/0.18)] via-[hsl(var(--admin-sidebar-active-2)/0.1)] to-transparent",
                          "ring-1 ring-inset ring-[hsl(var(--admin-sidebar-active)/0.22)]",
                          "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)]"
                        )} />
                      )}
                      {/* Hover background */}
                      {!active && (
                        <span className="absolute inset-0 rounded-lg bg-[hsl(var(--admin-sidebar-surface-strong))] opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                      {/* Active accent rail */}
                      {active && !collapsed && (
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-gradient-to-b from-[hsl(var(--admin-sidebar-active))] to-[hsl(var(--admin-sidebar-active-2))] shadow-[0_0_14px_hsl(var(--admin-sidebar-active)/0.65)]" />
                      )}

                      {/* Icon container */}
                      <span className={cn(
                        "relative flex items-center justify-center rounded-md shrink-0 transition-all",
                        collapsed ? "size-9" : "size-6",
                        active
                          ? "bg-gradient-to-br from-[hsl(var(--admin-sidebar-active))] to-[hsl(var(--admin-sidebar-active-2))] text-[hsl(var(--primary-foreground))] shadow-[0_8px_16px_-8px_hsl(var(--admin-sidebar-active)/0.75)] ring-1 ring-[hsl(0_0%_100%/0.18)]"
                          : "text-[hsl(var(--admin-sidebar-muted))] group-hover:text-[hsl(var(--admin-sidebar-active))]"
                      )}>
                        <Icon className={cn("transition-all", collapsed ? "size-[18px]" : "size-[14px]", active && "drop-shadow-sm")} strokeWidth={active ? 2.4 : 2} />
                      </span>

                      {!collapsed && (
                        <>
                          <span className="relative truncate flex-1 tracking-tight">{item.title}</span>
                          {item.badge && (
                            <span className="relative text-[9px] font-black tabular-nums px-1.5 h-[17px] rounded-full bg-[hsl(var(--admin-sidebar-active))] text-[hsl(var(--primary-foreground))] border border-[hsl(var(--admin-sidebar-active-2)/0.5)] flex items-center shadow-sm">
                              {item.badge}
                            </span>
                          )}
                          {active && !item.badge && (
                            <span className="relative size-1.5 rounded-full bg-[hsl(var(--admin-sidebar-active))] shadow-[0_0_10px_hsl(var(--admin-sidebar-active)/0.7)]" />
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
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--admin-sidebar-active))] via-[hsl(var(--admin-sidebar-active-2))] to-[hsl(var(--admin-sidebar-active)/0.82)]" />
                <div className="absolute -top-10 -right-10 size-24 rounded-full bg-[hsl(0_0%_100%/0.18)] blur-2xl group-hover:bg-[hsl(0_0%_100%/0.24)] transition-colors" />
                <div className="absolute -bottom-10 -left-10 size-24 rounded-full bg-[hsl(240_14%_4%/0.28)] blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="size-6 rounded-lg bg-[hsl(0_0%_100%/0.15)] backdrop-blur-sm flex items-center justify-center ring-1 ring-[hsl(0_0%_100%/0.2)]">
                      <Sparkles className="size-3 text-[hsl(var(--primary-foreground))]" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[hsl(0_0%_100%/0.72)]">Edition</span>
                  </div>
                  <p className="text-[13px] font-black text-[hsl(var(--primary-foreground))] tracking-tight leading-tight">Executive Mode</p>
                  <p className="text-[10px] text-[hsl(0_0%_100%/0.62)] mt-0.5 leading-snug">Acesso completo ativado</p>
                  <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-[hsl(0_0%_100%/0.88)] group-hover:text-[hsl(var(--primary-foreground))]">
                    <span>Gerenciar plano</span>
                    <ChevronDown className="size-3 -rotate-90 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            </div>
          )}
        </nav>

        {/* ============ USER ============ */}
        <div className="relative shrink-0 border-t border-[hsl(var(--admin-sidebar-border))] p-2 bg-[hsl(var(--admin-sidebar-surface)/0.55)]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "w-full flex items-center gap-2.5 rounded-xl p-1.5 hover:bg-[hsl(var(--admin-sidebar-surface-strong))] hover:shadow-sm transition-all group",
                collapsed && "justify-center"
              )}>
                <div className="relative shrink-0">
                  <div className="size-9 rounded-xl bg-gradient-to-br from-[hsl(var(--admin-sidebar-surface-strong))] to-[hsl(var(--admin-sidebar-bg))] flex items-center justify-center text-[11.5px] font-black text-[hsl(var(--primary-foreground))] ring-1 ring-[hsl(0_0%_100%/0.1)] shadow-md">
                    {initials(displayName)}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-[hsl(var(--admin-sidebar-online))] ring-[2px] ring-[hsl(var(--admin-sidebar-bg))]" />
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[12px] font-bold text-[hsl(var(--primary-foreground))] truncate leading-tight tracking-tight">
                        {String(displayName).split(/[@ ]/)[0]}
                      </p>
                      <p className="text-[10px] font-medium text-[hsl(var(--admin-sidebar-muted))] truncate mt-0.5">{user?.email}</p>
                    </div>
                    <ChevronDown className="size-3.5 text-[hsl(var(--admin-sidebar-muted))] group-hover:text-[hsl(var(--admin-sidebar-text))] transition-colors shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={collapsed ? "right" : "top"}
              align="end"
              className="w-[260px] p-2 rounded-2xl border-[hsl(var(--admin-sidebar-border))] bg-[hsl(var(--admin-sidebar-surface))] shadow-[0_24px_70px_-22px_hsl(240_20%_2%/0.9)]"
            >
              <div className="p-3 rounded-xl bg-[hsl(var(--admin-sidebar-surface-strong))] border border-[hsl(var(--admin-sidebar-border))] mb-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="size-10 rounded-xl bg-gradient-to-br from-[hsl(var(--admin-sidebar-surface-strong))] to-[hsl(var(--admin-sidebar-bg))] flex items-center justify-center text-[13px] font-black text-[hsl(var(--primary-foreground))] shadow-md ring-1 ring-[hsl(0_0%_100%/0.1)]">{initials(displayName)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-[hsl(var(--primary-foreground))] truncate tracking-tight">{displayName}</p>
                    <p className="text-[10.5px] font-medium text-[hsl(var(--admin-sidebar-muted))] truncate">{user?.email}</p>
                  </div>
                </div>
              </div>
              <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="gap-2.5 px-2.5 py-2 text-[12.5px] font-semibold rounded-lg cursor-pointer text-[hsl(var(--admin-sidebar-text))] focus:bg-[hsl(var(--admin-sidebar-surface-strong))] focus:text-[hsl(var(--primary-foreground))]">
                <Settings className="size-3.5 opacity-60" /> Preferências
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/suporte")} className="gap-2.5 px-2.5 py-2 text-[12.5px] font-semibold rounded-lg cursor-pointer text-[hsl(var(--admin-sidebar-text))] focus:bg-[hsl(var(--admin-sidebar-surface-strong))] focus:text-[hsl(var(--primary-foreground))]">
                <LifeBuoy className="size-3.5 opacity-60" /> Ajuda & suporte
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[hsl(var(--admin-sidebar-border))] my-1" />
              <DropdownMenuItem onClick={signOut} className="gap-2.5 px-2.5 py-2 text-[12.5px] font-bold rounded-lg text-destructive focus:bg-destructive/10 cursor-pointer">
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
