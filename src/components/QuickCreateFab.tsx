import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Briefcase, Truck, ClipboardList, FileText, FileSignature, Banknote } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS = [
  { label: "Novo Cliente", url: "/clientes?new=1", icon: Users, color: "primary" },
  { label: "Novo Parceiro", url: "/parceiros?new=1", icon: Briefcase, color: "primary" },
  { label: "Novo Prestador", url: "/prestadores?new=1", icon: Truck, color: "primary" },
  { label: "Nova Demanda", url: "/demandas?new=1", icon: ClipboardList, color: "primary" },
  { label: "Novo Documento", url: "/documentos?new=1", icon: FileText, color: "primary" },
  { label: "Novo Contrato", url: "/contratos?new=1", icon: FileSignature, color: "primary" },
  { label: "Novo Pagamento", url: "/financeiro?new=1", icon: Banknote, color: "primary" },
];

export function QuickCreateFab() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin, isAdminSecondary } = useAuth();

  if (!isAdmin && !isAdminSecondary) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Criação rápida"
        aria-label="Criação rápida"
        className="fixed bottom-6 right-6 z-40 size-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center no-print"
      >
        <Plus className="size-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criação rápida</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {SHORTCUTS.map((s) => (
              <button
                key={s.url}
                onClick={() => {
                  navigate(s.url);
                  setOpen(false);
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-sm"
              >
                <s.icon className="size-5 text-primary" />
                <span className="font-medium">{s.label}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
