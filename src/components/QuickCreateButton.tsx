import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Users, Briefcase, Truck, ClipboardList, FileText, FileSignature,
  Banknote, ChevronDown, Sparkles, CheckSquare,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Item = {
  label: string;
  url: string;
  icon: any;
  hint: string;
  tone: string; // tailwind classes for the icon pill
};

const ITEMS: Item[] = [
  { label: "Novo Cliente",     url: "/clientes?new=1",     icon: Users,          hint: "C", tone: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100" },
  { label: "Nova Demanda",     url: "/demandas?new=1",     icon: ClipboardList,  hint: "D", tone: "bg-violet-50 text-violet-600 ring-1 ring-violet-100" },
  { label: "Nova Tarefa",      url: "/tarefas?new=1",      icon: CheckSquare,    hint: "T", tone: "bg-sky-50 text-sky-600 ring-1 ring-sky-100" },
  { label: "Novo Documento",   url: "/documentos?new=1",   icon: FileText,       hint: "U", tone: "bg-amber-50 text-amber-600 ring-1 ring-amber-100" },
  { label: "Novo Contrato",    url: "/contratos?new=1",    icon: FileSignature,  hint: "K", tone: "bg-slate-100 text-slate-700 ring-1 ring-slate-200" },
  { label: "Novo Parceiro",    url: "/parceiros?new=1",    icon: Briefcase,      hint: "P", tone: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100" },
  { label: "Novo Prestador",   url: "/prestadores?new=1",  icon: Truck,          hint: "R", tone: "bg-teal-50 text-teal-600 ring-1 ring-teal-100" },
  { label: "Novo Pagamento",   url: "/financeiro?new=1",   icon: Banknote,       hint: "F", tone: "bg-rose-50 text-rose-600 ring-1 ring-rose-100" },
];

interface Props {
  variant?: "default" | "compact";
}

export function QuickCreateButton({ variant = "default" }: Props) {
  const navigate = useNavigate();
  const { isAdmin, isAdminSecondary } = useAuth();

  // Global keyboard shortcuts: jump to creation when not typing in an input.
  useEffect(() => {
    if (!isAdmin && !isAdminSecondary) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const key = e.key.toUpperCase();
      const item = ITEMS.find((i) => i.hint === key);
      if (item) {
        e.preventDefault();
        navigate(item.url);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAdmin, isAdminSecondary, navigate]);

  if (!isAdmin && !isAdminSecondary) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Criação rápida"
          className={
            variant === "compact"
              ? "h-9 w-9 inline-flex items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_12px_-2px_rgba(79,70,229,0.35)]"
              : "h-9 px-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all text-[12.5px] font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_12px_-2px_rgba(79,70,229,0.35)]"
          }
        >
          <Plus className="size-4" strokeWidth={2.6} />
          {variant === "default" && (
            <>
              <span className="hidden sm:inline">Criar</span>
              <ChevronDown className="size-3 opacity-80 hidden sm:inline" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[300px] p-0 overflow-hidden rounded-xl border border-slate-200/80 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18),0_0_0_1px_rgba(15,23,42,0.04)] bg-white"
      >
        <div className="px-4 pt-3.5 pb-3 bg-gradient-to-br from-indigo-50/80 via-white to-white border-b border-slate-100">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-700">
            <Sparkles className="size-3" />
            Criação rápida
          </div>
          <p className="text-[11.5px] text-slate-500 mt-1 leading-tight">
            Atalhos para criar registros sem sair da tela.
          </p>
        </div>
        <div className="p-1.5">
          {ITEMS.map((item) => (
            <DropdownMenuItem
              key={item.url}
              onClick={() => navigate(item.url)}
              className="gap-3 px-2 py-2 rounded-lg cursor-pointer text-[13px] font-medium text-slate-700 hover:bg-slate-50 focus:bg-slate-50 group transition-colors"
            >
              <span className={`size-7 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${item.tone}`}>
                <item.icon className="size-3.5" strokeWidth={2.2} />
              </span>
              <span className="flex-1">{item.label}</span>
              <kbd className="text-[9.5px] font-mono font-bold bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-500 shadow-[inset_0_-1px_0_rgba(15,23,42,0.05)]">
                {item.hint}
              </kbd>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
