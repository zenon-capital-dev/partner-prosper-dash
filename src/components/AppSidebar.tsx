import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Handshake,
  Package,
  Wallet,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  ChevronsLeftRight,
  Sparkles,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { initials } from "@/lib/format";

const adminNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Parceiros", url: "/parceiros", icon: Handshake },
  { title: "Produtos", url: "/produtos", icon: Package },
];

const adminFinance = [
  { title: "Vendas", url: "/vendas", icon: ChevronsLeftRight },
  { title: "Comissões", url: "/comissoes", icon: Wallet },
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
];

const partnerNav = [
  { title: "Painel", url: "/parceiro", icon: LayoutDashboard },
  { title: "Minhas Indicações", url: "/parceiro/clientes", icon: Users },
  { title: "Minhas Comissões", url: "/parceiro/comissoes", icon: Wallet },
];

const clientNav = [
  { title: "Meu Painel", url: "/cliente", icon: LayoutDashboard },
  { title: "Meus Documentos", url: "/cliente/documentos", icon: FileText },
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

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="size-9 rounded-lg bg-gradient-primary flex items-center justify-center shrink-0 shadow-vx-glow">
            <Sparkles className="size-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display font-bold text-white text-base leading-tight">VENDX</div>
              <div className="text-[10px] uppercase tracking-widest text-sidebar-muted">CRM Suite</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar">
        {showAdmin && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-widest font-semibold">
                Operação
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminNav.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground h-10"
                      >
                        <NavLink to={item.url}>
                          <item.icon className="size-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-widest font-semibold">
                Financeiro
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminFinance.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground h-10"
                      >
                        <NavLink to={item.url}>
                          <item.icon className="size-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-widest font-semibold">
                  Sistema
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/configuracoes")}
                        className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground hover:bg-sidebar-accent text-sidebar-foreground h-10"
                      >
                        <NavLink to="/configuracoes">
                          <Settings className="size-4" />
                          {!collapsed && <span>Configurações</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </>
        )}

        {showPartner && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-widest font-semibold">
              Parceiro
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {partnerNav.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground hover:bg-sidebar-accent text-sidebar-foreground h-10"
                    >
                      <NavLink to={item.url}>
                        <item.icon className="size-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {showClient && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-widest font-semibold">
              Cliente
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {clientNav.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground hover:bg-sidebar-accent text-sidebar-foreground h-10"
                    >
                      <NavLink to={item.url}>
                        <item.icon className="size-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border bg-sidebar p-3">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full bg-gradient-primary text-white flex items-center justify-center text-xs font-semibold shrink-0">
            {initials(user?.email)}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{user?.email}</p>
                <p className="text-[10px] text-sidebar-muted uppercase tracking-wider">
                  {isAdmin ? "Admin" : isVendedor ? "Vendedor" : isParceiro ? "Parceiro" : "Cliente"}
                </p>
              </div>
              <button
                onClick={signOut}
                className="size-8 rounded-md hover:bg-sidebar-accent flex items-center justify-center text-sidebar-muted hover:text-white transition-colors"
                title="Sair"
              >
                <LogOut className="size-4" />
              </button>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
