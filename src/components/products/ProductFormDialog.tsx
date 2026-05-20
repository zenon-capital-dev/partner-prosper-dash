import { useEffect, useState, KeyboardEvent } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tag, FileText, ListChecks, Wallet, Clock, X, Plus, Package,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: any | null;
  onSaved: (id?: string) => void;
}

type Tab = "basico" | "operacional" | "financeiro";

export function ProductFormDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>("basico");
  const [docs, setDocs] = useState<string[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [docInput, setDocInput] = useState("");
  const [stepInput, setStepInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<any>({
    name: "", description: "",
    base_price: 0, billing_type: "unico",
    installments_count: 1, installments_entry: 0, installments_due_day: 5,
    default_commission_percent: 10, default_employee_commission: 0, default_provider_value: 0,
    default_sla_days: 15, sla_day_type: "working",
    initial_status: "aguardando_inicio",
    active: true, recurring: false, allow_partner: true,
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name ?? "",
        description: editing.description ?? "",
        base_price: editing.base_price ?? 0,
        billing_type: editing.billing_type || "unico",
        installments_count: editing.installments_count ?? 1,
        installments_entry: editing.installments_entry ?? 0,
        installments_due_day: editing.installments_due_day ?? 5,
        default_commission_percent: editing.default_commission_percent ?? 10,
        default_employee_commission: editing.default_employee_commission ?? 0,
        default_provider_value: editing.default_provider_value ?? 0,
        default_sla_days: editing.default_sla_days ?? 15,
        sla_day_type: editing.sla_day_type || "working",
        initial_status: editing.initial_status || "aguardando_inicio",
        active: !!editing.active,
        recurring: !!editing.recurring,
        allow_partner: !!editing.allow_partner,
      });
      setDocs(Array.isArray(editing.required_documents) ? editing.required_documents.map((d: any) => d.name) : []);
      setSteps(Array.isArray(editing.standard_steps) ? editing.standard_steps.map((s: any) => s.label) : []);
    } else {
      setForm({
        name: "", description: "",
        base_price: 0, billing_type: "unico",
        installments_count: 1, installments_entry: 0, installments_due_day: 5,
        default_commission_percent: 10, default_employee_commission: 0, default_provider_value: 0,
        default_sla_days: 15, sla_day_type: "working",
        initial_status: "aguardando_inicio",
        active: true, recurring: false, allow_partner: true,
      });
      setDocs([]); setSteps([]);
    }
    setTab("basico");
  }, [open, editing]);

  const addDoc = () => {
    const v = docInput.trim();
    if (!v) return;
    if (!docs.includes(v)) setDocs([...docs, v]);
    setDocInput("");
  };
  const addStep = () => {
    const v = stepInput.trim();
    if (!v) return;
    if (!steps.includes(v)) setSteps([...steps, v]);
    setStepInput("");
  };
  const onKey = (cb: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); cb(); }
  };

  const submit = async () => {
    if (!form.name?.trim()) { toast.error("Dê um nome ao serviço"); setTab("basico"); return; }

    setSubmitting(true);
    const isInstallments = form.billing_type === "parcelado";
    const payload: any = {
      name: form.name.trim(),
      description: form.description?.trim() || null,
      base_price: Number(form.base_price ?? 0),
      billing_type: form.billing_type,
      installments_count: isInstallments ? Number(form.installments_count || 1) : null,
      installments_entry: isInstallments ? Number(form.installments_entry || 0) : null,
      installments_due_day: isInstallments ? Number(form.installments_due_day || 5) : null,
      default_commission_percent: Number(form.default_commission_percent ?? 0),
      default_employee_commission: Number(form.default_employee_commission ?? 0),
      default_provider_value: Number(form.default_provider_value ?? 0),
      default_sla_days: Number(form.default_sla_days || 15),
      sla_day_type: form.sla_day_type,
      initial_status: form.initial_status,
      required_documents: docs.map((name) => ({ name })),
      standard_steps: steps.map((label) => ({ label })),
      active: !!form.active,
      recurring: !!form.recurring,
      allow_partner: !!form.allow_partner,
    };

    const { data, error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id).select("id").maybeSingle()
      : await supabase.from("products").insert(payload).select("id").maybeSingle();

    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Serviço atualizado" : "Serviço cadastrado");
    onSaved(data?.id);
    onOpenChange(false);
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "basico", label: "Identificação", icon: Tag },
    { id: "operacional", label: "Operação", icon: ListChecks },
    { id: "financeiro", label: "Financeiro & SLA", icon: Wallet },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-2xl border border-slate-200/70 shadow-2xl bg-white">
        <DialogHeader className="px-8 pt-7 pb-5 bg-white">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Package className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                {editing ? "Editar serviço" : "Novo serviço"}
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                Catálogo de Ofertas
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-6 px-8 bg-white border-b border-slate-200/70">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 px-1 h-11 text-sm font-semibold transition-all border-b-2 whitespace-nowrap",
                  active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-900",
                )}
              >
                <t.icon className="size-4" /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="px-8 py-6 max-h-[60vh] overflow-y-auto space-y-5">
          {tab === "basico" && (
            <>
              <div className="space-y-1.5">
                <Label>Nome do serviço *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Planejamento Tributário PJ"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Descrição curta (visível para cliente e prestador)</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Escopo do serviço, entregáveis, periodicidade..."
                />
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 rounded-lg border border-slate-200/70 bg-slate-50/60">
                <Toggle label="Ativo" hint="Aparece no catálogo" checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
                <Toggle label="Recorrente" hint="Cobrança contínua" checked={form.recurring} onChange={(v) => setForm({ ...form, recurring: v })} />
                <Toggle label="Permitir parceiros" hint="Pode gerar comissão" checked={form.allow_partner} onChange={(v) => setForm({ ...form, allow_partner: v })} />
              </div>

              {!editing && (
                <p className="text-[11.5px] text-slate-500 bg-indigo-50/60 border border-indigo-100 rounded-md px-3 py-2">
                  Após criar, abriremos a ficha completa do serviço onde você poderá vincular prestadores, colaboradores, contrato modelo e ver clientes que já compraram.
                </p>
              )}
            </>
          )}

          {tab === "operacional" && (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileText className="size-3.5" /> Documentos exigidos do cliente
                </Label>
                <p className="text-[11.5px] text-slate-500">
                  Solicitados automaticamente quando este serviço for vendido.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={docInput}
                    onChange={(e) => setDocInput(e.target.value)}
                    onKeyDown={onKey(addDoc)}
                    placeholder="Ex: Contrato Social, Balanço, Notas fiscais..."
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addDoc} className="shrink-0">
                    <Plus className="size-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[28px] pt-1">
                  {docs.map((d) => (
                    <Badge key={d} variant="secondary" className="gap-1 pl-2.5 pr-1 py-1 text-[11px]">
                      <FileText className="size-3" /> {d}
                      <button onClick={() => setDocs(docs.filter((x) => x !== d))} className="ml-0.5 size-4 rounded hover:bg-rose-100 inline-flex items-center justify-center">
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                  {docs.length === 0 && <p className="text-[11.5px] text-slate-400 italic">Nenhum documento. Pressione Enter para adicionar.</p>}
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-200/70">
                <Label className="flex items-center gap-2">
                  <ListChecks className="size-3.5" /> Etapas do processo (checklist do prestador)
                </Label>
                <p className="text-[11.5px] text-slate-500">
                  Cada nova demanda começa com este checklist.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={stepInput}
                    onChange={(e) => setStepInput(e.target.value)}
                    onKeyDown={onKey(addStep)}
                    placeholder="Ex: Conferir documentos, Apurar impostos, Emitir guia..."
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addStep} className="shrink-0">
                    <Plus className="size-4" />
                  </Button>
                </div>
                <div className="flex flex-col gap-1 min-h-[28px] pt-1">
                  {steps.map((s, i) => (
                    <div key={s} className="flex items-center gap-2 p-2 rounded-md border border-slate-200/70 bg-white text-[12px]">
                      <span className="size-5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="flex-1">{s}</span>
                      <button onClick={() => setSteps(steps.filter((x) => x !== s))} className="size-6 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-600 flex items-center justify-center">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {steps.length === 0 && <p className="text-[11.5px] text-slate-400 italic">Nenhuma etapa.</p>}
                </div>
              </div>

              <div className="space-y-1.5 pt-4 border-t border-slate-200/70">
                <Label>Status inicial da demanda</Label>
                <Select value={form.initial_status} onValueChange={(v) => setForm({ ...form, initial_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aguardando_inicio">Aguardando início</SelectItem>
                    <SelectItem value="aguardando_documentos">Aguardando documentos</SelectItem>
                    <SelectItem value="em_execucao">Em execução</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {tab === "financeiro" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Valor padrão (R$)</Label>
                  <Input type="number" step="0.01" value={form.base_price}
                    onChange={(e) => setForm({ ...form, base_price: e.target.value })} placeholder="0,00" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de cobrança</Label>
                  <Select value={form.billing_type} onValueChange={(v) => setForm({ ...form, billing_type: v, recurring: v === "mensal" || v === "anual" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unico">Pagamento único</SelectItem>
                      <SelectItem value="parcelado">Parcelado</SelectItem>
                      <SelectItem value="mensal">Mensalidade</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.billing_type === "parcelado" && (
                <div className="grid grid-cols-3 gap-4 p-4 rounded-lg border border-indigo-100 bg-indigo-50/40">
                  <div className="space-y-1.5">
                    <Label className="text-[11.5px]">Nº de parcelas</Label>
                    <Input type="number" min="2" value={form.installments_count}
                      onChange={(e) => setForm({ ...form, installments_count: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11.5px]">Entrada (R$)</Label>
                    <Input type="number" step="0.01" value={form.installments_entry}
                      onChange={(e) => setForm({ ...form, installments_entry: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11.5px]">Dia de vencimento</Label>
                    <Input type="number" min="1" max="28" value={form.installments_due_day}
                      onChange={(e) => setForm({ ...form, installments_due_day: e.target.value })} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200/70">
                <div className="space-y-1.5">
                  <Label>Comissão parceiro (%)</Label>
                  <Input type="number" step="0.01" value={form.default_commission_percent}
                    onChange={(e) => setForm({ ...form, default_commission_percent: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Comissão colaborador (%)</Label>
                  <Input type="number" step="0.01" value={form.default_employee_commission}
                    onChange={(e) => setForm({ ...form, default_employee_commission: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Pagamento prestador (R$)</Label>
                  <Input type="number" step="0.01" value={form.default_provider_value}
                    onChange={(e) => setForm({ ...form, default_provider_value: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/70">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Clock className="size-3.5" /> SLA padrão (dias)</Label>
                  <Input type="number" value={form.default_sla_days}
                    onChange={(e) => setForm({ ...form, default_sla_days: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de prazo</Label>
                  <Select value={form.sla_day_type} onValueChange={(v) => setForm({ ...form, sla_day_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="working">Dias úteis</SelectItem>
                      <SelectItem value="calendar">Dias corridos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-8 py-5 bg-slate-50/60 border-t border-slate-200/70 flex items-center justify-between sm:justify-between">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
            * Campos obrigatórios
          </p>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-semibold text-slate-600">
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={submitting}
              className="px-6 h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm"
            >
              {submitting ? "Salvando..." : editing ? "Salvar Alterações" : "Criar Serviço"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-slate-800 leading-tight">{label}</p>
        <p className="text-[10.5px] text-slate-500 leading-tight">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
