import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Package, Handshake, Wallet, FileSignature, FileText,
  Banknote, BarChart3, Settings, UserCog, LifeBuoy, LogOut, Briefcase,
  CircleDollarSign, ClipboardList, History, UserCircle, Truck, Target,
  PanelLeftClose, PanelLeftOpen, Activity, Zap, MessageSquare, ChevronDown,
  Building2, Sparkles, CalendarClock, Search, UserPlus, BookOpen,
  TrendingDown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/format";
import { ZenonLogo } from "@/components/ZenonLogo";

type NavItem = { title: string; url: string; icon: any; badge?: string; adminOnly?: boolean; staffOnly?: boolean; superAdminOnly?: boolean };
type NavSection = { label: string; items: NavItem[]; adminOnly?: boolean; staffOnly?: boolean };

const SECTIONS: NavSection[] = [
  { label: "Operação", items: [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    { title: "Alertas", url: "/cockpit", icon: Activity },
    { title: "Demandas", url: "/demandas", icon: ClipboardList },
    { title: "Agenda", url: "/agenda", icon: CalendarClock },
    { title: "Prazos", url: "/sla", icon: Zap },
  ]},
  { label: "CRM & Vendas", items: [
    { title: "Clientes", url: "/clientes", icon: Users, staffOnly: true },
    { title: "Esteira de atendimento", url: "/esteira", icon: Activity, staffOnly: true },
    { title: "Leads", url: "/leads", icon: UserPlus, staffOnly: true },
    { title: "Vendas", url: "/vendas", icon: CircleDollarSign, staffOnly: true },
    { title: "Metas Comerciais", url: "/metas-comerciais", icon: Target, staffOnly: true },
    { title: "Despesas Operacionais", url: "/despesas-operacionais", icon: TrendingDown, adminOnly: true },
  ]},
  { label: "Catálogo", staffOnly: true, items: [
    { title: "Serviços", url: "/produtos", icon: Package },
  ]},
  { label: "Rede", items: [
    { title: "Parceiros", url: "/parceiros", icon: Handshake, staffOnly: true },
    { title: "Prestadores", url: "/prestadores", icon: Truck, staffOnly: true },
    { title: "Indicadores", url: "/indicadores", icon: Sparkles, staffOnly: true },
    { title: "Colaboradores", url: "/colaboradores", icon: UserCircle, adminOnly: true },
  ]},
  { label: "Central", staffOnly: true, items: [
    { title: "Suporte", url: "/hub/suporte", icon: LifeBuoy },
    { title: "Contratos", url: "/hub/contratos", icon: FileSignature },
    { title: "Documentos", url: "/hub/documentos", icon: FileText },
    { title: "Materiais", url: "/hub/materiais", icon: BookOpen },
  ]},
  { label: "Financeiro", adminOnly: true, items: [
    { title: "Central Financeira", url: "/financeiro/central", icon: BarChart3 },
    { title: "Caixinhas & Projetos", url: "/financeiro/caixinhas", icon: Wallet },
  ]},
  { label: "Sistema", items: [
    { title: "Relatórios", url: "/relatorios", icon: BarChart3, staffOnly: true },
    { title: "Auditoria", url: "/auditoria", icon: History, adminOnly: true },
    { title: "Usuários", url: "/usuarios", icon: UserCog, adminOnly: true, superAdminOnly: true },
    { title: "Configurações", url: "/configuracoes", icon: Settings, adminOnly: true },
  ]},
];


interface Props { collapsed: boolean; onToggle: () => void; onNavigate?: () => void; className?: string; }

export function AdminSidebar({ collapsed, onToggle, onNavigate, className }: Props) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isAdmin, isAdminSecondary, isColaborador, isVendedor, isSuperAdmin } = useAuth();
  const isFullAdmin = isAdmin || isAdminSecondary;
  const isStaff = isFullAdmin || isColaborador || isVendedor;
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

  const passItem = (i: NavItem) =>
    (isFullAdmin || (!i.adminOnly && (isStaff || !i.staffOnly))) &&
    (!i.superAdminOnly || isSuperAdmin);

  const sections = SECTIONS
    .filter((s) => isFullAdmin || (!s.adminOnly && (isStaff || !s.staffOnly)))
    .map((s) => ({ ...s, items: s.items.filter(passItem) }))
    .filter((s) => s.items.length > 0);

  const displayName = user?.user_metadata?.full_name || user?.email || "Admin";
  const displayEmail = user?.email || "";
  const portalLabel = isFullAdmin ? "Admin OS" : isColaborador ? "Colaborador" : isVendedor ? "Vendas" : "Workspace";

  // Verificamos se está em dark mode para ajustar cores específicas via style se necessário
  const isDark = document.documentElement.classList.contains("dark");

  return (
    <aside
      className={cn(
        "h-svh sticky top-0 shrink-0 flex flex-col z-30 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "bg-zenon-navy dark:bg-[hsl(211_50%_7%)] border-r border-zenon-navy-deep",
        collapsed ? "w-[76px]" : "w-[286px]",
        className
      )}
    >
      {/* BRAND */}
      <div className={cn(
        "relative shrink-0 h-[74px] flex items-center border-b border-[hsl(211_35%_26%)]",
        collapsed ? "px-3 justify-center" : "px-4"
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "flex items-center gap-3 rounded-xl transition-all group",
              collapsed ? "size-11 justify-center hover:bg-[hsl(211_40%_24%)]" : "w-full px-2 py-2 hover:bg-[hsl(211_40%_24%)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenon-bronze"
            )}
              aria-label={`ZENON — menu do ${portalLabel}`}
            >
              {collapsed ? (
                <ZenonLogo variant="selo-branco" height={40} decorative />
              ) : (
                <div className="flex-1 min-w-0 text-left">
                  <ZenonLogo variant="horizontal-branco" height={46} decorative />
                </div>
              )}
              {!collapsed && <ChevronDown className="size-3.5 text-[#C6BEAF] shrink-0 group-hover:text-zenon-ivory transition-colors" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]">
            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Workspace</DropdownMenuLabel>
            {isFullAdmin && (
              <>
                <DropdownMenuItem onClick={() => navigate("/configuracoes")}>
                  <Settings className="size-4 mr-2" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/usuarios")}>
                  <UserCog className="size-4 mr-2" /> Membros
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => navigate("/perfil")}>
              <UserCircle className="size-4 mr-2" /> Meu Perfil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {!collapsed && (
          <button
            onClick={onToggle}
            className="absolute -right-[12px] top-1/2 -translate-y-1/2 size-6 rounded-full bg-zenon-ivory border border-zenon-sand shadow-[0_8px_18px_-12px_hsl(211_49%_12%/0.5)] flex items-center justify-center text-zenon-navy hover:border-zenon-bronze hover:scale-110 transition-all z-10"
            title="Recolher"
          >
            <PanelLeftClose className="size-3" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={onToggle}
          className="mx-auto mt-3 size-9 rounded-lg hover:bg-[hsl(211_40%_24%)] flex items-center justify-center text-[#C6BEAF] hover:text-zenon-ivory transition-colors"
          title="Expandir"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}

      {!collapsed && (
        <div className="px-4 pt-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(211_40%_24%)] border border-[hsl(211_35%_30%)] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-zenon-ivory">
              <span className="size-1.5 rounded-full bg-zenon-bronze" />
              {portalLabel}
            </span>
            {!isFullAdmin && (
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#9DAFC3]">
                Acesso restrito
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }))}
            className="group flex h-10 w-full items-center gap-2.5 rounded-lg border border-[hsl(211_35%_30%)] bg-[hsl(211_42%_22%)] px-3 text-left text-[12px] font-medium text-[#D8D2C6] transition-colors hover:border-[hsl(211_30%_40%)] hover:bg-[hsl(211_40%_25%)] hover:text-zenon-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenon-bronze"
          >
            <Search className="size-3.5 text-[#9DAFC3] group-hover:text-zenon-ivory" />
            <span className="flex-1 truncate">Buscar no sistema</span>
            <span className="rounded border border-[hsl(211_30%_36%)] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#C6BEAF]">⌘K</span>
          </button>
        </div>
      )}

      {/* NAV */}
      <nav className="relative flex-1 overflow-y-auto px-3 py-4 space-y-5 vx-sidebar-scroll">
        {sections.map((section) => (
          <div key={section.label}>
            {!collapsed ? (
              <div className="px-3 mb-2.5 flex items-center gap-2">
                <span className="h-px w-4 bg-zenon-bronze/60" />
                <span className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-[#9DAFC3]">
                  {section.label}
                </span>
              </div>
            ) : (
              <div className="h-px bg-[hsl(211_35%_28%)] mx-3 my-3" />
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.url);
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    onClick={onNavigate}
                    title={collapsed ? item.title : undefined}
                    className={cn(
                      "group relative flex items-center rounded-lg text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenon-bronze",
                      collapsed ? "justify-center mx-auto size-11" : "px-3 h-10 gap-3",
                      active
                        ? "bg-[hsl(211_40%_26%)] text-zenon-ivory"
                        : "text-[#D8D2C6] hover:text-zenon-ivory hover:bg-[hsl(211_40%_23%)]"
                    )}
                  >
                    {active && !collapsed && (
                      <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-zenon-bronze" />
                    )}
                    {active && collapsed && (
                      <span className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-zenon-bronze" />
                    )}
                    <Icon
                      className={cn(
                        "shrink-0 transition-all",
                        collapsed ? "size-[18px]" : "size-[16px]",
                        active ? "text-zenon-bronze" : "text-[#9DAFC3] group-hover:text-zenon-ivory",
                      )}
                      strokeWidth={active ? 2.4 : 2}
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
      <div className="shrink-0 border-t border-[hsl(211_35%_26%)] p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "w-full flex items-center gap-2.5 rounded-lg p-2 hover:bg-[hsl(211_40%_23%)] transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenon-bronze",
              collapsed && "justify-center"
            )}>
              <div className="relative shrink-0">
                <div className="size-9 rounded-lg bg-zenon-bronze flex items-center justify-center text-zenon-navy text-[11px] font-bold">
                  {initials(displayName)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-zenon-navy" />
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[12.5px] font-semibold text-zenon-ivory truncate leading-tight">{displayName}</p>
                    <p className="text-[10.5px] font-medium text-[#B9C4D0] truncate leading-tight mt-0.5">{displayEmail}</p>
                  </div>
                  <ChevronDown className="size-3.5 text-[#C6BEAF] shrink-0 group-hover:text-zenon-ivory transition-colors" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-[220px]">
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-slate-800">Conta</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate("/perfil")}>
              <UserCircle className="size-4 mr-2" /> Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/configuracoes")}>
              <Settings className="size-4 mr-2" /> Preferências
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-rose-800 focus:text-rose-700 focus:bg-rose-50">
              <LogOut className="size-4 mr-2" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
