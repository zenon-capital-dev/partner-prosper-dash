import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { UserPlus, Package, FileSignature, ClipboardCheck, Wallet } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: any;
  onConverted?: () => void;
}

export function ConvertLeadDialog({ open, onOpenChange, lead, onConverted }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({});

  const { data: products } = useQuery({
    queryKey: ["products-convert"],
    queryFn: async () => (await supabase.from("products").select("id, name, base_price").eq("active", true).order("name")).data ?? [],
    enabled: open,
  });

  useEffect(() => {
    if (!lead) return;
    setForm({
      product_id: lead.product_id || "",
      contract_value: lead.estimated_value ?? "",
      partner_commission: "",
      contract_name: `Contrato — ${lead.full_name}`,
      contract_type: "padrao",
      first_task_title: `Iniciar onboarding de ${lead.full_name}`,
      first_task_due: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
      create_product: true,
      create_contract: true,
      create_commission: !!lead.partner_id,
      create_task: true,
    });
  }, [lead, open]);

  if (!lead) return null;

  const submit = async () => {
    if (!form.create_product && !form.create_contract && !form.create_task) {
      return toast.error("Selecione ao menos uma operação.");
    }
    setSubmitting(true);
    try {
      // 1. Client
      const { data: client, error: cErr } = await supabase.from("clients").insert({
        full_name: lead.full_name,
        company: lead.company,
        email: lead.email,
        phone: lead.phone,
        whatsapp: lead.whatsapp,
        origin: lead.source || "lead_convertido",
        source: lead.source || "Manual",
        status: "ativo",
        partner_id: lead.partner_id,
        responsible_id: lead.responsible_id,
        collaborator_id: lead.responsible_id,
        notes: lead.notes,
        contract_value: form.contract_value ? Number(form.contract_value) : null,
      }).select().single();
      if (cErr) throw cErr;

      let clientProductId: string | null = null;

      // 2. Client Product (Demanda)
      if (form.create_product && form.product_id) {
        const { data: cp, error: cpErr } = await supabase.from("client_products").insert({
          client_id: client.id,
          product_id: form.product_id,
          service_provider_id: null,
          responsible_employee_id: lead.responsible_id ?? null,
          status: "aguardando_inicio",
          priority: "normal",
          value: form.contract_value ? Number(form.contract_value) : null,
          start_date: new Date().toISOString().split("T")[0],
        }).select().single();
        if (cpErr) throw cpErr;
        clientProductId = cp.id;
      }

      // 3. Commission for partner
      if (form.create_commission && lead.partner_id && form.partner_commission) {
        await supabase.from("commissions").insert({
          partner_id: lead.partner_id,
          client_id: client.id,
          product_id: form.product_id || null,
          client_product_id: clientProductId,
          amount: Number(form.partner_commission),
          sale_value: form.contract_value ? Number(form.contract_value) : 0,
          status: "pendente",
          commission_type: "fixo",
          rule_type: "fixed",
          rule_value: Number(form.partner_commission),
        } as any);
      }

      // 4. Contract
      if (form.create_contract) {
        await supabase.from("contracts").insert({
          name: form.contract_name || `Contrato — ${lead.full_name}`,
          client_id: client.id,
          client_product_id: clientProductId,
          partner_id: lead.partner_id || null,
          product_id: form.product_id || null,
          contract_type: form.contract_type || "padrao",
          contract_kind: "cliente",
          status: "criado",
          amount: form.contract_value ? Number(form.contract_value) : null,
        });
      }

      // 5. First task
      if (form.create_task && form.first_task_title) {
        await supabase.from("tasks").insert({
          title: form.first_task_title,
          description: `Tarefa criada na conversão do lead ${lead.full_name}`,
          priority: "normal",
          status: "a_fazer",
          status_new: "a_fazer",
          due_date: form.first_task_due ? new Date(form.first_task_due).toISOString() : null,
          client_id: client.id,
          client_product_id: clientProductId,
          assigned_to: lead.responsible_id ?? user?.id ?? null,
          created_by: user?.id ?? null,
        });
      }

      // 6. Mark lead as converted
      await supabase.from("leads").update({
        status: "Fechado",
        converted_to_client_id: client.id,
        conversion_date: new Date().toISOString(),
      }).eq("id", lead.id);

      toast.success("Lead convertido com sucesso!");
      onConverted?.();
      onOpenChange(false);
      navigate(`/clientes/${client.id}`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao converter lead");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <UserPlus className="size-5 text-primary" /> Converter lead em cliente
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
            <p className="font-bold">{lead.full_name}{lead.company ? ` — ${lead.company}` : ""}</p>
            <p className="text-xs text-muted-foreground">{lead.email || lead.whatsapp || lead.phone}</p>
          </div>

          <div className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 font-bold"><Package className="size-4 text-primary" /> Criar produto contratado</Label>
              <Switch checked={form.create_product} onCheckedChange={(v) => setForm({ ...form, create_product: v })} />
            </div>
            {form.create_product && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 col-span-2">
                  <Label>Produto</Label>
                  <Select value={form.product_id || ""} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {products?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Valor do contrato (R$)</Label>
                  <Input type="number" step="0.01" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          {lead.partner_id && (
            <div className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 font-bold"><Wallet className="size-4 text-primary" /> Gerar comissão do parceiro</Label>
                <Switch checked={form.create_commission} onCheckedChange={(v) => setForm({ ...form, create_commission: v })} />
              </div>
              {form.create_commission && (
                <div className="space-y-2">
                  <Label>Valor da comissão (R$)</Label>
                  <Input type="number" step="0.01" value={form.partner_commission} onChange={(e) => setForm({ ...form, partner_commission: e.target.value })} />
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 font-bold"><FileSignature className="size-4 text-primary" /> Criar contrato</Label>
              <Switch checked={form.create_contract} onCheckedChange={(v) => setForm({ ...form, create_contract: v })} />
            </div>
            {form.create_contract && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 col-span-2">
                  <Label>Nome do contrato</Label>
                  <Input value={form.contract_name} onChange={(e) => setForm({ ...form, contract_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Input value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 font-bold"><ClipboardCheck className="size-4 text-primary" /> Criar primeira tarefa interna</Label>
              <Switch checked={form.create_task} onCheckedChange={(v) => setForm({ ...form, create_task: v })} />
            </div>
            {form.create_task && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 col-span-2">
                  <Label>Título</Label>
                  <Input value={form.first_task_title} onChange={(e) => setForm({ ...form, first_task_title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Prazo</Label>
                  <Input type="date" value={form.first_task_due} onChange={(e) => setForm({ ...form, first_task_due: e.target.value })} />
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting} className="bg-gradient-primary hover:opacity-90">
            {submitting ? "Convertendo..." : "Converter lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
