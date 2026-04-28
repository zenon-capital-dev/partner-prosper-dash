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
  ShoppingCart,
  FileSignature,
  Banknote,
  UserCog,
  LifeBuoy,
  ChevronDown,
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
  { title: "Produtos", url: "/produtos", icon: Package },
  { title: "Parceiros", url: "/parceiros", icon: Handshake },
  { title: "Vendas", url: "/vendas", icon: ShoppingCart },
  { title: "Comissões", url: "/comissoes", icon: Wallet },
  { title: "Contratos", url: "/contratos", icon: FileSignature },
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Financeiro", url: "/financeiro", icon: Banknote },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
  { title: "Usuários", url: "/usuarios", icon: UserCog },
  { title: "Suporte", url: "/suporte", icon: LifeBuoy },
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
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="bg-sidebar px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <VendxLogo size={collapsed ? 24 : 28} />
          {!collapsed && (
            <span className="font-display font-extrabold tracking-tight text-white text-[22px] leading-none">
              VENDX
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar px-2">
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
                        "h-10 rounded-lg px-3 transition-all",
                        "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
                        "data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-white data-[active=true]:font-semibold",
                        "data-[active=true]:shadow-[inset_3px_0_0_0_hsl(var(--sidebar-primary))]",
                      ].join(" ")}
                    >
                      <NavLink to={item.url} end={item.url === "/"}>
                        <item.icon className="size-[18px] shrink-0" strokeWidth={active ? 2.25 : 1.75} />
                        {!collapsed && <span className="text-sm">{item.title}</span>}
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
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full bg-gradient-to-br from-primary to-primary-glow text-white flex items-center justify-center text-[11px] font-bold shrink-0 ring-2 ring-sidebar-border">
            {initials(user?.email)}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white truncate leading-tight">
                  {isAdmin ? "Administrador" : isVendedor ? "Vendedor" : isParceiro ? "Parceiro" : "Cliente"}
                </p>
                <p className="text-[11px] text-sidebar-muted truncate">{user?.email}</p>
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
