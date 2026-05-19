import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Package, Handshake, Wallet, FileSignature, FileText,
  Banknote, BarChart3, Settings, UserCog, LifeBuoy, LogOut, Briefcase,
  CircleDollarSign, ClipboardList, History, UserCircle, Truck, Target,
  PanelLeftClose, PanelLeftOpen, Activity, Zap, MessageSquare, ChevronDown,
  Building2, Sparkles, Box, CalendarClock, Search, UserPlus,
} from "lucide-react";
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/format";

type NavItem = { title: string; url: string; icon: any; badge?: string; adminOnly?: boolean };
type NavSection = { label: string; items: NavItem[]; adminOnly?: boolean };

const SECTIONS: NavSection[] = [
  { label: "Operação", items: [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    { title: "Alertas", url: "/cockpit", icon: Activity },
    { title: "Atuações", url: "/atuacoes", icon: CalendarClock, adminOnly: true },
    { title: "Demandas", url: "/demandas", icon: ClipboardList },
    { title: "Tarefas", url: "/tarefas", icon: Target },
    { title: "Prazos", url: "/sla", icon: Zap },
  ]},
  { label: "Clientes", adminOnly: true, items: [
    { title: "Clientes", url: "/clientes", icon: Users, adminOnly: true },
    { title: "Leads", url: "/leads", icon: Target, adminOnly: true },
    { title: "Vendas", url: "/vendas", icon: CircleDollarSign, adminOnly: true },
    { title: "Propostas", url: "/propostas", icon: FileText, adminOnly: true },
  ]},
  { label: "Catálogo", adminOnly: true, items: [
    { title: "Produtos", url: "/produtos", icon: Package, adminOnly: true },
    { title: "Templates(Desenvolvimento)", url: "/templates", icon: MessageSquare, adminOnly: true },
  ]},
  { label: "Rede", adminOnly: true, items: [
    { title: "Parceiros", url: "/parceiros", icon: Handshake, adminOnly: true },
    { title: "Prestadores", url: "/prestadores", icon: Truck, adminOnly: true },
    { title: "Indicadores", url: "/indicadores", icon: Sparkles, adminOnly: true },
    { title: "Colaboradores", url: "/colaboradores", icon: UserCircle, adminOnly: true },
  ]},
  { label: "Financeiro", adminOnly: true, items: [
    { title: "Financeiro", url: "/financeiro", icon: Banknote, adminOnly: true },
    { title: "Central", url: "/financeiro/central", icon: BarChart3, adminOnly: true },
    { title: "Comissões", url: "/comissoes", icon: Wallet, adminOnly: true },
    { title: "Contratos", url: "/contratos", icon: FileSignature, adminOnly: true },
    { title: "Documentos", url: "/documentos", icon: FileText, adminOnly: true },
  ]},
  { label: "Sistema", adminOnly: true, items: [
    { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
    { title: "Auditoria", url: "/auditoria", icon: History },
    { title: "Usuários", url: "/usuarios", icon: UserCog },
    { title: "Automações", url: "/automacoes", icon: Zap },
    { title: "Configurações", url: "/configuracoes", icon: Settings },
  ]},
];

interface Props { collapsed: boolean; onToggle: () => void; onNavigate?: () => void; className?: string; }

export function AdminSidebar({ collapsed, onToggle, onNavigate, className }: Props) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isAdmin, isAdminSecondary } = useAuth();
  const isFullAdmin = isAdmin || isAdminSecondary;
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

  const sections = SECTIONS
    .filter((s) => isFullAdmin || !s.adminOnly)
    .map((s) => ({ ...s, items: s.items.filter((i) => isFullAdmin || !i.adminOnly) }))
    .filter((s) => s.items.length > 0);

  const displayName = user?.user_metadata?.full_name || user?.email || "Admin";
  const displayEmail = user?.email || "";
  const portalLabel = isFullAdmin ? "Admin OS" : "Workspace";

  return (
    <aside
      className={cn(
        "h-svh sticky top-0 shrink-0 flex flex-col z-50 transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "bg-white/96 backdrop-blur-xl border-r border-slate-200/75 shadow-[1px_0_0_hsl(220_13%_88%/0.7),18px_0_48px_-42px_hsl(222_47%_11%/0.42)]",
        collapsed ? "w-[76px]" : "w-[286px]",
        className
      )}
    >
      {/* BRAND */}
      <div className={cn(
        "relative shrink-0 h-[74px] flex items-center border-b border-slate-200/75 bg-gradient-to-b from-white to-slate-50/70",
        collapsed ? "px-3 justify-center" : "px-4"
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "flex items-center gap-3 rounded-xl transition-all group",
              collapsed ? "size-11 justify-center hover:bg-slate-100" : "w-full px-2 py-2 hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-200"
            )}>
              <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-slate-950 flex items-center justify-center shadow-[0_12px_24px_-14px_hsl(231_72%_46%/0.75)] shrink-0 ring-1 ring-indigo-400/30">
                <Box className="size-[17px] text-white" strokeWidth={2.5} />
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[15px] font-black text-slate-950 leading-tight tracking-tight truncate">VendxCRM</p>
                  <p className="text-[9.5px] font-extrabold text-indigo-700 leading-tight mt-0.5 truncate uppercase tracking-[0.18em]">
                    {portalLabel}
                  </p>
                </div>
              )}
              {!collapsed && <ChevronDown className="size-3.5 text-slate-500 shrink-0 group-hover:text-slate-800 transition-colors" />}
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
            className="absolute -right-[12px] top-1/2 -translate-y-1/2 size-6 rounded-full bg-white border border-slate-200 shadow-[0_8px_18px_-12px_hsl(222_47%_11%/0.5)] flex items-center justify-center text-slate-600 hover:text-indigo-800 hover:border-indigo-300 hover:scale-110 transition-all z-10"
            title="Recolher"
          >
            <PanelLeftClose className="size-3" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={onToggle}
          className="mx-auto mt-3 size-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-950 transition-colors"
          title="Expandir"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}

      {!collapsed && (
        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }))}
            className="group flex h-10 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-left text-[12px] font-semibold text-slate-500 shadow-sm transition-all hover:border-indigo-200 hover:bg-white hover:text-slate-800 hover:shadow-md"
          >
            <Search className="size-3.5 text-slate-400 group-hover:text-indigo-700" />
            <span className="flex-1 truncate">Buscar no sistema</span>
            <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500">⌘K</span>
          </button>
        </div>
      )}

      {/* NAV */}
      <nav className="relative flex-1 overflow-y-auto px-3 py-4 space-y-5 vx-sidebar-scroll">
        {sections.map((section) => (
          <div key={section.label}>
            {!collapsed ? (
              <div className="px-3 mb-2.5 flex items-center gap-2">
                <span className="h-px w-4 bg-slate-200" />
                <span className="text-[9.5px] font-black uppercase tracking-[0.24em] text-slate-500">
                  {section.label}
                </span>
              </div>
            ) : (
              <div className="h-px bg-slate-200 mx-3 my-3" />
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
                      "group relative flex items-center rounded-xl text-[13px] font-bold transition-all duration-150",
                      collapsed ? "justify-center mx-auto size-11" : "px-3 h-10 gap-3",
                      active
                        ? "bg-indigo-50 text-indigo-800 shadow-[inset_0_0_0_1px_hsl(231_72%_46%/0.08),0_8px_18px_-18px_hsl(231_72%_46%/0.55)]"
                        : "text-slate-600 hover:text-slate-950 hover:bg-slate-100/75"
                    )}
                  >
                    {active && !collapsed && (
                      <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-indigo-600" />
                    )}
                    {active && collapsed && (
                      <span className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-indigo-600" />
                    )}
                    <Icon
                      className={cn(
                        "shrink-0 transition-all",
                        collapsed ? "size-[18px]" : "size-[16px]",
                        active ? "text-indigo-700" : "text-slate-500 group-hover:text-slate-800",
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
      <div className="shrink-0 border-t border-slate-200/75 p-3 bg-gradient-to-b from-slate-50/60 to-white">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "w-full flex items-center gap-2.5 rounded-xl p-2 hover:bg-white hover:shadow-md transition-all group border border-transparent hover:border-slate-200",
              collapsed && "justify-center"
            )}>
              <div className="relative shrink-0">
                <div className="size-9 rounded-xl bg-gradient-to-br from-indigo-600 to-slate-950 flex items-center justify-center text-white text-[11px] font-black ring-2 ring-white shadow-sm">
                  {initials(displayName)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[12.5px] font-black text-slate-950 truncate leading-tight">{displayName}</p>
                    <p className="text-[10.5px] font-semibold text-slate-500 truncate leading-tight mt-0.5">{displayEmail}</p>
                  </div>
                  <ChevronDown className="size-3.5 text-slate-600 shrink-0 group-hover:text-slate-600 transition-colors" />
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
