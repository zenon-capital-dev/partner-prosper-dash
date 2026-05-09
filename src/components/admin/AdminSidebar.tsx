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
      { title: "Parceiros", url: "/parceiros", icon: Handshake },
    ],
  },
  {
    label: "Operacional",
    items: [
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
          "h-svh sticky top-0 shrink-0 flex flex-col border-r border-sidebar-border bg-sidebar-background text-sidebar-foreground transition-[width] duration-500 ease-[cubic-bezier(0.2,0,0,1)] z-50",
          collapsed ? "w-[80px]" : "w-[280px]"
        )}
      >
        {/* Brand */}
        <div className={cn("h-16 flex items-center px-4", collapsed ? "justify-center" : "justify-between")}>
          <button onClick={() => navigate("/admin")} className="flex items-center gap-3 group">
            <div className="size-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
              <Zap className="size-4 text-white fill-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-display text-[15px] font-extrabold tracking-tight text-white leading-none">PROSPER</span>
                <span className="text-[10px] font-bold tracking-[0.25em] text-indigo-400 uppercase mt-0.5">ECOSYSTEM</span>
              </div>
            )}
          </button>
          {!collapsed && (
            <button
              onClick={onToggle}
              className="size-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-sidebar-foreground/40 hover:text-white transition-all duration-200"
            >
              <ChevronsLeft className="size-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            onClick={onToggle}
            className="mt-2 mx-auto size-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-sidebar-foreground/40 hover:text-white transition-all"
          >
            <ChevronsRight className="size-4" />
          </button>
        )}

        {/* Search */}
        <div className="px-3 pt-4 pb-2">
          {!collapsed ? (
            <button
              onClick={() => setCmdOpen(true)}
              className="w-full h-9 rounded-lg bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.05] flex items-center gap-2.5 px-3 text-[13px] text-sidebar-foreground/50 transition-all duration-200 group"
            >
              <Search className="size-4 group-hover:text-white transition-colors" />
              <span className="flex-1 text-left font-medium">Search anything...</span>
              <kbd className="text-[10px] font-mono bg-white/[0.08] border border-white/[0.08] rounded-md px-1.5 py-0.5 flex items-center gap-1 opacity-60">
                <Command className="size-3" />K
              </kbd>
            </button>
          ) : (
            <button
              onClick={() => setCmdOpen(true)}
              className="size-9 mx-auto rounded-lg bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] flex items-center justify-center text-sidebar-foreground/50 hover:text-white transition-all"
            >
              <Search className="size-4" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8 admin-scroll">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <div className="px-3 mb-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/30 font-display">
                  {section.label}
                </div>
              )}
              {collapsed && <div className="h-px bg-white/[0.03] mx-2 mb-4" />}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(item.url);
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.url}
                      to={item.url}
                      title={collapsed ? item.title : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 h-10 rounded-xl text-[13.5px] font-medium transition-all duration-300",
                        collapsed ? "justify-center px-0" : "px-3",
                        active
                          ? "bg-white/[0.08] text-white shadow-sm"
                          : "text-sidebar-foreground/60 hover:text-white hover:bg-white/[0.03]"
                      )}
                    >
                      <Icon className={cn("size-[18px] shrink-0 transition-colors", active ? "text-indigo-400" : "group-hover:text-white")} strokeWidth={active ? 2.25 : 1.75} />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                      {active && !collapsed && (
                        <div className="ml-auto size-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                      )}
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
                  "w-full flex items-center gap-3 rounded-xl p-2 hover:bg-white/[0.04] transition-all duration-200 group",
                  collapsed && "justify-center"
                )}
              >
                <div className="size-9 rounded-lg bg-gradient-to-tr from-sidebar-accent to-indigo-500/20 border border-white/[0.08] flex items-center justify-center text-[11px] font-bold text-indigo-300 shrink-0 group-hover:border-indigo-500/40 transition-colors">
                  {initials(user?.user_metadata?.full_name || user?.email || "A")}
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[13px] font-bold text-white truncate leading-tight">
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
