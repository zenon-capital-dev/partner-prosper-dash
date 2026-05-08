import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Download, Check, X, Clock, Trash2, Calendar, Eye, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { DocumentDialog } from "@/components/documents/DocumentDialog";
import { Badge } from "@/components/ui/badge";

export function ClientDocuments({ clientId, user_id }: { clientId: string; user_id?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  const { data: docs, isLoading } = useQuery({
    queryKey: ["client-docs-admin", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          products(name)
        `)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = async (id: string, status: any) => {
    const { error } = await supabase
      .from("documents")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    
    if (error) return toast.error(error.message);
    toast.success(`Status atualizado para ${status}`);
    qc.invalidateQueries({ queryKey: ["client-docs-admin", clientId] });
  };

  const handleReprove = async (doc: any) => {
    const reason = window.prompt("Motivo da reprovação:");
    if (reason) {
      const { error } = await supabase
        .from("documents")
        .update({ status: "reprovado", rejection_reason: reason, reviewed_at: new Date().toISOString() })
        .eq("id", doc.id);
      
      if (error) return toast.error(error.message);
      toast.success("Documento reprovado");
      qc.invalidateQueries({ queryKey: ["client-docs-admin", clientId] });
    }
  };

  const viewFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const deleteDoc = async (id: string) => {
    if (!confirm("Excluir esta solicitação?")) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Solicitação removida");
    qc.invalidateQueries({ queryKey: ["client-docs-admin", clientId] });
  };

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="editorial-title text-xl">Gestão de Documentos</h3>
          <p className="editorial-label text-white/40">Solicite novos arquivos e valide os recebidos.</p>
        </div>
        <Button onClick={() => { setSelectedDoc(null); setOpen(true); }} className="btn-premium h-10 px-5 gap-2">
          <Plus className="size-4" /> Solicitar Documento
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="vx-card p-12 text-center text-white/20">Carregando documentos...</div>
        ) : docs?.length === 0 ? (
          <div className="vx-card p-16 text-center border-dashed">
            <FileText className="size-10 text-white/10 mx-auto mb-4" />
            <p className="editorial-title text-white/40">Nenhuma solicitação ativa</p>
          </div>
        ) : docs?.map((doc: any) => (
          <div key={doc.id} className="vx-card group p-5 flex items-center justify-between border-white/[0.05] hover:border-primary/20 transition-all">
            <div className="flex items-center gap-5">
              <div className={cn(
                "size-12 rounded-2xl flex items-center justify-center transition-all",
                doc.status === "aprovado" ? "bg-emerald-500/10 text-emerald-500" : "bg-white/[0.03] text-white/40"
              )}>
                <FileText className="size-6" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-white">{doc.name}</p>
                  <Badge variant="outline" className="text-[9px] uppercase tracking-widest px-1.5 py-0">
                    {doc.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                    {doc.products?.name || "Geral"}
                  </span>
                  {doc.due_date && (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-400/60">
                      <Clock className="size-3" /> Prazo: {formatDate(doc.due_date)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {doc.file_path && (
                <Button variant="ghost" size="icon" onClick={() => viewFile(doc.file_path)} className="size-8 rounded-lg hover:bg-white/10">
                  <Eye className="size-4" />
                </Button>
              )}
              {doc.status !== "aprovado" && (
                <Button variant="ghost" size="sm" onClick={() => updateStatus(doc.id, "aprovado")} className="text-emerald-500 hover:bg-emerald-500/10 h-8 uppercase text-[10px] font-black tracking-widest px-3">
                  <Check className="size-3.5 mr-1.5" /> Aprovar
                </Button>
              )}
              {doc.status !== "reprovado" && (
                <Button variant="ghost" size="sm" onClick={() => handleReprove(doc)} className="text-rose-500 hover:bg-rose-500/10 h-8 uppercase text-[10px] font-black tracking-widest px-3">
                  <X className="size-3.5 mr-1.5" /> Recusar
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc.id)} className="size-8 rounded-lg text-white/20 hover:text-rose-500">
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <DocumentDialog 
        open={open} 
        onOpenChange={setOpen} 
        clientId={clientId}
        document={selectedDoc}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["client-docs-admin", clientId] })}
      />
    </div>
  );
}
