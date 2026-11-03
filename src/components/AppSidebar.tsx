import { ZenonLogo } from "@/components/ZenonLogo";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Users, Package, Handshake, Wallet, FileSignature, FileText,
  Banknote, BarChart3, Settings, UserCog, LifeBuoy, ChevronDown, ChevronRight, LogOut, Search,
  Briefcase, CircleDollarSign, Command, Zap, ClipboardList, History,
  Truck, TrendingUp, Home, Boxes, FileCheck2,
  MessageSquare, FolderArchive, ListChecks, ShoppingBag, Sparkles
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { initials } from "@/lib/format";
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
    label: "Operação",
    items: [
      { title: "Demandas", url: "/demandas", icon: ClipboardList },
      { title: "Tarefas", url: "/tarefas", icon: ListChecks },
      { title: "Projetos", url: "/projetos", icon: Briefcase },
      // { title: "Templates", url: "/templates", icon: MessageSquare, badge: "BETA" },
    ],
  },
  {
    label: "Documentos",
    items: [
      { title: "Documentos", url: "/documentos", icon: FileText },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Central Financeira", url: "/financeiro/central", icon: BarChart3 },
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
      // { title: "Automações(Desenvolvimento)", url: "/automacoes", icon: Zap },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

const clientSections: NavSection[] = [
  {
    label: "Meu Portal",
    items: [
      { title: "Início", url: "/portal-cliente", icon: Home },
      { title: "Onboarding", url: "/cliente/onboarding", icon: Sparkles },
    ],
  },
  {
    label: "Serviços",
    items: [
      { title: "Meus Serviços", url: "/portal-cliente?tab=servicos", icon: Package },
      { title: "Soluções", url: "/portal-cliente?tab=descobrir", icon: ShoppingBag },
    ],
  },
  {
    label: "Arquivos",
    items: [
      { title: "Documentos", url: "/cliente/documentos", icon: FileCheck2 },
      { title: "Biblioteca", url: "/portal-cliente?tab=docs", icon: FolderArchive },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Pagamentos", url: "/portal-cliente?tab=financeiro", icon: Banknote },
    ],
  },
  {
    label: "Conta",
    items: [
      { title: "Suporte", url: "/cliente/suporte", icon: LifeBuoy },
      { title: "Meu Perfil", url: "/perfil", icon: UserCog },
    ],
  },
];

const prestadorSections: NavSection[] = [
  {
    label: "Operação",
    items: [
      { title: "Dashboard", url: "/prestador", icon: LayoutDashboard },
      { title: "Alertas", url: "/cockpit", icon: Zap },
      { title: "Atuação", url: "/prestador/atuacao", icon: Briefcase },
      { title: "Demandas", url: "/prestador/demandas", icon: ClipboardList },
      { title: "Por Cliente", url: "/prestador/por-cliente", icon: Users },
      { title: "Reportes", url: "/prestador/reportes", icon: FileCheck2 },
    ],
  },
  {
    label: "Arquivos",
    items: [
      { title: "Documentos", url: "/prestador/documentos", icon: FileText },
    ],
  },
  {
    label: "Conta",
    items: [
      { title: "Meu Perfil", url: "/prestador/perfil", icon: UserCog },
    ],
  },
];

const collaboratorSections: NavSection[] = [
  {
    label: "Operação",
    items: [
      { title: "Dashboard", url: "/colaborador", icon: LayoutDashboard },
      { title: "Alertas", url: "/cockpit", icon: Zap },
      { title: "Minhas Demandas", url: "/colaborador/demandas", icon: ClipboardList },
      { title: "Tarefas", url: "/colaborador/tarefas", icon: ListChecks },
    ],
  },
  {
    label: "Consulta",
    items: [
      { title: "Clientes", url: "/colaborador/clientes", icon: Users },
      { title: "Documentos", url: "/colaborador/documentos", icon: FileText },
      { title: "Lista geral", url: "/clientes", icon: Search, badge: "READ" },
    ],
  },
  {
    label: "Conta",
    items: [
      { title: "Meu Perfil", url: "/colaborador/perfil", icon: UserCog },
    ],
  },
];

const partnerSections: NavSection[] = [
  {
    label: "Painel",
    items: [
      { title: "Visão Geral", url: "/parceiro", icon: LayoutDashboard },
    ],
  },
  {
    label: "Carteira",
    items: [
      { title: "Indicados", url: "/parceiro/clientes", icon: Users },
      { title: "Demandas", url: "/parceiro/demandas", icon: ClipboardList },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Comissões", url: "/parceiro/comissoes", icon: Wallet },
    ],
  },
  {
    label: "Recursos",
    items: [
      { title: "Materiais", url: "/parceiro/materiais", icon: FolderArchive },
      { title: "Suporte", url: "/parceiro/suporte", icon: LifeBuoy },
    ],
  },
  {
    label: "Conta",
    items: [
      { title: "Dados Bancários", url: "/parceiro/perfil", icon: Wallet },
      { title: "Meu Perfil", url: "/perfil", icon: UserCog },
    ],
  },
];

const referrerSections: NavSection[] = [
  {
    label: "Painel",
    items: [
      { title: "Visão Geral", url: "/indicador", icon: LayoutDashboard },
    ],
  },
  {
    label: "Indicações",
    items: [
      { title: "Meus Indicados", url: "/indicador/indicacoes", icon: Users },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Ganhos", url: "/indicador/ganhos", icon: TrendingUp },
      { title: "Histórico", url: "/indicador/historico", icon: History },
    ],
  },
  {
    label: "Conta",
    items: [
      { title: "Meu Perfil", url: "/indicador/perfil", icon: UserCog },
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

  const { data: access } = useQuery({
    queryKey: ["sidebar-onboarding-check", user?.id],
    queryFn: async () => {
      const [{ data: profile }, { data: client }] = await Promise.all([
        supabase.from("profiles").select("onboarding_completed").eq("id", user!.id).maybeSingle(),
        supabase.from("clients").select("status, onboarding_status").eq("user_id", user!.id).maybeSingle(),
      ]);
      return { profile, client };
    },
    enabled: !!user?.id && isClientRole,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  const onboardingReleased = !!access?.profile?.onboarding_completed || ["completo", "concluido"].includes(access?.client?.onboarding_status || "") || access?.client?.status === "ativo";
  const onboardingBlocked = isClientRole && access && !onboardingReleased;
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

  const showAdmin = isAdmin || isAdminSecondary;
  const showColaborador = isColaborador && !showAdmin;
  const showPartner = isParceiro && !showAdmin && !showColaborador;
  const showReferrer = isIndicador && !showAdmin && !showColaborador && !showPartner;
  const showPrestador = isPrestador && !showAdmin && !showColaborador && !showPartner && !showReferrer;
  const showClient = isCliente && !showAdmin && !showColaborador && !showPartner && !showPrestador && !showReferrer;

  const rawSections = showAdmin
    ? adminSections
    : showColaborador ? collaboratorSections
    : showPartner ? partnerSections
    : showReferrer ? referrerSections
    : showPrestador ? prestadorSections
    : showClient ? clientSections
    : adminSections;

  const sections = useMemo(() => {
    if (!onboardingBlocked) return rawSections;
    
    // Filter sidebar for blocked onboarding
    return rawSections.map(section => ({
      ...section,
      items: section.items.filter(item => 
        item.url === "/cliente/onboarding" || 
        item.url === "/cliente/suporte" || 
        item.url === "/cliente/documentos" || 
        item.url === "/cliente/financeiro" || 
        item.url === "/cliente/contratos" ||
        item.url === "/cliente"
      )
    })).filter(section => section.items.length > 0);
  }, [rawSections, onboardingBlocked]);

  const portalLabel = showAdmin ? "Direct Response"
    : showColaborador ? "Colaborador"
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
        className="border-r border-sidebar-border bg-sidebar transition-[width] duration-300 shadow-[1px_0_0_rgba(15,23,42,0.02)]"
      >
        {/* ===== Brand ===== */}
        <SidebarHeader className="bg-sidebar px-4 pt-6 pb-5 border-b border-sidebar-border shrink-0">
          <button
            onClick={() => navigate("/")}
            className={cn("flex items-center gap-3.5 group w-full transition-all", collapsed && "justify-center")}
          >
            <ZenonLogo compact={collapsed} tone="light" className={collapsed ? "size-11" : "w-[196px] h-[60px]"} />
          </button>

          {!collapsed && (
            <div className="mt-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-sidebar-accent border border-sidebar-border px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.18em] text-sidebar-accent-foreground">
                <span className="size-1.5 rounded-full bg-[#c79662]" />
                {portalLabel}
              </span>
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-sidebar-muted">
                {showAdmin ? "Acesso total"
                  : showPartner ? "Acesso parceiro"
                  : showReferrer ? "Comissionado"
                  : showPrestador ? "Operacional"
                  : showClient ? "Portal cliente"
                  : "Workspace"}
              </span>
            </div>
          )}

          {!collapsed && (
            <button
              onClick={() => setCmdOpen(true)}
              className="mt-3 w-full h-10 rounded-lg bg-slate-50 border border-slate-200 hover:bg-sidebar-accent hover:border-indigo-300 hover:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] flex items-center gap-2.5 px-3 text-[12.5px] text-sidebar-foreground transition-all group"
            >
              <Search className="size-3.5 group-hover:text-sidebar-accent-foreground transition-colors" />
              <span className="flex-1 text-left font-medium">Buscar...</span>
              <kbd className="text-[10px] font-mono bg-white border border-slate-200 rounded px-1.5 py-0.5 flex items-center gap-0.5 text-sidebar-foreground shadow-sm">
                <Command className="size-2.5" />K
              </kbd>
            </button>
          )}
        </SidebarHeader>

        {/* ===== Navigation ===== */}
        <SidebarContent className="bg-sidebar px-2.5 pt-4 pb-4 overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {sections.map((section, idx) => (
            <SidebarGroup key={section.label} className={cn("py-0", idx > 0 && "mt-5")}>
              {!collapsed && (
                <div className="px-2.5 mb-2">
                  <span className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-sidebar-muted">
                    {section.label}
                  </span>
                </div>
              )}
              {collapsed && idx > 0 && <div className="h-px bg-sidebar-border mx-3 mb-2.5" />}
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
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                            )}
                          >
                            {active && !collapsed && (
                              <span className="absolute -left-[7px] top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#c79662]" />
                            )}
                            {active && collapsed && (
                              <span className="absolute -left-[7px] top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[#c79662]" />
                            )}
                            <Icon
                              className={cn(
                                "shrink-0 transition-all",
                                collapsed ? "size-[18px]" : "size-[15px]",
                                active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground"
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
                                      active ? "bg-[#c79662] text-white" : "bg-slate-100 text-sidebar-foreground"
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
        <SidebarFooter className="bg-sidebar p-2 mt-auto border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-sidebar-accent hover:shadow-sm hover:border-slate-200 border border-transparent transition-all group",
                  collapsed && "justify-center"
                )}
              >
                <div className="size-8 rounded-full bg-gradient-to-br from-[#586879] to-[#172d44] flex items-center justify-center text-[11px] font-bold text-white shrink-0 ring-2 ring-white shadow-sm">
                  {initials(fullName || user?.email || "U")}
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[12.5px] font-bold text-sidebar-accent-foreground truncate leading-tight">
                        {fullName}
                      </p>
                      <p className="text-[10.5px] text-sidebar-foreground truncate mt-0.5">
                        {user?.email}
                      </p>
                    </div>
                    <ChevronDown className="size-3.5 text-sidebar-muted group-hover:text-sidebar-foreground transition-colors shrink-0" />
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
