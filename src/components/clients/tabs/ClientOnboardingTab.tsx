import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Check, X, Clock, Trash2, Eye,
  Package, RefreshCw, MessageSquare, AlertCircle, Loader2, CheckCircle2,
  FileText, ShieldCheck, ArrowUpRight, Download
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ClientOnboardingTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["client-profile-onboarding", clientId],
    queryFn: async () => {
      // Assuming clientId passed here is the auth user id linked to the client profile
      // In this system, sometimes clientId is the ID from 'clients' table
      const { data: client } = await supabase.from("clients").select("user_id").eq("id", clientId).single();
      const userId = client?.user_id || clientId;
      
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      return data;
    },
  });

  const { data: docs = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["onboarding-docs-admin", clientId],
    queryFn: async () => {
      const { data: client } = await supabase.from("clients").select("user_id").eq("id", clientId).single();
      const userId = client?.user_id || clientId;
      const { data } = await supabase
        .from("onboarding_documents")
        .select("*")
        .eq("client_id", userId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const updateDocStatus = useMutation({
    mutationFn: async ({ docId, status, reason }: { docId: string; status: string; reason?: string }) => {
      const { error } = await supabase
        .from("onboarding_documents")
        .update({ 
          status, 
          rejection_reason: reason || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id
        } as any)
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding-docs-admin"] });
      toast.success("Status do documento atualizado");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleOnboarding = useMutation({
    mutationFn: async (completed: boolean) => {
      const userId = profile?.id;
      if (!userId) return;
      const { error } = await supabase
        .from("profiles")
        .update({ 
          onboarding_completed: completed,
          onboarding_status: completed ? 'completo' : 'em_andamento'
        } as any)
        .eq("id", userId);
      if (error) throw error;
      
      // Also update the clients table for consistency if needed
      await supabase.from("clients").update({ onboarding_status: completed ? 'concluido' : 'em_andamento' } as any).eq("user_id", userId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-profile-onboarding"] });
      qc.invalidateQueries({ queryKey: ["client"] });
      toast.success("Acesso do cliente atualizado");
    },
  });

  if (loadingProfile || loadingDocs) return <div className="p-12 text-center animate-pulse text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Carregando jornada...</div>;

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex items-center justify-between bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className={cn(
            "size-12 rounded-2xl flex items-center justify-center transition-colors",
            profile?.onboarding_completed ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
          )}>
            {profile?.onboarding_completed ? <ShieldCheck className="size-6" /> : <Clock className="size-6" />}
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Status do Onboarding</h3>
            <p className="text-xs text-muted-foreground">
              {profile?.onboarding_completed 
                ? "O cliente já concluiu a jornada e tem acesso total ao painel." 
                : "O cliente está em fluxo obrigatório. O painel completo está bloqueado."}
            </p>
          </div>
        </div>
        <Button 
          variant={profile?.onboarding_completed ? "outline" : "default"}
          className={cn("rounded-xl h-11 px-6 font-bold", !profile?.onboarding_completed && "bg-slate-900")}
          onClick={() => toggleOnboarding.mutate(!profile?.onboarding_completed)}
        >
          {profile?.onboarding_completed ? "Bloquear Acesso" : "Liberar Acesso Agora"}
        </Button>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
           <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400">Documentos da Jornada</h4>
           <Badge variant="outline" className="rounded-full bg-slate-50">{docs.length} Solicitados</Badge>
        </div>

        <div className="grid gap-4">
          {docs.map((doc: any) => (
            <div key={doc.id} className="bg-white border border-slate-100 rounded-3xl p-5 flex items-center justify-between group hover:border-indigo-100 transition-all">
               <div className="flex items-center gap-4">
                  <div className={cn(
                    "size-10 rounded-xl flex items-center justify-center border",
                    doc.status === 'approved' ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                    doc.status === 'rejected' ? "bg-rose-50 border-rose-100 text-rose-600" :
                    doc.status === 'submitted' ? "bg-blue-50 border-blue-100 text-blue-600" :
                    "bg-slate-50 border-slate-100 text-slate-400"
                  )}>
                     <FileText className="size-5" />
                  </div>
                  <div>
                     <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 text-sm">{doc.name}</p>
                        <DocStatusBadge status={doc.status} />
                     </div>
                     <p className="text-[11px] text-muted-foreground mt-0.5">
                       {doc.submitted_at ? `Enviado em ${formatDate(doc.submitted_at)}` : "Aguardando envio pelo cliente"}
                     </p>
                  </div>
               </div>

               <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {doc.file_url && (
                    <Button variant="ghost" size="sm" className="rounded-lg h-9 px-3 text-indigo-600 hover:bg-indigo-50 font-bold text-[10px]" onClick={() => {
                      supabase.storage.from("documents").createSignedUrl(doc.file_url, 3600).then(({data, error}) => {
                        if (error) {
                          toast.error("Erro ao gerar link do documento: " + error.message);
                        } else if (data) {
                          window.open(data.signedUrl, '_blank');
                        }
                      });
                    }}>
                      <Download className="size-3.5 mr-1.5" /> BAIXAR
                    </Button>
                  )}
                  
                  {doc.status === 'submitted' && (
                    <>
                      <Button 
                        size="sm" 
                        className="bg-emerald-600 hover:bg-emerald-700 h-9 px-4 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                        onClick={() => updateDocStatus.mutate({ docId: doc.id, status: 'approved' })}
                      >
                        Aprovar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-rose-600 border-rose-100 hover:bg-rose-50 h-9 px-4 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                        onClick={() => {
                          const reason = window.prompt("Motivo da rejeição:");
                          if (reason) updateDocStatus.mutate({ docId: doc.id, status: 'rejected', reason });
                        }}
                      >
                        Rejeitar
                      </Button>
                    </>
                  )}

                  <Button variant="ghost" size="icon" aria-label="Excluir documento" className="size-9 rounded-lg text-slate-400 hover:text-rose-600" onClick={async () => {
                    if (window.confirm("Excluir documento?")) {
                      const { error } = await supabase.from("onboarding_documents").delete().eq("id", doc.id);
                      if (error) return toast.error("Erro ao excluir: " + error.message);
                      qc.invalidateQueries({ queryKey: ["onboarding-docs-admin"] });
                      toast.success("Documento removido");
                    }
                  }}>
                    <Trash2 className="size-4" />
                  </Button>
               </div>
            </div>
          ))}
          
          {docs.length === 0 && (
            <div className="p-12 border-2 border-dashed border-slate-100 rounded-[32px] text-center">
               <FileText className="size-10 text-slate-100 mx-auto mb-4" />
               <p className="text-sm font-bold text-slate-400">Nenhum documento na jornada</p>
               <Button variant="ghost" size="sm" className="mt-4 text-indigo-600 hover:bg-indigo-50 font-bold text-xs" onClick={async () => {
                 const name = window.prompt("Nome do documento:");
                 if (name) {
                   const { error } = await supabase.from("onboarding_documents").insert({ client_id: profile?.id, name, status: 'pending' });
                   if (error) {
                     toast.error("Erro ao adicionar: " + error.message);
                   } else {
                     qc.invalidateQueries({ queryKey: ["onboarding-docs-admin"] });
                     toast.success("Solicitação adicionada");
                   }
                 }
               }}>
                 + Adicionar Documento Obrigatório
               </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocStatusBadge({ status }: { status: string }) {
  const map: any = {
    pending: { label: "PENDENTE", className: "bg-amber-50 text-amber-600 border-amber-100" },
    submitted: { label: "ENVIADO", className: "bg-blue-50 text-blue-600 border-blue-100" },
    approved: { label: "APROVADO", className: "bg-emerald-50 text-emerald-600 border-emerald-100" },
    rejected: { label: "REJEITADO", className: "bg-rose-50 text-rose-600 border-rose-100" },
  };
  const cfg = map[status] || map.pending;
  return (
    <Badge variant="outline" className={cn("text-[8px] font-black uppercase tracking-widest border px-1.5 py-0", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}