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
  Activity,
  Briefcase,
  CircleDollarSign,
  Cog,
  Command,
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

type NavItem = {
  title: string;
  url: string;
  icon: any;
  badge?: string;
};
type NavSection = { label: string; icon: any; items: NavItem[] };

const adminSections: NavSection[] = [
  {
    label: "Visão Geral",
    icon: Activity,
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
    ],
  },
  {
    label: "Operação",
    icon: Briefcase,
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
    icon: CircleDollarSign,
    items: [
      { title: "Comissões", url: "/comissoes", icon: Wallet },
      { title: "Financeiro", url: "/financeiro", icon: Banknote },
    ],
  },
  {
    label: "Sistema",
    icon: Cog,
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
    icon: Handshake,
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
    icon: Users,
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

  // Mini live stat for the bottom of the sidebar
  const { data: miniStats } = useQuery({
    queryKey: ["sidebar-mini-stats"],
    queryFn: async () => {
      const [{ data: sales }, { count: clients }] = await Promise.all([
        supabase.from("sales").select("amount, sale_date"),
        supabase.from("clients").select("id", { count: "exact", head: true }),
      ]);
      const now = new Date();
      const monthRev = (sales ?? [])
        .filter((s: any) => {
          const d = new Date(s.sale_date);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum: number, s: any) => sum + Number(s.amount), 0);
      return { monthRev, clients: clients ?? 0 };
    },
  });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* ========== HEADER ========== */}
      <SidebarHeader className="bg-sidebar px-4 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <VendxLogo size={collapsed ? 32 : 40} />
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-success ring-2 ring-sidebar animate-pulse" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display font-black tracking-[0.14em] text-white text-[22px] leading-none">
                  VENDX
                </span>
                <span className="text-[8.5px] font-bold tracking-wider text-primary bg-primary/15 border border-primary/25 rounded px-1 py-0.5 leading-none">
                  PRO
                </span>
              </div>
              <div className="text-[9.5px] uppercase tracking-[0.22em] text-sidebar-muted mt-1.5 font-bold">
                CRM Suite · v2.4
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <button className="mt-5 w-full h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.1] flex items-center gap-2.5 px-3 text-[12.5px] text-sidebar-muted transition-all group">
            <Search className="size-4 group-hover:text-white transition-colors" />
            <span className="flex-1 text-left">Buscar comandos…</span>
            <kbd className="text-[10px] font-mono bg-white/[0.07] border border-white/[0.08] rounded px-1.5 py-0.5 flex items-center gap-0.5">
              <Command className="size-2.5" />K
            </kbd>
          </button>
        )}
      </SidebarHeader>

      {/* ========== NAV ========== */}
      <SidebarContent className="bg-sidebar px-3 pb-2">
        {sections.map((section) => {
          const SectionIcon = section.icon;
          return (
            <SidebarGroup key={section.label} className="py-0">
              {!collapsed && (
                <div className="vx-nav-section">
                  <SectionIcon className="size-3" />
                  <span>{section.label}</span>
                </div>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {section.items.map((item) => {
                    const active = isActive(item.url);
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={collapsed ? item.title : undefined}
                          className="!h-auto !p-0 hover:!bg-transparent data-[active=true]:!bg-transparent"
                        >
                          <NavLink to={item.url} end={item.url === "/"} data-active={active} className="vx-nav-item">
                            <span className="vx-nav-icon-wrap">
                              <Icon className="size-[17px]" strokeWidth={active ? 2.4 : 1.85} />
                            </span>
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
          );
        })}

        {!collapsed && (
          <>
            {/* Live stats card */}
            <div className="mx-2 mt-6 rounded-2xl p-4 border border-white/[0.06] bg-white/[0.025]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-muted">
                  Hoje
                </span>
                <span className="vx-pill vx-pill-success !text-[9.5px] !py-0">
                  <span className="vx-dot bg-success animate-pulse" /> Live
                </span>
              </div>
              <div className="space-y-2.5">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-sidebar-muted font-semibold">Receita do mês</p>
                  <p className="font-display text-white text-[16px] font-bold tabular-nums tracking-tight mt-0.5">
                    {formatBRL(miniStats?.monthRev ?? 0)}
                  </p>
                </div>
                <div className="h-px bg-white/[0.06]" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-sidebar-muted">Clientes</span>
                  <span className="text-[12px] font-bold text-white tabular-nums">{miniStats?.clients ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Pro upsell */}
            <div className="mx-2 mt-3 mb-2 rounded-2xl p-4 relative overflow-hidden border border-white/[0.08]"
                 style={{ background: "linear-gradient(135deg, hsl(252 70% 26% / 0.85), hsl(252 70% 16% / 0.6))" }}>
              <div className="absolute -top-10 -right-10 size-28 rounded-full bg-primary/30 blur-2xl" />
              <div className="absolute -bottom-8 -left-8 size-20 rounded-full bg-[hsl(var(--chart-5))]/25 blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="size-8 rounded-xl bg-white/[0.12] border border-white/[0.15] flex items-center justify-center">
                    <Sparkles className="size-4 text-white" />
                  </div>
                  <div>
                    <span className="block text-[12px] font-bold text-white leading-none">Vendx Pro</span>
                    <span className="block text-[9px] uppercase tracking-wider text-white/60 mt-0.5">Plano premium</span>
                  </div>
                </div>
                <p className="text-[11.5px] text-white/75 leading-snug mb-3">
                  IA, exportação avançada e suporte prioritário 24/7.
                </p>
                <button className="w-full h-9 rounded-lg bg-white text-[#0F1729] text-[12px] font-bold hover:bg-white/95 transition-colors flex items-center justify-center gap-1.5 group">
                  <TrendingUp className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                  Fazer Upgrade
                </button>
              </div>
            </div>
          </>
        )}
      </SidebarContent>

      {/* ========== FOOTER (USER) ========== */}
      <SidebarFooter className="bg-sidebar border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 w-full rounded-xl p-2 hover:bg-white/[0.05] transition-colors group">
              <div className="relative shrink-0">
                <div className="size-10 rounded-xl bg-gradient-to-br from-primary via-primary/90 to-[hsl(var(--chart-5))] text-white flex items-center justify-center text-[12px] font-extrabold shadow-lg shadow-primary/30">
                  {initials(user?.email)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-success ring-2 ring-sidebar" />
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[13px] font-bold text-white truncate leading-tight">
                      {isAdmin ? "Administrador" : isVendedor ? "Vendedor" : isParceiro ? "Parceiro" : "Cliente"}
                    </p>
                    <p className="text-[11px] text-sidebar-muted truncate">{user?.email}</p>
                  </div>
                  <ChevronDown className="size-4 text-sidebar-muted group-hover:text-white transition-colors" />
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
