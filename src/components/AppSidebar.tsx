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

const adminNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Produtos", url: "/produtos", icon: Package },
  { title: "Parceiros", url: "/parceiros", icon: Handshake },
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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="bg-sidebar px-5 pt-5 pb-5">
        <div className="flex items-center gap-2.5">
          <VendxLogo size={collapsed ? 26 : 30} />
          {!collapsed && (
            <span className="font-display font-black tracking-[0.18em] text-white text-[20px] leading-none">
              VENDX
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar px-3 py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={collapsed ? item.title : undefined}
                      className={[
                        "h-10 rounded-lg px-3 transition-colors",
                        "text-sidebar-foreground hover:bg-white/5 hover:text-white",
                        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-semibold",
                      ].join(" ")}
                    >
                      <NavLink to={item.url} end={item.url === "/"}>
                        <item.icon className="size-[18px] shrink-0" strokeWidth={active ? 2.25 : 1.75} />
                        {!collapsed && <span className="text-[14px]">{item.title}</span>}
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 w-full rounded-lg p-2 hover:bg-white/5 transition-colors">
              <div className="size-9 rounded-full bg-sidebar-accent text-white flex items-center justify-center text-[11px] font-extrabold shrink-0">
                {initials(user?.email)}
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
