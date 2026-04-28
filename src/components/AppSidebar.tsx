import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Handshake,
  UserCheck,
  FolderKanban,
  Banknote,
  Wallet,
  BarChart3,
  FileText,
  Settings,
  LogOut,
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

const adminNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Parceiros", url: "/parceiros", icon: Handshake },
  { title: "Indicadores", url: "/indicadores", icon: UserCheck },
  { title: "Projetos", url: "/projetos", icon: FolderKanban },
  { title: "Financeiro", url: "/financeiro", icon: Banknote },
  { title: "Comissões", url: "/comissoes", icon: Wallet },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
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

  const items = showAdmin ? adminNav : showPartner ? partnerNav : showClient ? clientNav : [];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="bg-sidebar px-4 pt-5 pb-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <VendxLogo size={collapsed ? 24 : 28} />
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display font-extrabold tracking-tight text-sidebar-accent-foreground text-[20px] leading-none">
                VENDX
              </div>
              <div className="text-[9px] uppercase tracking-[0.22em] text-sidebar-muted mt-1 font-bold">
                CRM Suite
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar px-2 py-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {items.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={collapsed ? item.title : undefined}
                      className={[
                        "h-9 rounded-lg px-3 transition-colors duration-200",
                        "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-semibold",
                        "relative",
                      ].join(" ")}
                    >
                      <NavLink to={item.url} end={item.url === "/"}>
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2.5px] rounded-r-full bg-sidebar-primary" />
                        )}
                        <item.icon className="size-[17px] shrink-0" strokeWidth={active ? 2.25 : 1.75} />
                        {!collapsed && <span className="text-[13px]">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center text-[11px] font-extrabold shrink-0">
            {initials(user?.email)}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-sidebar-accent-foreground truncate leading-tight">
                  {isAdmin ? "Administrador" : isVendedor ? "Vendedor" : isParceiro ? "Parceiro" : "Cliente"}
                </p>
                <p className="text-[10.5px] text-sidebar-muted truncate">{user?.email}</p>
              </div>
              <button
                onClick={signOut}
                className="size-8 rounded-md hover:bg-sidebar-accent flex items-center justify-center text-sidebar-muted hover:text-sidebar-accent-foreground transition-colors"
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
