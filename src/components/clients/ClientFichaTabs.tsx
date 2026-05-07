import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ContractDialog } from "@/components/contracts/ContractDialog";
import { formatBRL, formatDate, formatDoc, formatPhone } from "@/lib/format";
import { toast } from "sonner";
import { Plus, FileSignature, Receipt, ListTodo, StickyNote, Trash2, CheckCircle2, IdCard, Mail, Phone, MapPin, Building2 } from "lucide-react";

function Empty({ icon: Icon, text }: any) {
  return (
    <div className="p-12 text-center bg-muted/20 rounded-2xl border border-dashed border-border/60">
      <Icon className="size-10 text-muted-foreground/30 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground font-medium px-6">{text}</p>
    </div>
  );
}

// =================== DADOS CADASTRAIS ===================
export function CadastralTab({ client }: { client: any }) {
  const Item = ({ label, value, mono }: any) => (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
      <p className={`text-sm ${mono ? "vx-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
  return (
    <div className="vx-card p-6 space-y-6">
      <div>
        <p className="font-display text-base font-semibold flex items-center gap-2"><IdCard className="size-4 text-primary" /> Identificação</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          <Item label="Nome completo" value={client.full_name} />
          <Item label="Empresa" value={client.company} />
          <Item label="CPF/CNPJ" value={formatDoc(client.document)} mono />
          <Item label="Tipo de documento" value={client.document_type} />
          <Item label="Data de nascimento" value={client.birth_date && formatDate(client.birth_date)} />
          <Item label="Prioridade" value={client.priority} />
        </div>
      </div>
      <div className="border-t border-border pt-6">
        <p className="font-display text-base font-semibold flex items-center gap-2"><Mail className="size-4 text-primary" /> Contato</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          <Item label="E-mail" value={client.email} />
          <Item label="Telefone" value={formatPhone(client.phone)} />
          <Item label="WhatsApp" value={formatPhone(client.whatsapp)} />
        </div>
      </div>
      <div className="border-t border-border pt-6">
        <p className="font-display text-base font-semibold flex items-center gap-2"><MapPin className="size-4 text-primary" /> Endereço</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          <Item label="Logradouro" value={client.address_street || client.address} />
          <Item label="Número" value={client.address_number} />
          <Item label="Complemento" value={client.address_complement} />
          <Item label="Bairro" value={client.address_neighborhood} />
          <Item label="CEP" value={client.address_zip_code} />
          <Item label="Cidade/UF" value={[client.address_city || client.city, client.address_state || client.state].filter(Boolean).join("/")} />
          <Item label="País" value={client.address_country} />
        </div>
      </div>
      <div className="border-t border-border pt-6">
        <p className="font-display text-base font-semibold flex items-center gap-2"><Building2 className="size-4 text-primary" /> Comercial</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          <Item label="Origem" value={client.source?.replace(/_/g, " ")} />
          <Item label="Status" value={client.status?.replace(/_/g, " ")} />
          <Item label="Data de entrada" value={client.entry_date && formatDate(client.entry_date)} />
          <Item label="Data da venda" value={client.sale_date && formatDate(client.sale_date)} />
          <Item label="Conclusão prevista" value={client.completion_date && formatDate(client.completion_date)} />
          <Item label="Forma de pagamento" value={client.payment_method} />
          <Item label="Valor do contrato" value={formatBRL(client.contract_value)} mono />
          <Item label="Status financeiro" value={client.payment_status} />
        </div>
      </div>
      {client.notes && (
        <div className="border-t border-border pt-6">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Observações</p>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{client.notes}</p>
        </div>
      )}
    </div>
  );
}

// =================== CONTRATOS ===================
const contractStatusBadge: Record<string, string> = {
  criado: "bg-slate-100 text-slate-700",
  enviado: "bg-blue-50 text-blue-700",
  assinado: "bg-emerald-50 text-emerald-700",
  cancelado: "bg-destructive/10 text-destructive",
  finalizado: "bg-emerald-50 text-emerald-700",
};

export function ContractsTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["client-contracts", clientId],
    queryFn: async () => (await supabase.from("contracts").select("*, products(name)").eq("client_id", clientId).order("created_at", { ascending: false })).data ?? [],
  });

  const updateStatus = async (id: string, status: string) => {
    const payload: any = { status };
    if (status === "assinado") payload.signed_at = new Date().toISOString();
    if (status === "enviado") payload.sent_at = new Date().toISOString();
    const { error } = await supabase.from("contracts").update(payload).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["client-contracts", clientId] });
  };

  return (
    <div className="vx-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Contratos do cliente</p>
          <p className="text-[11px] text-muted-foreground">Gestão de documentos contratuais</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-2 bg-gradient-primary"><Plus className="size-4" /> Novo contrato</Button>
      </div>
      {data.length === 0 ? (
        <Empty icon={FileSignature} text="Nenhum contrato cadastrado." />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-6 py-3 text-left font-semibold">Nome</th>
              <th className="px-6 py-3 text-left font-semibold">Produto</th>
              <th className="px-6 py-3 text-right font-semibold">Valor</th>
              <th className="px-6 py-3 text-left font-semibold">Status</th>
              <th className="px-6 py-3 text-left font-semibold">Criado</th>
              <th className="px-6 py-3 text-left font-semibold">Assinado</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((c: any) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-6 py-3 font-medium">{c.name}</td>
                <td className="px-6 py-3">{c.products?.name ?? "—"}</td>
                <td className="px-6 py-3 text-right vx-mono font-semibold">{formatBRL(c.amount)}</td>
                <td className="px-6 py-3">
                  <Select value={c.status} onValueChange={(v) => updateStatus(c.id, v)}>
                    <SelectTrigger className={`h-7 w-[140px] text-[11px] ${contractStatusBadge[c.status] ?? ""}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["criado", "enviado", "assinado", "cancelado", "finalizado"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-6 py-3 text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                <td className="px-6 py-3 text-xs text-muted-foreground">{c.signed_at ? formatDate(c.signed_at) : "—"}</td>
                <td className="px-6 py-3 text-right">
                  {c.file_path && (
                    <Button variant="ghost" size="sm" onClick={async () => {
                      const { data: signed } = await supabase.storage.from("contracts").createSignedUrl(c.file_path, 60);
                      if (signed?.signedUrl) window.open(signed.signedUrl, "_blank");
                    }}>Abrir</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ContractDialog open={open} onOpenChange={setOpen} clientId={clientId} onSuccess={() => qc.invalidateQueries({ queryKey: ["client-contracts", clientId] })} />
    </div>
  );
}

// =================== PAGAMENTOS / FINANCEIRO ===================
const payStatusBadge: Record<string, string> = {
  pendente: "bg-warning-muted text-warning",
  pago: "bg-success-muted text-success",
  parcial: "bg-blue-50 text-blue-700",
  atrasado: "bg-destructive/10 text-destructive",
  cancelado: "bg-muted text-muted-foreground",
  reembolsado: "bg-destructive/10 text-destructive",
};

export function PaymentsTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ amount: "", due_date: "", payment_method: "pix", installments_count: 1, installment_number: 1, status: "pendente", sale_id: "" });

  const { data: payments = [] } = useQuery({
    queryKey: ["client-payments", clientId],
    queryFn: async () => (await supabase.from("payments").select("*, sales(amount, products(name))").eq("client_id", clientId).order("due_date", { ascending: false })).data ?? [],
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["client-sales-for-payments", clientId],
    queryFn: async () => (await supabase.from("sales").select("id, amount, products(name)").eq("client_id", clientId)).data ?? [],
  });

  const totals = payments.reduce(
    (acc: any, p: any) => {
      const amt = Number(p.amount || 0);
      const paid = Number(p.amount_paid || 0);
      acc.total += amt;
      if (p.status === "pago") acc.paid += amt;
      else acc.pending += amt - paid;
      return acc;
    },
    { total: 0, paid: 0, pending: 0 },
  );

  const submit = async () => {
    if (!form.amount || !form.due_date || !form.sale_id) return toast.error("Preencha valor, vencimento e venda");
    const { error } = await supabase.from("payments").insert({
      client_id: clientId,
      sale_id: form.sale_id,
      amount: Number(form.amount),
      due_date: form.due_date,
      payment_method: form.payment_method,
      installments_count: Number(form.installments_count) || 1,
      installment_number: Number(form.installment_number) || 1,
      status: form.status,
    });
    if (error) return toast.error(error.message);
    toast.success("Pagamento lançado");
    setOpen(false);
    setForm({ amount: "", due_date: "", payment_method: "pix", installments_count: 1, installment_number: 1, status: "pendente", sale_id: "" });
    qc.invalidateQueries({ queryKey: ["client-payments", clientId] });
  };

  const markPaid = async (id: string, amount: number) => {
    const { error } = await supabase.from("payments").update({ status: "pago", paid_at: new Date().toISOString(), amount_paid: amount }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pagamento confirmado");
    qc.invalidateQueries({ queryKey: ["client-payments", clientId] });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="vx-card p-4"><p className="text-[10px] uppercase font-semibold text-muted-foreground">Total lançado</p><p className="font-display text-lg font-bold vx-mono">{formatBRL(totals.total)}</p></div>
        <div className="vx-card p-4"><p className="text-[10px] uppercase font-semibold text-muted-foreground">Pago</p><p className="font-display text-lg font-bold vx-mono text-success">{formatBRL(totals.paid)}</p></div>
        <div className="vx-card p-4"><p className="text-[10px] uppercase font-semibold text-muted-foreground">Em aberto</p><p className="font-display text-lg font-bold vx-mono text-warning">{formatBRL(totals.pending)}</p></div>
      </div>

      <div className="vx-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold">Lançamentos</p>
          <Button size="sm" onClick={() => setOpen(true)} className="gap-2 bg-gradient-primary"><Plus className="size-4" /> Lançar pagamento</Button>
        </div>
        {payments.length === 0 ? (
          <Empty icon={Receipt} text="Nenhum pagamento lançado para este cliente." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Produto</th>
                <th className="px-6 py-3 text-left font-semibold">Parcela</th>
                <th className="px-6 py-3 text-left font-semibold">Vencimento</th>
                <th className="px-6 py-3 text-right font-semibold">Valor</th>
                <th className="px-6 py-3 text-left font-semibold">Forma</th>
                <th className="px-6 py-3 text-left font-semibold">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((p: any) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-6 py-3 font-medium">{p.sales?.products?.name ?? "—"}</td>
                  <td className="px-6 py-3 text-xs">{p.installment_number}/{p.installments_count}</td>
                  <td className="px-6 py-3 text-xs">{formatDate(p.due_date)}</td>
                  <td className="px-6 py-3 text-right vx-mono font-semibold">{formatBRL(p.amount)}</td>
                  <td className="px-6 py-3 text-xs uppercase">{p.payment_method ?? "—"}</td>
                  <td className="px-6 py-3"><Badge className={`text-[10px] ${payStatusBadge[p.status] ?? ""}`}>{p.status}</Badge></td>
                  <td className="px-6 py-3 text-right">
                    {p.status !== "pago" && <Button size="sm" variant="ghost" onClick={() => markPaid(p.id, Number(p.amount))} className="gap-1.5 text-success"><CheckCircle2 className="size-3.5" /> Confirmar</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lançar pagamento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-2">
              <Label>Venda *</Label>
              <Select value={form.sale_id} onValueChange={(v) => setForm({ ...form, sale_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar venda" /></SelectTrigger>
                <SelectContent>
                  {sales.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.products?.name ?? "Venda"} — {formatBRL(s.amount)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Valor *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="space-y-2"><Label>Vencimento *</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <div className="space-y-2"><Label>Parcela nº</Label><Input type="number" value={form.installment_number} onChange={(e) => setForm({ ...form, installment_number: e.target.value })} /></div>
            <div className="space-y-2"><Label>Total parcelas</Label><Input type="number" value={form.installments_count} onChange={(e) => setForm({ ...form, installments_count: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Forma</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["pix", "boleto", "cartao_credito", "cartao_debito", "transferencia", "dinheiro"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["pendente", "pago", "parcial", "atrasado", "cancelado", "reembolsado"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} className="bg-gradient-primary">Lançar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =================== TAREFAS ===================
const taskPriority: Record<string, string> = {
  baixa: "bg-slate-100 text-slate-700",
  media: "bg-blue-50 text-blue-700",
  alta: "bg-amber-50 text-amber-700",
  urgente: "bg-destructive/10 text-destructive",
};

export function TasksTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ title: "", description: "", priority: "media", status: "pendente", due_date: "" });

  const { data = [] } = useQuery({
    queryKey: ["client-tasks", clientId],
    queryFn: async () => (await supabase.from("tasks").select("*").or(`related_to_id.eq.${clientId},related_entity_id.eq.${clientId}`).order("created_at", { ascending: false })).data ?? [],
  });

  const submit = async () => {
    if (!form.title) return toast.error("Título obrigatório");
    const { error } = await supabase.from("tasks").insert({
      title: form.title, description: form.description || null,
      priority: form.priority, status: form.status,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      related_to_type: "client", related_to_id: clientId,
      related_entity_type: "client", related_entity_id: clientId,
    });
    if (error) return toast.error(error.message);
    toast.success("Tarefa criada");
    setOpen(false); setForm({ title: "", description: "", priority: "media", status: "pendente", due_date: "" });
    qc.invalidateQueries({ queryKey: ["client-tasks", clientId] });
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["client-tasks", clientId] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir tarefa?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["client-tasks", clientId] });
  };

  return (
    <div className="vx-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <p className="text-sm font-semibold">Tarefas e pendências</p>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-2 bg-gradient-primary"><Plus className="size-4" /> Nova tarefa</Button>
      </div>
      {data.length === 0 ? (
        <Empty icon={ListTodo} text="Nenhuma tarefa criada." />
      ) : (
        <ul className="divide-y divide-border">
          {data.map((t: any) => (
            <li key={t.id} className="px-6 py-4 flex items-start gap-3 hover:bg-muted/30">
              <Button variant="ghost" size="icon" className="size-7 mt-0.5" onClick={() => setStatus(t.id, t.status === "concluida" ? "pendente" : "concluida")}>
                <CheckCircle2 className={`size-4 ${t.status === "concluida" ? "text-success" : "text-muted-foreground"}`} />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-medium ${t.status === "concluida" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                  <Badge className={`text-[10px] ${taskPriority[t.priority] ?? ""}`}>{t.priority}</Badge>
                  <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                  {t.due_date && <span className="text-[11px] text-muted-foreground">prazo: {formatDate(t.due_date)}</span>}
                </div>
                {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
              </div>
              <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => remove(t.id)}><Trash2 className="size-3.5" /></Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2"><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["baixa", "media", "alta", "urgente"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["pendente", "em_andamento", "aguardando", "concluida", "cancelada"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={submit} className="bg-gradient-primary">Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =================== NOTAS INTERNAS ===================
export function NotesTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["client-notes", clientId],
    queryFn: async () => (await supabase.from("notes").select("*").eq("client_id", clientId).order("created_at", { ascending: false })).data ?? [],
  });

  const submit = async () => {
    if (!content.trim()) return;
    const { error } = await supabase.from("notes").insert({ client_id: clientId, content: content.trim(), is_private: isPrivate, created_by: user?.id });
    if (error) return toast.error(error.message);
    setContent(""); setIsPrivate(false);
    qc.invalidateQueries({ queryKey: ["client-notes", clientId] });
  };

  return (
    <div className="vx-card p-6 space-y-4">
      <div className="space-y-2">
        <p className="font-display text-base font-semibold flex items-center gap-2"><StickyNote className="size-4 text-primary" /> Observações internas</p>
        <Textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Escreva uma nota interna sobre este cliente..." />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} /> Apenas eu vejo
          </label>
          <Button size="sm" onClick={submit} className="bg-gradient-primary gap-2"><Plus className="size-4" /> Adicionar nota</Button>
        </div>
      </div>
      <div className="border-t border-border pt-4">
        {data.length === 0 ? (
          <Empty icon={StickyNote} text="Nenhuma nota registrada." />
        ) : (
          <ul className="space-y-2">
            {data.map((n: any) => (
              <li key={n.id} className="rounded-md border border-border p-3 bg-muted/20">
                <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{formatDate(n.created_at)} {n.is_private && "· privada"}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
