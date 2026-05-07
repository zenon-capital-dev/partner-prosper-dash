import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Download, CheckCircle2, XCircle, Clock, Eye, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ClientDocuments({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data: documents, isLoading } = useQuery({
    queryKey: ["client-documents", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: any }) => {
      const { error } = await supabase.from("documents").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-documents", clientId] });
      toast.success("Status atualizado");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-documents", clientId] });
      toast.success("Documento removido");
    },
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Documentos</h3>
          <p className="text-xs text-muted-foreground">Gestão de arquivos e validações</p>
        </div>
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="size-4 mr-2" /> Solicitar Documento
        </Button>
      </div>

      <div className="cp-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30">
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Documento</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Data</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : documents?.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">Nenhum documento encontrado.</td></tr>
              ) : documents?.map((doc: any) => (
                <tr key={doc.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                        <FileText className="size-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{doc.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{doc.mime_type || "ARQUIVO"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusPill status={doc.status} />
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground tabular-nums">
                    {formatDate(doc.created_at)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-600" onClick={() => updateStatus.mutate({ id: doc.id, status: "aprovado" })}>
                        <CheckCircle2 className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-600" onClick={() => updateStatus.mutate({ id: doc.id, status: "reprovado" })}>
                        <XCircle className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={() => window.open(doc.file_path)}>
                        <Download className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:text-rose-500" onClick={() => deleteDoc.mutate(doc.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: any = {
    solicitado: { label: "SOLICITADO", color: "text-blue-600 bg-blue-50 dark:bg-blue-500/10" },
    enviado: { label: "ENVIADO", color: "text-amber-600 bg-amber-50 dark:bg-amber-500/10" },
    em_analise: { label: "ANÁLISE", color: "text-amber-600 bg-amber-50 dark:bg-amber-500/10" },
    aprovado: { label: "APROVADO", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" },
    reprovado: { label: "REPROVADO", color: "text-rose-600 bg-rose-50 dark:bg-rose-500/10" },
  };
  const config = map[status] || { label: status, color: "text-slate-600 bg-slate-50" };
  return (
    <span className={cn("px-2 py-1 rounded-full text-[9px] font-bold tracking-widest border border-current opacity-80", config.color)}>
      {config.label.toUpperCase()}
    </span>
  );
}
