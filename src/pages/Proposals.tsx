import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Search, MoreHorizontal, Eye, Trash2, Send, CheckCircle2, XCircle,
  FileText, Printer, ArrowRightCircle, X,
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { confirmAction } from "@/lib/confirm";

type Status = "rascunho" | "enviada" | "visualizada" | "aprovada" | "recusada" | "vencida";

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  enviada: { label: "Enviada", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  visualizada: { label: "Visualizada", cls: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  aprovada: { label: "Aprovada", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  recusada: { label: "Recusada", cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  vencida: { label: "Vencida", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
};

type Item = {
  id?: string;
  product_id: string | null;
  product_name: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
};

const emptyItem = (): Item => ({
  product_id: null, product_name: "", description: "", quantity: 1, unit_price: 0, discount: 0,
});

export default function Proposals() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ["proposals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("*, clients(id, full_name, email, company, document), leads(id, name, email, company), proposal_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Auto-mark expired
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const stale = proposals.filter((p: any) =>
      p.valid_until && p.valid_until < today &&
      ["enviada", "visualizada", "rascunho"].includes(p.status)
    );
    if (stale.length) {
      supabase.from("proposals").update({ status: "vencida" }).in("id", stale.map((p: any) => p.id))
        .then(() => qc.invalidateQueries({ queryKey: ["proposals"] }));
    }
  }, [proposals, qc]);

  const filtered = useMemo(() => proposals.filter((p: any) => {
    if (statusFilter !== "todos" && p.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const target = `${p.proposal_number ?? ""} ${p.recipient_name ?? ""} ${p.clients?.full_name ?? ""} ${p.leads?.name ?? ""} ${p.recipient_company ?? ""}`.toLowerCase();
      if (!target.includes(s)) return false;
    }
    return true;
  }), [proposals, statusFilter, search]);

  const updateStatus = async (id: string, status: Status, extra: any = {}) => {
    const { error } = await supabase.from("proposals").update({ status, ...extra }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["proposals"] });
    }
  };

  const remove = async (id: string) => {
    if (!(await confirmAction("Excluir esta proposta?"))) return;
    const { error } = await supabase.from("proposals").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Proposta excluída");
      qc.invalidateQueries({ queryKey: ["proposals"] });
    }
  };

  // KPIs do funil
  const kpis = useMemo(() => {
    const total = proposals.length;
    const totalValue = proposals.reduce((s: number, p: any) => s + Number(p.total || 0), 0);
    const approved = proposals.filter((p: any) => p.status === "aprovada");
    const approvedValue = approved.reduce((s: number, p: any) => s + Number(p.total || 0), 0);
    const sent = proposals.filter((p: any) => ["enviada", "visualizada"].includes(p.status)).length;
    const conversionRate = total > 0 ? Math.round((approved.length / total) * 100) : 0;
    return { total, totalValue, approvedValue, approvedCount: approved.length, sent, conversionRate };
  }, [proposals]);

  return (
    <div className="page-shell space-y-6 animate-fade-up">
      <PageHero
        eyebrow="Comercial"
        title="Propostas Comerciais"
        description="Monte propostas profissionais, acompanhe o funil e converta em vendas."
        icon={<FileText className="h-5 w-5" />}
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nova proposta
          </Button>
        }
        kpis={[
          { label: "Total", value: kpis.total, tone: "primary" },
          { label: "Em Negociação", value: kpis.sent, tone: "info" },
          { label: "Aprovadas", value: kpis.approvedCount, tone: "success" },
          { label: "Conversão", value: `${kpis.conversionRate}%`, tone: kpis.conversionRate >= 30 ? "success" : "warning" },
          { label: "Receita Aprovada", value: formatBRL(kpis.approvedValue), tone: "success" },
        ]}
      />

      {/* Tabs por status */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "todos", label: "Todas", count: proposals.length },
          ...(Object.keys(STATUS_META) as Status[]).map((k) => ({
            key: k,
            label: STATUS_META[k].label,
            count: proposals.filter((p: any) => p.status === k).length,
          })),
        ].map((t) => {
          const active = statusFilter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={cn(
                "h-9 px-4 rounded-xl text-xs font-bold border transition-all flex items-center gap-2",
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
              )}
            >
              {t.label}
              <span className={cn("px-1.5 rounded-md text-[10px] tabular-nums", active ? "bg-background/20" : "bg-background/60 text-foreground")}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por número, cliente ou empresa..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Número</th>
              <th className="text-left px-4 py-3 font-medium">Destinatário</th>
              <th className="text-left px-4 py-3 font-medium">Itens</th>
              <th className="text-right px-4 py-3 font-medium">Total</th>
              <th className="text-left px-4 py-3 font-medium">Validade</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhuma proposta encontrada.</td></tr>
            )}
            {filtered.map((p: any) => {
              const recipient = p.clients?.full_name ?? p.leads?.name ?? p.recipient_name ?? "—";
              const company = p.clients?.company ?? p.leads?.company ?? p.recipient_company;
              const meta = STATUS_META[p.status as Status] ?? STATUS_META.rascunho;
              return (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{p.proposal_number || p.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{recipient}</div>
                    {company && <div className="text-xs text-muted-foreground">{company}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.proposal_items?.length ?? 0}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatBRL(p.total)}</td>
                  <td className="px-4 py-3">{p.valid_until ? formatDate(p.valid_until) : "—"}</td>
                  <td className="px-4 py-3"><Badge className={cn("font-normal", meta.cls)}>{meta.label}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewing(p)}>
                          <Eye className="h-4 w-4 mr-2" /> Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditing(p); setFormOpen(true); }}>
                          <FileText className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {p.status === "rascunho" && (
                          <DropdownMenuItem onClick={() => updateStatus(p.id, "enviada", { sent_at: new Date().toISOString() })}>
                            <Send className="h-4 w-4 mr-2" /> Marcar como enviada
                          </DropdownMenuItem>
                        )}
                        {["enviada", "visualizada"].includes(p.status) && (
                          <>
                            <DropdownMenuItem onClick={() => updateStatus(p.id, "aprovada", { approved_at: new Date().toISOString() })}>
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(p.id, "recusada", { rejected_at: new Date().toISOString() })}>
                              <XCircle className="h-4 w-4 mr-2" /> Recusar
                            </DropdownMenuItem>
                          </>
                        )}
                        {p.status === "aprovada" && !p.converted_sale_id && (
                          <DropdownMenuItem onClick={() => convertToSale(p, qc)}>
                            <ArrowRightCircle className="h-4 w-4 mr-2" /> Converter em venda
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => remove(p.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ProposalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        proposal={editing}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["proposals"] }); setFormOpen(false); }}
      />

      <ProposalViewer proposal={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

// ---------- Conversion to sale ----------
async function convertToSale(p: any, qc: any) {
  if (!p.client_id) {
    toast.error("Para converter, vincule a proposta a um cliente. Se a proposta é de um lead, converta o lead em cliente primeiro na pipeline.");
    return;
  }
  if (!p.proposal_items?.length) { toast.error("Proposta sem itens."); return; }
  if (!(await confirmAction("Converter proposta em venda(s) e produto(s) contratado(s)?"))) return;

  try {
    const { data: u } = await supabase.auth.getUser();
    const today = new Date().toISOString().slice(0, 10);
    const firstItem = p.proposal_items[0];
    const productId = firstItem.product_id;
    if (!productId) { toast.error("Item da proposta precisa de produto válido."); return; }

    const { data: sale, error: sErr } = await supabase.from("sales").insert({
      client_id: p.client_id,
      product_id: productId,
      amount: p.total,
      sale_date: today,
      status: "pendente",
      created_by: u.user?.id,
      notes: `Convertida da proposta ${p.proposal_number ?? p.id.slice(0, 8)}`,
    }).select().single();
    if (sErr) throw sErr;

    // Create client_products entries for every item
    const cpRows = p.proposal_items.filter((i: any) => i.product_id).map((i: any) => ({
      client_id: p.client_id,
      product_id: i.product_id,
      value: Number(i.unit_price) * Number(i.quantity) - Number(i.discount || 0),
      discount: i.discount || 0,
      status: "aguardando_inicio",
      start_date: today,
    }));
    if (cpRows.length) {
      const { error: cpErr } = await supabase.from("client_products").insert(cpRows);
      if (cpErr) console.warn(cpErr);
    }

    await supabase.from("proposals").update({
      status: "aprovada",
      converted_at: new Date().toISOString(),
      converted_sale_id: sale.id,
      approved_at: p.approved_at ?? new Date().toISOString(),
    }).eq("id", p.id);

    toast.success("Proposta convertida em venda!");
    qc.invalidateQueries({ queryKey: ["proposals"] });
  } catch (e: any) {
    toast.error(e.message || "Erro ao converter");
  }
}

// ---------- Form dialog ----------
function ProposalFormDialog({ open, onOpenChange, proposal, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; proposal: any | null; onSaved: () => void;
}) {
  const [recipientType, setRecipientType] = useState<"client" | "lead" | "manual">("client");
  const [clientId, setClientId] = useState<string>("");
  const [leadId, setLeadId] = useState<string>("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientCompany, setRecipientCompany] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientDocument, setRecipientDocument] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, full_name, email, company, document").order("full_name")).data ?? [],
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["leads-min"],
    queryFn: async () => (await supabase.from("leads").select("id, name, email, company").order("name")).data ?? [],
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products-min"],
    queryFn: async () => (await supabase.from("products").select("id, name, base_price").order("name")).data ?? [],
  });

  useEffect(() => {
    if (!open) return;
    if (proposal) {
      setRecipientType(proposal.client_id ? "client" : proposal.lead_id ? "lead" : "manual");
      setClientId(proposal.client_id ?? "");
      setLeadId(proposal.lead_id ?? "");
      setRecipientName(proposal.recipient_name ?? "");
      setRecipientCompany(proposal.recipient_company ?? "");
      setRecipientEmail(proposal.recipient_email ?? "");
      setRecipientDocument(proposal.recipient_document ?? "");
      setPaymentTerms(proposal.payment_terms ?? "");
      setNotes(proposal.notes ?? "");
      setValidUntil(proposal.valid_until ?? "");
      setDiscount(Number(proposal.discount ?? 0));
      setItems((proposal.proposal_items ?? []).length
        ? proposal.proposal_items.map((i: any) => ({
            id: i.id, product_id: i.product_id, product_name: i.product_name,
            description: i.description ?? "", quantity: Number(i.quantity),
            unit_price: Number(i.unit_price), discount: Number(i.discount ?? 0),
          }))
        : [emptyItem()]);
    } else {
      setRecipientType("client"); setClientId(""); setLeadId("");
      setRecipientName(""); setRecipientCompany(""); setRecipientEmail(""); setRecipientDocument("");
      setPaymentTerms(""); setNotes("");
      setValidUntil(new Date(Date.now() + 1000 * 60 * 60 * 24 * 15).toISOString().slice(0, 10));
      setDiscount(0); setItems([emptyItem()]);
    }
  }, [open, proposal]);

  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) * Number(i.unit_price) - Number(i.discount || 0)), 0);
  const total = Math.max(0, subtotal - Number(discount || 0));

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const save = async () => {
    if (recipientType === "client" && !clientId) return toast.error("Selecione o cliente");
    if (recipientType === "lead" && !leadId) return toast.error("Selecione o lead");
    if (recipientType === "manual" && !recipientName) return toast.error("Informe o destinatário");
    if (!items.length || items.some(i => !i.product_name)) return toast.error("Cada item precisa de um nome de produto");

    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        client_id: recipientType === "client" ? clientId : null,
        lead_id: recipientType === "lead" ? leadId : null,
        recipient_name: recipientName || null,
        recipient_company: recipientCompany || null,
        recipient_email: recipientEmail || null,
        recipient_document: recipientDocument || null,
        payment_terms: paymentTerms || null,
        notes: notes || null,
        valid_until: validUntil || null,
        discount, subtotal, total,
      };

      let proposalId = proposal?.id;
      if (proposal?.id) {
        const { error } = await supabase.from("proposals").update(payload).eq("id", proposal.id);
        if (error) throw error;
        await supabase.from("proposal_items").delete().eq("proposal_id", proposal.id);
      } else {
        payload.created_by = u.user?.id;
        payload.proposal_number = `PROP-${Date.now().toString().slice(-6)}`;
        const { data, error } = await supabase.from("proposals").insert(payload).select().single();
        if (error) throw error;
        proposalId = data.id;
      }

      const itemRows = items.map((i, idx) => ({
        proposal_id: proposalId,
        product_id: i.product_id || null,
        product_name: i.product_name,
        description: i.description || null,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
        total: Number(i.quantity) * Number(i.unit_price) - Number(i.discount || 0),
        position: idx,
      }));
      const { error: iErr } = await supabase.from("proposal_items").insert(itemRows);
      if (iErr) throw iErr;

      toast.success(proposal ? "Proposta atualizada" : "Proposta criada");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{proposal ? "Editar proposta" : "Nova proposta"}</DialogTitle>
          <DialogDescription>Monte uma proposta comercial profissional.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label className="mb-2 block">Destinatário</Label>
            <div className="flex gap-2 mb-3">
              {(["client", "manual"] as const).map(t => (
                <Button key={t} type="button" size="sm"
                  variant={recipientType === t ? "default" : "outline"}
                  onClick={() => setRecipientType(t)}>
                  {t === "client" ? "Cliente cadastrado" : "Destinatário manual"}
                </Button>
              ))}
            </div>
            {recipientType === "client" && (
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Selecione cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}{c.company ? ` — ${c.company}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {recipientType === "manual" && (
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Nome" value={recipientName} onChange={e => setRecipientName(e.target.value)} />
                <Input placeholder="Empresa" value={recipientCompany} onChange={e => setRecipientCompany(e.target.value)} />
                <Input placeholder="E-mail" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} />
                <Input placeholder="CPF/CNPJ" value={recipientDocument} onChange={e => setRecipientDocument(e.target.value)} />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Itens</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setItems([...items, emptyItem()])}>
                <Plus className="h-3 w-3 mr-1" /> Item
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="rounded-md border p-3 space-y-2 bg-muted/20">
                  <div className="flex gap-2">
                    <Select value={it.product_id ?? ""}
                      onValueChange={(v) => {
                        const prod = products.find((p: any) => p.id === v);
                        updateItem(idx, {
                          product_id: v,
                          product_name: prod?.name ?? it.product_name,
                          unit_price: prod?.base_price ?? it.unit_price,
                        });
                      }}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Produto" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button type="button" size="icon" variant="ghost"
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      disabled={items.length === 1}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input placeholder="Nome do item (livre)" value={it.product_name}
                    onChange={e => updateItem(idx, { product_name: e.target.value })} />
                  <Textarea rows={2} placeholder="Descrição"
                    value={it.description} onChange={e => updateItem(idx, { description: e.target.value })} />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Qtd</Label>
                      <Input type="number" min={1} value={it.quantity}
                        onChange={e => updateItem(idx, { quantity: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-xs">Valor unitário</Label>
                      <Input type="number" min={0} step="0.01" value={it.unit_price}
                        onChange={e => updateItem(idx, { unit_price: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-xs">Desconto</Label>
                      <Input type="number" min={0} step="0.01" value={it.discount}
                        onChange={e => updateItem(idx, { discount: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div className="text-right text-sm font-medium">
                    {formatBRL(Number(it.quantity) * Number(it.unit_price) - Number(it.discount || 0))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Validade</Label>
              <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
            </div>
            <div>
              <Label>Desconto geral</Label>
              <Input type="number" min={0} step="0.01" value={discount}
                onChange={e => setDiscount(Number(e.target.value))} />
            </div>
            <div className="col-span-2">
              <Label>Condição de pagamento</Label>
              <Input placeholder="Ex: 30/60/90 ou À vista via Pix"
                value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-4 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatBRL(subtotal)}</span></div>
            <div className="flex justify-between"><span>Desconto geral</span><span>- {formatBRL(discount)}</span></div>
            <div className="flex justify-between text-base font-semibold pt-1 border-t mt-1"><span>Total</span><span>{formatBRL(total)}</span></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Pretty viewer ----------
function ProposalViewer({ proposal, onClose }: { proposal: any | null; onClose: () => void }) {
  if (!proposal) return null;
  const recipient = proposal.clients?.full_name ?? proposal.leads?.name ?? proposal.recipient_name ?? "—";
  const company = proposal.clients?.company ?? proposal.leads?.company ?? proposal.recipient_company;
  const email = proposal.clients?.email ?? proposal.leads?.email ?? proposal.recipient_email;
  const doc = proposal.clients?.document ?? proposal.recipient_document;
  const meta = STATUS_META[proposal.status as Status] ?? STATUS_META.rascunho;

  return (
    <Dialog open={!!proposal} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-background border-b px-6 py-3 flex items-center justify-between print:hidden">
          <DialogTitle className="text-sm font-medium">Proposta {proposal.proposal_number || proposal.id.slice(0, 8)}</DialogTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
          </div>
        </div>

        <div className="p-10 space-y-8 print:p-6 bg-card">
          <div className="flex items-start justify-between border-b pb-6">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Proposta Comercial</div>
              <div className="text-3xl font-bold mt-1">{proposal.proposal_number || `#${proposal.id.slice(0, 8)}`}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Emitida em {formatDate(proposal.created_at)}
                {proposal.valid_until && <> · Válida até {formatDate(proposal.valid_until)}</>}
              </div>
            </div>
            <Badge className={cn("text-sm px-3 py-1", meta.cls)}>{meta.label}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Para</div>
              <div className="font-semibold text-base">{recipient}</div>
              {company && <div>{company}</div>}
              {doc && <div className="text-muted-foreground">{doc}</div>}
              {email && <div className="text-muted-foreground">{email}</div>}
            </div>
            {proposal.payment_terms && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Condição de pagamento</div>
                <div>{proposal.payment_terms}</div>
              </div>
            )}
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Itens</div>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Descrição</th>
                    <th className="text-right px-4 py-2 font-medium w-16">Qtd</th>
                    <th className="text-right px-4 py-2 font-medium w-32">Unitário</th>
                    <th className="text-right px-4 py-2 font-medium w-32">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(proposal.proposal_items ?? []).map((i: any) => (
                    <tr key={i.id} className="border-t align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium">{i.product_name}</div>
                        {i.description && <div className="text-xs text-muted-foreground mt-1">{i.description}</div>}
                      </td>
                      <td className="px-4 py-3 text-right">{i.quantity}</td>
                      <td className="px-4 py-3 text-right">{formatBRL(i.unit_price)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatBRL(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-72 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatBRL(proposal.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span>- {formatBRL(proposal.discount)}</span></div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t mt-2">
                <span>Total</span><span>{formatBRL(proposal.total)}</span>
              </div>
            </div>
          </div>

          {proposal.notes && (
            <div className="text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Observações</div>
              <p className="whitespace-pre-line text-muted-foreground">{proposal.notes}</p>
            </div>
          )}

          <div className="text-xs text-muted-foreground border-t pt-4">
            Esta proposta tem caráter comercial e está sujeita aos termos descritos. Para aceite formal, responda confirmando a aprovação.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
