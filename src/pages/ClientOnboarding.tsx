import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ShieldCheck, ArrowRight, Building2, Package,
  FileSignature, CheckCircle2, Headphones, Sparkles,
  Upload, Clock, AlertCircle, Loader2, Download,
  Check, ChevronRight, LayoutDashboard, LogOut,
  CreditCard, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatBRL, formatDate, initials } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export default function ClientOnboarding() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-data-v2", user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();

      const { data: client } = await supabase
        .from("clients")
        .select(`*, companies(id, name, trade_name)`)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!client) return { profile, client: null, prods: [], docs: [], payments: [], contracts: [] };

      const [prods, docs, payments, contracts] = await Promise.all([
        supabase.from("client_products").select("*, products(name)").eq("client_id", client.id),
        supabase.from("onboarding_documents").select("*").eq("client_id", user!.id).order("created_at", { ascending: true }),
        supabase.from("payments").select("*").eq("client_id", client.id).order("due_date", { ascending: true }),
        supabase.from("contracts").select("*").eq("client_id", client.id).order("created_at", { ascending: true }),
      ]);

      return {
        profile,
        client,
        prods: prods.data || [],
        docs: docs.data || [],
        payments: payments.data || [],
        contracts: contracts.data || [],
      };
    },
    enabled: !!user,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ docId, file }: { docId: string; file: File }) => {
      setUploadingId(docId);
      const ext = file.name.split(".").pop();
      const path = `onboarding/${user?.id}/${docId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from("onboarding_documents")
        .update({
          file_url: path,
          file_name: file.name,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          rejection_reason: null
        } as any)
        .eq("id", docId);
      if (dbErr) throw dbErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding-data-v2"] });
      toast.success("Documento enviado para análise!");
    },
    onError: (err: any) => {
      toast.error("Erro ao enviar: " + err.message);
    },
    onSettled: () => setUploadingId(null),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      // Logic to finalize if everything is OK or if it's manual approval
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_step: 5 } as any)
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding-data-v2"] });
      toast.success("Jornada finalizada! Aguardando ativação final.");
    },
  });

  useEffect(() => {
    if (data?.profile?.onboarding_completed) {
      navigate("/cliente", { replace: true });
    }
  }, [data?.profile?.onboarding_completed, navigate]);

  if (isLoading) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="text-center space-y-4 animate-pulse">
        <Loader2 className="size-10 animate-spin mx-auto text-primary/30" />
        <p className="text-sm font-medium text-slate-400 tracking-wide uppercase">Iniciando sua jornada premium...</p>
      </div>
    </div>
  );

  if (!data?.profile) return null;

  const { profile, client, prods, docs, payments, contracts } = data;
  const currentStep = profile.onboarding_step || 1;
  const totalSteps = 5;
  const progress = (currentStep / totalSteps) * 100;

  const steps = [
    { id: 1, label: "Boas-vindas", icon: Sparkles },
    { id: 2, label: "Dados e Contratos", icon: Building2 },
    { id: 3, label: "Documentação", icon: FileText },
    { id: 4, label: "Financeiro", icon: CreditCard },
    { id: 5, label: "Ativação", icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Premium Navbar */}
      <nav className="h-20 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50 flex items-center px-8 lg:px-12 justify-between">
        <div className="flex items-center gap-4">
          <div className="size-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Package className="size-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Onboarding</p>
            <p className="text-sm font-bold text-slate-900 mt-1">Portal do Cliente</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-12">
          {steps.map((s) => (
            <div key={s.id} className={cn(
              "flex items-center gap-2 transition-opacity",
              currentStep === s.id ? "opacity-100" : "opacity-40"
            )}>
              <s.icon className={cn("size-4", currentStep === s.id && "text-indigo-600")} />
              <span className={cn("text-[11px] font-bold uppercase tracking-widest", currentStep === s.id && "text-slate-900")}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl px-4 gap-2 text-xs font-bold uppercase tracking-widest">
            <LogOut className="size-3.5" /> Sair
          </Button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center py-12 lg:py-20 px-6">
        <div className="w-full max-w-4xl space-y-12">
          
          {/* Header Section */}
          <div className="text-center space-y-4 animate-fade-up">
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-[0.15em]">
              Etapa {currentStep} de {totalSteps}
            </Badge>
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 font-display">
              {currentStep === 1 && "Seja muito bem-vindo."}
              {currentStep === 2 && "Validar contrato e dados."}
              {currentStep === 3 && "Enviar documentação."}
              {currentStep === 4 && "Configuração financeira."}
              {currentStep === 5 && "Análise final de ativação."}
            </h1>
            <p className="text-slate-500 max-w-lg mx-auto text-sm font-medium leading-relaxed">
              {currentStep === 1 && "Iniciamos agora a configuração do seu ambiente exclusivo Prosper. Siga as etapas para liberar seu acesso completo."}
              {currentStep === 2 && "Confirme os dados da sua empresa e verifique os contratos vinculados às suas soluções contratadas."}
              {currentStep === 3 && "Para sua segurança e conformidade, precisamos que envie os documentos obrigatórios listados abaixo."}
              {currentStep === 4 && "Confirme as formas de pagamento e os vencimentos das suas parcelas iniciais."}
              {currentStep === 5 && "Tudo pronto! Nossa equipe está validando seus dados. Você será notificado assim que o painel for liberado."}
            </p>
          </div>

          <div className="relative animate-fade-up" style={{ animationDelay: '100ms' }}>
            {/* Ambient Background Glow */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500/5 via-transparent to-sky-500/5 blur-3xl -z-10 rounded-[60px]" />
            
            <div className="bg-white border border-slate-100 rounded-[48px] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] overflow-hidden min-h-[400px] flex flex-col">
              
              <div className="flex-1 p-8 lg:p-12">
                {currentStep === 1 && (
                  <div className="grid md:grid-cols-2 gap-12 items-center h-full">
                    <div className="space-y-8">
                       <div className="space-y-4">
                          <h3 className="text-2xl font-bold text-slate-900">Soluções Contratadas</h3>
                          <div className="space-y-3">
                             {prods.map((p: any) => (
                               <div key={p.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-colors hover:bg-white hover:border-indigo-100 hover:shadow-sm">
                                  <div className="size-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                                     <Package className="size-5" />
                                  </div>
                                  <span className="font-bold text-slate-800 text-sm">{p.products?.name}</span>
                               </div>
                             ))}
                             {prods.length === 0 && <p className="text-sm text-slate-400 italic">Nenhuma solução vinculada ainda.</p>}
                          </div>
                       </div>
                    </div>
                    <div className="bg-slate-50 rounded-[32px] p-8 space-y-6 flex flex-col justify-center border border-slate-100 shadow-inner">
                       <Sparkles className="size-12 text-indigo-600 mb-2" />
                       <h4 className="text-xl font-bold text-slate-900">Ambiente em preparação</h4>
                       <p className="text-sm text-slate-500 leading-relaxed font-medium">
                         Seu portal está sendo configurado com base nos produtos acima. Todas as ferramentas, relatórios e entregas estarão disponíveis após o onboarding.
                       </p>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-10">
                    <div className="grid md:grid-cols-2 gap-8">
                       <div className="space-y-6">
                          <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Dados Cadastrais</h4>
                          <div className="space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                             <DataRow label="Razão Social" value={client?.company || profile?.full_name} />
                             <DataRow label="Responsável" value={profile?.full_name} />
                             <DataRow label="E-mail" value={profile?.email} />
                             <DataRow label="Documento" value={client?.document || "—"} />
                          </div>
                       </div>
                       <div className="space-y-6">
                          <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Contratos Pendentes</h4>
                          <div className="space-y-3">
                             {contracts.map((c: any) => (
                               <div key={c.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 transition-colors shadow-sm">
                                  <div className="flex items-center gap-3">
                                     <FileSignature className="size-5 text-indigo-600" />
                                     <span className="text-xs font-bold">{c.name}</span>
                                  </div>
                                  <Button variant="ghost" size="sm" className="h-8 rounded-lg text-indigo-600 font-bold text-[10px] hover:bg-indigo-50">
                                     VER CONTRATO
                                  </Button>
                               </div>
                             ))}
                             {contracts.length === 0 && <p className="text-xs text-slate-400 italic">Nenhum contrato gerado ainda.</p>}
                          </div>
                       </div>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {docs.map((doc: any) => (
                        <div key={doc.id} className="p-6 rounded-3xl border border-slate-100 bg-white shadow-sm flex flex-col justify-between gap-4 transition-all hover:shadow-md hover:border-indigo-100">
                          <div className="space-y-2">
                             <div className="flex items-center justify-between">
                                <h4 className="font-bold text-slate-900 text-sm">{doc.name}</h4>
                                <DocStatusBadge status={doc.status} />
                             </div>
                             <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{doc.description || "Por favor, envie uma cópia legível deste documento."}</p>
                          </div>

                          <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-50">
                             {doc.file_url ? (
                               <div className="flex items-center gap-2 text-emerald-600">
                                  <CheckCircle2 className="size-4" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider">Arquivo Enviado</span>
                               </div>
                             ) : (
                               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aguardando Envio</span>
                             )}
                             
                             <Button 
                               size="sm" 
                               variant={doc.file_url ? "outline" : "default"}
                               className={cn(
                                 "rounded-xl h-9 px-5 text-xs font-bold gap-2",
                                 !doc.file_url && "bg-slate-900 hover:bg-indigo-600"
                               )}
                               disabled={uploadingId === doc.id}
                               onClick={() => {
                                 setUploadingId(doc.id);
                                 fileRef.current?.click();
                               }}
                             >
                               {uploadingId === doc.id ? (
                                 <Loader2 className="size-3 animate-spin" />
                               ) : doc.file_url ? (
                                 "SUBSTITUIR"
                               ) : (
                                 <>
                                   <Upload className="size-3" /> ENVIAR
                                 </>
                               )}
                             </Button>
                          </div>
                          {doc.rejection_reason && (
                             <div className="mt-2 p-2 bg-rose-50 border border-rose-100 rounded-xl flex gap-2">
                                <AlertCircle className="size-3 text-rose-600 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-rose-700 font-medium"><strong>Reprovado:</strong> {doc.rejection_reason}</p>
                             </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <input 
                      type="file" 
                      ref={fileRef} 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && uploadingId) {
                          uploadMutation.mutate({ docId: uploadingId, file });
                        }
                      }}
                    />
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-10">
                    <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-8 opacity-10">
                          <CreditCard className="size-32" />
                       </div>
                       <div className="relative z-10">
                          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-2">Financeiro</p>
                          <h4 className="text-3xl font-bold font-display">Resumo de Cobranças</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mt-10">
                             <DataCol label="Total Investido" value={formatBRL(payments.reduce((s: any, p: any) => s + Number(p.amount || 0), 0))} light />
                             <DataCol label="Parcelas" value={payments.length} light />
                             <DataCol label="Vencimento Inicial" value={payments[0]?.due_date ? formatDate(payments[0].due_date) : "—"} light />
                             <DataCol label="Status" value="Aguardando" light />
                          </div>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400">Fluxo de Pagamentos</h4>
                       <div className="grid gap-2">
                          {payments.map((p: any, i: number) => (
                            <div key={p.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                               <div className="flex items-center gap-4">
                                  <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-400">#{i + 1}</div>
                                  <p className="text-sm font-bold text-slate-800">{formatBRL(p.amount)}</p>
                               </div>
                               <div className="flex items-center gap-6">
                                  <p className="text-[11px] font-bold text-slate-500 uppercase">{formatDate(p.due_date)}</p>
                                  <Badge variant="outline" className="text-[9px] font-bold tracking-widest bg-amber-50 text-amber-600 border-amber-100">PENDENTE</Badge>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                  </div>
                )}

                {currentStep === 5 && (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-10 py-10">
                     <div className="relative">
                        <div className="size-32 rounded-[40px] bg-emerald-500/10 flex items-center justify-center text-emerald-600 animate-pulse">
                           <ShieldCheck className="size-16" />
                        </div>
                        <div className="absolute -bottom-4 -right-4 size-12 rounded-2xl bg-white border border-slate-100 shadow-xl flex items-center justify-center animate-bounce">
                           <Sparkles className="size-6 text-indigo-600" />
                        </div>
                     </div>
                     <div className="space-y-4">
                        <h4 className="text-2xl font-bold text-slate-900 font-display">Solicitação de Acesso em Análise</h4>
                        <p className="text-slate-500 max-w-sm mx-auto font-medium leading-relaxed">
                          Confirmamos o recebimento de todos os seus dados. Nossa equipe técnica está validando cada informação para liberar seu dashboard completo.
                        </p>
                     </div>
                     <div className="flex items-center gap-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl max-w-md">
                        <Headphones className="size-5 text-indigo-600 shrink-0" />
                        <p className="text-[11px] text-indigo-700 font-bold uppercase tracking-widest leading-relaxed">
                          Precisando de algo? <br/> suporte@prosper.com.br
                        </p>
                     </div>
                  </div>
                )}
              </div>

              {/* Navigation Footer */}
              <div className="p-8 lg:p-10 border-t border-slate-50 flex items-center justify-between bg-white sticky bottom-0">
                <Button 
                  variant="ghost" 
                  disabled={currentStep === 1 || completeMutation.isPending}
                  onClick={async () => {
                    const { error } = await supabase.from("profiles").update({ onboarding_step: currentStep - 1 } as any).eq("id", user!.id);
                    if (!error) qc.invalidateQueries({ queryKey: ["onboarding-data-v2"] });
                  }}
                  className="rounded-2xl h-12 px-8 text-xs font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors"
                >
                  Anterior
                </Button>

                <div className="flex items-center gap-6">
                   <div className="hidden sm:flex flex-col items-end">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Progresso</p>
                      <p className="text-xs font-bold text-indigo-600">{Math.round(progress)}% Concluído</p>
                   </div>
                   
                   <Button 
                     className="rounded-2xl h-14 px-10 bg-slate-900 hover:bg-indigo-600 transition-all font-bold gap-4 shadow-2xl shadow-slate-200 text-sm tracking-tight"
                     disabled={completeMutation.isPending || (currentStep === 5)}
                     onClick={async () => {
                       if (currentStep < totalSteps - 1) {
                         const { error } = await supabase.from("profiles").update({ onboarding_step: currentStep + 1 } as any).eq("id", user!.id);
                         if (!error) qc.invalidateQueries({ queryKey: ["onboarding-data-v2"] });
                       } else if (currentStep === totalSteps - 1) {
                         completeMutation.mutate();
                       }
                     }}
                   >
                     {currentStep === totalSteps - 1 ? "SOLICITAR ATIVAÇÃO" : "CONTINUAR JORNADA"}
                     <ArrowRight className="size-4" />
                   </Button>
                </div>
              </div>

            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-4 animate-fade-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center gap-3">
               <ShieldCheck className="size-4 text-emerald-500" />
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protocolo Seguro de Dados AES-256</p>
            </div>
            <div className="flex items-center gap-8">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors">Privacidade</p>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors">Termos de Uso</p>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors">Ajuda</p>
            </div>
          </div>
        </div>
      </main>
      
      {/* Scroll Progress Bar at very top */}
      <div className="fixed top-0 left-0 w-full h-[3px] bg-slate-50 z-[100]">
         <div className="h-full bg-indigo-600 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100/50 pb-3 last:border-0 last:pb-0">
      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <span className="text-sm font-bold text-slate-900 truncate">{value || "—"}</span>
    </div>
  );
}

function DataCol({ label, value, light }: { label: string; value: any; light?: boolean }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <p className={cn("text-[10px] font-bold uppercase tracking-widest opacity-40", light ? "text-white" : "text-slate-500")}>{label}</p>
      <p className={cn("text-lg font-bold truncate tracking-tight font-display", light ? "text-white" : "text-slate-900")}>{value}</p>
    </div>
  );
}

function DocStatusBadge({ status }: { status: string }) {
  const map: any = {
    pending: { label: "PENDENTE", className: "bg-amber-50 text-amber-600 border-amber-100" },
    submitted: { label: "EM ANÁLISE", className: "bg-blue-50 text-blue-600 border-blue-100" },
    reviewing: { label: "REVISANDO", className: "bg-indigo-50 text-indigo-600 border-indigo-100" },
    approved: { label: "APROVADO", className: "bg-emerald-50 text-emerald-600 border-emerald-100" },
    rejected: { label: "REJEITADO", className: "bg-rose-50 text-rose-600 border-rose-100" },
  };
  const cfg = map[status] || map.pending;
  return (
    <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest border px-2 py-0.5", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}
