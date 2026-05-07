import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Package, Handshake, Wallet, FileSignature, FileText,
  Banknote, BarChart3, Settings, UserCog, LifeBuoy, LogOut, Search, Command,
  Briefcase, CircleDollarSign, ClipboardList, History, UserCircle, Truck, Target,
  ChevronsLeft, ChevronsRight, Activity, Zap,
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
import { initials } from "@/lib/format";

type NavItem = { title: string; url: string; icon: any };
type NavSection = { label: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
      { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
      { title: "Auditoria", url: "/auditoria", icon: History },
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
          "h-screen sticky top-0 shrink-0 flex flex-col border-r border-white/[0.06] bg-[#08090c] text-white transition-[width] duration-200",
          collapsed ? "w-[68px]" : "w-[248px]"
        )}
      >
        {/* Brand */}
        <div className={cn("h-14 flex items-center border-b border-white/[0.06] px-3", collapsed ? "justify-center" : "justify-between")}>
          <button onClick={() => navigate("/admin")} className="flex items-center gap-2.5 group">
            <div className="size-7 rounded-md bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-[0_0_18px_rgba(16,185,129,0.35)]">
              <Zap className="size-3.5 text-black" strokeWidth={3} />
            </div>
            {!collapsed && (
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[13px] font-bold tracking-tight">prosper</span>
                <span className="text-[9px] font-bold tracking-[0.2em] text-emerald-400 uppercase">core</span>
              </div>
            )}
          </button>
          {!collapsed && (
            <button
              onClick={onToggle}
              className="size-7 rounded-md hover:bg-white/[0.05] flex items-center justify-center text-white/40 hover:text-white transition-colors"
            >
              <ChevronsLeft className="size-3.5" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            onClick={onToggle}
            className="mt-2 mx-auto size-7 rounded-md hover:bg-white/[0.05] flex items-center justify-center text-white/40 hover:text-white transition-colors"
          >
            <ChevronsRight className="size-3.5" />
          </button>
        )}

        {/* Search */}
        <div className="px-2.5 pt-3 pb-2">
          {!collapsed ? (
            <button
              onClick={() => setCmdOpen(true)}
              className="w-full h-8 rounded-md bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05] flex items-center gap-2 px-2.5 text-[12px] text-white/40 transition-colors"
            >
              <Search className="size-3.5" />
              <span className="flex-1 text-left font-mono">Search</span>
              <kbd className="text-[9.5px] font-mono bg-white/[0.06] border border-white/[0.06] rounded px-1 py-0.5 flex items-center gap-0.5">
                <Command className="size-2.5" />K
              </kbd>
            </button>
          ) : (
            <button
              onClick={() => setCmdOpen(true)}
              className="size-8 mx-auto rounded-md bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] flex items-center justify-center text-white/50"
            >
              <Search className="size-3.5" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-3 admin-scroll">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <div className="px-2.5 mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/30 font-mono">
                  {section.label}
                </div>
              )}
              {collapsed && <div className="h-px bg-white/[0.04] mx-2 mb-2" />}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.url);
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.url}
                      to={item.url}
                      title={collapsed ? item.title : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 h-8 rounded-md text-[12.5px] font-medium transition-all",
                        collapsed ? "justify-center px-0" : "px-2.5",
                        active
                          ? "bg-white/[0.06] text-white"
                          : "text-white/55 hover:text-white hover:bg-white/[0.03]"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      )}
                      <Icon className={cn("size-[15px] shrink-0", active && "text-emerald-400")} strokeWidth={active ? 2.25 : 1.85} />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-white/[0.06] p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-md p-1.5 hover:bg-white/[0.04] transition-colors",
                  collapsed && "justify-center"
                )}
              >
                <div className="size-7 rounded-md bg-gradient-to-br from-emerald-400/20 to-cyan-500/20 border border-emerald-400/20 flex items-center justify-center text-[10.5px] font-mono font-bold text-emerald-300 shrink-0">
                  {initials(user?.user_metadata?.full_name || user?.email || "A")}
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[12px] font-semibold text-white truncate leading-tight">
                      {user?.user_metadata?.full_name || "Admin"}
                    </p>
                    <p className="text-[10px] text-white/40 truncate font-mono">{user?.email}</p>
                  </div>
                )}
                {!collapsed && (
                  <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="end"
              className="w-52 bg-[#0c0d11] border-white/[0.08] text-white"
            >
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-white/40 font-mono">
                Conta
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              <DropdownMenuItem
                onClick={() => navigate("/configuracoes")}
                className="gap-2 text-[12.5px] focus:bg-white/[0.06]"
              >
                <Settings className="size-3.5" /> Configurações
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/suporte")}
                className="gap-2 text-[12.5px] focus:bg-white/[0.06]"
              >
                <LifeBuoy className="size-3.5" /> Suporte
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              <DropdownMenuItem
                onClick={signOut}
                className="gap-2 text-[12.5px] text-red-400 focus:bg-red-500/10 focus:text-red-300"
              >
                <LogOut className="size-3.5" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Comandos, páginas, ações..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado.</CommandEmpty>
          <CommandGroup heading="Navegação">
            {allItems.map((item) => (
              <CommandItem
                key={item.url}
                onSelect={() => {
                  navigate(item.url);
                  setCmdOpen(false);
                }}
                className="gap-3"
              >
                <item.icon className="size-4 text-muted-foreground" />
                <span className="flex-1">{item.title}</span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                  {item.group}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
