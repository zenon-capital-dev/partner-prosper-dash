import { useNavigate } from "react-router-dom";
import {
  Plus, Users, Briefcase, Truck, ClipboardList, FileText, FileSignature,
  Banknote, ChevronDown, Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ITEMS = [
  { label: "Novo Cliente", url: "/clientes?new=1", icon: Users, hint: "C" },
  { label: "Nova Demanda", url: "/demandas?new=1", icon: ClipboardList, hint: "D" },
  { label: "Nova Tarefa", url: "/tarefas?new=1", icon: ClipboardList, hint: "T" },
  { label: "Novo Documento", url: "/documentos?new=1", icon: FileText, hint: "U" },
  { label: "Novo Contrato", url: "/contratos?new=1", icon: FileSignature, hint: "K" },
  { label: "Novo Parceiro", url: "/parceiros?new=1", icon: Briefcase, hint: "P" },
  { label: "Novo Prestador", url: "/prestadores?new=1", icon: Truck, hint: "R" },
  { label: "Novo Pagamento", url: "/financeiro?new=1", icon: Banknote, hint: "F" },
];

interface Props {
  variant?: "default" | "compact";
}

export function QuickCreateButton({ variant = "default" }: Props) {
  const navigate = useNavigate();
  const { isAdmin, isAdminSecondary } = useAuth();

  if (!isAdmin && !isAdminSecondary) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Criação rápida"
          className={
            variant === "compact"
              ? "h-9 w-9 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              : "h-9 px-3 inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-[12.5px] font-semibold shadow-sm"
          }
        >
          <Plus className="size-4" strokeWidth={2.4} />
          {variant === "default" && (
            <>
              <span className="hidden sm:inline">Criar</span>
              <ChevronDown className="size-3 opacity-70 hidden sm:inline" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-1.5">
        <DropdownMenuLabel className="px-2.5 py-2 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-muted-foreground">
          <Sparkles className="size-3" /> Criação rápida
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ITEMS.map((item, idx) => (
          <DropdownMenuItem
            key={item.url + idx}
            onClick={() => navigate(item.url)}
            className="gap-2.5 px-2.5 py-2 rounded-md cursor-pointer text-[13px]"
          >
            <item.icon className="size-4 text-muted-foreground" />
            <span className="flex-1">{item.label}</span>
            <kbd className="text-[9.5px] font-mono font-semibold bg-slate-100 dark:bg-muted border border-border rounded px-1.5 py-0.5 text-slate-500 dark:text-muted-foreground/70">
              {item.hint}
            </kbd>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
