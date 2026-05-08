import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Download, CheckCircle2, Clock, AlertCircle, Loader2, ShieldCheck, History } from "lucide-react";
import { formatDate, formatBRL } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Contract = {
  id: string;
  name: string;
  status: string;
  amount: number | null;
  file_path: string | null;
  signed_at: string | null;
  sent_at: string | null;
  created_at: string;
  products?: { name: string };
};

const STATUS_META: Record<string, { label: string; tone: string; icon: any }> = {
  criado: { label: "Rascunho", tone: "bg-slate-50 text-slate-600 border-slate-200", icon: Clock },
  enviado: { label: "Aguardando Assinatura", tone: "bg-amber-50 text-amber-700 border-amber-200", icon: FileSignature },
  aguardando_assinatura: { label: "Aguardando Assinatura", tone: "bg-amber-50 text-amber-700 border-amber-200", icon: FileSignature },
  assinado: { label: "Assinado", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: ShieldCheck },
  finalizado: { label: "Finalizado", tone: "bg-primary-50 text-primary border-primary-200", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", tone: "bg-rose-50 text-rose-700 border-rose-200", icon: AlertCircle },
};

export function ClientContractsTab({
  clientId,
  contracts,
}: {
  clientId: string;
  contracts: Contract[];
}) {
  const qc = useQueryClient();
  const [signingId, setSigningId] = useState<string | null>(null);
  const [confirmSign, setConfirmSign] = useState<Contract | null>(null);

  async function handleSign(contract: Contract) {
    try {
      setSigningId(contract.id);
      
      const { error } = await supabase
        .from("contracts")
        .update({ 
          status: "assinado", 
          signed_at: new Date().toISOString() 
        })
        .eq("id", contract.id);

      if (error) throw error;

      // Log to history
      await supabase.from("contract_history").insert({
        contract_id: contract.id,
        status: "assinado",
        action_by: (await supabase.auth.getUser()).data.user?.id,
        notes: "Contrato assinado pelo cliente via painel."
      });

      toast.success("Contrato assinado com sucesso!");
      qc.invalidateQueries({ queryKey: ["client-panel"] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao assinar contrato");
    } finally {
      setSigningId(null);
      setConfirmSign(null);
    }
  }

  async function handleView(contract: Contract) {
    if (!contract.file_path) return;
    const { data, error } = await supabase.storage.from("contracts").createSignedUrl(contract.file_path, 3600);
    if (error || !data) return toast.error("Não foi possível acessar o contrato");
    window.open(data.signedUrl, "_blank");
  }

  if (contracts.length === 0) {
    return (
      <div className="vx-card bg-white dark:bg-slate-900/40 rounded-[24px] p-12 text-center border-slate-100 dark:border-white/5">
        <FileSignature className="size-12 text-primary/30 mx-auto mb-4" />
        <h3 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white">Nenhum contrato ativo</h3>
        <p className="text-muted-foreground mt-2 text-sm">Seus contratos de serviço aparecerão aqui para assinatura e consulta.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {contracts.map((c) => {
          const meta = STATUS_META[c.status] ?? STATUS_META.criado;
          const Icon = meta.icon;
          const isAwaitingSign = c.status === 'enviado' || c.status === 'aguardando_assinatura';

          return (
            <div key={c.id} className="vx-card bg-white dark:bg-slate-900/40 rounded-[32px] p-8 border-slate-100 dark:border-white/5 hover:shadow-xl transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className={cn("size-14 rounded-2xl flex items-center justify-center shrink-0 border", meta.tone)}>
                  <Icon className="size-7" />
                </div>
                <Badge variant="outline" className={cn("text-[10px] uppercase tracking-widest px-3 py-1", meta.tone)}>
                  {meta.label}
                </Badge>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                    {c.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {c.products?.name || "Contrato de Prestação de Serviço"}
                  </p>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {c.amount ? formatBRL(c.amount) : "---"}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Valor do Contrato</span>
                </div>

                <div className="pt-4 border-t border-slate-50 dark:border-white/5 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> Criado em {formatDate(c.created_at)}</span>
                  {c.signed_at && <span className="flex items-center gap-1.5 text-emerald-600 font-bold"><ShieldCheck className="size-3.5" /> Assinado em {formatDate(c.signed_at)}</span>}
                </div>

                <div className="pt-6 flex items-center gap-3">
                  {c.file_path && (
                    <Button variant="outline" className="flex-1 rounded-2xl h-12 font-bold" onClick={() => handleView(c)}>
                      <Download className="size-4 mr-2" /> Visualizar
                    </Button>
                  )}
                  {isAwaitingSign && (
                    <Button 
                      className="flex-[1.5] rounded-2xl h-12 bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20"
                      onClick={() => setConfirmSign(c)}
                    >
                      <FileSignature className="size-4 mr-2" /> Assinar Contrato
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!confirmSign} onOpenChange={() => setConfirmSign(null)}>
        <AlertDialogContent className="rounded-[32px] p-8">
          <AlertDialogHeader>
            <div className="size-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mb-6">
              <ShieldCheck className="size-8" />
            </div>
            <AlertDialogTitle className="font-editorial text-3xl">Assinatura Digital</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-base leading-relaxed pt-2">
              Você está prestes a assinar digitalmente o contrato <strong className="text-slate-900 dark:text-white">"{confirmSign?.name}"</strong>. 
              Esta ação confirma sua concordância com todos os termos estabelecidos e possui validade jurídica dentro da nossa plataforma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-8">
            <AlertDialogCancel className="rounded-2xl h-12 font-bold border-slate-200">Revisar Termos</AlertDialogCancel>
            <AlertDialogAction 
              className="rounded-2xl h-12 bg-primary hover:bg-primary/90 text-white font-bold"
              onClick={() => confirmSign && handleSign(confirmSign)}
              disabled={!!signingId}
            >
              {signingId ? <Loader2 className="size-4 animate-spin" /> : "Confirmar Assinatura"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
