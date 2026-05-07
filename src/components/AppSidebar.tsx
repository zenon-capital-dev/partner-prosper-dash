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
import { ProsperLogo as AppLogo } from "@/components/VendxLogo";
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

  const showAdmin = isAdmin || isAdminSecondary || isColaborador;
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
        supabase.from("documents").select("id", { count: "exact", head: true }).in("status", ["enviado", "em_analise"]),
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
      <Sidebar collapsible="icon" className="border-r border-white/5 !bg-[#09090b]">
        <SidebarHeader className="!bg-transparent px-5 pt-8 pb-6">
          <div className={cn("flex items-center gap-3 transition-all", collapsed ? "justify-center" : "px-1")}>
            <div className="relative shrink-0 active:scale-95 transition-transform cursor-pointer" onClick={() => navigate("/")}>
              <AppLogo size={collapsed ? 28 : 34} />
              <div className="absolute -inset-1 bg-primary/20 blur-lg rounded-full animate-pulse opacity-50" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold tracking-tight text-white text-lg leading-none">
                    PROSPER
                  </span>
                  <div className="size-1 rounded-full bg-primary/60" />
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase opacity-80">
                    PRO
                  </span>
                </div>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={() => setCmdOpen(true)}
              className="mt-8 w-full h-10 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] flex items-center gap-3 px-4 text-xs text-sidebar-foreground/50 transition-all group"
            >
              <Search className="size-3.5 group-hover:text-sidebar-foreground transition-colors" />
              <span className="flex-1 text-left font-medium">Search anything...</span>
              <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-white/40">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>
          )}
        </SidebarHeader>

        <SidebarContent className="!bg-transparent px-3 pb-4">
          {sections.map((section, idx) => (
            <SidebarGroup key={section.label} className={cn("py-2", idx > 0 && "mt-2")}>
              {!collapsed && (
                <div className="px-3 mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                    {section.label}
                  </span>
                </div>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {section.items.map((item) => {
                    const active = isActive(item.url);
                    const Icon = item.icon;
                    const counter = counterFor(item.counterKey);
                    
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={collapsed ? item.title : undefined}
                          className="!h-auto !p-0 !bg-transparent"
                        >
                          <NavLink to={item.url} end={item.url === "/"} data-active={active} className="vx-nav-item">
                            <span className="vx-nav-icon-wrap">
                              <Icon className={cn("size-[18px] transition-all", active ? "text-primary" : "text-inherit")} strokeWidth={active ? 2.25 : 1.8} />
                            </span>
                            {!collapsed && (
                              <>
                                <span className={cn("flex-1 transition-colors", active ? "text-white font-semibold" : "text-inherit")}>
                                  {item.title}
                                </span>
                                {counter !== null && (
                                  <span className="ml-auto size-5 flex items-center justify-center rounded-md bg-white/5 text-[10px] font-bold text-white/40 border border-white/5">
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
          ))}
        </SidebarContent>

        <SidebarFooter className="!bg-transparent p-4 mt-auto border-t border-white/5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "flex items-center gap-3 w-full p-2 rounded-xl transition-all hover:bg-white/5 group",
                collapsed ? "justify-center" : "text-left"
              )}>
                <div className="size-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0 transition-transform group-hover:scale-105">
                  {initials(user?.user_metadata?.full_name || user?.email || "U")}
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {user?.user_metadata?.full_name || "Usuário"}
                    </p>
                    <p className="text-[10px] text-white/40 truncate font-medium">
                      {user?.email}
                    </p>
                  </div>
                )}
                {!collapsed && <ChevronDown className="size-3.5 text-white/20 group-hover:text-white/40 transition-colors" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl border-white/10 bg-[#09090b] text-white shadow-2xl">
              <DropdownMenuLabel className="font-display font-bold px-3 py-2 text-xs uppercase tracking-widest text-white/30">
                Minha Conta
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="gap-2.5 px-3 py-2.5 rounded-lg focus:bg-white/10 transition-colors cursor-pointer">
                <Settings className="size-4 text-white/50" />
                <span className="text-sm font-medium">Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/suporte")} className="gap-2.5 px-3 py-2.5 rounded-lg focus:bg-white/10 transition-colors cursor-pointer">
                <LifeBuoy className="size-4 text-white/50" />
                <span className="text-sm font-medium">Suporte</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem onClick={signOut} className="gap-2.5 px-3 py-2.5 rounded-lg focus:bg-destructive/10 text-destructive transition-colors cursor-pointer">
                <LogOut className="size-4" />
                <span className="text-sm font-medium">Sair da conta</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Digite para buscar..." />
        <CommandList className="max-h-[300px] vx-sidebar-scroll">
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Navegação">
            {cmdItems.map((item) => (
              <CommandItem
                key={item.url}
                onSelect={() => {
                  navigate(item.url);
                  setCmdOpen(false);
                }}
                className="gap-3 py-3 px-4 rounded-lg cursor-pointer"
              >
                <item.icon className="size-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{item.group}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
