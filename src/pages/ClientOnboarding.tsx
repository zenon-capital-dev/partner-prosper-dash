import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, ArrowRight, ArrowLeft, Building2, Package,
  FileSignature, CheckCircle2, Headphones, Sparkles,
  Upload, AlertCircle, Loader2, Check, LogOut,
  CreditCard, FileText, Mail, BadgeCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatBRL, formatDate } from "@/lib/format";

const STEPS = [
  { id: 1, label: "Boas-vindas", icon: Sparkles, title: "Bem-vindo ao seu portal.", subtitle: "Configuramos um ambiente exclusivo para acompanhar suas soluções, contratos e pagamentos." },
  { id: 2, label: "Dados & Contratos", icon: Building2, title: "Confirme seus dados.", subtitle: "Valide as informações cadastrais e revise os contratos vinculados às suas soluções." },
  { id: 3, label: "Documentação", icon: FileText, title: "Envie a documentação.", subtitle: "Precisamos de alguns documentos obrigatórios para garantir segurança e conformidade." },
  { id: 4, label: "Financeiro", icon: CreditCard, title: "Resumo financeiro.", subtitle: "Veja o detalhamento das suas parcelas e formas de pagamento." },
  { id: 5, label: "Ativação", icon: ShieldCheck, title: "Estamos validando seus dados.", subtitle: "Nossa equipe está revisando tudo. Em breve você receberá o acesso completo." },
];

export default function ClientOnboarding() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-data-v3", user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      const { data: client } = await supabase.from("clients").select(`*, companies(id, name, trade_name)`).eq("user_id", user!.id).maybeSingle();
      if (!client) return { profile, client: null, prods: [], docs: [], payments: [], contracts: [] };
      const [prods, docs, payments, contracts] = await Promise.all([
        supabase.from("client_products").select("*, products(name)").eq("client_id", client.id),
        supabase.from("onboarding_documents").select("*").eq("client_id", user!.id).order("created_at", { ascending: true }),
        supabase.from("payments").select("*").eq("client_id", client.id).order("due_date", { ascending: true }),
        supabase.from("contracts").select("*").eq("client_id", client.id).order("created_at", { ascending: true }),
      ]);
      return { profile, client, prods: prods.data || [], docs: docs.data || [], payments: payments.data || [], contracts: contracts.data || [] };
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
      const { error: dbErr } = await supabase.from("onboarding_documents").update({
        file_url: path, file_name: file.name, status: "submitted",
        submitted_at: new Date().toISOString(), rejection_reason: null,
      } as any).eq("id", docId);
      if (dbErr) throw dbErr;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["onboarding-data-v3"] }); toast.success("Documento enviado para análise"); },
    onError: (err: any) => toast.error("Erro ao enviar: " + err.message),
    onSettled: () => setUploadingId(null),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ onboarding_step: 5 } as any).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["onboarding-data-v3"] }); toast.success("Jornada concluída! Aguardando ativação."); },
  });

  useEffect(() => {
    if (data?.profile?.onboarding_completed) navigate("/cliente", { replace: true });
  }, [data?.profile?.onboarding_completed, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/60 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="size-8 animate-spin mx-auto text-indigo-600" />
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Carregando portal...</p>
        </div>
      </div>
    );
  }
  if (!data?.profile) return null;

  const { profile, client, prods, docs, payments, contracts } = data;
  const currentStep = Math.max(1, Math.min(profile.onboarding_step || 1, 5));
  const totalSteps = STEPS.length;
  const progress = (currentStep / totalSteps) * 100;
  const stepCfg = STEPS[currentStep - 1];

  const goTo = async (n: number) => {
    if (n < 1 || n > totalSteps) return;
    const { error } = await supabase.from("profiles").update({ onboarding_step: n } as any).eq("id", user!.id);
    if (!error) qc.invalidateQueries({ queryKey: ["onboarding-data-v3"] });
  };

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col font-sans">
      {/* progress bar */}
      <div className="fixed top-0 inset-x-0 h-[3px] bg-slate-100 z-50">
        <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* NAVBAR */}
      <header className="bg-white border-b border-slate-200/70 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-[0_2px_8px_-2px_rgba(79,70,229,0.5)] shrink-0">
              <Package className="size-4.5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-slate-400 leading-none">Onboarding</p>
              <p className="text-[13px] font-bold text-slate-900 mt-0.5 leading-tight truncate">Portal do cliente</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{profile.full_name ? "Olá," : ""}</p>
              <p className="text-[12px] font-semibold text-slate-700 truncate max-w-[180px]">{profile.full_name || profile.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg h-9 px-3 gap-1.5 text-[11.5px] font-semibold"
            >
              <LogOut className="size-3.5" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-5 lg:px-8 py-10 lg:py-14">

        {/* STEP INDICATOR */}
        <nav aria-label="Progresso" className="mb-10">
          <ol className="flex items-center justify-between gap-2">
            {STEPS.map((s, idx) => {
              const isDone = s.id < currentStep;
              const isCurrent = s.id === currentStep;
              return (
                <li key={s.id} className="flex items-center flex-1 last:flex-initial">
                  <button
                    type="button"
                    onClick={() => isDone && goTo(s.id)}
                    disabled={!isDone}
                    className={cn(
                      "flex items-center gap-2.5 group",
                      isDone && "cursor-pointer hover:opacity-80",
                      !isDone && !isCurrent && "cursor-default"
                    )}
                  >
                    <span className={cn(
                      "size-9 rounded-full flex items-center justify-center font-bold text-[12px] tabular-nums transition-all shrink-0 ring-1",
                      isCurrent && "bg-indigo-600 text-white ring-indigo-200 shadow-[0_4px_12px_-2px_rgba(79,70,229,0.45)] scale-105",
                      isDone && "bg-emerald-50 text-emerald-700 ring-emerald-200",
                      !isCurrent && !isDone && "bg-white text-slate-400 ring-slate-200"
                    )}>
                      {isDone ? <Check className="size-4 stroke-[2.5]" /> : s.id}
                    </span>
                    <div className="hidden lg:block text-left">
                      <p className={cn(
                        "text-[10px] font-bold uppercase tracking-[0.14em] leading-none",
                        isCurrent ? "text-indigo-700" : isDone ? "text-emerald-700" : "text-slate-400"
                      )}>
                        Etapa {s.id}
                      </p>
                      <p className={cn(
                        "text-[12px] font-semibold mt-1 leading-none",
                        isCurrent ? "text-slate-900" : isDone ? "text-slate-700" : "text-slate-400"
                      )}>
                        {s.label}
                      </p>
                    </div>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className="flex-1 mx-3 h-[2px] rounded-full bg-slate-200 overflow-hidden">
                      <div className={cn(
                        "h-full transition-all duration-500 rounded-full",
                        s.id < currentStep ? "w-full bg-emerald-400" : "w-0"
                      )} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* TITLE */}
        <div className="mb-8 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-50 ring-1 ring-indigo-100 mb-4">
            <stepCfg.icon className="size-3 text-indigo-600" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-700">
              Etapa {currentStep} de {totalSteps} · {stepCfg.label}
            </span>
          </div>
          <h1 className="font-display text-[30px] lg:text-[36px] font-bold tracking-[-0.025em] text-slate-900 leading-[1.1]">
            {stepCfg.title}
          </h1>
          <p className="text-[14px] text-slate-600 mt-3 leading-relaxed">{stepCfg.subtitle}</p>
        </div>

        {/* CARD */}
        <div className="bg-white border border-slate-200/70 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_28px_-16px_rgba(15,23,42,0.1)] overflow-hidden">
          <div className="p-6 lg:p-8 min-h-[360px]">

            {/* ============ STEP 1 — WELCOME ============ */}
            {currentStep === 1 && (
              <div className="grid md:grid-cols-5 gap-6">
                <div className="md:col-span-3 space-y-5">
                  <div>
                    <SectionLabel>Soluções contratadas</SectionLabel>
                    <div className="mt-3 space-y-2">
                      {prods.length > 0 ? prods.map((p: any) => (
                        <div key={p.id} className="flex items-center gap-3 p-3.5 bg-slate-50/60 rounded-xl border border-slate-200/70 hover:bg-white hover:border-indigo-200 transition-all">
                          <div className="size-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center ring-1 ring-indigo-100 shrink-0">
                            <Package className="size-4 stroke-[2.2]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold text-slate-900 truncate">{p.products?.name || p.custom_product_name || "Solução"}</p>
                            <p className="text-[11px] text-slate-500">Ambiente em preparação</p>
                          </div>
                          <BadgeCheck className="size-4 text-emerald-500 shrink-0" />
                        </div>
                      )) : (
                        <EmptyHint message="Nenhuma solução vinculada ainda." />
                      )}
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="bg-gradient-to-br from-indigo-50 via-white to-white border border-indigo-100/80 rounded-xl p-5 h-full flex flex-col">
                    <div className="size-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white mb-4 shadow-[0_4px_12px_-2px_rgba(79,70,229,0.45)]">
                      <Sparkles className="size-5" />
                    </div>
                    <h4 className="font-display text-[16px] font-bold text-slate-900 mb-2">Ambiente premium</h4>
                    <p className="text-[12.5px] text-slate-600 leading-relaxed">
                      Seu portal está sendo configurado com base nas suas soluções. Ferramentas, relatórios e entregas ficam disponíveis após o onboarding.
                    </p>
                    <div className="mt-auto pt-5 border-t border-slate-200/70 grid grid-cols-2 gap-3">
                      <Pill icon={CheckCircle2} label={`${prods.length} produto(s)`} />
                      <Pill icon={ShieldCheck} label="Seguro AES-256" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============ STEP 2 — DATA + CONTRACTS ============ */}
            {currentStep === 2 && (
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <SectionLabel>Dados cadastrais</SectionLabel>
                  <div className="mt-3 bg-slate-50/60 border border-slate-200/70 rounded-xl divide-y divide-slate-200/60">
                    <DataRow label="Razão social" value={client?.company || profile?.full_name} />
                    <DataRow label="Responsável" value={profile?.full_name} />
                    <DataRow label="E-mail" value={profile?.email} />
                    <DataRow label="Documento" value={client?.document} />
                  </div>
                </div>
                <div>
                  <SectionLabel>Contratos vinculados</SectionLabel>
                  <div className="mt-3 space-y-2">
                    {contracts.length > 0 ? contracts.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 p-3.5 bg-white border border-slate-200/70 rounded-xl hover:border-indigo-200 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-8 rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 flex items-center justify-center shrink-0">
                            <FileSignature className="size-4 stroke-[2.2]" />
                          </div>
                          <p className="text-[13px] font-semibold text-slate-900 truncate">{c.name}</p>
                        </div>
                        <Button size="sm" variant="ghost" className="h-8 rounded-lg text-indigo-600 hover:bg-indigo-50 text-[11px] font-bold uppercase tracking-wider">
                          Ver
                        </Button>
                      </div>
                    )) : (
                      <EmptyHint message="Nenhum contrato gerado ainda." />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ============ STEP 3 — DOCUMENTS ============ */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  {docs.length > 0 ? docs.map((doc: any) => (
                    <div key={doc.id} className="p-5 rounded-xl border border-slate-200/70 bg-white hover:border-indigo-200 hover:shadow-[0_4px_14px_-6px_rgba(15,23,42,0.08)] transition-all flex flex-col">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="text-[13.5px] font-semibold text-slate-900 leading-tight">{doc.name}</h4>
                        <DocStatusBadge status={doc.status} />
                      </div>
                      <p className="text-[11.5px] text-slate-500 leading-relaxed">
                        {doc.description || "Envie uma cópia legível deste documento."}
                      </p>
                      {doc.rejection_reason && (
                        <div className="mt-3 p-2.5 bg-rose-50 border border-rose-100 rounded-lg flex gap-2">
                          <AlertCircle className="size-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <p className="text-[10.5px] text-rose-700"><strong className="font-bold">Reprovado:</strong> {doc.rejection_reason}</p>
                        </div>
                      )}
                      <div className="mt-auto pt-4 flex items-center justify-between gap-3 border-t border-slate-100 mt-4">
                        {doc.file_url ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 text-[10.5px] font-bold uppercase tracking-wider">
                            <CheckCircle2 className="size-3.5" /> Enviado
                          </span>
                        ) : (
                          <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Aguardando</span>
                        )}
                        <Button
                          size="sm"
                          variant={doc.file_url ? "outline" : "default"}
                          className={cn(
                            "rounded-lg h-8 px-3 text-[11px] font-semibold gap-1.5",
                            !doc.file_url && "bg-indigo-600 hover:bg-indigo-700 text-white",
                            doc.file_url && "border-slate-200 text-slate-700 hover:bg-slate-50"
                          )}
                          disabled={uploadingId === doc.id}
                          onClick={() => { setUploadingId(doc.id); fileRef.current?.click(); }}
                        >
                          {uploadingId === doc.id ? <Loader2 className="size-3 animate-spin" /> : doc.file_url ? "Substituir" : (<><Upload className="size-3" /> Enviar</>)}
                        </Button>
                      </div>
                    </div>
                  )) : (
                    <div className="sm:col-span-2"><EmptyHint message="Nenhum documento solicitado." /></div>
                  )}
                </div>
                <input type="file" ref={fileRef} className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && uploadingId) uploadMutation.mutate({ docId: uploadingId, file });
                }} />
              </div>
            )}

            {/* ============ STEP 4 — FINANCIAL ============ */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-white p-6 relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="size-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-[0_4px_12px_-2px_rgba(79,70,229,0.45)]">
                      <CreditCard className="size-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-700">Financeiro</p>
                      <p className="text-[15px] font-bold text-slate-900">Resumo de cobranças</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                    <DataCol label="Total investido" value={formatBRL(payments.reduce((s: any, p: any) => s + Number(p.amount || 0), 0))} highlight />
                    <DataCol label="Parcelas" value={String(payments.length)} />
                    <DataCol label="1º vencimento" value={payments[0]?.due_date ? formatDate(payments[0].due_date) : "—"} />
                    <DataCol label="Status" value="Aguardando" />
                  </div>
                </div>

                <div>
                  <SectionLabel>Fluxo de pagamentos</SectionLabel>
                  <div className="mt-3 space-y-2">
                    {payments.length > 0 ? payments.map((p: any, i: number) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 p-3.5 bg-white border border-slate-200/70 rounded-xl hover:border-slate-300 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-lg bg-slate-50 ring-1 ring-slate-200 flex items-center justify-center text-[10.5px] font-bold text-slate-600 tabular-nums">
                            {String(i + 1).padStart(2, "0")}
                          </div>
                          <div>
                            <p className="text-[13.5px] font-bold text-slate-900 tabular-nums">{formatBRL(p.amount)}</p>
                            <p className="text-[10.5px] text-slate-500 font-medium">Vence em {formatDate(p.due_date)}</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-[10px] font-bold uppercase tracking-wider">
                          <span className="size-1.5 rounded-full bg-amber-500" /> Pendente
                        </span>
                      </div>
                    )) : (
                      <EmptyHint message="Nenhuma parcela registrada ainda." />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ============ STEP 5 — ACTIVATION ============ */}
            {currentStep === 5 && (
              <div className="flex flex-col items-center text-center py-8 px-4">
                <div className="relative mb-6">
                  <div className="size-20 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center text-emerald-600">
                    <ShieldCheck className="size-10 stroke-[1.8]" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 size-8 rounded-xl bg-white border border-slate-200/70 shadow-md flex items-center justify-center">
                    <Sparkles className="size-4 text-indigo-600" />
                  </div>
                </div>
                <h3 className="font-display text-[22px] font-bold text-slate-900 mb-2">Solicitação de acesso em análise</h3>
                <p className="text-[13.5px] text-slate-600 max-w-md leading-relaxed">
                  Confirmamos o recebimento dos seus dados. Nossa equipe técnica está validando cada informação para liberar seu painel completo.
                </p>
                <a
                  href="mailto:suporte@prosper.com.br"
                  className="mt-6 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/70 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors group"
                >
                  <div className="size-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Headphones className="size-3.5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-slate-500">Precisa de algo?</p>
                    <p className="text-[12.5px] font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">suporte@prosper.com.br</p>
                  </div>
                  <Mail className="size-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors ml-2" />
                </a>
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="px-6 lg:px-8 py-4 border-t border-slate-100 flex items-center justify-between gap-4 bg-slate-50/40">
            <Button
              variant="ghost"
              disabled={currentStep === 1 || completeMutation.isPending}
              onClick={() => goTo(currentStep - 1)}
              className="rounded-lg h-10 px-4 text-[12px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-white gap-1.5"
            >
              <ArrowLeft className="size-3.5" /> Anterior
            </Button>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-slate-400 leading-none">Progresso</p>
                <p className="text-[11.5px] font-bold text-indigo-600 tabular-nums mt-0.5">{Math.round(progress)}% concluído</p>
              </div>
              <Button
                disabled={completeMutation.isPending || currentStep === totalSteps}
                onClick={() => {
                  if (currentStep < totalSteps - 1) goTo(currentStep + 1);
                  else if (currentStep === totalSteps - 1) completeMutation.mutate();
                }}
                className="rounded-lg h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-[12.5px] font-semibold gap-2 shadow-[0_2px_4px_rgba(79,70,229,0.25),0_6px_16px_-4px_rgba(79,70,229,0.35)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {currentStep === totalSteps ? "Aguardando ativação" : currentStep === totalSteps - 1 ? "Solicitar ativação" : "Continuar"}
                {currentStep < totalSteps && <ArrowRight className="size-3.5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* FOOTER LEGAL */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-8 text-[10.5px] font-semibold text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            <span className="uppercase tracking-[0.15em]">Protocolo seguro AES-256</span>
          </div>
          <div className="flex items-center gap-5">
            <a className="hover:text-indigo-600 transition-colors uppercase tracking-[0.12em]">Privacidade</a>
            <a className="hover:text-indigo-600 transition-colors uppercase tracking-[0.12em]">Termos de uso</a>
            <a className="hover:text-indigo-600 transition-colors uppercase tracking-[0.12em]">Ajuda</a>
          </div>
        </div>

      </main>
    </div>
  );
}

/* ============ PIECES ============ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{children}</p>;
}

function DataRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-[13px] font-semibold text-slate-900 truncate text-right">{value || "—"}</span>
    </div>
  );
}

function DataCol({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-1.5">{label}</p>
      <p className={cn("font-display font-bold tabular-nums truncate leading-none", highlight ? "text-[20px] text-indigo-700" : "text-[16px] text-slate-900")}>
        {value}
      </p>
    </div>
  );
}

function Pill({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white border border-slate-200/70 text-[10.5px] font-semibold text-slate-600">
      <Icon className="size-3 text-indigo-600" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="py-8 text-center bg-slate-50/60 border border-dashed border-slate-200 rounded-xl">
      <p className="text-[12px] text-slate-400 font-medium">{message}</p>
    </div>
  );
}

function DocStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    pending: { label: "Pendente", cls: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
    submitted: { label: "Em análise", cls: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
    reviewing: { label: "Revisando", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200", dot: "bg-indigo-500" },
    approved: { label: "Aprovado", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
    rejected: { label: "Reprovado", cls: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
  };
  const cfg = map[status] || map.pending;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider ring-1", cfg.cls)}>
      <span className={cn("size-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
