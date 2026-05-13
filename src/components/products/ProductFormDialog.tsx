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
  Sparkles, Tag, FileText, ListChecks, Settings2, Wallet, Clock, X, Plus,
  Briefcase, ScrollText, Calculator, Scale, Package
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Category { id: string; name: string; color: string | null }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: any | null;
  categories: Category[];
  onSaved: () => void;
}

const PRESETS = [
  { name: "Contabilidade Mensal", icon: Calculator, category: "Contábil" },
  { name: "Planejamento Tributário", icon: ScrollText, category: "Tributário" },
  { name: "Defesa Jurídica", icon: Scale, category: "Jurídico" },
  { name: "Abertura de Empresa", icon: Briefcase, category: "Societário" },
];

export function ProductFormDialog({ open, onOpenChange, editing, categories, onSaved }: Props) {
  const [tab, setTab] = useState<"basico" | "operacional" | "financeiro" | "comunicacao">("basico");
  const [docs, setDocs] = useState<string[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [docInput, setDocInput] = useState("");
  const [stepInput, setStepInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<any>({
    name: "", description: "", category_id: "",
    base_price: 0, billing_type: "unico",
    default_commission_percent: 10, default_employee_commission: 0, default_provider_value: 0,
    default_sla_days: 15, sla_day_type: "working",
    initial_status: "aguardando_inicio", recommended_provider_type: "",
    client_welcome_message: "", provider_welcome_message: "",
    active: true, recurring: false, allow_partner: true,
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name ?? "",
        description: editing.description ?? "",
        category_id: editing.category_id ?? (categories[0]?.id ?? ""),
        base_price: editing.base_price ?? 0,
        billing_type: editing.billing_type || "unico",
        default_commission_percent: editing.default_commission_percent ?? 10,
        default_employee_commission: editing.default_employee_commission ?? 0,
        default_provider_value: editing.default_provider_value ?? 0,
        default_sla_days: editing.default_sla_days ?? 15,
        sla_day_type: editing.sla_day_type || "working",
        initial_status: editing.initial_status || "aguardando_inicio",
        recommended_provider_type: editing.recommended_provider_type ?? "",
        client_welcome_message: editing.client_welcome_message ?? "",
        provider_welcome_message: editing.provider_welcome_message ?? "",
        active: !!editing.active,
        recurring: !!editing.recurring,
        allow_partner: !!editing.allow_partner,
      });
      setDocs(Array.isArray(editing.required_documents) ? editing.required_documents.map((d: any) => d.name) : []);
      setSteps(Array.isArray(editing.standard_steps) ? editing.standard_steps.map((s: any) => s.label) : []);
    } else {
      setForm((f: any) => ({ ...f, category_id: categories[0]?.id ?? "" }));
      setDocs([]); setSteps([]);
    }
    setTab("basico");
  }, [open, editing, categories]);

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
    if (!form.category_id) { toast.error("Selecione uma categoria"); setTab("basico"); return; }

    setSubmitting(true);
    const payload = {
      name: form.name.trim(),
      description: form.description?.trim() || null,
      category_id: form.category_id,
      base_price: Number(form.base_price ?? 0),
      billing_type: form.billing_type,
      default_commission_percent: Number(form.default_commission_percent ?? 0),
      default_employee_commission: Number(form.default_employee_commission ?? 0),
      default_provider_value: Number(form.default_provider_value ?? 0),
      default_sla_days: Number(form.default_sla_days || 15),
      sla_day_type: form.sla_day_type,
      initial_status: form.initial_status,
      recommended_provider_type: form.recommended_provider_type?.trim() || null,
      client_welcome_message: form.client_welcome_message?.trim() || null,
      provider_welcome_message: form.provider_welcome_message?.trim() || null,
      required_documents: docs.map((name) => ({ name })),
      standard_steps: steps.map((label) => ({ label })),
      active: !!form.active,
      recurring: !!form.recurring,
      allow_partner: !!form.allow_partner,
    };

    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);

    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Serviço atualizado" : "Serviço cadastrado");
    onSaved();
    onOpenChange(false);
  };

  const tabs = [
    { id: "basico", label: "Identificação", icon: Tag },
    { id: "operacional", label: "Operação", icon: ListChecks },
    { id: "financeiro", label: "Financeiro & SLA", icon: Wallet },
    { id: "comunicacao", label: "Comunicação", icon: FileText },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
        <DialogHeader className="px-8 pt-8 pb-6 bg-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <Package className="size-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-2xl font-bold text-slate-900">
                {editing ? "Editar serviço" : "Novo serviço"}
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-slate-400 uppercase tracking-widest mt-0.5">
                Catálogo de Ofertas
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab nav */}
        <div className="flex items-center gap-6 px-8 bg-white border-b border-slate-100 overflow-x-auto scrollbar-hide">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 px-1 h-12 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                  active
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                )}
              >
                <t.icon className={cn("size-4", active ? "text-indigo-600" : "text-slate-400")} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="px-7 py-5 max-h-[60vh] overflow-y-auto space-y-5">
          {tab === "basico" && (
            <>
              {!editing && (
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Sugestões rápidas</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {PRESETS.map((p) => {
                      const cat = categories.find((c) => c.name.toLowerCase() === p.category.toLowerCase());
                      return (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => setForm({ ...form, name: p.name, category_id: cat?.id ?? form.category_id })}
                          className="flex flex-col items-start gap-2 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
                        >
                          <p.icon className="size-4 text-primary" />
                          <span className="text-[11.5px] font-semibold leading-tight">{p.name}</span>
                          <span className="text-[9.5px] text-muted-foreground uppercase tracking-wider">{p.category}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Nome do serviço *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Planejamento Tributário PJ"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Categoria *</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="inline-flex items-center gap-2">
                            <span className="size-2 rounded-full" style={{ background: c.color ?? "#6366f1" }} />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de prestador recomendado</Label>
                  <Input
                    value={form.recommended_provider_type}
                    onChange={(e) => setForm({ ...form, recommended_provider_type: e.target.value })}
                    placeholder="Ex: Contador, Advogado tributarista"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Descrição (visível para cliente e prestador)</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Escopo do serviço, entregáveis, periodicidade..."
                />
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 rounded-lg border border-border bg-muted/20">
                <Toggle label="Ativo" hint="Aparece no catálogo" checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
                <Toggle label="Recorrente" hint="Cobrança contínua" checked={form.recurring} onChange={(v) => setForm({ ...form, recurring: v })} />
                <Toggle label="Permitir parceiros" hint="Pode gerar comissão" checked={form.allow_partner} onChange={(v) => setForm({ ...form, allow_partner: v })} />
              </div>
            </>
          )}

          {tab === "operacional" && (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileText className="size-3.5" /> Documentos que o cliente precisa enviar
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Esses documentos serão solicitados automaticamente quando este serviço for vendido. O prestador delegado verá apenas estes documentos.
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
                      <button onClick={() => setDocs(docs.filter((x) => x !== d))} className="ml-0.5 size-4 rounded hover:bg-destructive/20 inline-flex items-center justify-center">
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                  {docs.length === 0 && <p className="text-[11px] text-muted-foreground italic">Nenhum documento ainda. Pressione Enter para adicionar.</p>}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="flex items-center gap-2">
                  <ListChecks className="size-3.5" /> Etapas do processo (checklist do prestador)
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Cada nova demanda criada para este serviço vai começar com este checklist.
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
                    <div key={s} className="flex items-center gap-2 p-2 rounded-md border border-border bg-card text-[12px]">
                      <span className="size-5 rounded bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="flex-1">{s}</span>
                      <button onClick={() => setSteps(steps.filter((x) => x !== s))} className="size-6 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {steps.length === 0 && <p className="text-[11px] text-muted-foreground italic">Nenhuma etapa ainda.</p>}
                </div>
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
                  <Select value={form.billing_type} onValueChange={(v) => setForm({ ...form, billing_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unico">Pagamento único</SelectItem>
                      <SelectItem value="mensal">Mensalidade</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border">
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
                  <Label>Pagamento ao prestador (R$)</Label>
                  <Input type="number" step="0.01" value={form.default_provider_value}
                    onChange={(e) => setForm({ ...form, default_provider_value: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Clock className="size-3" /> SLA padrão (dias)</Label>
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

          {tab === "comunicacao" && (
            <>
              <div className="space-y-1.5">
                <Label>Mensagem de boas-vindas para o cliente</Label>
                <Textarea rows={4} value={form.client_welcome_message}
                  onChange={(e) => setForm({ ...form, client_welcome_message: e.target.value })}
                  placeholder="Olá! Iniciamos seu serviço de Planejamento Tributário. Em breve solicitaremos os documentos necessários." />
              </div>
              <div className="space-y-1.5">
                <Label>Instruções padrão para o prestador</Label>
                <Textarea rows={4} value={form.provider_welcome_message}
                  onChange={(e) => setForm({ ...form, provider_welcome_message: e.target.value })}
                  placeholder="Demanda delegada. Por favor, conferir documentos e iniciar pelo passo 1 do checklist." />
              </div>
              <div className="space-y-1.5">
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
        </div>

        <DialogFooter className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between sm:justify-between">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
            * Campos obrigatórios
          </p>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold text-slate-500">
              Cancelar
            </Button>
            <Button 
              onClick={submit} 
              disabled={submitting}
              className="rounded-xl px-8 h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-600/20"
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
        <p className="text-[12px] font-semibold leading-tight">{label}</p>
        <p className="text-[10px] text-muted-foreground leading-tight">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
