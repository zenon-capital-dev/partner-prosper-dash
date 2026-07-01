import { useMemo, useState, useEffect } from "react";
import { subDays, startOfMonth, startOfToday, endOfDay } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/hooks/useAuth";
import { useInternalTeamRef } from "@/hooks/useReferenceData";

import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AllBeneficiariesTable } from "@/components/commissions/AllBeneficiariesTable";
import {
  Wallet, Clock, CheckCircle2, XCircle, Plus, Search, MoreHorizontal,
  Pencil, Trash2, Check, Download, TrendingUp, X, Receipt, CircleDollarSign,
  ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import { formatBRL, formatDate, formatPercent, initials } from "@/lib/format";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import { PaginationControl } from "@/components/ui/PaginationControl";

type StatusKey =
  | "all" | "aguardando_confirmacao" | "pendente" | "liberada"
  | "em_pagamento" | "paga" | "cancelada" | "estornada";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  aguardando_confirmacao: { label: "Aguardando", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  pendente: { label: "Pendente", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  liberada: { label: "Liberada", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  em_pagamento: { label: "Em pagamento", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  paga: { label: "Paga", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pago: { label: "Paga", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelada: { label: "Cancelada", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  estornada: { label: "Estornada", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

const OPEN_STATUSES = ["aguardando_confirmacao", "pendente", "liberada", "em_pagamento"];
const PAID_STATUSES = ["paga", "pago"];

const commissionTriggerEvents = [
  { value: "first_sale", label: "Primeira Venda" },
  { value: "renewal", label: "Renovação" },
  { value: "recurrence", label: "Recorrência" },
  { value: "single_payment", label: "Pagamento Único" },
];

const norm = (s: any) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const exportCsv = (filename: string, headers: string[], rows: any[][]) => {
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => {
      const s = String(c ?? "");
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

type SortDir = "asc" | "desc";
function SortableTh({ label, k, sortKey, sortDir, onSort, align = "left" }: any) {
  const active = sortKey === k;
  return (
    <th className={cn("px-4 py-3 select-none text-[11px] uppercase tracking-wider font-semibold text-slate-500",
      align === "center" && "text-center", align === "right" && "text-right")}>
      <button onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 hover:text-slate-700 transition-colors", active && "text-indigo-700")}>
        {label}
        {active ? (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </th>
  );
}

export default function Commissions() {
  const qc = useQueryClient();
  const { isAdmin, isAdminSecondary } = useAuth();
  const canManage = isAdmin || isAdminSecondary;

  const [rangeKey, setRangeKey] = useState<"HOJE" | "7 DIAS" | "30 DIAS" | "MÊS" | "TUDO">("TUDO");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [rulesSearch, setRulesSearch] = useState("");
  const itemsPerPage = 10;

  // sort
  const [sort, setSort] = useState<{k: string; d: SortDir}>({k: "created_at", d: "desc"});
  const toggleSort = (k: string) => setSort((s) => ({ k, d: s.k === k && s.d === "desc" ? "asc" : "desc" }));

  useEffect(() => {
    setCurrentPage(1);
    setSelected({});
  }, [debouncedSearch, statusFilter, partnerFilter, rangeKey, dateFrom, dateTo]);

  // dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [ruleCreateOpen, setRuleCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [payForm, setPayForm] = useState({
    paid_at: new Date().toISOString().slice(0, 10),
    payment_method: "pix",
    notes: "",
  });

  const { data: collaborators = [] } = useInternalTeamRef(createOpen);


  const { data: referrers = [] } = useQuery({
    queryKey: ["referrers-simple"],
    enabled: createOpen,
    queryFn: async () => (await supabase.from("referrers").select("id,full_name").order("full_name").limit(300)).data ?? [],
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["providers-simple"],
    enabled: createOpen,
    queryFn: async () => (await supabase.from("service_providers").select("id,name").order("name").limit(300)).data ?? [],
  });
  const [createForm, setCreateForm] = useState<any>({
    beneficiary_id: "", beneficiary_type: "partner", sale_id: "", amount: 0, percent: 10,
    commission_type: "percentual", status: "aguardando_confirmacao", notes: "",
  });
  const [ruleForm, setRuleForm] = useState<any>({
    partner_id: "", product_id: "", rule_type: "percentage", value: 0,
    is_recurring: false, trigger_event: "first_sale", release_after_payment: true,
  });

  // ----- Queries -----
  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ["commissions-list"],
    queryFn: async () => {
      const [commsRes, splitsRes, partnersRes, profilesRes, referrersRes, providersRes, salesRes, clientsRes, productsRes] = await Promise.all([
        supabase
          .from("commissions")
          .select("*, partners(id,full_name,email,pix_key), referrers(id,full_name), profiles:profiles!commissions_collaborator_id_fkey(id,full_name), sales(amount, sale_date, clients(id,full_name), products(id,name))")
          .order("created_at", { ascending: false }).limit(300),
        supabase.from("commission_splits").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("partners").select("id,full_name,email,pix_key").limit(300),
        supabase.from("profiles").select("id,full_name").limit(300),
        supabase.from("referrers").select("id,full_name").limit(300),
        supabase.from("service_providers").select("id,name").limit(300),
        supabase.from("sales").select("id, amount, sale_date, client_id, product_id").order("sale_date", { ascending: false }).limit(300),
        supabase.from("clients").select("id, full_name").limit(300),
        supabase.from("products").select("id, name").limit(300),
      ]);
      const partnersMap = new Map((partnersRes.data ?? []).map((p: any) => [p.id, p]));
      const profilesMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
      const referrersMap = new Map((referrersRes.data ?? []).map((r: any) => [r.id, r]));
      const providersMap = new Map((providersRes.data ?? []).map((p: any) => [p.id, { id: p.id, full_name: p.name }]));
      const salesMap = new Map((salesRes.data ?? []).map((s: any) => [s.id, s]));
      const clientsMap = new Map((clientsRes.data ?? []).map((c: any) => [c.id, c]));
      const productsMap = new Map((productsRes.data ?? []).map((p: any) => [p.id, p]));

      const splitRows = (splitsRes.data ?? []).map((s: any) => {
        const sale: any = salesMap.get(s.sale_id) || {};
        const partner = s.beneficiary_type === "partner" ? partnersMap.get(s.beneficiary_id) : null;
        const profile = s.beneficiary_type === "collaborator" ? profilesMap.get(s.beneficiary_id) : null;
        const referrer = s.beneficiary_type === "referrer" ? referrersMap.get(s.beneficiary_id) : null;
        const provider = s.beneficiary_type === "service_provider" ? providersMap.get(s.beneficiary_id) : null;
        const wsMap: Record<string, string> = { pendente: "aguardando_confirmacao", pago: "paga", cancelado: "cancelada" };
        return {
          id: s.id,
          _source: "split",
          sale_id: s.sale_id,
          partner_id: s.beneficiary_type === "partner" ? s.beneficiary_id : null,
          collaborator_id: s.beneficiary_type === "collaborator" ? s.beneficiary_id : null,
          referrer_id: s.beneficiary_type === "referrer" ? s.beneficiary_id : null,
          provider_id: s.beneficiary_type === "service_provider" ? s.beneficiary_id : null,
          beneficiary_type: s.beneficiary_type,
          amount: s.amount,
          percent: s.percent,
          status: s.status,
          workflow_status: wsMap[s.status] || s.status,
          commission_type: "percentual",
          paid_at: s.paid_at,
          approval_date: s.paid_at,
          payment_method: s.payment_method,
          notes: s.notes,
          created_at: s.created_at,
          partners: partner || null,
          profiles: profile || null,
          referrers: referrer || null,
          service_providers: provider || null,
          sales: sale.id ? {
            amount: sale.amount,
            sale_date: sale.sale_date,
            clients: clientsMap.get(sale.client_id) || null,
            products: productsMap.get(sale.product_id) || null,
          } : null,
        };
      });

      // Avoid showing manual commissions if a split already exists for same sale+beneficiary
      const splitKeys = new Set(splitRows.map((s: any) => `${s.sale_id}|${s.partner_id || s.collaborator_id || s.referrer_id || s.provider_id}`));
      const commRows = (commsRes.data ?? [])
        .filter((c: any) => !splitKeys.has(`${c.sale_id}|${c.partner_id || c.collaborator_id || c.referrer_id}`))
        .map((c: any) => ({ ...c, _source: "commission" }));

      return [...splitRows, ...commRows].sort((a: any, b: any) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      );
    },
  });

  const { data: rules = [], isLoading: loadingRules } = useQuery({
    queryKey: ["commission-rules"],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_rules")
        .select("*, partners(full_name), products(name)")
        .order("created_at", { ascending: false })
        .limit(300);
      return data ?? [];
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-simple"],
    enabled: createOpen || ruleCreateOpen,
    queryFn: async () => (await supabase.from("partners").select("id,full_name,pix_key").order("full_name").limit(300)).data ?? [],
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-simple"],
    enabled: ruleCreateOpen,
    queryFn: async () => (await supabase.from("products").select("id,name").order("name").limit(300)).data ?? [],
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["sales-simple"],
    queryFn: async () => (await supabase.from("sales").select("id,amount,sale_date,commission_percent,client_id,product_id,clients(full_name),products(name)").order("sale_date", { ascending: false }).limit(200)).data ?? [],
  });

  // ----- Filtering -----
  const filtered = useMemo(() => {
    const today = startOfToday();
    let start = today;
    let end = endOfDay(today);
    if (rangeKey === "7 DIAS") start = subDays(today, 6);
    else if (rangeKey === "30 DIAS") start = subDays(today, 29);
    else if (rangeKey === "MÊS") start = startOfMonth(today);

    const q = norm(debouncedSearch);

    return commissions.filter((c: any) => {
      if (rangeKey !== "TUDO") {
        const created = new Date(c.created_at);
        if (created < start || created > end) return false;
      }
      const ws = c.workflow_status || c.status;
      if (statusFilter !== "all" && ws !== statusFilter) return false;
      if (partnerFilter !== "all" && c.partner_id !== partnerFilter) return false;
      if (dateFrom && (c.created_at || "").slice(0,10) < dateFrom) return false;
      if (dateTo && (c.created_at || "").slice(0,10) > dateTo) return false;
      if (q) {
        const beneficiaryName = c.partners?.full_name ?? c.referrers?.full_name ?? (c.profiles as any)?.full_name ?? "";
        const hay = norm(`${beneficiaryName} ${c.sales?.clients?.full_name ?? ""} ${c.sales?.products?.name ?? ""} ${c.notes ?? ""}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [commissions, statusFilter, partnerFilter, dateFrom, dateTo, debouncedSearch, rangeKey]);

  // sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: any, b: any) => {
      const dir = sort.d === "asc" ? 1 : -1;
      const get = (x: any) => {
        if (sort.k === "amount") return Number(x.amount || 0);
        if (sort.k === "percent") return Number(x.percent || 0);
        if (sort.k === "base") return Number(x.sales?.amount || 0);
        if (sort.k === "partner") return norm(x.partners?.full_name ?? x.referrers?.full_name ?? (x.profiles as any)?.full_name);
        if (sort.k === "client") return norm(x.sales?.clients?.full_name);
        if (sort.k === "status") return x.workflow_status || x.status || "";
        return x.created_at || "";
      };
      const va = get(a), vb = get(b);
      return va > vb ? dir : va < vb ? -dir : 0;
    });
    return arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage]);

  const totals = useMemo(() => {
    const acc = { paid: 0, pending: 0, canceled: 0, total: 0, count: filtered.length };
    filtered.forEach((c: any) => {
      const v = Number(c.amount || 0);
      acc.total += v;
      const ws = c.workflow_status || c.status;
      if (PAID_STATUSES.includes(ws)) acc.paid += v;
      else if (OPEN_STATUSES.includes(ws)) acc.pending += v;
      else if (["cancelada", "estornada"].includes(ws)) acc.canceled += v;
    });
    return acc;
  }, [filtered]);

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
  const selectedTotals = useMemo(() => {
    const list = filtered.filter((c: any) => selected[c.id]);
    return { count: list.length, sum: list.reduce((s: number, c: any) => s + Number(c.amount || 0), 0) };
  }, [filtered, selected]);

  const allFilteredSelected = paginated.length > 0 && paginated.every((c: any) => selected[c.id]);
  const toggleAll = () => {
    if (allFilteredSelected) setSelected({});
    else {
      const next: Record<string, boolean> = { ...selected };
      paginated.forEach((c: any) => { next[c.id] = true; });
      setSelected(next);
    }
  };

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["commissions-list"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["dash-commissions"] });
    qc.invalidateQueries({ queryKey: ["fin-commissions"] });
    qc.invalidateQueries({ queryKey: ["finance-splits"] });
    qc.invalidateQueries({ queryKey: ["commission-splits-unified"] });
  };

  // Split rows in commission_splits use a simpler enum (pendente/pago/cancelado).
  // Map workflow_status → split_status and route the update to the correct table.
  const splitStatusFor = (ws: string) =>
    PAID_STATUSES.includes(ws) ? "pago" : (["cancelada", "estornada"].includes(ws) ? "cancelado" : "pendente");

  const updateSplit = async (ids: string[], patch: { status?: string; paid_at?: string | null; payment_method?: string | null; notes?: string | null }) => {
    const upd: any = {};
    if (patch.status !== undefined) upd.status = patch.status;
    if (patch.paid_at !== undefined) upd.paid_at = patch.paid_at;
    if (patch.payment_method !== undefined) upd.payment_method = patch.payment_method;
    if (patch.notes !== undefined) upd.notes = patch.notes;
    return supabase.from("commission_splits").update(upd).in("id", ids);
  };

  // ----- Mutations -----
  const createCommission = async () => {
    if (!createForm.beneficiary_id) { toast.error("Selecione um beneficiário"); return; }
    if (!createForm.sale_id) { toast.error("Vincule a uma venda"); return; }
    if (!Number(createForm.amount) || Number(createForm.amount) <= 0) { toast.error("Informe um valor maior que zero"); return; }
    
    const splitPayload: any = {
      sale_id: createForm.sale_id,
      beneficiary_type: createForm.beneficiary_type,
      beneficiary_id: createForm.beneficiary_id,
      amount: Number(createForm.amount),
      percent: Number(createForm.percent || 0),
      status: splitStatusFor(createForm.status),
      notes: createForm.notes || null,
    };
    const { error } = await supabase.from("commission_splits").insert(splitPayload);
    if (error) { toast.error(error.message); return; }
    toast.success("Comissão criada");
    setCreateOpen(false);
    setCreateForm({ beneficiary_id: "", beneficiary_type: "partner", sale_id: "", amount: 0, percent: 10, commission_type: "percentual", status: "aguardando_confirmacao", notes: "" });
    invalidateAll();
  };

  const saveRule = async () => {
    if (!ruleForm.rule_type) { toast.error("Selecione o tipo de regra"); return; }
    if (!Number(ruleForm.value) || Number(ruleForm.value) <= 0) { toast.error("Valor inválido"); return; }
    const payload = {
      partner_id: ruleForm.partner_id || null,
      product_id: ruleForm.product_id || null,
      rule_type: ruleForm.rule_type,
      value: Number(ruleForm.value),
      is_recurring: ruleForm.is_recurring,
      trigger_event: ruleForm.trigger_event,
      release_after_payment: ruleForm.release_after_payment,
    };
    const { error } = await supabase.from("commission_rules").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Regra salva");
    setRuleCreateOpen(false);
    setRuleForm({ partner_id: "", product_id: "", rule_type: "percentage", value: 0, is_recurring: false, trigger_event: "first_sale", release_after_payment: true });
    qc.invalidateQueries({ queryKey: ["commission-rules"] });
  };

  const removeRule = async (r: any) => {
    const ok = await confirmAction({
      title: "Excluir regra?",
      description: `Esta ação não pode ser desfeita. Regra: ${r.partners?.full_name ?? "Todos parceiros"} · ${r.products?.name ?? "Todos produtos"}`,
      confirmText: "Excluir", destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("commission_rules").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Regra excluída");
    qc.invalidateQueries({ queryKey: ["commission-rules"] });
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setEditForm({
      amount: c.amount,
      percent: c.percent,
      commission_type: c.commission_type || "percentual",
      status: c.workflow_status || "aguardando_confirmacao",
      notes: c.notes ?? "",
      payment_method: c.payment_method ?? "",
      paid_at: c.paid_at ? c.paid_at.slice(0, 10) : "",
      approval_date: c.approval_date ? c.approval_date.slice(0, 10) : "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const ws = editForm.status;
    const isPaid = PAID_STATUSES.includes(ws);
    const isApproved = ws === "aprovada" || ws === "liberada" || isPaid;
    const isClosed = ["cancelada", "estornada"].includes(ws);
    const payload: any = {
      amount: Number(editForm.amount),
      percent: Number(editForm.percent),
      commission_type: editForm.commission_type,
      workflow_status: ws,
      status: isPaid ? "pago" : (isClosed ? "cancelado" : "pendente"),
      notes: editForm.notes || null,
      payment_method: editForm.payment_method || null,
      approval_date: isClosed ? null : (isApproved ? (editForm.approval_date ? new Date(editForm.approval_date).toISOString() : (editing.approval_date || new Date().toISOString())) : (editing.approval_date || null)),
      paid_at: isClosed ? null : (isPaid ? (editForm.paid_at ? new Date(editForm.paid_at).toISOString() : (editing.paid_at || new Date().toISOString())) : null),
    };
    const { error } = editing._source === "split"
      ? await updateSplit([editing.id], {
          status: splitStatusFor(ws),
          paid_at: payload.paid_at,
          payment_method: payload.payment_method,
          notes: payload.notes,
        })
      : await supabase.from("commissions").update(payload).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Comissão atualizada");
    setEditOpen(false); setEditing(null);
    invalidateAll();
  };

  const removeOne = async (c: any) => {
    const ok = await confirmAction({
      title: "Excluir comissão?",
      description: `${formatBRL(c.amount)} para ${c.partners?.full_name ?? c.profiles?.full_name ?? c.referrers?.full_name ?? "—"}. Ação irreversível.`,
      confirmText: "Excluir", destructive: true,
    });
    if (!ok) return;
    const { error } = c._source === "split"
      ? await supabase.from("commission_splits").delete().eq("id", c.id)
      : await supabase.from("commissions").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Comissão excluída");
    invalidateAll();
  };

  const cancelOne = async (c: any) => {
    const ok = await confirmAction({
      title: "Cancelar comissão?",
      description: `${formatBRL(c.amount)} para ${c.partners?.full_name ?? c.profiles?.full_name ?? c.referrers?.full_name ?? "—"}`,
      confirmText: "Cancelar comissão",
    });
    if (!ok) return;
    const { error } = c._source === "split"
      ? await updateSplit([c.id], { status: "cancelado", paid_at: null })
      : await supabase.from("commissions")
          .update({ workflow_status: "cancelada", status: "cancelado", paid_at: null, approval_date: null })
          .eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Comissão cancelada");
    invalidateAll();
  };

  const reopenOne = async (c: any) => {
    const ok = await confirmAction({
      title: "Reabrir comissão?",
      description: `Voltar para "Aguardando confirmação".`,
      confirmText: "Reabrir",
    });
    if (!ok) return;
    const { error } = c._source === "split"
      ? await updateSplit([c.id], { status: "pendente", paid_at: null })
      : await supabase.from("commissions")
          .update({ workflow_status: "aguardando_confirmacao", status: "pendente", paid_at: null, approval_date: null })
          .eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Comissão reaberta");
    invalidateAll();
  };

  const openPaySingle = (c: any) => { setPayTarget({ ids: [c.id] }); setPayOpen(true); };
  const openPayBulk = () => {
    if (selectedIds.length === 0) { toast.error("Selecione ao menos uma comissão"); return; }
    setPayTarget({ ids: selectedIds });
    setPayOpen(true);
  };

  const confirmPay = async () => {
    if (!payTarget?.ids?.length) return;
    if (payForm.paid_at > new Date().toISOString().slice(0,10)) {
      toast.error("Data de pagamento não pode ser futura"); return;
    }
    const ok = await confirmAction({
      title: `Confirmar pagamento de ${payTarget.ids.length} comissão(ões)?`,
      description: `Data: ${formatDate(payForm.paid_at)} · Método: ${payForm.payment_method.toUpperCase()}`,
      confirmText: "Confirmar pagamento",
    });
    if (!ok) return;
    const now = new Date().toISOString();
    const paidAtIso = new Date(payForm.paid_at).toISOString();
    const idSet = new Set(payTarget.ids);
    const splitIds = commissions.filter((c: any) => idSet.has(c.id) && c._source === "split").map((c: any) => c.id);
    const commIds = commissions.filter((c: any) => idSet.has(c.id) && c._source !== "split").map((c: any) => c.id);
    const errors: string[] = [];
    if (commIds.length > 0) {
      const payload: any = { workflow_status: "paga", status: "pago", paid_at: paidAtIso, approval_date: now, payment_method: payForm.payment_method, notes: payForm.notes || null };
      const { error } = await supabase.from("commissions").update(payload).in("id", commIds);
      if (error) errors.push(error.message);
    }
    if (splitIds.length > 0) {
      const { error } = await updateSplit(splitIds, { status: "pago", paid_at: paidAtIso, payment_method: payForm.payment_method, notes: payForm.notes || null });
      if (error) errors.push(error.message);
    }
    if (errors.length) { toast.error(errors.join(" · ")); return; }
    toast.success(`${payTarget.ids.length} comissão(ões) marcada(s) como paga(s)`);
    setPayOpen(false); setPayTarget(null); setSelected({});
    invalidateAll();
  };

  const _splitAndCommissionIds = () => {
    const idSet = new Set(selectedIds);
    return {
      splitIds: commissions.filter((c: any) => idSet.has(c.id) && c._source === "split").map((c: any) => c.id),
      commIds: commissions.filter((c: any) => idSet.has(c.id) && c._source !== "split").map((c: any) => c.id),
    };
  };

  const bulkCancel = async () => {
    if (selectedIds.length === 0) return;
    const ok = await confirmAction({
      title: `Cancelar ${selectedIds.length} comissão(ões)?`,
      description: `Total selecionado: ${formatBRL(selectedTotals.sum)}`,
      confirmText: "Cancelar", destructive: true,
    });
    if (!ok) return;
    const { splitIds, commIds } = _splitAndCommissionIds();
    const errs: string[] = [];
    if (commIds.length) {
      const { error } = await supabase.from("commissions").update({ workflow_status: "cancelada", status: "cancelado", paid_at: null, approval_date: null }).in("id", commIds);
      if (error) errs.push(error.message);
    }
    if (splitIds.length) {
      const { error } = await updateSplit(splitIds, { status: "cancelado", paid_at: null });
      if (error) errs.push(error.message);
    }
    if (errs.length) { toast.error(errs.join(" · ")); return; }
    toast.success("Comissões canceladas"); setSelected({}); invalidateAll();
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ok = await confirmAction({
      title: `Excluir ${selectedIds.length} comissão(ões)?`,
      description: "Esta ação é irreversível.",
      confirmText: "Excluir", destructive: true,
    });
    if (!ok) return;
    const { splitIds, commIds } = _splitAndCommissionIds();
    const errs: string[] = [];
    if (commIds.length) {
      const { error } = await supabase.from("commissions").delete().in("id", commIds);
      if (error) errs.push(error.message);
    }
    if (splitIds.length) {
      const { error } = await supabase.from("commission_splits").delete().in("id", splitIds);
      if (error) errs.push(error.message);
    }
    if (errs.length) { toast.error(errs.join(" · ")); return; }
    toast.success("Comissões excluídas"); setSelected({}); invalidateAll();
  };

  const exportCSV = () => {
    exportCsv(`comissoes_${Date.now()}.csv`,
      ["Indicador", "Cliente", "Produto", "Base", "%", "Comissão", "Status", "Criada", "Paga em", "Método"],
      sorted.map((c: any) => [
        c.partners?.full_name ?? "",
        c.sales?.clients?.full_name ?? "",
        c.sales?.products?.name ?? "",
        Number(c.sales?.amount || 0).toFixed(2),
        Number(c.percent || 0).toFixed(2),
        Number(c.amount || 0).toFixed(2),
        STATUS_META[c.workflow_status || c.status]?.label ?? (c.workflow_status || c.status),
        formatDate(c.created_at),
        c.paid_at ? formatDate(c.paid_at) : "",
        c.payment_method ?? "",
      ]));
    toast.success("CSV exportado");
  };

  const clearFilters = () => {
    setSearch(""); setStatusFilter("all"); setPartnerFilter("all"); setDateFrom(""); setDateTo(""); setRangeKey("TUDO");
  };

  // active filter chips
  const chips: { label: string; clear: () => void }[] = [];
  if (rangeKey !== "TUDO") chips.push({ label: `Período: ${rangeKey}`, clear: () => setRangeKey("TUDO") });
  if (search) chips.push({ label: `Busca: ${search}`, clear: () => setSearch("") });
  if (statusFilter !== "all") chips.push({ label: `Status: ${STATUS_META[statusFilter]?.label}`, clear: () => setStatusFilter("all") });
  if (partnerFilter !== "all") chips.push({ label: `Indicador: ${partners.find((p:any)=>p.id===partnerFilter)?.full_name ?? ""}`, clear: () => setPartnerFilter("all") });
  if (dateFrom) chips.push({ label: `De: ${formatDate(dateFrom)}`, clear: () => setDateFrom("") });
  if (dateTo) chips.push({ label: `Até: ${formatDate(dateTo)}`, clear: () => setDateTo("") });

  const onSelectSale = (saleId: string) => {
    const s = sales.find((x: any) => x.id === saleId);
    if (s) {
      const pct = Number(s.commission_percent ?? 10);
      const amount = Math.round(Number(s.amount) * pct) / 100;
      setCreateForm((f: any) => ({ ...f, sale_id: saleId, percent: pct, amount }));
    } else {
      setCreateForm((f: any) => ({ ...f, sale_id: saleId }));
    }
  };

  // Rules filtered
  const filteredRules = useMemo(() => {
    const q = norm(rulesSearch);
    if (!q) return rules;
    return rules.filter((r: any) =>
      norm(r.partners?.full_name).includes(q) ||
      norm(r.products?.name).includes(q) ||
      norm(commissionTriggerEvents.find(e => e.value === r.trigger_event)?.label).includes(q)
    );
  }, [rules, rulesSearch]);

  return (
    <div className="min-h-dvh bg-slate-50/60 font-sans">
      <PageHero
        eyebrow="Financeiro"
        category="Comissionamento"
        title="Comissões"
        description="Gestão de regras e pagamentos para parceiros e indicadores."
        icon={<Wallet className="size-6" />}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex bg-white border border-slate-200/70 rounded-lg p-0.5 shadow-sm">
              {(["HOJE", "7 DIAS", "30 DIAS", "MÊS", "TUDO"] as const).map((k) => (
                <button key={k} onClick={() => setRangeKey(k)}
                  className={cn("px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wide transition-all",
                    rangeKey === k ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-700")}>
                  {k}
                </button>
              ))}
            </div>
            {canManage && (
              <Button onClick={() => setCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="size-4 mr-1.5" /> Nova comissão
              </Button>
            )}
          </div>
        }
        kpis={[
          { label: "Total filtrado", value: formatBRL(totals.total), tone: "primary", hint: `${totals.count} registros`, icon: <CircleDollarSign className="size-4" /> },
          { label: "A pagar", value: formatBRL(totals.pending), tone: "warning", icon: <Clock className="size-4" /> },
          { label: "Pagas", value: formatBRL(totals.paid), tone: "success", icon: <CheckCircle2 className="size-4" /> },
          { label: "Conversão", value: `${(totals.paid + totals.pending) > 0 ? Math.round((totals.paid / (totals.paid + totals.pending)) * 100) : 0}%`, tone: "info", icon: <TrendingUp className="size-4" /> },
        ]}
      />

      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 space-y-5 pb-10">
        <Tabs defaultValue="list" className="space-y-4">
          <TabsList className="bg-white border border-slate-200/70 rounded-lg p-1 h-auto flex-wrap justify-start overflow-x-auto">
            <TabsTrigger value="list" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 text-slate-600">
              Histórico <span className="ml-1.5 text-[10px] font-mono opacity-60">{commissions.length}</span>
            </TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 text-slate-600">
              Todos beneficiários
            </TabsTrigger>
            <TabsTrigger value="rules" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 text-slate-600">
              Regras <span className="ml-1.5 text-[10px] font-mono opacity-60">{rules.length}</span>
            </TabsTrigger>
          </TabsList>

          {/* ----- HISTÓRICO ----- */}
          <TabsContent value="list" className="space-y-4">
            {/* Toolbar */}
            <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-4 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input placeholder="Buscar indicador, cliente, produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-slate-200" />
                </div>
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="w-44 bg-white border-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="aguardando_confirmacao">Aguardando</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="liberada">Liberada</SelectItem>
                    <SelectItem value="em_pagamento">Em pagamento</SelectItem>
                    <SelectItem value="paga">Paga</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                    <SelectItem value="estornada">Estornada</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                  <SelectTrigger className="w-52 bg-white border-slate-200"><SelectValue placeholder="Indicador" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos indicadores</SelectItem>
                    {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1.5">
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[140px] bg-white border-slate-200" />
                  <span className="text-slate-400 text-xs">→</span>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[140px] bg-white border-slate-200" />
                </div>
                <Button variant="outline" size="sm" onClick={exportCSV} className="border-slate-200">
                  <Download className="size-3.5 mr-1.5" /> CSV
                </Button>
              </div>

              {chips.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500">Filtros:</span>
                  {chips.map((c, i) => (
                    <Badge key={i} variant="outline" className="bg-white border-slate-200 text-slate-700 gap-1.5">
                      {c.label}
                      <button onClick={c.clear}><X className="size-3" /></button>
                    </Badge>
                  ))}
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-slate-500">Limpar tudo</Button>
                </div>
              )}
            </div>

            {/* Bulk bar */}
            {canManage && selectedIds.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center justify-between">
                <p className="text-sm text-indigo-900">
                  <span className="font-semibold">{selectedTotals.count}</span> selecionada(s) ·
                  <span className="font-mono font-semibold ml-1">{formatBRL(selectedTotals.sum)}</span>
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelected({})} className="border-slate-200"><X className="size-3.5 mr-1" /> Limpar</Button>
                  <Button size="sm" variant="outline" onClick={bulkCancel} className="border-slate-200"><XCircle className="size-3.5 mr-1" /> Cancelar</Button>
                  <Button size="sm" variant="outline" onClick={bulkDelete} className="border-rose-200 text-rose-700 hover:bg-rose-50"><Trash2 className="size-3.5 mr-1" /> Excluir</Button>
                  <Button size="sm" onClick={openPayBulk} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Check className="size-3.5 mr-1" /> Marcar pagas</Button>
                </div>
              </div>
            )}

            {/* Tabela */}
            <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="p-6 space-y-3">{Array.from({length: 6}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : sorted.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                  <Wallet className="size-10 mb-2 opacity-40" />
                  <p className="text-sm font-medium text-slate-600">
                    {commissions.length === 0 ? "Nenhuma comissão cadastrada" : "Nenhuma comissão corresponde aos filtros"}
                  </p>
                  {chips.length > 0 && <Button size="sm" variant="ghost" onClick={clearFilters} className="mt-3 text-indigo-700">Limpar filtros</Button>}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/80 border-b border-slate-200">
                        <tr>
                          {canManage && (
                            <th className="px-4 py-3 w-10">
                              <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} aria-label="Selecionar página" />
                            </th>
                          )}
                          <SortableTh label="Indicador" k="partner" sortKey={sort.k} sortDir={sort.d} onSort={toggleSort} />
                          <SortableTh label="Cliente / Produto" k="client" sortKey={sort.k} sortDir={sort.d} onSort={toggleSort} />
                          <SortableTh label="Base" k="base" sortKey={sort.k} sortDir={sort.d} onSort={toggleSort} align="right" />
                          <SortableTh label="%" k="percent" sortKey={sort.k} sortDir={sort.d} onSort={toggleSort} align="right" />
                          <SortableTh label="Comissão" k="amount" sortKey={sort.k} sortDir={sort.d} onSort={toggleSort} align="right" />
                          <SortableTh label="Status" k="status" sortKey={sort.k} sortDir={sort.d} onSort={toggleSort} />
                          <SortableTh label="Criada" k="created_at" sortKey={sort.k} sortDir={sort.d} onSort={toggleSort} />
                          <th className="px-4 py-3 w-32"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((c: any) => {
                          const ws = c.workflow_status || c.status;
                          const meta = STATUS_META[ws] || { label: ws, cls: "bg-slate-100 text-slate-600 border-slate-200" };
                          return (
                            <tr key={c.id} className={cn("border-b border-slate-100 hover:bg-slate-50/60", selected[c.id] && "bg-indigo-50/40")}>
                              {canManage && (
                                <td className="px-4 py-3">
                                  <Checkbox checked={!!selected[c.id]} onCheckedChange={(v) => setSelected((s) => ({ ...s, [c.id]: !!v }))} />
                                </td>
                              )}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className={cn("size-8 rounded-full flex items-center justify-center text-[10px] font-bold", 
                                    c.partners ? "bg-indigo-50 text-indigo-700" : 
                                    c.referrers ? "bg-amber-50 text-amber-700" : 
                                    "bg-emerald-50 text-emerald-700")}>
                                    {initials(c.partners?.full_name ?? c.referrers?.full_name ?? (c.profiles as any)?.full_name)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-900 truncate">
                                      {c.partners?.full_name ?? c.referrers?.full_name ?? (c.profiles as any)?.full_name ?? "—"}
                                    </p>
                                    {(c.partners?.pix_key) && <p className="text-[10px] text-slate-500 font-mono truncate max-w-[180px]">PIX: {c.partners.pix_key}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-slate-900">{c.sales?.clients?.full_name ?? "—"}</p>
                                <p className="text-[11px] text-slate-500 truncate max-w-[200px]">{c.sales?.products?.name ?? "Manual"}</p>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-slate-500">{c.sales?.amount ? formatBRL(c.sales.amount) : "—"}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-700">{formatPercent(c.percent)}</td>
                              <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">{formatBRL(c.amount)}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
                              </td>
                              <td className="px-4 py-3 text-slate-600 font-mono text-xs">{formatDate(c.created_at)}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {canManage && OPEN_STATUSES.includes(ws) && (
                                    <Button size="sm" variant="ghost" onClick={() => openPaySingle(c)} className="h-7 gap-1 text-xs text-emerald-700 hover:bg-emerald-50">
                                      <Check className="size-3" /> Pagar
                                    </Button>
                                  )}
                                  {canManage && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button className="size-7 rounded-md hover:bg-slate-100 flex items-center justify-center"><MoreHorizontal className="size-3.5 text-slate-500" /></button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-44">
                                        <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="size-3.5 mr-2" /> Editar</DropdownMenuItem>
                                        {ws !== "aguardando_confirmacao" && (
                                          <DropdownMenuItem onClick={() => reopenOne(c)}><Clock className="size-3.5 mr-2" /> Reabrir</DropdownMenuItem>
                                        )}
                                        {ws !== "cancelada" && (
                                          <DropdownMenuItem onClick={() => cancelOne(c)}><XCircle className="size-3.5 mr-2" /> Cancelar</DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => removeOne(c)} className="text-rose-700">
                                          <Trash2 className="size-3.5 mr-2" /> Excluir
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-3 border-t border-slate-200">
                    <PaginationControl
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                      totalItems={sorted.length}
                      itemsPerPage={itemsPerPage}
                    />
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* ----- TODOS BENEFICIÁRIOS ----- */}
          <TabsContent value="all">
            <AllBeneficiariesTable />
          </TabsContent>

          {/* ----- REGRAS ----- */}
          <TabsContent value="rules" className="space-y-4">
            <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-4 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input placeholder="Buscar regra por parceiro, produto, evento..." value={rulesSearch} onChange={(e) => setRulesSearch(e.target.value)} className="pl-9 bg-white border-slate-200" />
              </div>
              {canManage && (
                <Button onClick={() => setRuleCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Plus className="size-4 mr-1.5" /> Nova regra
                </Button>
              )}
            </div>

            <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
              {loadingRules ? (
                <div className="p-6 space-y-3">{Array.from({length: 4}).map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : filteredRules.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                  <Receipt className="size-10 mb-2 opacity-40" />
                  <p className="text-sm font-medium text-slate-600">
                    {rules.length === 0 ? "Nenhuma regra configurada" : "Nenhuma regra corresponde à busca"}
                  </p>
                  {canManage && rules.length === 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setRuleCreateOpen(true)} className="mt-3 text-indigo-700">Criar primeira regra</Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/80 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Regra aplicada</th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Evento</th>
                        <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-semibold text-slate-500">Valor</th>
                        <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider font-semibold text-slate-500">Recorrência</th>
                        <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider font-semibold text-slate-500">Liberação</th>
                        {canManage && <th className="px-4 py-3 w-16"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRules.map((r: any) => (
                        <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900">{r.partners?.full_name ?? "Todos parceiros"}</span>
                              <span className="text-xs text-slate-500">{r.products?.name ?? "Todos os produtos"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                              {commissionTriggerEvents.find(e => e.value === r.trigger_event)?.label ?? r.trigger_event}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                            {r.rule_type === 'percentage' ? formatPercent(r.value) : formatBRL(r.value)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {r.is_recurring ? (
                              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">Recorrente</Badge>
                            ) : <span className="text-slate-400 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-slate-600">
                            {r.release_after_payment ? "Pós pagamento" : "Imediata"}
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-right">
                              <Button variant="ghost" size="icon" aria-label="Remover regra" className="size-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => removeRule(r)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* CREATE Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova comissão</DialogTitle>
            <DialogDescription>Vincule a uma venda existente.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Tipo de Beneficiário *</Label>
              <Select value={createForm.beneficiary_type} onValueChange={(v) => setCreateForm({ ...createForm, beneficiary_type: v, beneficiary_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="partner">Parceiro</SelectItem>
                  <SelectItem value="collaborator">Colaborador</SelectItem>
                  <SelectItem value="referrer">Indicador</SelectItem>
                  <SelectItem value="service_provider">Prestador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Beneficiário *</Label>
              <Select value={createForm.beneficiary_id} onValueChange={(v) => setCreateForm({ ...createForm, beneficiary_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar beneficiário" /></SelectTrigger>
                <SelectContent>
                  {createForm.beneficiary_type === "partner" && partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  {createForm.beneficiary_type === "collaborator" && collaborators.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  {createForm.beneficiary_type === "referrer" && referrers.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  {createForm.beneficiary_type === "service_provider" && (providers as any[]).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Venda *</Label>
              <Select value={createForm.sale_id || ""} onValueChange={onSelectSale}>
                <SelectTrigger><SelectValue placeholder="Selecionar venda" /></SelectTrigger>
                <SelectContent>
                  {sales.slice(0, 100).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.clients?.full_name ?? "?"} — {s.products?.name ?? "?"} ({formatBRL(s.amount)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>% Comissão</Label>
              <Input type="number" step="0.01" value={createForm.percent} onChange={(e) => setCreateForm({ ...createForm, percent: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={createForm.amount} onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Status</Label>
              <Select value={createForm.status} onValueChange={(v) => setCreateForm({ ...createForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aguardando_confirmacao">Aguardando</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="liberada">Liberada</SelectItem>
                  <SelectItem value="em_pagamento">Em pagamento</SelectItem>
                  <SelectItem value="paga">Paga</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={3} value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={createCommission} className="bg-indigo-600 hover:bg-indigo-700 text-white">Criar comissão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar comissão</DialogTitle>
            <DialogDescription>
              {editing?.partners?.full_name ?? editing?.profiles?.full_name ?? editing?.referrers?.full_name ?? "—"} · {editing?.sales?.clients?.full_name ?? "Manual"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>% Comissão</Label>
              <Input type="number" step="0.01" value={editForm.percent} onChange={(e) => setEditForm({ ...editForm, percent: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aguardando_confirmacao">Aguardando</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="liberada">Liberada</SelectItem>
                  <SelectItem value="em_pagamento">Em pagamento</SelectItem>
                  <SelectItem value="paga">Paga</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                  <SelectItem value="estornada">Estornada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Método de pagamento</Label>
              <Select value={editForm.payment_method || "none"} onValueChange={(v) => setEditForm({ ...editForm, payment_method: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="ted">TED</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {PAID_STATUSES.includes(editForm.status) && (
              <div className="col-span-2 space-y-1.5">
                <Label>Data do pagamento</Label>
                <Input type="date" max={new Date().toISOString().slice(0,10)} value={editForm.paid_at} onChange={(e) => setEditForm({ ...editForm, paid_at: e.target.value })} />
              </div>
            )}
            <div className="col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={saveEdit} className="bg-indigo-600 hover:bg-indigo-700 text-white">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PAY Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="size-5 text-emerald-600" /> Confirmar pagamento</DialogTitle>
            <DialogDescription>
              {payTarget?.ids?.length === 1 ? "Marcar 1 comissão como paga." : `Marcar ${payTarget?.ids?.length ?? 0} comissões como pagas.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-emerald-50 border border-emerald-200/70 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700">Total a pagar</p>
              <p className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                {formatBRL(filtered.filter((c: any) => payTarget?.ids?.includes(c.id)).reduce((s: number, c: any) => s + Number(c.amount || 0), 0))}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" max={new Date().toISOString().slice(0,10)} value={payForm.paid_at} onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Método</Label>
                <Select value={payForm.payment_method} onValueChange={(v) => setPayForm({ ...payForm, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="ted">TED</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={2} value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="TXID, comprovante..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button onClick={confirmPay} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="size-4 mr-1.5" /> Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RULE CREATE Dialog */}
      <Dialog open={ruleCreateOpen} onOpenChange={setRuleCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova regra de comissionamento</DialogTitle>
            <DialogDescription>Defina como o sistema deve calcular as comissões automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Parceiro (opcional)</Label>
              <Select value={ruleForm.partner_id || "all"} onValueChange={(v) => setRuleForm({ ...ruleForm, partner_id: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Todos parceiros" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos parceiros</SelectItem>
                  {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Produto (opcional)</Label>
              <Select value={ruleForm.product_id || "all"} onValueChange={(v) => setRuleForm({ ...ruleForm, product_id: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Todos produtos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos produtos</SelectItem>
                  {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de valor</Label>
              <Select value={ruleForm.rule_type} onValueChange={(v) => setRuleForm({ ...ruleForm, rule_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <Input type="number" step="0.01" value={ruleForm.value} onChange={(e) => setRuleForm({ ...ruleForm, value: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Evento de disparo</Label>
              <Select value={ruleForm.trigger_event} onValueChange={(v) => setRuleForm({ ...ruleForm, trigger_event: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {commissionTriggerEvents.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-center space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="is_recurring" checked={ruleForm.is_recurring} onCheckedChange={(v) => setRuleForm({ ...ruleForm, is_recurring: !!v })} />
                <Label htmlFor="is_recurring" className="text-sm font-medium">Recorrente?</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="release_after_payment" checked={ruleForm.release_after_payment} onCheckedChange={(v) => setRuleForm({ ...ruleForm, release_after_payment: !!v })} />
                <Label htmlFor="release_after_payment" className="text-sm font-medium">Liberar só após pagamento do cliente?</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleCreateOpen(false)}>Cancelar</Button>
            <Button onClick={saveRule} className="bg-indigo-600 hover:bg-indigo-700 text-white">Salvar regra</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
