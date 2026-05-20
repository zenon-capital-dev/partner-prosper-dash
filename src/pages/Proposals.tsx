import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
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
  FileText, Printer, ArrowRightCircle, X, ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { confirmAction } from "@/lib/confirm";
import { useAuth } from "@/hooks/useAuth";

type Status = "rascunho" | "enviada" | "visualizada" | "aprovada" | "recusada" | "vencida";

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  rascunho:    { label: "Rascunho",    cls: "bg-slate-100 text-slate-700 border-slate-200" },
  enviada:     { label: "Enviada",     cls: "bg-blue-50 text-blue-700 border-blue-200" },
  visualizada: { label: "Visualizada", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  aprovada:    { label: "Aprovada",    cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  recusada:    { label: "Recusada",    cls: "bg-rose-50 text-rose-700 border-rose-200" },
  vencida:     { label: "Vencida",     cls: "bg-amber-50 text-amber-700 border-amber-200" },
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

// ---------- Helpers ----------
const num = (v: any, fallback = 0) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};
const norm = (s: any) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const onlyDigits = (s: any) => String(s ?? "").replace(/\D+/g, "");
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const daysUntil = (iso?: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d).getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / 86400000);
};

type SortKey = "number" | "recipient" | "total" | "valid_until" | "status" | "created_at";
type SortDir = "asc" | "desc";

export default function Proposals() {
  const qc = useQueryClient();
  const { isAdmin, isAdminSecondary } = useAuth();
  const canManage = isAdmin || isAdminSecondary;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [linkFilter, setLinkFilter] = useState<"all" | "client" | "lead" | "manual">("all");
  const [validityFilter, setValidityFilter] = useState<"all" | "valid" | "expiring" | "expired" | "no_date">("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  // Auto-mark expired — uses local date and runs once per dataset
  useEffect(() => {
    if (!canManage || !proposals.length) return;
    const today = todayLocal();
    const stale = proposals.filter((p: any) =>
      p.valid_until && p.valid_until < today &&
      ["enviada", "visualizada", "rascunho"].includes(p.status)
    );
    if (!stale.length) return;
    let cancelled = false;
    (async () => {
      const { error } = await supabase
        .from("proposals")
        .update({ status: "vencida" })
        .in("id", stale.map((p: any) => p.id));
      if (!cancelled && !error) qc.invalidateQueries({ queryKey: ["proposals"] });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposals.length, canManage]);

  const filtered = useMemo(() => {
    const s = norm(search.trim());
    const sDigits = onlyDigits(search);
    const today = todayLocal();

    const arr = proposals.filter((p: any) => {
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;

      if (linkFilter !== "all") {
        const kind = p.client_id ? "client" : p.lead_id ? "lead" : "manual";
        if (kind !== linkFilter) return false;
      }

      if (validityFilter !== "all") {
        if (validityFilter === "no_date") {
          if (p.valid_until) return false;
        } else {
          if (!p.valid_until) return false;
          const d = daysUntil(p.valid_until);
          if (d === null) return false;
          if (validityFilter === "expired" && !(p.valid_until < today)) return false;
          if (validityFilter === "valid" && !(p.valid_until >= today)) return false;
          if (validityFilter === "expiring" && !(d >= 0 && d <= 7)) return false;
        }
      }

      if (s) {
        const recipient = p.clients?.full_name ?? p.leads?.name ?? p.recipient_name ?? "";
        const company = p.clients?.company ?? p.leads?.company ?? p.recipient_company ?? "";
        const email = p.clients?.email ?? p.leads?.email ?? p.recipient_email ?? "";
        const doc = p.clients?.document ?? p.recipient_document ?? "";
        const haystack = norm([p.proposal_number, recipient, company, email, doc].join(" "));
        const matchText = haystack.includes(s);
        const matchDoc = sDigits.length >= 3 && onlyDigits(doc).includes(sDigits);
        if (!matchText && !matchDoc) return false;
      }
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a: any, b: any) => {
      const av = (() => {
        switch (sortKey) {
          case "number": return String(a.proposal_number ?? a.id);
          case "recipient": return norm(a.clients?.full_name ?? a.leads?.name ?? a.recipient_name ?? "");
          case "total": return Number(a.total ?? 0);
          case "valid_until": return a.valid_until ?? "";
          case "status": return a.status ?? "";
          default: return a.created_at ?? "";
        }
      })();
      const bv = (() => {
        switch (sortKey) {
          case "number": return String(b.proposal_number ?? b.id);
          case "recipient": return norm(b.clients?.full_name ?? b.leads?.name ?? b.recipient_name ?? "");
          case "total": return Number(b.total ?? 0);
          case "valid_until": return b.valid_until ?? "";
          case "status": return b.status ?? "";
          default: return b.created_at ?? "";
        }
      })();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [proposals, search, statusFilter, linkFilter, validityFilter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "created_at" || k === "total" ? "desc" : "asc"); }
  };

  const updateStatus = async (id: string, status: Status, extra: any = {}) => {
    const { error } = await supabase.from("proposals").update({ status, ...extra }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["proposals"] });
    }
  };

  const remove = async (p: any) => {
    if (p.converted_sale_id) {
      toast.error("Esta proposta já foi convertida em venda e não pode ser excluída.");
      return;
    }
    if (!(await confirmAction(`Excluir a proposta ${p.proposal_number || p.id.slice(0, 8)}? Esta ação não pode ser desfeita.`))) return;
    const { error } = await supabase.from("proposals").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Proposta excluída");
      qc.invalidateQueries({ queryKey: ["proposals"] });
    }
  };

  const kpis = useMemo(() => {
    const total = proposals.length;
    const totalValue = proposals.reduce((s: number, p: any) => s + Number(p.total || 0), 0);
    const approved = proposals.filter((p: any) => p.status === "aprovada");
    const approvedValue = approved.reduce((s: number, p: any) => s + Number(p.total || 0), 0);
    const sent = proposals.filter((p: any) => ["enviada", "visualizada"].includes(p.status)).length;
    const conversionRate = total > 0 ? Math.round((approved.length / total) * 100) : 0;
    return { total, totalValue, approvedValue, approvedCount: approved.length, sent, conversionRate };
  }, [proposals]);

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (statusFilter !== "todos") activeChips.push({ key: "status", label: `Status: ${STATUS_META[statusFilter as Status]?.label ?? statusFilter}`, clear: () => setStatusFilter("todos") });
  if (linkFilter !== "all") activeChips.push({ key: "link", label: `Vínculo: ${linkFilter === "client" ? "Cliente" : linkFilter === "lead" ? "Lead" : "Manual"}`, clear: () => setLinkFilter("all") });
  if (validityFilter !== "all") activeChips.push({ key: "validity", label: `Validade: ${validityFilter === "valid" ? "Vigente" : validityFilter === "expiring" ? "Vence em 7d" : validityFilter === "expired" ? "Vencida" : "Sem data"}`, clear: () => setValidityFilter("all") });
  if (search.trim()) activeChips.push({ key: "search", label: `Busca: "${search.trim()}"`, clear: () => setSearch("") });

  const clearAll = () => { setStatusFilter("todos"); setLinkFilter("all"); setValidityFilter("all"); setSearch(""); };

  return (
    <div className="page-shell space-y-6 animate-fade-up">
      <PageHero
        eyebrow="Comercial"
        title="Propostas Comerciais"
        description="Monte propostas profissionais, acompanhe o funil e converta em vendas."
        icon={<FileText className="h-5 w-5" />}
        actions={
          canManage ? (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Nova proposta
            </Button>
          ) : null
        }
        kpis={[
          { label: "Total", value: kpis.total, tone: "primary" },
          { label: "Em Negociação", value: kpis.sent, tone: "info" },
          { label: "Aprovadas", value: kpis.approvedCount, tone: "success" },
          { label: "Conversão", value: `${kpis.conversionRate}%`, tone: kpis.conversionRate >= 30 ? "success" : "warning" },
          { label: "Receita Aprovada", value: formatBRL(kpis.approvedValue), tone: "success" },
        ]}
      />

      {/* Status tabs */}
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
                "h-8 px-3 rounded-md text-xs font-semibold border transition-all flex items-center gap-2",
                active
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              {t.label}
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] tabular-nums font-mono",
                active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              )}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9 bg-white border-slate-200"
            placeholder="Buscar por número, cliente, empresa, e-mail ou documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={linkFilter} onValueChange={(v: any) => setLinkFilter(v)}>
          <SelectTrigger className="w-[180px] bg-white border-slate-200"><SelectValue placeholder="Vínculo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os vínculos</SelectItem>
            <SelectItem value="client">Clientes</SelectItem>
            <SelectItem value="lead">Leads</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>

        <Select value={validityFilter} onValueChange={(v: any) => setValidityFilter(v)}>
          <SelectTrigger className="w-[200px] bg-white border-slate-200"><SelectValue placeholder="Validade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda validade</SelectItem>
            <SelectItem value="valid">Vigente</SelectItem>
            <SelectItem value="expiring">Vence em 7 dias</SelectItem>
            <SelectItem value="expired">Vencida</SelectItem>
            <SelectItem value="no_date">Sem data</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((c) => (
            <button
              key={c.key}
              onClick={c.clear}
              className="h-7 px-2.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 flex items-center gap-1.5"
            >
              {c.label}
              <X className="h-3 w-3" />
            </button>
          ))}
          <button
            onClick={clearAll}
            className="h-7 px-2.5 rounded-full text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            Limpar tudo
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-slate-200/70 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200/70">
              <tr>
                <SortableTh label="Número" k="number" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Destinatário" k="recipient" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide">Itens</th>
                <SortableTh label="Total" k="total" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="Validade" k="valid_until" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-3 bg-slate-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <div className="text-sm font-medium text-slate-700">Nenhuma proposta encontrada</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {activeChips.length ? "Tente limpar os filtros." : "Crie sua primeira proposta para começar."}
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && filtered.map((p: any) => {
                const recipient = p.clients?.full_name ?? p.leads?.name ?? p.recipient_name ?? "—";
                const company = p.clients?.company ?? p.leads?.company ?? p.recipient_company;
                const meta = STATUS_META[p.status as Status] ?? STATUS_META.rascunho;
                const d = daysUntil(p.valid_until);
                return (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{p.proposal_number || p.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{recipient}</div>
                      {company && <div className="text-xs text-slate-500">{company}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums">{p.proposal_items?.length ?? 0}</td>
                    <td className="px-4 py-3 text-right font-semibold font-mono text-slate-900">{formatBRL(p.total)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {p.valid_until ? (
                        <div className="flex flex-col">
                          <span>{formatDate(p.valid_until)}</span>
                          {d !== null && p.status !== "aprovada" && p.status !== "recusada" && (
                            <span className={cn(
                              "text-[10px] font-medium mt-0.5",
                              d < 0 ? "text-rose-600" : d <= 7 ? "text-amber-600" : "text-slate-400"
                            )}>
                              {d < 0 ? `Vencida há ${Math.abs(d)}d` : d === 0 ? "Vence hoje" : `${d}d restantes`}
                            </span>
                          )}
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn("font-medium border", meta.cls)} variant="outline">{meta.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewing(p)}>
                            <Eye className="h-4 w-4 mr-2" /> Visualizar
                          </DropdownMenuItem>
                          {canManage && (
                            <DropdownMenuItem onClick={() => { setEditing(p); setFormOpen(true); }}>
                              <FileText className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                          )}
                          {canManage && <DropdownMenuSeparator />}
                          {canManage && p.status === "rascunho" && (
                            <DropdownMenuItem onClick={() => updateStatus(p.id, "enviada", { sent_at: new Date().toISOString() })}>
                              <Send className="h-4 w-4 mr-2" /> Marcar como enviada
                            </DropdownMenuItem>
                          )}
                          {canManage && ["enviada", "visualizada"].includes(p.status) && (
                            <>
                              <DropdownMenuItem onClick={() => updateStatus(p.id, "aprovada", { approved_at: new Date().toISOString() })}>
                                <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(p.id, "recusada", { rejected_at: new Date().toISOString() })}>
                                <XCircle className="h-4 w-4 mr-2" /> Recusar
                              </DropdownMenuItem>
                            </>
                          )}
                          {canManage && p.status === "aprovada" && !p.converted_sale_id && (
                            <DropdownMenuItem onClick={() => convertToSale(p, qc)}>
                              <ArrowRightCircle className="h-4 w-4 mr-2" /> Converter em venda
                            </DropdownMenuItem>
                          )}
                          {canManage && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-rose-600 focus:text-rose-700" onClick={() => remove(p)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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

function SortableTh({ label, k, sortKey, sortDir, onClick, align = "left" }: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: SortDir;
  onClick: (k: SortKey) => void; align?: "left" | "right";
}) {
  const active = sortKey === k;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cn("px-4 py-3 font-medium text-xs uppercase tracking-wide select-none", align === "right" ? "text-right" : "text-left")}>
      <button
        onClick={() => onClick(k)}
        className={cn(
          "inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors",
          active ? "text-slate-900" : "text-slate-600"
        )}
      >
        {label}
        <Icon className={cn("h-3 w-3", active ? "opacity-100" : "opacity-40")} />
      </button>
    </th>
  );
}

// ---------- Conversion to sale ----------
async function convertToSale(p: any, qc: any) {
  if (!p.client_id) {
    toast.error("Para converter, vincule a proposta a um cliente. Converta o lead em cliente primeiro.");
    return;
  }
  const items = (p.proposal_items ?? []).filter((i: any) => i.product_id);
  if (!items.length) {
    toast.error("Adicione ao menos um item com produto vinculado para converter.");
    return;
  }
  if (!(await confirmAction("Converter esta proposta em venda e demanda(s)?"))) return;

  try {
    const { data: u } = await supabase.auth.getUser();
    const today = todayLocal();
    const firstItem = items[0];

    const { data: sale, error: sErr } = await supabase.from("sales").insert({
      client_id: p.client_id,
      product_id: firstItem.product_id,
      amount: Number(p.total ?? 0),
      sale_date: today,
      status: "pendente",
      created_by: u.user?.id,
      notes: `Convertida da proposta ${p.proposal_number ?? p.id.slice(0, 8)}`,
    }).select().single();
    if (sErr) throw sErr;

    const cpRows = items.map((i: any) => ({
      client_id: p.client_id,
      product_id: i.product_id,
      value: Math.max(0, num(i.unit_price) * num(i.quantity, 1) - num(i.discount)),
      discount: num(i.discount),
      status: "aguardando_inicio",
      start_date: today,
    }));
    if (cpRows.length) {
      const { error: cpErr } = await supabase.from("client_products").insert(cpRows);
      if (cpErr) console.warn("client_products insert", cpErr);
    }

    const { error: upErr } = await supabase.from("proposals").update({
      status: "aprovada",
      converted_at: new Date().toISOString(),
      converted_sale_id: sale.id,
      approved_at: p.approved_at ?? new Date().toISOString(),
    }).eq("id", p.id);
    if (upErr) throw upErr;

    toast.success("Proposta convertida em venda!");
    qc.invalidateQueries({ queryKey: ["proposals"] });
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["client_products"] });
  } catch (e: any) {
    toast.error(e.message || "Erro ao converter proposta");
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
    enabled: open,
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["leads-min"],
    queryFn: async () => (await supabase.from("leads").select("id, name, email, company").order("name")).data ?? [],
    enabled: open,
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products-min"],
    queryFn: async () => (await supabase.from("products").select("id, name, base_price").order("name")).data ?? [],
    enabled: open,
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
      setDiscount(num(proposal.discount));
      setItems((proposal.proposal_items ?? []).length
        ? proposal.proposal_items.map((i: any) => ({
            id: i.id, product_id: i.product_id, product_name: i.product_name,
            description: i.description ?? "", quantity: num(i.quantity, 1),
            unit_price: num(i.unit_price), discount: num(i.discount),
          }))
        : [emptyItem()]);
    } else {
      setRecipientType("client"); setClientId(""); setLeadId("");
      setRecipientName(""); setRecipientCompany(""); setRecipientEmail(""); setRecipientDocument("");
      setPaymentTerms(""); setNotes("");
      const d = new Date(Date.now() + 1000 * 60 * 60 * 24 * 15);
      setValidUntil(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      setDiscount(0); setItems([emptyItem()]);
    }
  }, [open, proposal]);

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + Math.max(0, num(i.quantity, 1) * num(i.unit_price) - num(i.discount)), 0),
    [items]
  );
  const total = useMemo(() => Math.max(0, subtotal - num(discount)), [subtotal, discount]);

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const save = async () => {
    if (recipientType === "client" && !clientId) return toast.error("Selecione o cliente");
    if (recipientType === "lead" && !leadId) return toast.error("Selecione o lead");
    if (recipientType === "manual") {
      if (!recipientName.trim()) return toast.error("Informe o nome do destinatário");
      if (recipientEmail && !isEmail(recipientEmail)) return toast.error("E-mail inválido");
    }
    if (!items.length) return toast.error("Adicione ao menos um item");
    for (const [i, it] of items.entries()) {
      if (!it.product_name.trim()) return toast.error(`Item ${i + 1}: informe o nome do produto`);
      if (num(it.quantity, 0) <= 0) return toast.error(`Item ${i + 1}: quantidade deve ser maior que zero`);
      if (num(it.unit_price) < 0) return toast.error(`Item ${i + 1}: valor não pode ser negativo`);
      if (num(it.discount) < 0) return toast.error(`Item ${i + 1}: desconto não pode ser negativo`);
      if (num(it.discount) > num(it.quantity, 1) * num(it.unit_price)) return toast.error(`Item ${i + 1}: desconto maior que o subtotal`);
    }
    if (num(discount) < 0) return toast.error("Desconto geral não pode ser negativo");
    if (num(discount) > subtotal) return toast.error("Desconto geral maior que o subtotal");

    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        client_id: recipientType === "client" ? clientId : null,
        lead_id: recipientType === "lead" ? leadId : null,
        recipient_name: recipientType === "manual" ? recipientName.trim() : null,
        recipient_company: recipientType === "manual" ? (recipientCompany.trim() || null) : null,
        recipient_email: recipientType === "manual" ? (recipientEmail.trim().toLowerCase() || null) : null,
        recipient_document: recipientType === "manual" ? (onlyDigits(recipientDocument) || null) : null,
        payment_terms: paymentTerms.trim() || null,
        notes: notes.trim() || null,
        valid_until: validUntil || null,
        discount: num(discount),
        subtotal,
        total,
      };

      let proposalId = proposal?.id;
      if (proposal?.id) {
        const { error } = await supabase.from("proposals").update(payload).eq("id", proposal.id);
        if (error) throw error;
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
        product_name: i.product_name.trim(),
        description: i.description.trim() || null,
        quantity: num(i.quantity, 1),
        unit_price: num(i.unit_price),
        discount: num(i.discount),
        total: Math.max(0, num(i.quantity, 1) * num(i.unit_price) - num(i.discount)),
        position: idx,
      }));

      // Insert new items first, then remove old (edit). For create, just insert.
      if (proposal?.id) {
        const { error: insErr } = await supabase.from("proposal_items").insert(itemRows);
        if (insErr) throw insErr;
        // remove old items
        const oldIds = (proposal.proposal_items ?? []).map((i: any) => i.id).filter(Boolean);
        if (oldIds.length) {
          await supabase.from("proposal_items").delete().in("id", oldIds);
        }
      } else {
        const { error: iErr } = await supabase.from("proposal_items").insert(itemRows);
        if (iErr) throw iErr;
      }

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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>{proposal ? "Editar proposta" : "Nova proposta"}</DialogTitle>
          <DialogDescription>Monte uma proposta comercial profissional.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label className="mb-2 block">Destinatário</Label>
            <div className="flex flex-wrap gap-2 mb-3">
              {(["client", "lead", "manual"] as const).map(t => (
                <Button key={t} type="button" size="sm"
                  variant={recipientType === t ? "default" : "outline"}
                  onClick={() => setRecipientType(t)}>
                  {t === "client" ? "Cliente" : t === "lead" ? "Lead" : "Manual"}
                </Button>
              ))}
            </div>
            {recipientType === "client" && (
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}{c.company ? ` — ${c.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {recipientType === "lead" && (
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger><SelectValue placeholder="Selecione um lead" /></SelectTrigger>
                <SelectContent>
                  {leads.map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}{l.company ? ` — ${l.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {recipientType === "manual" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Nome *" value={recipientName} onChange={e => setRecipientName(e.target.value)} />
                <Input placeholder="Empresa" value={recipientCompany} onChange={e => setRecipientCompany(e.target.value)} />
                <Input type="email" placeholder="E-mail" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} />
                <Input placeholder="CPF/CNPJ" value={recipientDocument} onChange={e => setRecipientDocument(e.target.value)} />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Itens</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setItems([...items, emptyItem()])}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar item
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((it, idx) => {
                const itemTotal = Math.max(0, num(it.quantity, 1) * num(it.unit_price) - num(it.discount));
                return (
                  <div key={idx} className="rounded-md border border-slate-200 p-3 space-y-2 bg-slate-50/40">
                    <div className="flex gap-2">
                      <Select value={it.product_id ?? ""}
                        onValueChange={(v) => {
                          const prod = products.find((p: any) => p.id === v);
                          updateItem(idx, {
                            product_id: v,
                            product_name: prod?.name ?? it.product_name,
                            unit_price: num(prod?.base_price ?? it.unit_price),
                          });
                        }}>
                        <SelectTrigger className="flex-1 bg-white"><SelectValue placeholder="Vincular a produto (opcional)" /></SelectTrigger>
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
                    <Input className="bg-white" placeholder="Nome do item *" value={it.product_name}
                      onChange={e => updateItem(idx, { product_name: e.target.value })} />
                    <Textarea className="bg-white" rows={2} placeholder="Descrição (opcional)"
                      value={it.description} onChange={e => updateItem(idx, { description: e.target.value })} />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Qtd</Label>
                        <Input className="bg-white" type="number" min={1} step="1" value={it.quantity}
                          onChange={e => updateItem(idx, { quantity: num(e.target.value, 1) })} />
                      </div>
                      <div>
                        <Label className="text-xs">Valor unitário</Label>
                        <Input className="bg-white" type="number" min={0} step="0.01" value={it.unit_price}
                          onChange={e => updateItem(idx, { unit_price: num(e.target.value) })} />
                      </div>
                      <div>
                        <Label className="text-xs">Desconto</Label>
                        <Input className="bg-white" type="number" min={0} step="0.01" value={it.discount}
                          onChange={e => updateItem(idx, { discount: num(e.target.value) })} />
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold font-mono text-slate-800">
                      {formatBRL(itemTotal)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Validade</Label>
              <Input className="bg-white" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
            </div>
            <div>
              <Label>Desconto geral</Label>
              <Input className="bg-white" type="number" min={0} step="0.01" value={discount}
                onChange={e => setDiscount(num(e.target.value))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Condição de pagamento</Label>
              <Input className="bg-white" placeholder="Ex: 30/60/90 ou À vista via Pix"
                value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <Textarea className="bg-white" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-1 text-sm">
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="font-mono">{formatBRL(subtotal)}</span></div>
            <div className="flex justify-between text-slate-600"><span>Desconto geral</span><span className="font-mono">- {formatBRL(num(discount))}</span></div>
            <div className="flex justify-between text-base font-semibold pt-2 border-t border-slate-200 mt-2 text-slate-900">
              <span>Total</span><span className="font-mono">{formatBRL(total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 bg-white">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between print:hidden z-10">
          <DialogTitle className="text-sm font-medium text-slate-700">
            Proposta {proposal.proposal_number || proposal.id.slice(0, 8)}
          </DialogTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
          </div>
        </div>

        <div className="p-8 sm:p-10 space-y-8 print:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500">Proposta Comercial</div>
              <div className="text-3xl font-bold mt-1 text-slate-900 font-mono">
                {proposal.proposal_number || `#${proposal.id.slice(0, 8)}`}
              </div>
              <div className="mt-2 text-sm text-slate-500">
                Emitida em {formatDate(proposal.created_at)}
                {proposal.valid_until && <> · Válida até {formatDate(proposal.valid_until)}</>}
              </div>
            </div>
            <Badge className={cn("text-sm px-3 py-1 border self-start", meta.cls)} variant="outline">{meta.label}</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Para</div>
              <div className="font-semibold text-base text-slate-900">{recipient}</div>
              {company && <div className="text-slate-700">{company}</div>}
              {doc && <div className="text-slate-500">{doc}</div>}
              {email && <div className="text-slate-500">{email}</div>}
            </div>
            {proposal.payment_terms && (
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Condição de pagamento</div>
                <div className="text-slate-800">{proposal.payment_terms}</div>
              </div>
            )}
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-3">Itens</div>
            <div className="rounded-md border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Descrição</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-600 w-16">Qtd</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-600 w-32">Unitário</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-600 w-32">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(proposal.proposal_items ?? []).map((i: any) => (
                    <tr key={i.id} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{i.product_name}</div>
                        {i.description && <div className="text-xs text-slate-500 mt-1 whitespace-pre-line">{i.description}</div>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{i.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">{formatBRL(i.unit_price)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">{formatBRL(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-full sm:w-72 text-sm space-y-1">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="font-mono">{formatBRL(proposal.subtotal)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Desconto</span><span className="font-mono">- {formatBRL(proposal.discount)}</span></div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-200 mt-2 text-slate-900">
                <span>Total</span><span className="font-mono">{formatBRL(proposal.total)}</span>
              </div>
            </div>
          </div>

          {proposal.notes && (
            <div className="text-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Observações</div>
              <p className="whitespace-pre-line text-slate-700">{proposal.notes}</p>
            </div>
          )}

          <div className="text-xs text-slate-500 border-t border-slate-200 pt-4">
            Esta proposta tem caráter comercial e está sujeita aos termos descritos. Para aceite formal, responda confirmando a aprovação.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
