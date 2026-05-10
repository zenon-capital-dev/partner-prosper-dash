import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Package, Handshake, Wallet, FileSignature, FileText,
  Banknote, BarChart3, Settings, UserCog, LifeBuoy, LogOut, Search, Command,
  Briefcase, CircleDollarSign, ClipboardList, History, UserCircle, Truck, Target,
  ChevronsLeft, ChevronsRight, Activity, Zap, MessageSquare,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { GlobalSearch } from "@/components/GlobalSearch";
import { initials } from "@/lib/format";

type NavItem = { title: string; url: string; icon: any };
type NavSection = { label: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
      { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
      { title: "SLA e Prazos", url: "/sla", icon: Zap },
      { title: "Logs e Auditoria", url: "/auditoria", icon: History },
    ],
  },
  {
    label: "Comercial",
    items: [
      { title: "Clientes", url: "/clientes", icon: Users },
      { title: "Leads", url: "/leads", icon: Target },
      { title: "Produtos", url: "/produtos", icon: Package },
      { title: "Vendas", url: "/vendas", icon: CircleDollarSign },
      { title: "Propostas", url: "/propostas", icon: FileText },
      { title: "Parceiros", url: "/parceiros", icon: Handshake },
    ],
  },
  {
    label: "Operacional",
    items: [
      { title: "Demandas", url: "/demandas", icon: ClipboardList },
      { title: "Tarefas", url: "/tarefas", icon: ClipboardList },
      { title: "Documentos", url: "/documentos", icon: FileText },
      { title: "Contratos", url: "/contratos", icon: FileSignature },
      { title: "Projetos", url: "/projetos", icon: Briefcase },
      { title: "Templates", url: "/templates", icon: MessageSquare },
      { title: "Colaboradores", url: "/colaboradores", icon: UserCircle },
      { title: "Prestadores", url: "/prestadores", icon: Truck },
      { title: "Indicadores", url: "/indicadores", icon: Activity },
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
    label: "Sistema",
    items: [
      { title: "Usuários & Acessos", url: "/usuarios", icon: UserCog },
      { title: "Suporte", url: "/suporte", icon: LifeBuoy },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export function AdminSidebar({ collapsed, onToggle }: Props) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
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
    path === "/admin" ? pathname === "/admin" : pathname === path || pathname.startsWith(path + "/");

  const allItems = SECTIONS.flatMap((s) => s.items.map((i) => ({ ...i, group: s.label })));

  return (
    <>
      <aside
        className={cn(
          "h-svh sticky top-0 shrink-0 flex flex-col border-r border-sidebar-border bg-sidebar-background text-sidebar-foreground transition-[width] duration-500 ease-[cubic-bezier(0.2,0,0,1)] z-50 overflow-hidden",
          collapsed ? "w-[72px]" : "w-[260px]"
        )}
      >
        {/* Brand */}
        <div className={cn("h-16 flex items-center border-b border-white/[0.04] px-3.5", collapsed ? "justify-center" : "justify-between")}>
          <button onClick={() => navigate("/admin")} className="flex items-center gap-2.5 group">
            <div className="size-8 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center ring-1 ring-white/10 shadow-[0_4px_16px_-4px_rgba(99,102,241,0.5)] group-hover:scale-[1.04] transition-transform duration-300 shrink-0">
              <Zap className="size-3.5 text-white fill-white" strokeWidth={2.5} />
            </div>
            {!collapsed && (
              <div className="flex flex-col leading-none">
                <span className="font-display text-[14px] font-bold tracking-tight text-white truncate">Prosper</span>
                <span className="text-[9px] font-semibold tracking-[0.28em] text-indigo-300/70 uppercase mt-1 truncate">Operations</span>
              </div>
            )}
          </button>
          {!collapsed && (
            <button
              onClick={onToggle}
              className="size-7 rounded-md hover:bg-white/[0.06] flex items-center justify-center text-sidebar-foreground/40 hover:text-white transition-all duration-200"
            >
              <ChevronsLeft className="size-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            onClick={onToggle}
            className="mt-2 mx-auto size-7 rounded-md hover:bg-white/[0.06] flex items-center justify-center text-sidebar-foreground/40 hover:text-white transition-all"
          >
            <ChevronsRight className="size-4" />
          </button>
        )}

        {/* Search */}
        <div className="px-3 pt-3 pb-2">
          {!collapsed ? (
            <button
              onClick={() => setCmdOpen(true)}
              className="w-full h-9 rounded-md bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05] flex items-center gap-2.5 px-3 text-[12.5px] text-sidebar-foreground/55 transition-all duration-200 group"
            >
              <Search className="size-3.5 group-hover:text-white transition-colors" />
              <span className="flex-1 text-left font-medium">Search</span>
              <kbd className="text-[10px] font-mono bg-white/[0.06] border border-white/[0.08] rounded px-1.5 py-0.5 flex items-center gap-0.5 opacity-70">
                <Command className="size-2.5" />K
              </kbd>
            </button>
          ) : (
            <button
              onClick={() => setCmdOpen(true)}
              className="size-9 mx-auto rounded-md bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] flex items-center justify-center text-sidebar-foreground/55 hover:text-white transition-all"
            >
              <Search className="size-3.5" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-4 admin-scroll">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <div className="px-3 mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/25">
                  {section.label}
                </div>
              )}
              {collapsed && <div className="h-px bg-white/[0.04] mx-2 mb-2" />}
              <div className="space-y-0.25">
                {section.items.map((item) => {
                  const active = isActive(item.url);
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.url}
                      to={item.url}
                      title={collapsed ? item.title : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 h-8.5 rounded-md text-[12.5px] font-medium transition-all duration-200",
                        collapsed ? "justify-center px-0" : "px-3",
                        active
                          ? "bg-white/[0.06] text-white"
                          : "text-sidebar-foreground/55 hover:text-white hover:bg-white/[0.03]"
                      )}
                    >
                      {active && !collapsed && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-indigo-400" />
                      )}
                      <Icon className={cn("size-[15px] shrink-0 transition-colors", active ? "text-indigo-300" : "group-hover:text-white/90")} strokeWidth={active ? 2.25 : 1.75} />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="mt-auto border-t border-white/[0.05] p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-md p-2 hover:bg-white/[0.04] transition-all duration-200 group",
                  collapsed && "justify-center"
                )}
              >
                <div className="size-8 rounded-md bg-gradient-to-tr from-sidebar-accent to-indigo-500/25 border border-white/[0.08] flex items-center justify-center text-[10.5px] font-bold text-indigo-200 shrink-0 group-hover:border-indigo-500/40 transition-colors">
                  {initials(user?.user_metadata?.full_name || user?.email || "A")}
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[12.5px] font-semibold text-white truncate leading-tight">
                      {user?.user_metadata?.full_name || "Admin User"}
                    </p>
                    <p className="text-[11px] text-sidebar-foreground/40 truncate font-mono mt-0.5">{user?.email}</p>
                  </div>
                )}
                {!collapsed && (
                  <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={collapsed ? "right" : "top"}
              align="end"
              className="w-56 bg-[#0f172a] border-white/[0.08] text-white p-2 rounded-xl shadow-2xl"
            >
              <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/30 font-display">
                Management
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/[0.06] my-1" />
              <DropdownMenuItem
                onClick={() => navigate("/configuracoes")}
                className="gap-3 px-2 py-2 text-[13px] rounded-lg focus:bg-white/[0.08] cursor-pointer"
              >
                <Settings className="size-4 text-white/40" /> Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/suporte")}
                className="gap-3 px-2 py-2 text-[13px] rounded-lg focus:bg-white/[0.08] cursor-pointer"
              >
                <LifeBuoy className="size-4 text-white/40" /> Help & Support
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.06] my-1" />
              <DropdownMenuItem
                onClick={signOut}
                className="gap-3 px-2 py-2 text-[13px] rounded-lg text-rose-400 focus:bg-rose-500/10 focus:text-rose-300 cursor-pointer"
              >
                <LogOut className="size-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>


      <GlobalSearch open={cmdOpen} onOpenChange={setCmdOpen} navItems={allItems} />
    </>
  );
}
