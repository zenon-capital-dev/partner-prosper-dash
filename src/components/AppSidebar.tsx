import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Users, Package, Handshake, Wallet, FileSignature, FileText,
  Banknote, BarChart3, Settings, UserCog, LifeBuoy, ChevronDown, LogOut, Search,
  Briefcase, CircleDollarSign, Command, Zap, Target, ClipboardList, History,
  Truck, TrendingUp, Home, Boxes, PackageCheck, FileCheck2,
  MessageSquare, FolderArchive, Receipt,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { initials } from "@/lib/format";
import { ProsperLogo as AppLogo } from "@/components/VendxLogo";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

type NavItem = { title: string; url: string; icon: any };
type NavSection = { label: string; items: NavItem[] };

/* ============================================================
   Menu structures — one block per group, exactly as requested.
   ============================================================ */

const adminSections: NavSection[] = [
  {
    label: "Visão Geral",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
      { title: "Cockpit", url: "/cockpit", icon: Zap },
      { title: "SLA & Prazos", url: "/sla", icon: TrendingUp },
      { title: "Auditoria", url: "/auditoria", icon: History },
    ],
  },
  {
    label: "Comercial",
    items: [
      { title: "Leads", url: "/leads", icon: Target },
      { title: "Propostas", url: "/propostas", icon: FileText },
      { title: "Vendas", url: "/vendas", icon: CircleDollarSign },
      { title: "Produtos", url: "/produtos", icon: Package },
    ],
  },
  {
    label: "Clientes",
    items: [
      { title: "Clientes", url: "/clientes", icon: Users },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Demandas", url: "/demandas", icon: ClipboardList },
      { title: "Tarefas", url: "/tarefas", icon: ClipboardList },
      { title: "Projetos", url: "/projetos", icon: Briefcase },
      { title: "Templates", url: "/templates", icon: MessageSquare },
    ],
  },
  {
    label: "Documentos",
    items: [
      { title: "Documentos", url: "/documentos", icon: FileText },
      { title: "Contratos", url: "/contratos", icon: FileSignature },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro", url: "/financeiro", icon: Banknote },
      { title: "Central Financeira", url: "/financeiro/central", icon: BarChart3 },
      { title: "Comissões", url: "/comissoes", icon: Wallet },
    ],
  },
  {
    label: "Parceiros",
    items: [
      { title: "Parceiros", url: "/parceiros", icon: Handshake },
    ],
  },
  {
    label: "Prestadores",
    items: [
      { title: "Prestadores", url: "/prestadores", icon: Truck },
      { title: "Reportes", url: "/prestadores/reportes", icon: ClipboardList },
      { title: "Performance", url: "/prestadores/performance", icon: TrendingUp },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
      { title: "Indicadores", url: "/indicadores", icon: TrendingUp },
    ],
  },
  {
    label: "Configurações",
    items: [
      { title: "Usuários & Acessos", url: "/usuarios", icon: UserCog },
      { title: "Automações", url: "/automacoes", icon: Zap },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

const clientSections: NavSection[] = [
  {
    label: "Painel",
    items: [
      { title: "Início", url: "/cliente", icon: Home },
      { title: "Meus Produtos", url: "/cliente/produtos", icon: Boxes },
      { title: "Documentos", url: "/cliente/documentos", icon: FileText },
      { title: "Entregas", url: "/cliente/entregas", icon: PackageCheck },
      { title: "Financeiro", url: "/cliente/financeiro", icon: Banknote },
      { title: "Contratos", url: "/cliente/contratos", icon: FileSignature },
      { title: "Suporte", url: "/suporte", icon: LifeBuoy },
    ],
  },
];

const prestadorSections: NavSection[] = [
  {
    label: "Painel",
    items: [
      { title: "Início", url: "/prestador", icon: Home },
      { title: "Minhas Demandas", url: "/prestador/demandas", icon: ClipboardList },
      { title: "Documentos", url: "/prestador/documentos", icon: FileText },
      { title: "Reportes", url: "/prestador/reportes", icon: FileCheck2 },
      { title: "Pagamentos", url: "/prestador/pagamentos", icon: Receipt },
      { title: "Histórico", url: "/prestador/historico", icon: History },
    ],
  },
];

const partnerSections: NavSection[] = [
  {
    label: "Painel",
    items: [
      { title: "Início", url: "/parceiro", icon: Home },
      { title: "Meus Indicados", url: "/parceiro/clientes", icon: Users },
      { title: "Comissões", url: "/parceiro/comissoes", icon: Wallet },
      { title: "Pagamentos", url: "/parceiro/pagamentos", icon: Receipt },
      { title: "Materiais", url: "/parceiro/materiais", icon: FolderArchive },
      { title: "Contrato", url: "/parceiro/contrato", icon: FileSignature },
    ],
  },
];

const referrerSections: NavSection[] = [
  {
    label: "Indicador",
    items: [
      { title: "Painel", url: "/indicador", icon: LayoutDashboard },
      { title: "Indicações", url: "/indicador", icon: Users },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const {
    user, isAdmin, isAdminSecondary, isParceiro, isCliente, isColaborador,
    isPrestador, isIndicador, signOut,
  } = useAuth();
  const collapsed = state === "collapsed";

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
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");

  const showAdmin = isAdmin || isAdminSecondary || isColaborador;
  const showPartner = isParceiro && !showAdmin;
  const showReferrer = isIndicador && !showAdmin && !showPartner;
  const showPrestador = isPrestador && !showAdmin && !showPartner && !showReferrer;
  const showClient = isCliente && !showAdmin && !showPartner && !showPrestador && !showReferrer;

  const sections = showAdmin
    ? adminSections
    : showPartner
      ? partnerSections
      : showReferrer
        ? referrerSections
        : showPrestador
          ? prestadorSections
          : showClient
            ? clientSections
            : adminSections;

  const portalLabel = showAdmin
    ? "Operations"
    : showPartner
      ? "Partner"
      : showPrestador
        ? "Provider"
        : showClient
          ? "Client"
          : showReferrer
            ? "Referrer"
            : "Operations";

  const cmdItems = useMemo(
    () => sections.flatMap((s) => s.items.map((i) => ({ ...i, group: s.label }))),
    [sections]
  );

  const fullName = user?.user_metadata?.full_name || "Usuário";

  return (
    <>
      <Sidebar
        collapsible="icon"
        className="border-r border-sidebar-border bg-sidebar-background transition-[width] duration-300"
      >
        {/* ===== Brand ===== */}
        <SidebarHeader className="!bg-transparent px-4 pt-5 pb-4">
          <button
            onClick={() => navigate("/")}
            className={cn(
              "flex items-center gap-2.5 group w-full",
              collapsed ? "justify-center" : ""
            )}
          >
            <div className="relative shrink-0">
              <div className="size-9 rounded-lg bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.08] flex items-center justify-center shadow-sm">
                <AppLogo size={20} />
              </div>
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1 text-left leading-none">
                <p className="font-display text-[15px] font-bold tracking-tight text-white">
                  Prosper
                </p>
                <p className="text-[9.5px] font-semibold tracking-[0.22em] uppercase text-white/35 mt-1">
                  {portalLabel}
                </p>
              </div>
            )}
          </button>

          {!collapsed && (
            <button
              onClick={() => setCmdOpen(true)}
              className="mt-4 w-full h-9 rounded-md bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12] flex items-center gap-2.5 px-3 text-[12.5px] text-white/50 transition-colors group"
            >
              <Search className="size-3.5 group-hover:text-white/80 transition-colors" />
              <span className="flex-1 text-left font-medium">Buscar</span>
              <kbd className="text-[10px] font-mono bg-white/[0.06] border border-white/[0.08] rounded px-1.5 py-0.5 flex items-center gap-0.5 text-white/40">
                <Command className="size-2.5" />K
              </kbd>
            </button>
          )}
        </SidebarHeader>

        {/* ===== Navigation ===== */}
        <SidebarContent className="!bg-transparent px-3 pb-4 overflow-x-hidden vx-sidebar-scroll">
          {sections.map((section, idx) => (
            <SidebarGroup
              key={section.label}
              className={cn("py-0", idx > 0 && "mt-4")}
            >
              {!collapsed && (
                <div className="px-3 mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/30">
                  {section.label}
                </div>
              )}
              {collapsed && idx > 0 && (
                <div className="h-px bg-white/[0.05] mx-2 mb-2" />
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.url);
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={collapsed ? item.title : undefined}
                          className="!h-auto !p-0 !bg-transparent"
                        >
                          <NavLink
                            to={item.url}
                            end={item.url === "/" || item.url.split("/").length === 2}
                            className={cn(
                              "group relative flex items-center rounded-md text-[13px] font-medium transition-colors duration-150",
                              collapsed ? "justify-center h-9 w-9 mx-auto" : "h-9 px-3 gap-2.5",
                              active
                                ? "text-white bg-white/[0.07]"
                                : "text-white/55 hover:text-white hover:bg-white/[0.035]"
                            )}
                          >
                            {active && !collapsed && (
                              <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-primary" />
                            )}
                            <Icon
                              className={cn(
                                "size-4 shrink-0 transition-colors",
                                active ? "text-white" : "text-white/45 group-hover:text-white/85"
                              )}
                              strokeWidth={active ? 2.25 : 1.85}
                            />
                            {!collapsed && (
                              <span className={cn("truncate", active && "font-semibold")}>
                                {item.title}
                              </span>
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
        </SidebarContent>

        {/* ===== Footer: user + actions ===== */}
        <SidebarFooter className="!bg-transparent p-3 mt-auto border-t border-white/[0.05]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-md p-2 hover:bg-white/[0.04] transition-colors group",
                  collapsed && "justify-center"
                )}
              >
                <div className="size-8 rounded-md bg-gradient-to-br from-primary/40 to-primary/15 border border-primary/25 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                  {initials(fullName || user?.email || "U")}
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[12.5px] font-semibold text-white truncate leading-tight">
                        {fullName}
                      </p>
                      <p className="text-[10.5px] text-white/40 truncate font-mono mt-0.5">
                        {user?.email}
                      </p>
                    </div>
                    <ChevronDown className="size-3.5 text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={collapsed ? "right" : "top"}
              align="end"
              className="w-60 rounded-lg border-white/[0.08] bg-[#0c0d12] text-white shadow-2xl p-1.5"
            >
              <DropdownMenuLabel className="px-2.5 py-2">
                <p className="text-[12px] font-semibold text-white truncate">{fullName}</p>
                <p className="text-[10.5px] text-white/40 truncate font-mono mt-0.5">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              <DropdownMenuItem
                onClick={() => navigate("/configuracoes")}
                className="gap-2.5 px-2.5 py-2 text-[13px] rounded-md focus:bg-white/[0.06] cursor-pointer"
              >
                <Settings className="size-4 text-white/50" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/suporte")}
                className="gap-2.5 px-2.5 py-2 text-[13px] rounded-md focus:bg-white/[0.06] cursor-pointer"
              >
                <LifeBuoy className="size-4 text-white/50" />
                Suporte
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              <DropdownMenuItem
                onClick={signOut}
                className="gap-2.5 px-2.5 py-2 text-[13px] rounded-md text-rose-400 focus:bg-rose-500/10 focus:text-rose-300 cursor-pointer"
              >
                <LogOut className="size-4" />
                Sair da conta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Buscar..." />
        <CommandList className="max-h-[320px] vx-sidebar-scroll">
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Navegação">
            {cmdItems.map((item) => (
              <CommandItem
                key={item.url}
                onSelect={() => {
                  navigate(item.url);
                  setCmdOpen(false);
                }}
                className="gap-3 py-2.5 px-3 rounded-md cursor-pointer"
              >
                <item.icon className="size-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium">{item.title}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    {item.group}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
