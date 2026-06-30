import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Loader2, FileCheck2, X, Receipt } from "lucide-react";
import { toast } from "sonner";
import { sanitizeStorageFileName, uploadErrorMessage, uploadStorageFileFast } from "@/lib/uploads";
import { downloadStorageFile } from "@/lib/download";
import { formatBRL } from "@/lib/format";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp";
const MAX_MB = 10;

export function PaymentReceiptDialog({
  clientId, payment, invalidateKey,
}: {
  clientId: string;
  payment: { id: string; amount: number; receipt_url?: string | null; description?: string | null };
  invalidateKey: unknown[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const hasReceipt = !!payment.receipt_url;

  async function submit() {
    if (!file) return toast.error("Selecione um arquivo");
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`Arquivo maior que ${MAX_MB}MB`);
    setBusy(true);
    try {
      const path = `${clientId}/receipts/${payment.id}/${Date.now()}-${sanitizeStorageFileName(file.name)}`;
      await uploadStorageFileFast("documents", path, file);
      const { error } = await supabase.rpc("client_submit_payment_receipt", {
        _payment_id: payment.id, _receipt_path: path,
      });
      if (error) throw error;
      toast.success("Comprovante enviado! Aguardando análise.");
      setFile(null);
      setOpen(false);
      qc.invalidateQueries({ queryKey: invalidateKey });
    } catch (e: any) {
      toast.error(uploadErrorMessage(e) || e?.message || "Falha ao enviar comprovante");
    } finally {
      setBusy(false);
    }
  }

  async function viewReceipt() {
    if (!payment.receipt_url) return;
    const newTab = window.open("", "_blank");
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      const baseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
      const anonKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${baseUrl}/storage/v1/object/authenticated/documents/${payment.receipt_url}`, {
        headers: { apikey: anonKey, authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      if (newTab) newTab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      newTab?.close();
      toast.error("Não foi possível abrir o comprovante");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setFile(null); }}>
      <div className="flex flex-col items-end gap-1.5">
        <DialogTrigger asChild>
          <Button size="sm" variant={hasReceipt ? "outline" : "default"} className="rounded-xl">
            <Receipt className="size-3.5 mr-1.5" />
            {hasReceipt ? "Atualizar comprovante" : "Enviar comprovante"}
          </Button>
        </DialogTrigger>
        {hasReceipt && (
          <button onClick={viewReceipt} className="text-[11px] text-indigo-600 hover:underline inline-flex items-center gap-1">
            <FileCheck2 className="size-3" /> Ver comprovante enviado
          </button>
        )}
      </div>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar comprovante de pagamento</DialogTitle>
          <DialogDescription>
            Anexe o comprovante ({formatBRL(payment.amount)}). Nossa equipe vai analisar e confirmar o recebimento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block">
            <input
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {!file ? (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition">
                <Upload className="size-6 mx-auto text-slate-400" />
                <p className="text-sm font-medium text-slate-700 mt-2">Selecionar arquivo</p>
                <p className="text-xs text-slate-500 mt-1">PDF, PNG, JPG até {MAX_MB}MB</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 p-3 flex items-center gap-3 bg-slate-50/60">
                <div className="size-9 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <FileCheck2 className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-slate-900 truncate">{file.name}</p>
                  <p className="text-[11px] text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <Button type="button" size="icon" variant="ghost" className="size-7" onClick={(e) => { e.preventDefault(); setFile(null); }}>
                  <X className="size-4" />
                </Button>
              </div>
            )}
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || !file}>
            {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Upload className="size-4 mr-1.5" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
