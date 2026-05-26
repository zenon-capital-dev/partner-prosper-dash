import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string | null;
  productName: string;
  onDeleted?: () => void;
};

export function DeleteProductDialog({ open, onOpenChange, productId, productName, onDeleted }: Props) {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setConfirmText(""); setLoading(false); }
  }, [open]);

  const canConfirm = confirmText.trim().toLowerCase() === "excluir" && !loading && !!productId;

  const handleDelete = async () => {
    if (!canConfirm || !productId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_delete_product_cascade", {
      _product_id: productId,
      _force: true,
    });
    setLoading(false);
    if (error) { toast.error(error.message || "Falha ao excluir"); return; }
    const r = data as { ok: boolean; message?: string } | null;
    if (!r?.ok) { toast.error(r?.message || "Falha ao excluir"); return; }
    toast.success(r.message || "Serviço e todos os vínculos excluídos");
    onOpenChange(false);
    onDeleted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="size-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-2">
            <AlertTriangle className="size-5" />
          </div>
          <DialogTitle className="text-rose-700">Excluir serviço permanentemente</DialogTitle>
          <DialogDescription className="text-slate-600">
            Você está prestes a excluir <span className="font-semibold text-slate-900">"{productName}"</span> e
            <span className="font-semibold"> todas as informações vinculadas</span>: vendas, comissões, pagamentos,
            demandas, tarefas, documentos e histórico. <span className="text-rose-600 font-semibold">Esta ação é
            irreversível.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="confirm-delete" className="text-xs font-semibold text-slate-700">
            Para confirmar, digite <span className="font-mono text-rose-600">excluir</span> abaixo:
          </Label>
          <Input
            id="confirm-delete"
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="excluir"
            className="border-rose-200 focus-visible:ring-rose-500"
            onKeyDown={(e) => { if (e.key === "Enter" && canConfirm) handleDelete(); }}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canConfirm}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            <Trash2 className="size-4 mr-1.5" />
            {loading ? "Excluindo..." : "Excluir permanentemente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
