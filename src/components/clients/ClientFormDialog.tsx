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

const ONBOARDING_STEPS = [
  { id: "confirm_data", label: "Confirmar Dados" },
  { id: "upload_docs", label: "Enviar Documentos" },
  { id: "sign_contracts", label: "Assinar Contratos" },
  { id: "initial_payment", label: "Pagamento Inicial" },
];

// Promise com timeout — evita "Salvando..." infinito quando a função fica pendurada
function withTimeout<T>(p: Promise<T>, ms: number, label = "operação"): Promise<T> {
  return Promise.race<T>([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Tempo esgotado em ${label} (${ms}ms)`)), ms)),
  ]);
}

export function ClientFormDialog({ open, onOpenChange, onCreated, client }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({ status: "novo_cliente", source: "cadastro_manual" });

  // Acesso ao painel (apenas no cadastro novo)
  const [createAccess, setCreateAccess] = useState(false);
  const [accessPwd, setAccessPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  // Onboarding settings (apenas no cadastro novo)
  const [selectedTemplateDocs, setSelectedTemplateDocs] = useState<string[]>([]);
  const [customDocs, setCustomDocs] = useState<string[]>([]);
  const [newDocInput, setNewDocInput] = useState("");
  const [mandatorySteps, setMandatorySteps] = useState<string[]>(["confirm_data", "upload_docs", "sign_contracts", "initial_payment"]);
  const [manualApproval, setManualApproval] = useState(false);

  // Produtos contratados (apenas no cadastro novo)
  const [selectedProducts, setSelectedProducts] = useState<Array<{ product_id: string; value: string; deadline: string }>>([]);

  useEffect(() => {
    if (client) setForm(client);
    else setForm({ status: "novo_cliente", source: "cadastro_manual" });
    setCreateAccess(false);
    setAccessPwd("");
    setSelectedTemplateDocs([]);
    setCustomDocs([]);
    setNewDocInput("");
    setManualApproval(false);
    setMandatorySteps(["confirm_data", "upload_docs", "sign_contracts", "initial_payment"]);
    setSelectedProducts([]);
  }, [client, open]);

  const generatePassword = () => {
    setAccessPwd(generateSecurePassword(12));
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
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "colaborador");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids).order("full_name");
      return data ?? [];
    },
  });

  const { data: providers } = useQuery({
    queryKey: ["providers-select-active"],
    queryFn: async () => (await supabase.from("service_providers").select("id, name, specialty").eq("active", true).order("name")).data ?? [],
  });

  const { data: productsList } = useQuery({
    queryKey: ["products-select-active"],
    queryFn: async () => (await supabase.from("products").select("id, name, base_price").eq("active", true).order("name")).data ?? [],
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
    if (submitting) return;

    if (!form.full_name?.trim()) {
      toast.error("Nome obrigatório");
      return;
    }

    if (form.document && !isValidCPFOrCNPJ(form.document)) {
      toast.error("CPF/CNPJ inválido"); return;
    }
    if (form.phone && !isValidPhoneBR(form.phone)) {
      toast.error("Telefone inválido"); return;
    }

    if (!client?.id && createAccess) {
      if (!form.email) { toast.error("Email obrigatório para criar acesso"); return; }
      if (!accessPwd || accessPwd.length < 8) { toast.error("Senha deve ter no mínimo 8 caracteres"); return; }
    }

    setSubmitting(true);

    try {
      // CEP lookup defensivo
      if (form.address_zip_code && !form.address_street) {
        try {
          const r = await withTimeout(lookupCEP(form.address_zip_code), 6000, "consulta de CEP");
          if (r) {
            form.address_street = r.logradouro;
            form.address_neighborhood = r.bairro;
            form.city = r.localidade;
            form.state = r.uf;
          }
        } catch (e) {
          console.warn("CEP lookup falhou, seguindo sem preencher:", e);
        }
      }

      // Duplicidade
      if (form.email || form.document) {
        const cleanDoc = form.document ? onlyDigits(form.document) : null;
        const checks: Array<{ data: any[] | null }> = [];
        if (form.email) {
          let q = supabase.from("clients").select("id").eq("email", form.email).limit(1);
          if (client?.id) q = q.neq("id", client.id);
          checks.push(await q);
        }
        if (cleanDoc) {
          let q = supabase.from("clients").select("id").eq("document", cleanDoc).limit(1);
          if (client?.id) q = q.neq("id", client.id);
          checks.push(await q);
        }
        if (checks.find((r) => (r.data?.length ?? 0) > 0)) {
          toast.error("Já existe um cliente cadastrado com este email ou documento");
          return;
        }
      }

      const payload: any = {
        full_name: form.full_name.trim(),
        email: form.email || null,
        phone: form.phone ? onlyDigits(form.phone) : null,
        document: form.document ? onlyDigits(form.document) : null,
        company: form.company || null,
        birth_date: form.birth_date || null,
        address_street: form.address_street || null,
        address_number: form.address_number || null,
        address_complement: form.address_complement || null,
        address_neighborhood: form.address_neighborhood || null,
        address_zip_code: form.address_zip_code ? onlyDigits(form.address_zip_code) : null,
        city: form.city || null,
        state: form.state || null,
        status: form.status || "novo_cliente",
        source: form.source || "cadastro_manual",
        partner_id: form.partner_id || null,
        referrer_id: form.referrer_id || null,
        collaborator_id: form.collaborator_id || null,
        service_provider_id: form.service_provider_id || null,
        responsible_id: form.collaborator_id || null,
        notes: form.notes || null,
        mandatory_steps: mandatorySteps,
        manual_approval_required: manualApproval,
        created_by: user?.id,
      };

      let clientId = client?.id as string | undefined;
      if (clientId) {
        const { error } = await supabase.from("clients").update(payload).eq("id", clientId);
        if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
      } else {
        const { data: created, error } = await supabase.from("clients").insert(payload).select("id").single();
        if (error) { toast.error("Erro ao cadastrar: " + error.message); return; }
        clientId = created.id;
      }

      // Propaga colaborador para demandas sem responsável
      if (clientId && form.collaborator_id) {
        const { error: cpUpErr } = await supabase
          .from("client_products")
          .update({ responsible_employee_id: form.collaborator_id })
          .eq("client_id", clientId)
          .is("responsible_employee_id", null);
        if (cpUpErr) console.warn("Vínculo colaborador-demandas:", cpUpErr);
      }

      if (clientId && form.service_provider_id) {
        const { error: providerUpErr } = await supabase
          .from("client_products")
          .update({ service_provider_id: form.service_provider_id })
          .eq("client_id", clientId)
          .is("service_provider_id", null);
        if (providerUpErr) console.warn("Vínculo prestador-demandas:", providerUpErr);
      }

      // Produtos contratados (cadastro novo)
      if (!client?.id && clientId && selectedProducts.length > 0) {
        const valid = selectedProducts.filter((p) => p.product_id);
        if (valid.length > 0) {
          const rows = valid.map((p) => ({
            client_id: clientId!,
            product_id: p.product_id,
            value: p.value ? Number(p.value) : null,
            custom_value: p.value ? Number(p.value) : null,
            deadline: p.deadline || null,
            status: "aguardando_inicio",
            responsible_employee_id: form.collaborator_id || null,
            service_provider_id: form.service_provider_id || null,
          }));
          const { error: prodErr } = await supabase.from("client_products").insert(rows);
          if (prodErr) {
            console.warn("Produtos do cliente:", prodErr);
            toast.warning("Cliente criado, mas houve erro ao vincular produtos: " + prodErr.message);
          }
        }
      }


      // Pendências de documentos (cadastro novo)
      if (!client?.id && clientId) {
        const allDocs = [...selectedTemplateDocs, ...customDocs];
        if (allDocs.length > 0) {
          // Check for existing to avoid duplicates if something retried
          const { data: existing } = await supabase.from("onboarding_documents").select("name").eq("client_id", clientId);
          const existingNames = new Set((existing ?? []).map(e => e.name));
          
          const rows = allDocs
            .filter(name => !existingNames.has(name))
            .map((name) => ({
              client_id: clientId!,
              name,
              is_required: true,
              status: "pending",
            }));
          if (rows.length > 0) {
            const { error: docErr } = await supabase.from("onboarding_documents").insert(rows);
            if (docErr) console.warn("Onboarding docs:", docErr);
          }
        }
      }

      // Acesso ao painel (cadastro novo + switch ligado)
      if (!client?.id && createAccess && clientId) {
        try {
          const result: any = await withTimeout(
            supabase.functions.invoke("invite-user", {
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
            }) as any,
            15000,
            "criação de acesso"
          );
          if (result?.error) {
            toast.warning("Cliente criado, mas o acesso falhou: " + result.error.message);
          } else {
            try { await navigator.clipboard.writeText(`Email: ${form.email}\nSenha: ${accessPwd}`); } catch {}
            toast.success(`Acesso criado para ${form.email}`, {
              description: `Senha: ${accessPwd} (copiada para a área de transferência)`,
              duration: 20000,
            });
          }
        } catch (e: any) {
          toast.warning("Cliente criado, mas o acesso travou: " + (e?.message || "tempo esgotado"));
        }
      } else {
        toast.success(client?.id ? "Cliente atualizado" : "Cliente cadastrado");
      }

      // Invalida caches
      [
        "clients", "client", "client-collaborator", "client-referrer",
        "collab-assigned-clients", "collab-demandas", "collab-tasks", "collab-clients",
        "referrer-panel", "partner-panel",
        "demands", "demands-list", "tasks", "tasks-list",
      ].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));

      onCreated?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("[ClientFormDialog] erro inesperado:", err);
      toast.error(err?.message || "Erro inesperado ao salvar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[calc(100svh-1rem)] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{client?.id ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            Cadastre os dados do cliente. Comissões e valores ficam no fluxo de <strong>Vendas</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 py-4">
          {/* DADOS PESSOAIS */}
          <div className="col-span-1 sm:col-span-2 space-y-2">
            <Label className="text-[13px] font-semibold text-slate-700">Nome completo *</Label>
            <Input className="h-10 rounded-lg border-slate-200" value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold text-slate-700">Email</Label>
            <Input className="h-10 rounded-lg border-slate-200" type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold text-slate-700">Telefone</Label>
            <MaskedInput className="h-10 rounded-lg border-slate-200" mask="phone" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(11) 99999-9999" />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold text-slate-700">CPF/CNPJ</Label>
            <MaskedInput className="h-10 rounded-lg border-slate-200" mask="cpfcnpj" value={form.document ?? ""} onChange={(v) => setForm({ ...form, document: v })} placeholder="000.000.000-00" />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold text-slate-700">Empresa</Label>
            <Input className="h-10 rounded-lg border-slate-200" value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold text-slate-700">Data de nascimento</Label>
            <Input className="h-10 rounded-lg border-slate-200" type="date" value={form.birth_date ?? ""} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
          </div>

          {/* ENDEREÇO */}
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>CEP</Label>
              <MaskedInput
                mask="cep"
                value={form.address_zip_code ?? ""}
                onChange={(v) => setForm({ ...form, address_zip_code: v })}
                onBlur={async () => {
                  try {
                    const r = await withTimeout(lookupCEP(form.address_zip_code ?? ""), 6000, "CEP");
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
                  } catch {}
                }}
                placeholder="00000-000"
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
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
            <Label>Complemento</Label>
            <Input value={form.address_complement ?? ""} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Input value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </div>

          {/* CLASSIFICAÇÃO */}
          <div className="space-y-2">
            <Label>Origem do cliente</Label>
            <Select value={form.source ?? "cadastro_manual"} onValueChange={(v) => setForm({ ...form, source: v })}>
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
            <Label>Status</Label>
            <Select value={form.status ?? "novo_cliente"} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="novo_cliente">Novo cliente</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* VÍNCULOS */}
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
            <Label>Prestador padrão</Label>
            <Select value={form.service_provider_id ?? "none"} onValueChange={(v) => setForm({ ...form, service_provider_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Sem prestador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem prestador</SelectItem>
                {providers?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}{p.specialty ? ` · ${p.specialty}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2 -mt-2">
            <p className="text-[11px] text-muted-foreground">
              Esses vínculos alimentam automaticamente o painel do parceiro, do prestador, do colaborador e as demandas abertas.
            </p>
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label>Observações internas</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          {/* PRODUTOS CONTRATADOS — só cadastro novo */}
          {!client?.id && (
            <div className="sm:col-span-2 space-y-3 p-4 rounded-xl border-2 border-dashed border-indigo-300/60 bg-indigo-50/40">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-indigo-700" />
                  <div>
                    <p className="text-sm font-bold">Produtos contratados</p>
                    <p className="text-[11px] text-muted-foreground">Crie as demandas iniciais já vinculadas a este cliente.</p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 text-xs"
                  onClick={() => setSelectedProducts((p) => [...p, { product_id: "", value: "", deadline: "" }])}
                >
                  <Plus className="size-3.5" /> Adicionar produto
                </Button>
              </div>

              {selectedProducts.length === 0 && (
                <p className="text-[12px] text-slate-500 italic">Nenhum produto adicionado. (Opcional — você pode contratar depois.)</p>
              )}

              {selectedProducts.map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-white rounded-lg p-2 border border-indigo-200/60">
                  <div className="col-span-12 sm:col-span-5 space-y-1">
                    <Label className="text-[11px]">Produto</Label>
                    <Select
                      value={row.product_id || undefined}
                      onValueChange={(v) => {
                        const prod = productsList?.find((p: any) => p.id === v);
                        setSelectedProducts((arr) => arr.map((r, i) => i === idx ? {
                          ...r,
                          product_id: v,
                          value: r.value || (prod?.base_price ? String(prod.base_price) : ""),
                        } : r));
                      }}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {productsList?.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-6 sm:col-span-3 space-y-1">
                    <Label className="text-[11px]">Valor (R$)</Label>
                    <Input
                      className="h-9"
                      type="number"
                      step="0.01"
                      value={row.value}
                      onChange={(e) => setSelectedProducts((arr) => arr.map((r, i) => i === idx ? { ...r, value: e.target.value } : r))}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3 space-y-1">
                    <Label className="text-[11px]">Prazo</Label>
                    <Input
                      className="h-9"
                      type="date"
                      value={row.deadline}
                      onChange={(e) => setSelectedProducts((arr) => arr.map((r, i) => i === idx ? { ...r, deadline: e.target.value } : r))}
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 text-rose-600 hover:bg-rose-50"
                      onClick={() => setSelectedProducts((arr) => arr.filter((_, i) => i !== idx))}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PENDÊNCIAS DE DOCUMENTOS — só cadastro novo */}
          {!client?.id && (
            <div className="sm:col-span-2 space-y-3 p-4 rounded-xl border-2 border-dashed border-amber-300/60 bg-amber-50/40">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-amber-700" />
                <div>
                  <p className="text-sm font-bold">Pendências de documentos</p>
                  <p className="text-[11px] text-muted-foreground">Aparecerão no painel do cliente assim que ele logar.</p>
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

          {/* ONBOARDING — só cadastro novo */}
          {!client?.id && (
            <div className="sm:col-span-2 space-y-3 p-5 rounded-2xl border border-indigo-100 bg-indigo-50/30">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="size-4 text-indigo-600" />
                <h4 className="text-sm font-bold text-indigo-900">Configuração de Onboarding</h4>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-indigo-100">
                <div className="space-y-0.5">
                  <Label className="text-sm cursor-pointer" htmlFor="manual-approval">Aprovação manual obrigatória</Label>
                  <p className="text-[10px] text-muted-foreground">O acesso só é liberado depois que um admin validar.</p>
                </div>
                <Switch id="manual-approval" checked={manualApproval} onCheckedChange={setManualApproval} />
              </div>
              <div className="space-y-2 pt-1">
                <Label className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">Etapas obrigatórias</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ONBOARDING_STEPS.map((step) => (
                    <div key={step.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`step-${step.id}`}
                        checked={mandatorySteps.includes(step.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setMandatorySteps((prev) => [...prev, step.id]);
                          else setMandatorySteps((prev) => prev.filter((s) => s !== step.id));
                        }}
                      />
                      <Label htmlFor={`step-${step.id}`} className="text-xs cursor-pointer">{step.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ACESSO AO PAINEL — só cadastro novo */}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting} className="bg-gradient-primary hover:opacity-90">
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
