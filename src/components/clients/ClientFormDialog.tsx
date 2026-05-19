import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Eye, EyeOff, Sparkles, Copy, FileText, Plus, X, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { MaskedInput } from "@/components/ui/masked-input";
import { onlyDigits, maskCPFCNPJ, maskPhoneBR, maskCEP } from "@/lib/masks";
import { isValidCPFOrCNPJ, isValidPhoneBR, lookupCEP } from "@/lib/validators";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
  client?: any;
}

export function ClientFormDialog({ open, onOpenChange, onCreated, client }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({ status: "novo_cliente", source: "cadastro_manual", priority: "media" });

  // Acesso ao painel (apenas no cadastro novo)
  const [createAccess, setCreateAccess] = useState(false);
  const [accessPwd, setAccessPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  // Onboarding settings
  const [selectedTemplateDocs, setSelectedTemplateDocs] = useState<string[]>([]);
  const [customDocs, setCustomDocs] = useState<string[]>([]);
  const [newDocInput, setNewDocInput] = useState("");
  const [mandatorySteps, setMandatorySteps] = useState<string[]>(["confirm_data", "upload_docs", "sign_contracts", "initial_payment"]);
  const [manualApproval, setManualApproval] = useState(false);

  useEffect(() => {
    if (client) setForm(client);
    else setForm({ status: "ativo" });
    setCreateAccess(false);
    setAccessPwd("");
    setSelectedTemplateDocs([]);
    setCustomDocs([]);
    setNewDocInput("");
    setManualApproval(false);
  }, [client, open]);

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
    p += "!" + Math.floor(Math.random() * 90 + 10);
    setAccessPwd(p);
    setShowPwd(true);
  };

  const { data: partners } = useQuery({
    queryKey: ["partners-select"],
    queryFn: async () => (await supabase.from("partners").select("id, full_name").eq("active", true).order("full_name")).data ?? [],
  });
  const { data: referrers } = useQuery({
    queryKey: ["referrers-select"],
    queryFn: async () => (await supabase.from("referrers").select("id, full_name").eq("active", true).order("full_name")).data ?? [],
  });
  const { data: collaborators } = useQuery({
    queryKey: ["collaborators-select"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["vendedor", "admin", "colaborador"]);
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids).order("full_name");
      return data ?? [];
    },
  });
  const { data: serviceProviders } = useQuery({
    queryKey: ["service-providers-select"],
    queryFn: async () => {
      const { data } = await supabase.from("service_providers").select("id, name").eq("active", true).order("name");
      return (data ?? []).map((p: any) => ({ id: p.id, full_name: p.name }));
    },
  });

  const { data: docTemplates } = useQuery({
    queryKey: ["doc-templates-setting"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("value").eq("key", "doc_templates").maybeSingle();
      const raw = (data?.value as any);
      const arr = Array.isArray(raw) ? raw : (raw?.items ?? raw?.value ?? []);
      return (arr as any[])
        .map((it: any) => (typeof it === "string" ? it : it?.label ?? it?.name))
        .filter(Boolean) as string[];
    },
  });

  const toggleTemplate = (name: string) =>
    setSelectedTemplateDocs((p) => (p.includes(name) ? p.filter((d) => d !== name) : [...p, name]));
  const addCustomDoc = () => {
    const v = newDocInput.trim();
    if (!v) return;
    setCustomDocs((p) => [...p, v]);
    setNewDocInput("");
  };

  const submit = async () => {
    if (!form.full_name) {
      toast.error("Nome obrigatório");
      return;
    }

    // Se CEP preenchido mas endereço vazio, tenta buscar antes de salvar
    if (form.address_zip_code && !form.address_street) {
      const r = await lookupCEP(form.address_zip_code);
      if (r) {
        form.address_street = r.logradouro;
        form.address_neighborhood = r.bairro;
        form.city = r.localidade;
        form.state = r.state || r.uf;
      }
    }

    if (!client?.id && createAccess) {
      if (!form.email) { toast.error("Email obrigatório para criar acesso"); return; }
      if (!accessPwd || accessPwd.length < 8) { toast.error("Senha deve ter no mínimo 8 caracteres"); return; }
    }

    setSubmitting(true);
    // Validações de máscara
    if (form.document && !isValidCPFOrCNPJ(form.document)) {
      toast.error("CPF/CNPJ inválido"); return;
    }
    if (form.phone && !isValidPhoneBR(form.phone)) {
      toast.error("Telefone inválido"); return;
    }

    const payload = {
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone ? onlyDigits(form.phone) : null,
      document: form.document ? onlyDigits(form.document) : null,
      company: form.company || null,
      address: form.address || null,
      address_street: form.address_street || null,
      address_number: form.address_number || null,
      address_neighborhood: form.address_neighborhood || null,
      address_zip_code: form.address_zip_code ? onlyDigits(form.address_zip_code) : null,
      city: form.city || null,
      state: form.state || null,
      status: form.status,
      partner_id: form.partner_id || null,
      referrer_id: form.referrer_id || null,
      collaborator_id: form.collaborator_id || null,
      service_provider_id: form.service_provider_id || null,
      origin: form.origin || null,
      contract_value: form.contract_value || null,
      commission_value: form.commission_value || null,
      partner_commission_percent: form.partner_commission_percent ? Number(form.partner_commission_percent) : null,
      referrer_commission_percent: form.referrer_commission_percent ? Number(form.referrer_commission_percent) : null,
      collaborator_commission_percent: form.collaborator_commission_percent ? Number(form.collaborator_commission_percent) : null,
      payment_status: form.payment_status || "pendente",
      notes: form.notes || null,
      tags: form.tags ?? [],
      health_score: form.health_score || 100,
      churn_risk: form.churn_risk || "Baixo",
      created_by: user?.id,
    };

    let clientId = client?.id as string | undefined;
    if (clientId) {
      const { error } = await supabase.from("clients").update(payload).eq("id", clientId);
      if (error) { setSubmitting(false); toast.error(error.message); return; }
    } else {
      const { data: created, error } = await supabase.from("clients").insert(payload).select("id").single();
      if (error) { setSubmitting(false); toast.error(error.message); return; }
      clientId = created.id;
    }

    // Garante que o colaborador escolhido no cliente também passe a enxergar demandas
    // já existentes sem responsável definido.
    if (clientId && form.collaborator_id) {
      await supabase
        .from("client_products")
        .update({ responsible_employee_id: form.collaborator_id })
        .eq("client_id", clientId)
        .is("responsible_employee_id", null);
    }

    // Onboarding setup
    if (clientId) {
      const shouldReleaseAccess = createAccess && !manualApproval;
      const { error: profErr } = await supabase.from("profiles").update({
        onboarding_completed: shouldReleaseAccess,
        onboarding_step: 1,
        manual_approval_required: manualApproval,
      } as any).eq("id", clientId); // user_id is profile id usually in this system
      if (shouldReleaseAccess) {
        await supabase.from("clients").update({ onboarding_status: "concluido", onboarding_progress: 100 } as any).eq("id", clientId);
      }

      const allDocs = [...selectedTemplateDocs, ...customDocs];
      if (allDocs.length > 0) {
        const rows = allDocs.map((name) => ({
          client_id: clientId!,
          name: name,
          is_required: true,
          status: "pending",
        }));
        await supabase.from("onboarding_documents").insert(rows);
      }
    }


    // Cria acesso ao painel via edge function (apenas no novo + checkbox marcado)
    if (!client?.id && createAccess && clientId) {
      const { error: invErr } = await supabase.functions.invoke("invite-user", {
        body: {
          email: form.email,
          full_name: form.full_name,
          phone: form.phone || null,
          role: "cliente",
          send_invite: false,
          password: accessPwd,
          link_client_id: clientId,
          onboarding_completed: !manualApproval,
          manual_approval_required: manualApproval,
        },
      });
      if (invErr) {
        setSubmitting(false);
        toast.warning("Cliente criado, mas o acesso falhou: " + invErr.message);
        onCreated?.();
        return;
      }
      try { await navigator.clipboard.writeText(`Email: ${form.email}\nSenha: ${accessPwd}`); } catch {}
      toast.success(`Acesso criado para ${form.email}`, {
        description: `Senha: ${accessPwd} (copiada para a área de transferência)`,
        duration: 20000,
      });
    } else {
      toast.success(client?.id ? "Cliente atualizado" : "Cliente cadastrado");
    }

    setSubmitting(false);
    // Invalida caches dos painéis impactados pelos vínculos (parceiro, indicador, colaborador, prestador)
    [
      "clients", "client", "client-collaborator", "client-provider", "client-referrer",
      "collab-assigned-clients", "collab-demandas", "collab-tasks", "collab-clients",
      "provider-self", "provider-client-products", "provider-documents",
      "referrer-panel",
      "partner-panel",
      "demands", "demands-list", "tasks", "tasks-list", "commissions", "commissions-list",
    ].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
    onCreated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[calc(100svh-1rem)] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{client?.id ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>Cadastre os dados do cliente. Você pode opcionalmente já criar o acesso ao painel.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="col-span-2 space-y-2">
            <Label>Nome completo *</Label>
            <Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <MaskedInput mask="phone" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(11) 99999-9999" />
          </div>
          <div className="space-y-2">
            <Label>CPF/CNPJ</Label>
            <MaskedInput mask="cpfcnpj" value={form.document ?? ""} onChange={(v) => setForm({ ...form, document: v })} placeholder="000.000.000-00" />
          </div>
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Input value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-3 space-y-2">
              <Label>Logradouro</Label>
              <Input value={form.address_street ?? ""} onChange={(e) => setForm({ ...form, address_street: e.target.value })} placeholder="Ex: Av. Paulista" />
            </div>
            <div className="space-y-2">
              <Label>Nº</Label>
              <Input value={form.address_number ?? ""} onChange={(e) => setForm({ ...form, address_number: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input value={form.address_neighborhood ?? ""} onChange={(e) => setForm({ ...form, address_neighborhood: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>CEP</Label>
            <MaskedInput
              mask="cep"
              value={form.address_zip_code ?? ""}
              onChange={(v) => setForm({ ...form, address_zip_code: v })}
              onBlur={async () => {
                const r = await lookupCEP(form.address_zip_code ?? "");
                if (r) {
                  setForm((p: any) => ({
                    ...p,
                    address_street: p.address_street || r.logradouro,
                    address_neighborhood: p.address_neighborhood || r.bairro,
                    city: p.city || r.localidade,
                    state: p.state || r.uf,
                  }));
                  toast.success("Endereço preenchido pelo CEP");
                }
              }}
              placeholder="00000-000"
            />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Input value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Parceiro</Label>
            <Select value={form.partner_id ?? "none"} onValueChange={(v) => setForm({ ...form, partner_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Sem parceiro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem parceiro</SelectItem>
                {partners?.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Comissão parceiro (%)</Label>
            <Input type="number" step="0.01" min="0" max="100" placeholder="Ex: 10"
              value={form.partner_commission_percent ?? ""}
              disabled={!form.partner_id}
              onChange={(e) => setForm({ ...form, partner_commission_percent: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Indicador</Label>
            <Select value={form.referrer_id ?? "none"} onValueChange={(v) => setForm({ ...form, referrer_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Sem indicador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem indicador</SelectItem>
                {referrers?.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Comissão indicador (%)</Label>
            <Input type="number" step="0.01" min="0" max="100" placeholder="Ex: 5"
              value={form.referrer_commission_percent ?? ""}
              disabled={!form.referrer_id}
              onChange={(e) => setForm({ ...form, referrer_commission_percent: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Colaborador responsável</Label>
            <Select value={form.collaborator_id ?? "none"} onValueChange={(v) => setForm({ ...form, collaborator_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Sem colaborador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem colaborador</SelectItem>
                {collaborators?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name ?? c.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Comissão colaborador (%)</Label>
            <Input type="number" step="0.01" min="0" max="100" placeholder="Ex: 3"
              value={form.collaborator_commission_percent ?? ""}
              disabled={!form.collaborator_id}
              onChange={(e) => setForm({ ...form, collaborator_commission_percent: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Prestador de serviço</Label>
            <Select value={form.service_provider_id ?? "none"} onValueChange={(v) => setForm({ ...form, service_provider_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Sem prestador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem prestador</SelectItem>
                {serviceProviders?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Origem do cliente *</Label>
            <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cadastro_manual">Cadastro manual</SelectItem>
                <SelectItem value="indicacao_parceiro">Indicação de parceiro</SelectItem>
                <SelectItem value="indicacao_cliente">Indicação de cliente</SelectItem>
                <SelectItem value="indicacao_colaborador">Indicação de colaborador</SelectItem>
                <SelectItem value="trafego_pago">Tráfego pago</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="site">Site</SelectItem>
                <SelectItem value="organico">Orgânico</SelectItem>
                <SelectItem value="prospeccao_ativa">Prospecção ativa</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status do Cliente</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="novo_cliente">Novo Cliente</SelectItem>
                <SelectItem value="aguardando_atendimento">Aguardando atendimento</SelectItem>
                <SelectItem value="aguardando_documentos">Aguardando documentos</SelectItem>
                <SelectItem value="documentos_enviados">Documentos enviados</SelectItem>
                <SelectItem value="documentos_analise">Documentos em análise</SelectItem>
                <SelectItem value="documentos_aprovados">Documentos aprovados</SelectItem>
                <SelectItem value="documentos_reprovados">Documentos reprovados</SelectItem>
                <SelectItem value="aguardando_contrato">Aguardando contrato</SelectItem>
                <SelectItem value="contrato_enviado">Contrato enviado</SelectItem>
                <SelectItem value="contrato_assinado">Contrato assinado</SelectItem>
                <SelectItem value="pagamento_pendente">Pagamento pendente</SelectItem>
                <SelectItem value="pagamento_parcial">Pagamento parcial</SelectItem>
                <SelectItem value="pagamento_confirmado">Pagamento confirmado</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="aguardando_terceiro">Aguardando terceiro</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
                <SelectItem value="reembolso">Reembolso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor do contrato (R$)</Label>
            <Input type="number" step="0.01" value={form.contract_value ?? ""} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Comissão (R$)</Label>
            <Input type="number" step="0.01" value={form.commission_value ?? ""} onChange={(e) => setForm({ ...form, commission_value: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Status de pagamento</Label>
            <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Engajamento (0-100)</Label>
            <Input type="number" min="0" max="100" value={form.health_score ?? 100} onChange={(e) => setForm({ ...form, health_score: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Risco de Cancelamento</Label>
            <Select value={form.churn_risk ?? "Baixo"} onValueChange={(v) => setForm({ ...form, churn_risk: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Baixo">Baixo</SelectItem>
                <SelectItem value="Médio">Médio</SelectItem>
                <SelectItem value="Alto">Alto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Tags (separadas por vírgula)</Label>
            <Input
              placeholder="VIP, risco, novo, prioridade"
              value={(form.tags ?? []).join(", ")}
              onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map((t: string) => t.trim()).filter(Boolean) })}
            />
            <p className="text-[10px] text-muted-foreground">Sugestões: VIP, risco, novo, prioridade</p>
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Observações internas</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          {/* Pendências de documentos — apenas no cadastro novo */}
          {!client?.id && (
            <div className="sm:col-span-2 space-y-3 p-4 rounded-xl border-2 border-dashed border-amber-300/60 bg-amber-50/40">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-amber-700" />
                <div>
                  <p className="text-sm font-bold">Pendências de documentos</p>
                  <p className="text-[11px] text-muted-foreground">Aparecerão para o cliente no painel assim que ele logar.</p>
                </div>
              </div>

              {docTemplates && docTemplates.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[11px]">Selecione dos templates</Label>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {docTemplates.map((doc) => (
                      <label key={doc} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white cursor-pointer border border-transparent hover:border-amber-200">
                        <Checkbox checked={selectedTemplateDocs.includes(doc)} onCheckedChange={() => toggleTemplate(doc)} />
                        <span className="text-xs">{doc}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-1">
                <Label className="text-[11px]">Adicionar pendência personalizada</Label>
                 <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={newDocInput}
                    onChange={(e) => setNewDocInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomDoc(); } }}
                    placeholder="Ex: Certidão Negativa de Débitos"
                    className="h-9"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addCustomDoc} className="h-9">
                    <Plus className="size-3.5 mr-1" /> Add
                  </Button>
                </div>
                {customDocs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {customDocs.map((doc, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-white border border-amber-200 px-2 py-0.5 rounded-full">
                        {doc}
                        <button type="button" onClick={() => setCustomDocs((p) => p.filter((_, idx) => idx !== i))} className="text-amber-700 hover:text-amber-900">
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {(selectedTemplateDocs.length + customDocs.length) > 0 && (
                <p className="text-[10.5px] font-semibold text-amber-800">
                  {selectedTemplateDocs.length + customDocs.length} documento(s) serão solicitado(s) ao cliente.
                </p>
              )}
            </div>
          )}

          {/* Onboarding Options */}
          {!client?.id && (
            <div className="sm:col-span-2 space-y-3 p-5 rounded-2xl border border-indigo-100 bg-indigo-50/30">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="size-4 text-indigo-600" />
                <h4 className="text-sm font-bold text-indigo-900">Configuração de Onboarding</h4>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-indigo-100">
                <div className="space-y-0.5">
                  <Label className="text-sm cursor-pointer" htmlFor="manual-approval">Aprovação Manual Obrigatória</Label>
                  <p className="text-[10px] text-muted-foreground">O acesso ao painel só é liberado após o admin validar tudo.</p>
                </div>
                <Switch id="manual-approval" checked={manualApproval} onCheckedChange={setManualApproval} />
              </div>
              <div className="space-y-2 pt-1">
                <Label className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">Etapas Obrigatórias</Label>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: "confirm_data", label: "Confirmar Dados" },
                    { id: "upload_docs", label: "Enviar Documentos" },
                    { id: "sign_contracts", label: "Assinar Contratos" },
                    { id: "initial_payment", label: "Pagamento Inicial" },
                  ].map((step) => (
                    <div key={step.id} className="flex items-center gap-2">
                      <Checkbox 
                        id={`step-${step.id}`} 
                        checked={mandatorySteps.includes(step.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setMandatorySteps(prev => [...prev, step.id]);
                          else setMandatorySteps(prev => prev.filter(s => s !== step.id));
                        }}
                      />
                      <Label htmlFor={`step-${step.id}`} className="text-xs cursor-pointer">{step.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Acesso ao painel — apenas no cadastro novo */}
          {!client?.id && (
            <div className="sm:col-span-2 space-y-3 p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.03]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="size-4 text-primary" />
                  <div>
                    <p className="text-sm font-bold">Criar acesso ao painel</p>
                    <p className="text-[11px] text-muted-foreground">Cliente loga em /auth com email + senha que você definir.</p>
                  </div>
                </div>
                <Switch checked={createAccess} onCheckedChange={setCreateAccess} />
              </div>

              {createAccess && (
                <div className="space-y-3 pt-2 border-t border-primary/20">
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Email do cliente *</Label>
                    <Input
                      type="email"
                      value={form.email ?? ""}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="cliente@empresa.com"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Senha de acesso *</Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showPwd ? "text" : "password"}
                          value={accessPwd}
                          onChange={(e) => setAccessPwd(e.target.value)}
                          placeholder="Mínimo 8 caracteres"
                          className="h-9 pr-9 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd(!showPwd)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={generatePassword} className="gap-1.5 h-9">
                        <Sparkles className="size-3.5" /> Gerar
                      </Button>
                      {accessPwd && (
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9"
                          onClick={() => { navigator.clipboard.writeText(accessPwd); toast.success("Senha copiada"); }}>
                          <Copy className="size-3.5" />
                        </Button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Após salvar, email + senha são copiados para sua área de transferência.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting} className="bg-gradient-primary hover:opacity-90">{submitting ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
