import { ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, LogOut, MessageSquare } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { PanelNavItem, PanelRole, ROLE_THEME } from "./types";

interface Props {
  role: PanelRole;
  nav: PanelNavItem[];
  activeKey: string;
  onNavigate: (key: string) => void;
  userName?: string;
  userSubtitle?: string;
  children: ReactNode;
  notifCount?: number;
}

export function PanelShell({ role, nav, activeKey, userName, userSubtitle, children, notifCount }: Props) {
  const theme = ROLE_THEME[role];
  const { user, signOut } = useAuth() as any;
  const [sheetOpen, setSheetOpen] = useState(false);
  const basePathByRole: Record<PanelRole, string> = {
    cliente: "/portal-cliente",
    parceiro: "/parceiro",
    prestador: "/prestador",
    indicador: "/indicador",
    colaborador: "/colaborador",
  };
  const navHref = (key: string) => key === "dashboard" ? basePathByRole[role] : `${basePathByRole[role]}/${key}`;

  const displayName = userName || user?.user_metadata?.full_name || user?.email || theme.label;
  const subtitle = userSubtitle || user?.email || "";

  const SideNav = ({ onPick }: { onPick?: () => void }) => (
    <nav className="flex flex-col gap-0.5 px-3 py-4">
      <div className="px-2 pb-3 mb-2 border-b border-slate-100">
        <p className={cn("text-[10px] font-semibold uppercase tracking-[0.18em]", theme.accentText)}>{theme.label}</p>
        <p className="text-[13px] font-semibold text-slate-900 mt-0.5 truncate">{displayName}</p>
        <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>
      </div>
      {nav.map((n) => {
        const active = n.key === activeKey;
        const Icon = n.icon;
        return (
          <Link
            key={n.key}
            to={navHref(n.key)}
            onClick={() => { onPick?.(); }}
            className={cn(
              "relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13.5px] font-medium transition",
              active
                ? cn(theme.accentSoft, theme.accentText)
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            {active && <span className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-r", theme.accentBg)} />}
            <Icon className="size-[17px] shrink-0" />
            <span className="truncate flex-1 text-left">{n.label}</span>
            {n.badge ? (
              <span className={cn("text-[10px] font-semibold px-1.5 rounded-full", theme.accentSoft, theme.accentText)}>{n.badge}</span>
            ) : null}
          </Link>
        );
      })}
      <button
        onClick={() => signOut?.()}
        className="mt-3 flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-slate-500 hover:bg-slate-50 hover:text-rose-600 transition"
      >
        <LogOut className="size-4" />
        Sair
      </button>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-slate-50/70 font-sans">
      <div className="flex min-h-dvh">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-[252px] shrink-0 flex-col bg-white border-r border-slate-200/70 sticky top-0 h-dvh">
          <SideNav />
        </aside>

        {/* Main column */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top header */}
          <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/70">
            <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
              <div className="lg:hidden">
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Abrir menu">
                      <Menu className="size-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-[280px]">
                    <SideNav onPick={() => setSheetOpen(false)} />
                  </SheetContent>
                </Sheet>
              </div>
              <Link to="/" className="flex items-center gap-2">
                <div className={cn("size-7 rounded-md bg-gradient-to-br shadow-sm", theme.gradient)} />
                <span className="text-[13px] font-semibold text-slate-800 hidden sm:inline">{theme.label}</span>
              </Link>
              <div className="flex-1" />
              <Link
                to="/minhas-solicitacoes"
                className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[12.5px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                aria-label="Caixa de solicitações"
              >
                <MessageSquare className="size-4" />
                Solicitações
              </Link>
              <NotificationBell />

              <Avatar className="size-8">
                <AvatarFallback className={cn("text-[11px] font-semibold", theme.accentSoft, theme.accentText)}>
                  {initials(displayName)}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>

          <main className="flex-1 pb-24 lg:pb-10">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/70 pb-[max(env(safe-area-inset-bottom),0px)]">
        <div className="h-16 flex overflow-x-auto scrollbar-thin px-1">
          {nav.map((n) => {
            const active = n.key === activeKey;
            const Icon = n.icon;
            return (
              <Link
                key={n.key}
                to={navHref(n.key)}
                className={cn(
                  "min-w-[74px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition relative",
                  active ? theme.accentText : "text-slate-500"
                )}
              >
                {active && <span className={cn("absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-b-full", theme.accentBg)} />}
                <Icon className={cn("size-[20px] mb-0.5", active && "scale-110")} />
                <span className="truncate max-w-[64px]">{n.shortLabel || n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
