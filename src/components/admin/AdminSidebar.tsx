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

type NavItem = { title: string; url: string; icon: any; badge?: string; adminOnly?: boolean };
type NavSection = { label: string; items: NavItem[]; adminOnly?: boolean };

const SECTIONS: NavSection[] = [
  { label: "Operação", items: [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    { title: "Cockpit", url: "/cockpit", icon: Activity },
    { title: "Demandas", url: "/demandas", icon: ClipboardList },
    { title: "Tarefas", url: "/tarefas", icon: Target },
    { title: "SLA & Prazos", url: "/sla", icon: Zap },
  ]},
  { label: "Clientes", adminOnly: true, items: [
    { title: "Clientes", url: "/clientes", icon: Users, adminOnly: true },
    { title: "Vendas", url: "/vendas", icon: CircleDollarSign, adminOnly: true },
    { title: "Propostas", url: "/propostas", icon: FileText, adminOnly: true },
  ]},
  { label: "Catálogo", adminOnly: true, items: [
    { title: "Produtos", url: "/produtos", icon: Package, adminOnly: true },
    { title: "Templates", url: "/templates", icon: MessageSquare, adminOnly: true },
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
    { title: "Suporte", url: "/suporte", icon: LifeBuoy },
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
        "bg-card border-r border-border/80 shadow-[4px_0_24px_-24px_hsl(var(--foreground)/0.5)]",
        collapsed ? "w-[72px]" : "w-[272px]",
        className
      )}
    >
      {/* BRAND */}
      <div className={cn(
        "relative shrink-0 h-[64px] flex items-center border-b border-border/80",
        collapsed ? "px-3 justify-center" : "px-4"
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "flex items-center gap-2.5 rounded-lg transition-colors group",
              collapsed ? "size-10 justify-center hover:bg-slate-100" : "w-full px-1.5 py-1.5 hover:bg-slate-50"
            )}>
              <div className="size-9 rounded-lg bg-primary flex items-center justify-center shadow-sm shrink-0 ring-1 ring-primary/20">
                <Box className="size-4 text-primary-foreground" strokeWidth={2.5} />
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13.5px] font-bold text-foreground leading-tight tracking-tight truncate">VendxCRM</p>
                  <p className="text-[10px] font-semibold text-muted-foreground leading-tight mt-0.5 truncate uppercase tracking-[0.12em]">
                    {portalLabel}
                  </p>
                </div>
              )}
              {!collapsed && <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]">
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Workspace</DropdownMenuLabel>
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
            className="absolute -right-3 top-1/2 -translate-y-1/2 size-6 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all z-10"
            title="Recolher"
          >
            <PanelLeftClose className="size-3" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={onToggle}
          className="mx-auto mt-2 size-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          title="Expandir"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}

      {/* NAV */}
      <nav className="relative flex-1 overflow-y-auto px-2.5 py-3 space-y-4 vx-sidebar-scroll">
        {sections.map((section) => (
          <div key={section.label}>
            {!collapsed ? (
              <div className="px-2.5 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
                  {section.label}
                </span>
              </div>
            ) : (
              <div className="h-px bg-border mx-3 my-2" />
            )}
            <div className="space-y-0.5">
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
                      "group relative flex items-center rounded-lg text-[13px] font-semibold transition-all duration-150",
                      collapsed ? "justify-center mx-auto size-10" : "px-2.5 h-9 gap-2.5",
                      active
                        ? "bg-primary-muted text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.08)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                    )}
                  >
                    {active && !collapsed && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-primary" />
                    )}
                    <Icon
                      className={cn(
                        "shrink-0",
                        collapsed ? "size-[18px]" : "size-[15px]",
                        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
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
      <div className="shrink-0 border-t border-border/80 p-2 bg-background/55">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "w-full flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-muted transition-colors group",
              collapsed && "justify-center"
            )}>
              <div className="size-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-[11px] font-bold shrink-0 ring-1 ring-border">
                {initials(displayName)}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[12.5px] font-semibold text-foreground truncate leading-tight">{displayName}</p>
                    <p className="text-[10.5px] text-muted-foreground truncate leading-tight mt-0.5">{displayEmail}</p>
                  </div>
                  <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
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
