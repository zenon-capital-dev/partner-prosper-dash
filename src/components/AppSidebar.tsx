import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Users, Package, Handshake, Wallet, FileSignature, FileText,
  Banknote, BarChart3, Settings, UserCog, LifeBuoy, ChevronDown, ChevronRight, LogOut, Search,
  Briefcase, CircleDollarSign, Command, Zap, ClipboardList, History,
  Truck, TrendingUp, Home, Boxes, FileCheck2,
  MessageSquare, FolderArchive, ListChecks, ShoppingBag,
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

const adminSections: NavSection[] = [
  {
    label: "Visão Geral",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
      { title: "Alertas", url: "/cockpit", icon: Zap },
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
    items: [{ title: "Clientes", url: "/clientes", icon: Users }],
  },
  {
    label: "​​",
    items: [
      { title: "Demandas", url: "/demandas", icon: ClipboardList },
      { title: "Tarefas", url: "/tarefas", icon: ListChecks },
      { title: "Projetos", url: "/projetos", icon: Briefcase },
      { title: "Templates(Desenvolvimento)", url: "/templates", icon: MessageSquare },
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
    items: [{ title: "Parceiros", url: "/parceiros", icon: Handshake }],
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
    label: "Sistema",
    items: [
      { title: "Usuários & Acessos", url: "/usuarios", icon: UserCog },
      { title: "Automações(Desenvolvimento)", url: "/automacoes", icon: Zap },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

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

const prestadorSections: NavSection[] = [
  {
    label: "​​",
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
      { title: "Indicações", url: "/indicador/indicacoes", icon: Users },
      { title: "Extrato", url: "/indicador/extrato", icon: Wallet },
    ],
  },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const {
    user, isAdmin, isAdminSecondary, isParceiro, isCliente, isColaborador,
    isPrestador, isIndicador, signOut, roles
  } = useAuth();

  const isClientRole = roles.includes("cliente") || roles.includes("lead");

  const { data: profile } = useQuery({
    queryKey: ["sidebar-onboarding-check", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("onboarding_completed").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id && isClientRole,
  });

  const onboardingBlocked = isClientRole && profile && !profile.onboarding_completed;
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

  const isActive = (path: string) => path === "/" ? pathname === path : pathname === path || pathname.startsWith(path + "/");

  const showAdmin = isAdmin || isAdminSecondary || isColaborador;
  const showPartner = isParceiro && !showAdmin;
  const showReferrer = isIndicador && !showAdmin && !showPartner;
  const showPrestador = isPrestador && !showAdmin && !showPartner && !showReferrer;
  const showClient = isCliente && !showAdmin && !showPartner && !showPrestador && !showReferrer;

  const sections = showAdmin
    ? adminSections
    : showPartner ? partnerSections
    : showReferrer ? referrerSections
    : showPrestador ? prestadorSections
    : showClient ? clientSections
    : adminSections;

  const portalLabel = showAdmin ? "Direct Response"
    : showPartner ? "Parceiro"
    : showPrestador ? "Prestador"
    : showClient ? "Cliente"
    : showReferrer ? "Indicador"
    : "​​";

  const portalTitle = showAdmin ? "Admin"
    : showPartner ? "Parceiro"
    : showPrestador ? "Prestador"
    : showClient ? "Cliente"
    : showReferrer ? "Indicador"
    : "Workspace";

  const cmdItems = useMemo(
    () => sections.flatMap((s) => s.items.map((i) => ({ ...i, group: s.label }))),
    [sections]
  );

  const fullName = user?.user_metadata?.full_name || "Usuário";

  return (
    <>
      <Sidebar
        collapsible="icon"
        className="border-r border-slate-200/70 bg-white transition-[width] duration-300 shadow-[1px_0_0_rgba(15,23,42,0.02)]"
      >
        {/* ===== Brand ===== */}
        <SidebarHeader className="!bg-white px-4 pt-5 pb-4 border-b border-slate-200/70">
          <button
            onClick={() => navigate("/")}
            className={cn("flex items-center gap-3 group w-full", collapsed && "justify-center")}
          >
            <div className="relative shrink-0">
              <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 flex items-center justify-center shadow-[0_8px_20px_-8px_rgba(79,70,229,0.55)] ring-1 ring-indigo-700/20">
                <AppLogo size={22} />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1 text-left leading-tight">
                <p className="font-display text-[16px] font-extrabold tracking-tight text-slate-950">
                  {portalTitle}
                </p>
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-indigo-700 mt-0.5">
                  {portalLabel}
                </p>
              </div>
            )}
          </button>

          {!collapsed && (
            <button
              onClick={() => setCmdOpen(true)}
              className="mt-4 w-full h-10 rounded-lg bg-slate-50 border border-slate-200 hover:bg-white hover:border-indigo-300 hover:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] flex items-center gap-2.5 px-3 text-[12.5px] text-slate-500 transition-all group"
            >
              <Search className="size-3.5 group-hover:text-indigo-700 transition-colors" />
              <span className="flex-1 text-left font-medium">Buscar...</span>
              <kbd className="text-[10px] font-mono bg-white border border-slate-200 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-slate-600 shadow-sm">
                <Command className="size-2.5" />K
              </kbd>
            </button>
          )}
        </SidebarHeader>

        {/* ===== Navigation ===== */}
        <SidebarContent className="!bg-white px-2.5 pt-4 pb-4 overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {sections.map((section, idx) => (
            <SidebarGroup key={section.label} className={cn("py-0", idx > 0 && "mt-5")}>
              {!collapsed && (
                <div className="px-2.5 mb-2">
                  <span className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-slate-400">
                    {section.label}
                  </span>
                </div>
              )}
              {collapsed && idx > 0 && <div className="h-px bg-slate-200 mx-3 mb-2.5" />}
              <SidebarGroupContent>
                <SidebarMenu className="gap-[2px]">
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
                            onClick={() => isMobile && setOpenMobile(false)}
                            className={cn(
                              "group relative flex items-center rounded-[7px] text-[13px] font-semibold transition-all duration-150",
                              collapsed ? "justify-center h-10 w-10 mx-auto" : "h-[34px] px-2.5 gap-2.5",
                              active
                                ? "bg-indigo-50 text-indigo-800"
                                : "text-slate-700 hover:text-slate-950 hover:bg-slate-100/70"
                            )}
                          >
                            {active && !collapsed && (
                              <span className="absolute -left-[7px] top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-indigo-600" />
                            )}
                            {active && collapsed && (
                              <span className="absolute -left-[7px] top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-indigo-600" />
                            )}
                            <Icon
                              className={cn(
                                "shrink-0 transition-all",
                                collapsed ? "size-[18px]" : "size-[15px]",
                                active ? "text-indigo-700" : "text-slate-500 group-hover:text-slate-800"
                              )}
                              strokeWidth={active ? 2.4 : 2}
                            />
                            {!collapsed && (
                              <>
                                <span className="truncate flex-1">{item.title}</span>
                                {item.badge && (
                                  <span
                                    className={cn(
                                      "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                                      active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                                    )}
                                  >
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

        {/* ===== Footer ===== */}
        <SidebarFooter className="!bg-slate-50/60 p-2 mt-auto border-t border-slate-200/70">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-white hover:shadow-sm hover:border-slate-200 border border-transparent transition-all group",
                  collapsed && "justify-center"
                )}
              >
                <div className="size-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-[11px] font-bold text-white shrink-0 ring-2 ring-white shadow-sm">
                  {initials(fullName || user?.email || "U")}
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[12.5px] font-bold text-slate-950 truncate leading-tight">
                        {fullName}
                      </p>
                      <p className="text-[10.5px] text-slate-500 truncate mt-0.5">
                        {user?.email}
                      </p>
                    </div>
                    <ChevronDown className="size-3.5 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={collapsed ? "right" : "top"}
              align="end"
              className="w-64 rounded-xl shadow-2xl p-1.5"
            >
              <DropdownMenuLabel className="px-2.5 py-2">
                <p className="text-[12.5px] font-semibold truncate">{fullName}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{user?.email}</p>
                <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
                  {portalLabel}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate(showAdmin ? "/configuracoes" : "/perfil")}
                className="gap-2.5 px-2.5 py-2 text-[13px] rounded-md cursor-pointer"
              >
                <Settings className="size-4 text-muted-foreground" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/configuracoes")}
                className="gap-2.5 px-2.5 py-2 text-[13px] rounded-md cursor-pointer"
              >
                <LifeBuoy className="size-4 text-muted-foreground" />
                Suporte
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={signOut}
                className="gap-2.5 px-2.5 py-2 text-[13px] rounded-md text-rose-600 focus:bg-rose-50 focus:text-rose-700 cursor-pointer"
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
        <CommandList className="max-h-[360px]">
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
