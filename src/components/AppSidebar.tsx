import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Package,
  Handshake,
  Wallet,
  FileSignature,
  FileText,
  Banknote,
  BarChart3,
  Settings,
  UserCog,
  LifeBuoy,
  ChevronDown,
  LogOut,
  Sparkles,
  TrendingUp,
  Search,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { initials } from "@/lib/format";
import { VendxLogo } from "@/components/VendxLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = {
  title: string;
  url: string;
  icon: any;
  badge?: string;
};
type NavSection = { label: string; items: NavItem[] };

const adminSections: NavSection[] = [
  {
    label: "Visão Geral",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Clientes", url: "/clientes", icon: Users, badge: "Novo" },
      { title: "Produtos", url: "/produtos", icon: Package },
      { title: "Parceiros", url: "/parceiros", icon: Handshake },
      { title: "Contratos", url: "/contratos", icon: FileSignature },
      { title: "Documentos", url: "/documentos", icon: FileText },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Comissões", url: "/comissoes", icon: Wallet },
      { title: "Financeiro", url: "/financeiro", icon: Banknote },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Usuários", url: "/usuarios", icon: UserCog },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
      { title: "Suporte", url: "/suporte", icon: LifeBuoy },
    ],
  },
];

const partnerSections: NavSection[] = [
  {
    label: "Parceiro",
    items: [
      { title: "Painel", url: "/parceiro", icon: LayoutDashboard },
      { title: "Minhas Indicações", url: "/parceiro/clientes", icon: Users },
      { title: "Minhas Comissões", url: "/parceiro/comissoes", icon: Wallet },
    ],
  },
];

const clientSections: NavSection[] = [
  {
    label: "Cliente",
    items: [
      { title: "Meu Painel", url: "/cliente", icon: LayoutDashboard },
      { title: "Meus Documentos", url: "/cliente/documentos", icon: FileText },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { pathname } = useLocation();
  const { user, isAdmin, isVendedor, isParceiro, isCliente, signOut } = useAuth();
  const collapsed = state === "collapsed";

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");

  const showAdmin = isAdmin || isVendedor;
  const showPartner = isParceiro && !showAdmin;
  const showClient = isCliente && !showAdmin && !isParceiro;
  const sections = showAdmin
    ? adminSections
    : showPartner
      ? partnerSections
      : showClient
        ? clientSections
        : adminSections;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="bg-sidebar px-5 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <VendxLogo size={collapsed ? 28 : 34} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display font-black tracking-[0.16em] text-white text-[20px] leading-none">
                VENDX
              </div>
              <div className="text-[9.5px] uppercase tracking-[0.22em] text-sidebar-muted mt-1.5 font-bold">
                CRM Suite · v2.4
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <button className="mt-5 w-full h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] flex items-center gap-2 px-3 text-[12px] text-sidebar-muted transition-colors">
            <Search className="size-3.5" />
            <span className="flex-1 text-left">Buscar...</span>
            <kbd className="text-[10px] font-mono bg-white/[0.06] border border-white/[0.06] rounded px-1.5 py-0.5">⌘K</kbd>
          </button>
        )}
      </SidebarHeader>

      <SidebarContent className="bg-sidebar px-3 pb-2">
        {sections.map((section, sIdx) => (
          <SidebarGroup key={section.label} className="py-0">
            {!collapsed && sIdx > 0 && <div className="vx-nav-section">{section.label}</div>}
            {!collapsed && sIdx === 0 && <div className="vx-nav-section pt-3">{section.label}</div>}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={collapsed ? item.title : undefined}
                        className="!h-auto !p-0 hover:!bg-transparent data-[active=true]:!bg-transparent"
                      >
                        <NavLink to={item.url} end={item.url === "/"} data-active={active} className="vx-nav-item">
                          <item.icon
                            className="size-[18px] shrink-0"
                            strokeWidth={active ? 2.4 : 1.8}
                          />
                          {!collapsed && (
                            <>
                              <span className="truncate">{item.title}</span>
                              {item.badge && <span className="vx-nav-badge">{item.badge}</span>}
                            </>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {!collapsed && (
          <div className="mx-2 mt-6 mb-2 rounded-2xl p-4 relative overflow-hidden border border-white/[0.06]"
               style={{ background: "linear-gradient(135deg, hsl(252 70% 24% / 0.7), hsl(252 70% 14% / 0.5))" }}>
            <div className="absolute -top-8 -right-8 size-24 rounded-full bg-primary/30 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <div className="size-7 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Sparkles className="size-3.5 text-primary" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/90">Pro Plan</span>
              </div>
              <p className="text-[12px] text-white/70 leading-snug mb-3">
                Desbloqueie IA, exportação avançada e suporte prioritário.
              </p>
              <button className="w-full h-8 rounded-lg bg-white text-[#0F1729] text-[12px] font-bold hover:bg-white/90 transition-colors flex items-center justify-center gap-1.5">
                <TrendingUp className="size-3.5" /> Upgrade
              </button>
            </div>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="bg-sidebar border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 w-full rounded-xl p-2 hover:bg-white/[0.04] transition-colors">
              <div className="relative shrink-0">
                <div className="size-9 rounded-full bg-gradient-to-br from-primary to-[hsl(var(--chart-5))] text-white flex items-center justify-center text-[11px] font-extrabold">
                  {initials(user?.email)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-success ring-2 ring-sidebar" />
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[13px] font-bold text-white truncate leading-tight">
                      {isAdmin ? "Administrador" : isVendedor ? "Vendedor" : isParceiro ? "Parceiro" : "Cliente"}
                    </p>
                    <p className="text-[11px] text-sidebar-muted truncate">{user?.email}</p>
                  </div>
                  <ChevronDown className="size-4 text-sidebar-muted" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuItem asChild>
              <NavLink to="/configuracoes">Configurações</NavLink>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <NavLink to="/suporte">Suporte</NavLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="size-4 mr-2" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
