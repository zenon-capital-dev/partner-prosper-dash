import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Users, Package, Handshake, Wallet, FileSignature, FileText,
  Banknote, BarChart3, Settings, UserCog, LifeBuoy, ChevronDown, LogOut, Search,
  Briefcase, CircleDollarSign, Command, Zap, Target, ClipboardList, History,
  Truck, TrendingUp, Home, Boxes, PackageCheck, FileCheck2,
  MessageSquare, FolderArchive, Receipt, ListChecks, ShoppingBag, Inbox, Layers,
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

type NavItem = { title: string; url: string; icon: any; badge?: string };
type NavSection = { label: string; items: NavItem[] };

/* ============================================================
   Menu structures — aligned to actual panel tabs / routes.
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
      { title: "Tarefas", url: "/tarefas", icon: ListChecks },
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
    label: "Inteligência",
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

// Cliente — URLs mapeiam direto para abas internas do ClientPanel
const clientSections: NavSection[] = [
  {
    label: "Meu Painel",
    items: [
      { title: "Início", url: "/cliente", icon: Home },
      { title: "Meus Produtos", url: "/cliente/produtos", icon: Boxes },
      { title: "Documentos", url: "/cliente/documentos", icon: FileCheck2 },
      { title: "Pagamentos", url: "/cliente/financeiro", icon: Banknote },
      { title: "Contratos", url: "/cliente/contratos", icon: FileSignature },
    ],
  },
  {
    label: "Mais",
    items: [
      { title: "Biblioteca", url: "/cliente/biblioteca", icon: FolderArchive },
      { title: "Novas Soluções", url: "/cliente/descobrir", icon: ShoppingBag },
      { title: "Suporte", url: "/suporte", icon: LifeBuoy },
    ],
  },
];

// Prestador — URLs mapeiam para abas internas do ProviderPanel
const prestadorSections: NavSection[] = [
  {
    label: "Operação",
    items: [
      { title: "Dashboard", url: "/prestador", icon: LayoutDashboard },
      { title: "Por Cliente", url: "/prestador/por-cliente", icon: Users },
      { title: "Demandas", url: "/prestador/demandas", icon: ClipboardList },
      { title: "Reportes", url: "/prestador/reportes", icon: FileCheck2 },
    ],
  },
  {
    label: "Documentos",
    items: [
      { title: "Documentos", url: "/prestador/documentos", icon: FileText },
      { title: "Contratos", url: "/prestador/contratos", icon: FileSignature },
    ],
  },
];

// Parceiro — URLs mapeiam para abas internas do PartnerPanel
const partnerSections: NavSection[] = [
  {
    label: "Painel",
    items: [
      { title: "Visão Geral", url: "/parceiro", icon: LayoutDashboard },
      { title: "Indicados", url: "/parceiro/clientes", icon: Users },
      { title: "Comissões", url: "/parceiro/comissoes", icon: Wallet },
      { title: "Demandas", url: "/parceiro/demandas", icon: ClipboardList },
      { title: "Contratos", url: "/parceiro/contratos", icon: FileSignature },
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

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    // exact match — evita que /cliente case com /cliente/produtos
    return pathname === path;
  };

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
    ? "Operações"
    : showPartner
      ? "Parceiro"
      : showPrestador
        ? "Prestador"
        : showClient
          ? "Cliente"
          : showReferrer
            ? "Indicador"
            : "Operações";

  const cmdItems = useMemo(
    () => sections.flatMap((s) => s.items.map((i) => ({ ...i, group: s.label }))),
    [sections]
  );

  const fullName = user?.user_metadata?.full_name || "Usuário";

  return (
    <>
      <Sidebar
        collapsible="icon"
        className="border-r border-white/[0.06] bg-sidebar-background transition-[width] duration-300"
      >
        {/* ===== Brand ===== */}
        <SidebarHeader className="!bg-transparent px-5 pt-6 pb-5">
          <button
            onClick={() => navigate("/")}
            className={cn(
              "flex items-center gap-3 group w-full",
              collapsed ? "justify-center" : ""
            )}
          >
            <div className="relative shrink-0">
              <div className="size-11 rounded-xl bg-gradient-to-br from-primary/30 via-white/[0.06] to-white/[0.02] border border-white/[0.10] flex items-center justify-center shadow-lg shadow-primary/10">
                <AppLogo size={24} />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0c0d12]" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1 text-left leading-none">
                <p className="font-display text-[17px] font-bold tracking-tight text-white">
                  Prosper
                </p>
                <p className="text-[10px] font-semibold tracking-[0.24em] uppercase text-primary/80 mt-1.5">
                  {portalLabel}
                </p>
              </div>
            )}
          </button>

          {!collapsed && (
            <button
              onClick={() => setCmdOpen(true)}
              className="mt-5 w-full h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.06] hover:border-white/[0.14] flex items-center gap-2.5 px-3.5 text-[13px] text-white/55 transition-all group"
            >
              <Search className="size-4 group-hover:text-white transition-colors" />
              <span className="flex-1 text-left font-medium">Buscar...</span>
              <kbd className="text-[10px] font-mono bg-white/[0.07] border border-white/[0.10] rounded-md px-1.5 py-0.5 flex items-center gap-0.5 text-white/50">
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
              className={cn("py-0", idx > 0 && "mt-5")}
            >
              {!collapsed && (
                <div className="px-3.5 mb-2 flex items-center gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                    {section.label}
                  </span>
                  <div className="h-px flex-[2] bg-gradient-to-l from-white/[0.08] to-transparent" />
                </div>
              )}
              {collapsed && idx > 0 && (
                <div className="h-px bg-white/[0.06] mx-2.5 mb-2.5" />
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
                          className="!h-auto !p-0 !bg-transparent"
                        >
                          <NavLink
                            to={item.url}
                            end
                            className={cn(
                              "group relative flex items-center rounded-lg text-[13.5px] font-medium transition-all duration-200",
                              collapsed
                                ? "justify-center h-11 w-11 mx-auto"
                                : "h-11 px-3.5 gap-3",
                              active
                                ? "text-white bg-gradient-to-r from-primary/20 via-primary/10 to-transparent shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                                : "text-white/60 hover:text-white hover:bg-white/[0.045]"
                            )}
                          >
                            {active && !collapsed && (
                              <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                            )}
                            <Icon
                              className={cn(
                                "size-[17px] shrink-0 transition-all",
                                active
                                  ? "text-primary"
                                  : "text-white/50 group-hover:text-white/90"
                              )}
                              strokeWidth={active ? 2.25 : 1.85}
                            />
                            {!collapsed && (
                              <>
                                <span className={cn("truncate flex-1", active && "font-semibold tracking-tight")}>
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span className="text-[10px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-md">
                                    {item.badge}
                                  </span>
                                )}
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
        </SidebarContent>

        {/* ===== Footer: user + actions ===== */}
        <SidebarFooter className="!bg-transparent p-3 mt-auto border-t border-white/[0.06]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl p-2.5 hover:bg-white/[0.05] transition-colors group",
                  collapsed && "justify-center"
                )}
              >
                <div className="size-10 rounded-xl bg-gradient-to-br from-primary/50 to-primary/15 border border-primary/30 flex items-center justify-center text-[13px] font-bold text-white shrink-0 shadow-md shadow-primary/10">
                  {initials(fullName || user?.email || "U")}
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[13.5px] font-semibold text-white truncate leading-tight">
                        {fullName}
                      </p>
                      <p className="text-[11px] text-white/45 truncate font-mono mt-1">
                        {user?.email}
                      </p>
                    </div>
                    <ChevronDown className="size-4 text-white/35 group-hover:text-white/70 transition-colors shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={collapsed ? "right" : "top"}
              align="end"
              className="w-64 rounded-xl border-white/[0.08] bg-[#0c0d12] text-white shadow-2xl p-1.5"
            >
              <DropdownMenuLabel className="px-2.5 py-2">
                <p className="text-[12.5px] font-semibold text-white truncate">{fullName}</p>
                <p className="text-[11px] text-white/45 truncate font-mono mt-0.5">{user?.email}</p>
                <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-md bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider">
                  {portalLabel}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              <DropdownMenuItem
                onClick={() => navigate(showAdmin ? "/configuracoes" : "/perfil")}
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
        <CommandList className="max-h-[360px] vx-sidebar-scroll">
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Navegação">
            {cmdItems.map((item) => (
              <CommandItem
                key={item.url + item.title}
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
