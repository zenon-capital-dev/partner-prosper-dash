import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
  client?: any;
}

export function ClientFormDialog({ open, onOpenChange, onCreated, client }: Props) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({ status: "novo_cliente", source: "cadastro_manual", priority: "media" });

  useEffect(() => {
    if (client) setForm(client);
    else setForm({ status: "ativo" });
  }, [client, open]);

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
    queryFn: async () => (await supabase.from("service_providers").select("id, full_name").eq("active", true).order("full_name")).data ?? [],
  });

  const submit = async () => {
    if (!form.full_name) {
      toast.error("Nome obrigatório");
      return;
    }
    setSubmitting(true);
    const payload = {
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      document: form.document || null,
      company: form.company || null,
      address: form.address || null,
      address_street: form.address_street || null,
      address_number: form.address_number || null,
      address_neighborhood: form.address_neighborhood || null,
      address_zip_code: form.address_zip_code || null,
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
      payment_status: form.payment_status || "pendente",
      notes: form.notes || null,
      tags: form.tags ?? [],
      health_score: form.health_score || 100,
      churn_risk: form.churn_risk || "Baixo",
      created_by: user?.id,
    };
    const { error } = client?.id
      ? await supabase.from("clients").update(payload).eq("id", client.id)
      : await supabase.from("clients").insert(payload);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(client?.id ? "Cliente atualizado" : "Cliente cadastrado");
    onCreated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{client?.id ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
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
            <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>CPF/CNPJ</Label>
            <Input value={form.document ?? ""} onChange={(e) => setForm({ ...form, document: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Input value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="col-span-2 grid grid-cols-4 gap-4">
            <div className="col-span-3 space-y-2">
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
            <Input value={form.address_zip_code ?? ""} onChange={(e) => setForm({ ...form, address_zip_code: e.target.value })} />
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
            <Label>Health Score (0-100)</Label>
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
          <div className="col-span-2 space-y-2">
            <Label>Tags (separadas por vírgula)</Label>
            <Input
              placeholder="VIP, risco, novo, prioridade"
              value={(form.tags ?? []).join(", ")}
              onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map((t: string) => t.trim()).filter(Boolean) })}
            />
            <p className="text-[10px] text-muted-foreground">Sugestões: VIP, risco, novo, prioridade</p>
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Observações internas</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting} className="bg-gradient-primary hover:opacity-90">{submitting ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
