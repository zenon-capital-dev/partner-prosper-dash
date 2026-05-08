import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Download, CheckCircle2, XCircle, Clock, Trash2, Calendar, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClientDocuments({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: "", due_date: "" });

  const { data: requests, isLoading } = useQuery({
    queryKey: ["client-doc-requests", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_document_requests")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const createRequest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("client_document_requests").insert({
        client_id: clientId,
        title: newDoc.title,
        due_date: newDoc.due_date || null,
        status: "pendente"
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-doc-requests", clientId] });
      toast.success("Solicitação enviada");
      setOpen(false);
      setNewDoc({ title: "", due_date: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: any }) => {
      const { error } = await supabase.from("client_document_requests").update({ 
        status,
        reviewed_at: status === "aprovado" || status === "rejeitado" ? new Date().toISOString() : null
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-doc-requests", clientId] });
      toast.success("Status atualizado");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_document_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-doc-requests", clientId] });
      toast.success("Solicitação removida");
    },
  });

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="editorial-title text-xl">Checklist de Documentos</h3>
          <p className="editorial-label text-white/40">Solicite e valide documentos necessários para o processo.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="btn-premium h-10 px-5 gap-2">
          <Plus className="size-4" /> Solicitar Documento
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="vx-card p-12 text-center text-white/20">Carregando checklist...</div>
        ) : requests?.length === 0 ? (
          <div className="vx-card p-16 text-center border-dashed">
            <FileText className="size-10 text-white/10 mx-auto mb-4" />
            <p className="editorial-title text-white/40">Nenhuma solicitação ativa</p>
            <p className="editorial-label text-white/20 mt-1">Comece solicitando os documentos base do contrato.</p>
          </div>
        ) : requests?.map((doc: any) => (
          <div key={doc.id} className="vx-card group p-5 flex items-center justify-between border-white/[0.05] hover:border-primary/20 transition-all">
            <div className="flex items-center gap-5">
              <div className={cn(
                "size-12 rounded-2xl flex items-center justify-center transition-all",
                doc.status === "aprovado" ? "bg-emerald-500/10 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]" : "bg-white/[0.03] text-white/40 group-hover:bg-primary/10 group-hover:text-primary"
              )}>
                <FileText className="size-6" />
              </div>
              <div>
                <p className="font-bold text-white group-hover:text-primary transition-colors">{doc.title}</p>
                <div className="flex items-center gap-3 mt-1">
                  <StatusPill status={doc.status} />
                  {doc.due_date && (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/20">
                      <Calendar className="size-3" /> Prazo: {formatDate(doc.due_date)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {doc.status === "pendente" && (
                <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: doc.id, status: "aprovado" })} className="text-emerald-500 hover:bg-emerald-500/10 h-8 uppercase text-[10px] font-black tracking-widest px-3">
                  <CheckCircle2 className="size-3.5 mr-1.5" /> Aprovar
                </Button>
              )}
              {doc.file_url && (
                <Button variant="ghost" size="icon" onClick={() => window.open(doc.file_url)} className="size-8 rounded-lg hover:bg-white/10">
                  <Download className="size-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => deleteRequest.mutate(doc.id)} className="size-8 rounded-lg text-white/20 hover:text-rose-500 hover:bg-rose-500/10">
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-neutral-950 border-white/10">
          <DialogHeader>
            <DialogTitle className="editorial-title">Nova Solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="editorial-label text-white/40">Título do Documento</Label>
              <Input 
                placeholder="Ex: Contrato assinado, RG, Comprovante de endereço" 
                value={newDoc.title}
                onChange={e => setNewDoc({...newDoc, title: e.target.value})}
                className="bg-white/[0.03] border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label className="editorial-label text-white/40">Prazo de Entrega (Opcional)</Label>
              <Input 
                type="date"
                value={newDoc.due_date}
                onChange={e => setNewDoc({...newDoc, due_date: e.target.value})}
                className="bg-white/[0.03] border-white/10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="editorial-label">Cancelar</Button>
            <Button onClick={() => createRequest.mutate()} disabled={!newDoc.title} className="btn-primary">Enviar Solicitação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: any = {
    pendente: { label: "Aguardando", cls: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
    em_analise: { label: "Em Análise", cls: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
    aprovado: { label: "Validado", cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
    rejeitado: { label: "Pendente", cls: "text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-400/20" },
  };
  const m = map[status] || { label: status, cls: "text-white/20 bg-white/[0.03] border-white/[0.05]" };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.1em] border", m.cls)}>
      {m.label}
    </span>
  );
}

