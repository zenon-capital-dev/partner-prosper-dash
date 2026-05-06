import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
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
  Briefcase,
  CircleDollarSign,
  Cog,
  Command,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Bell,
  ArrowUpRight,
  Plus,
  Zap,
  Target,
  ClipboardList,
  History,
  UserCircle,
  Truck,
  ShieldCheck,
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
import { initials, formatBRL } from "@/lib/format";
import { VendxLogo } from "@/components/VendxLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const demoSidebarLive = {
  clients: 65,
  pendingFinCount: 18,
  pendingComCount: 22,
  newDocs: 7,
  pendingFinTotal: 248_900,
  pendingComTotal: 73_940,
  sparkline: [52_000, 78_500, 64_300, 112_800, 96_400, 138_700, 168_900].map((v, i) => ({ d: `demo-${i}`, v })),
  monthRev: 1_351_923.39,
};

type NavItem = {
  title: string;
  url: string;
  icon: any;
  badge?: string;
  counterKey?: "clients" | "pendingFin" | "pendingCom" | "newDocs";
};
type NavSection = { label: string; icon: any; items: NavItem[] };

const adminSections: NavSection[] = [
  {
    label: "Visão Geral",
    icon: LayoutDashboard,
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
      { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
      { title: "Histórico / Auditoria", url: "/auditoria", icon: History },
    ],
  },
  {
    label: "Comercial",
    icon: Briefcase,
    items: [
      { title: "Clientes", url: "/clientes", icon: Users, counterKey: "clients" },
      { title: "Leads / Convidados", url: "/leads", icon: Target },
      { title: "Produtos / Serviços", url: "/produtos", icon: Package },
      { title: "Parceiros", url: "/parceiros", icon: Handshake },
    ],
  },
  {
    label: "Operacional",
    icon: ClipboardList,
    items: [
      { title: "Tarefas / Pendências", url: "/tarefas", icon: ClipboardList },
      { title: "Documentos", url: "/documentos", icon: FileText, counterKey: "newDocs" },
      { title: "Contratos", url: "/contratos", icon: FileSignature },
      { title: "Colaboradores", url: "/colaboradores", icon: UserCircle },
      { title: "Prestadores", url: "/prestadores", icon: Truck },
    ],
  },
  {
    label: "Financeiro",
    icon: CircleDollarSign,
    items: [
      { title: "Financeiro", url: "/financeiro", icon: Banknote, counterKey: "pendingFin" },
      { title: "Comissões", url: "/comissoes", icon: Wallet, counterKey: "pendingCom" },
    ],
  },
  {
    label: "Sistema",
    icon: Cog,
    items: [
      { title: "Usuários e Acessos", url: "/usuarios", icon: UserCog },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
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
  const { state, toggleSidebar } = useSidebar();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, isAdminSecondary, isParceiro, isCliente, isColaborador, isPrestador, isLead, signOut } = useAuth();
  const collapsed = state === "collapsed";

  const [cmdOpen, setCmdOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  // Theme toggle
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [isDark]);

  // ⌘K open
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

  const showAdmin = isAdmin || isVendedor || isColaborador;
  const showPartner = isParceiro && !showAdmin;
  const showPrestador = isPrestador && !showAdmin && !showPartner;
  const showClient = isCliente && !showAdmin && !showPartner && !showPrestador;
  const sections = showAdmin
    ? adminSections
    : showPartner
      ? partnerSections
      : showPrestador
        ? [] // We can add provider specific sections later
        : showClient
          ? clientSections
          : adminSections;

  // ===== Live counters & sparkline (admin/vendedor) =====
  const { data: live } = useQuery({
    queryKey: ["sidebar-live", showAdmin],
    queryFn: async () => {
      if (!showAdmin) return null;
      const sevenAgo = new Date();
      sevenAgo.setDate(sevenAgo.getDate() - 7);
      const sevenIso = sevenAgo.toISOString().slice(0, 10);

      const [
        { count: clients },
        { data: salesPending },
        { data: comsPending },
        { count: newDocs },
        { data: weekSales },
      ] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", "ativo"),
        supabase.from("sales").select("amount").in("status", ["pendente", "em_andamento"]),
        supabase.from("commissions").select("amount").eq("status", "pendente"),
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "solicitado"),
        supabase.from("sales").select("amount, sale_date").gte("sale_date", sevenIso),
      ]);

      if (!clients && !salesPending?.length && !weekSales?.length) return demoSidebarLive;

      const pendingFinTotal = (salesPending ?? []).reduce((s, x: any) => s + Number(x.amount), 0);
      const pendingComTotal = (comsPending ?? []).reduce((s, x: any) => s + Number(x.amount), 0);

      // sparkline buckets (last 7 days)
      const buckets = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return { d: d.toISOString().slice(0, 10), v: 0 };
      });
      (weekSales ?? []).forEach((s: any) => {
        const b = buckets.find((b) => b.d === s.sale_date);
        if (b) b.v += Number(s.amount);
      });

      const monthRev = (weekSales ?? []).reduce((s, x: any) => {
        const d = new Date(x.sale_date);
        const now = new Date();
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          return s + Number(x.amount);
        }
        return s;
      }, 0);

      return {
        clients: clients ?? 0,
        pendingFinCount: (salesPending ?? []).length,
        pendingComCount: (comsPending ?? []).length,
        newDocs: newDocs ?? 0,
        pendingFinTotal,
        pendingComTotal,
        sparkline: buckets,
        monthRev,
      };
    },
    refetchInterval: 60_000,
  });

  const liveData = live ?? demoSidebarLive;

  // command palette index
  const cmdItems = useMemo(() => sections.flatMap((s) => s.items.map((i) => ({ ...i, group: s.label }))), [sections]);

  function counterFor(key?: NavItem["counterKey"]) {
    if (!key) return null;
    const map: Record<string, number> = {
      clients: liveData.clients,
      pendingFin: liveData.pendingFinCount,
      pendingCom: liveData.pendingComCount,
      newDocs: liveData.newDocs,
    };
    const v = map[key];
    return v && v > 0 ? v : null;
  }

  // sparkline path
  const sparkPath = useMemo(() => {
    if (!liveData?.sparkline) return "";
    const max = Math.max(1, ...liveData.sparkline.map((b) => b.v));
    const w = 100;
    const h = 28;
    const step = w / (liveData.sparkline.length - 1 || 1);
    return liveData.sparkline
      .map((b, i) => {
        const x = i * step;
        const y = h - (b.v / max) * h;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [liveData?.sparkline]);

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        {/* ========== HEADER ========== */}
        <SidebarHeader className="bg-sidebar px-4 pt-5 pb-4">
          <div className={collapsed ? "flex flex-col items-center gap-2" : "flex items-center gap-3 px-1"}>
            <div className="relative shrink-0">
              <VendxLogo size={collapsed ? 32 : 42} />
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-success ring-2 ring-sidebar" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-display font-black tracking-[0.14em] text-white text-[24px] leading-none">
                    PAINEL DOUGLAS
                  </span>
                  <span className="text-[10px] font-bold tracking-wider text-white bg-primary rounded px-1.5 py-0.5 leading-none">
                    PRO
                  </span>
                </div>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={toggleSidebar}
                className="size-8 rounded-lg hover:bg-white/[0.05] flex items-center justify-center text-sidebar-muted hover:text-white transition-colors"
                title="Recolher"
              >
                <PanelLeftClose className="size-4" />
              </button>
            )}
          </div>

          {!collapsed ? (
            <button
              onClick={() => setCmdOpen(true)}
              className="mt-5 w-full h-11 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] flex items-center gap-2.5 px-3.5 text-[13.5px] text-sidebar-muted transition-colors group"
            >
              <Search className="size-4 group-hover:text-white transition-colors" />
              <span className="flex-1 text-left">Buscar comandos…</span>
              <kbd className="text-[10.5px] font-mono bg-white/[0.07] border border-white/[0.08] rounded px-1.5 py-0.5 flex items-center gap-0.5">
                <Command className="size-2.5" />K
              </kbd>
            </button>
          ) : (
            <button
              onClick={() => setCmdOpen(true)}
              className="mt-3 size-9 mx-auto rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] flex items-center justify-center text-sidebar-muted hover:text-white transition-colors"
              title="Buscar (⌘K)"
            >
              <Search className="size-4" />
            </button>
          )}
        </SidebarHeader>

        {/* ========== NAV ========== */}
        <SidebarContent className="bg-sidebar px-3 pb-2 vx-sidebar-scroll">
          {sections.map((section) => {
            const SectionIcon = section.icon;
            return (
              <SidebarGroup key={section.label} className="py-0">
                {!collapsed && (
                  <div className="vx-nav-section">
                    <span className="vx-nav-section-icon">
                      <SectionIcon className="size-3.5" strokeWidth={2.25} />
                    </span>
                    <span className="vx-nav-section-label">{section.label}</span>
                    <span className="vx-nav-section-line" />
                  </div>
                )}
                {collapsed && <div className="h-px bg-white/[0.05] mx-2 my-2" />}
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {section.items.map((item) => {
                      const active = isActive(item.url);
                      const Icon = item.icon;
                      const counter = counterFor(item.counterKey);
                      const counterTone =
                        item.counterKey === "pendingFin" || item.counterKey === "pendingCom"
                          ? "vx-nav-counter-warning"
                          : item.counterKey === "newDocs"
                            ? "vx-nav-counter-info"
                            : item.counterKey === "clients"
                              ? "vx-nav-counter-primary"
                              : "";
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
                                <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 1.9} />
                                {collapsed && counter && (
                                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-sidebar" />
                                )}
                              </span>
                              {!collapsed && (
                                <>
                                  <span className="truncate">{item.title}</span>
                                  {counter !== null && (
                                    <span className={cn("vx-nav-counter", counterTone)}>
                                      {counter}
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
            );
          })}

          {!collapsed && showAdmin && (
            <div className="mx-1 mt-6 mb-2 rounded-xl p-4 border border-white/[0.07] bg-white/[0.03]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-sidebar-muted flex items-center gap-1.5">
                  <Zap className="size-3 text-success" />
                  Receita · 7 dias
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-success flex items-center gap-0.5">
                  <ArrowUpRight className="size-3" />
                  +18.2%
                </span>
              </div>
              <p className="font-display text-white text-[22px] font-bold tabular-nums tracking-[-0.02em] leading-none">
                {formatBRL(liveData.monthRev)}
              </p>
              <div className="mt-3 h-9">
                <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="w-full h-full">
                  <defs>
                    <linearGradient id="sb-spark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--sidebar-primary))" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="hsl(var(--sidebar-primary))" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {sparkPath && (
                    <>
                      <path d={`${sparkPath} L100,28 L0,28 Z`} fill="url(#sb-spark)" />
                      <path d={sparkPath} fill="none" stroke="hsl(var(--sidebar-primary))" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  )}
                </svg>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/[0.06]">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-sidebar-muted font-semibold">A receber</p>
                  <p className="text-[13px] font-bold text-white tabular-nums mt-1">{formatBRL(liveData.pendingFinTotal)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-sidebar-muted font-semibold">A pagar</p>
                  <p className="text-[13px] font-bold text-warning tabular-nums mt-1">{formatBRL(liveData.pendingComTotal)}</p>
                </div>
              </div>
            </div>
          )}
        </SidebarContent>

        {/* ========== FOOTER ========== */}
        <SidebarFooter className="bg-sidebar border-t border-sidebar-border p-2">
          {/* quick actions row */}
          {!collapsed && (
            <div className="flex items-center gap-1 px-1 pb-2">
              <button
                onClick={() => setIsDark((v) => !v)}
                className="flex-1 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.1] flex items-center justify-center gap-1.5 text-[11px] font-semibold text-sidebar-muted hover:text-white transition-all"
                title="Alternar tema"
              >
                {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                {isDark ? "Claro" : "Escuro"}
              </button>
              <button
                onClick={toggleSidebar}
                className="size-8 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.1] flex items-center justify-center text-sidebar-muted hover:text-white transition-all"
                title="Recolher"
              >
                <PanelLeftClose className="size-3.5" />
              </button>
            </div>
          )}
          {collapsed && (
            <div className="flex flex-col items-center gap-1 pb-2">
              <button
                onClick={toggleSidebar}
                className="size-8 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] flex items-center justify-center text-sidebar-muted hover:text-white"
                title="Expandir"
              >
                <PanelLeftOpen className="size-3.5" />
              </button>
              <button
                onClick={() => setIsDark((v) => !v)}
                className="size-8 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] flex items-center justify-center text-sidebar-muted hover:text-white"
                title="Tema"
              >
                {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              </button>
            </div>
          )}

          {/* user dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 w-full rounded-xl p-2 hover:bg-white/[0.05] transition-colors group">
                <div className="relative shrink-0">
                  <div className="size-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-[12px] font-extrabold">
                    {initials(user?.email)}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-success ring-2 ring-sidebar" />
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[13px] font-bold text-white truncate leading-tight">
                        {isAdmin ? "Administrador" : isVendedor ? "Vendedor" : isColaborador ? "Colaborador" : isParceiro ? "Parceiro" : isPrestador ? "Prestador" : "Cliente"}
                      </p>
                      <p className="text-[11px] text-sidebar-muted truncate">{user?.email}</p>
                    </div>
                    <ChevronDown className="size-4 text-sidebar-muted group-hover:text-white transition-colors" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-64">
              <DropdownMenuLabel className="flex items-center gap-2.5">
                <div className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold">
                  {initials(user?.email)}
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-bold truncate">{user?.email}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    {isAdmin ? "Administrador" : isVendedor ? "Vendedor" : isColaborador ? "Colaborador" : isParceiro ? "Parceiro" : isPrestador ? "Prestador" : "Cliente"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/configuracoes")}>
                <Settings className="size-4 mr-2" /> Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/suporte")}>
                <LifeBuoy className="size-4 mr-2" /> Suporte
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCmdOpen(true)}>
                <Search className="size-4 mr-2" /> Buscar
                <kbd className="ml-auto text-[10px] font-mono bg-muted rounded px-1.5 py-0.5">⌘K</kbd>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="size-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      {/* ===== Command palette ===== */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Buscar páginas, ações…" />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          {Array.from(new Set(cmdItems.map((i) => i.group))).map((group) => (
            <CommandGroup key={group} heading={group}>
              {cmdItems
                .filter((i) => i.group === group)
                .map((i) => {
                  const Icon = i.icon;
                  return (
                    <CommandItem
                      key={i.url}
                      onSelect={() => {
                        navigate(i.url);
                        setCmdOpen(false);
                      }}
                    >
                      <Icon className="size-4 mr-2" />
                      {i.title}
                      <ArrowUpRight className="size-3 ml-auto opacity-50" />
                    </CommandItem>
                  );
                })}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading="Ações rápidas">
            <CommandItem onSelect={() => { navigate("/clientes?new=1"); setCmdOpen(false); }}>
              <Plus className="size-4 mr-2" /> Novo cliente
            </CommandItem>
            <CommandItem onSelect={() => { navigate("/produtos?new=1"); setCmdOpen(false); }}>
              <Plus className="size-4 mr-2" /> Novo produto
            </CommandItem>
            <CommandItem onSelect={() => { setIsDark((v) => !v); }}>
              {isDark ? <Sun className="size-4 mr-2" /> : <Moon className="size-4 mr-2" />}
              Alternar tema
            </CommandItem>
            <CommandItem onSelect={signOut}>
              <LogOut className="size-4 mr-2" /> Sair
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
