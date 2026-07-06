import { useMemo, useState, useEffect, useRef, useLayoutEffect } from "react";
import { useClientsRef, usePartnersRef, useProductsRef } from "@/hooks/useReferenceData";
import { subDays, startOfMonth, startOfToday, endOfDay, parseISO } from "date-fns";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, Search, Download, MoreHorizontal, CheckCircle2, XCircle, PlayCircle,
  Clock3, Trash2, Eye, ShoppingBag, X, CircleDollarSign,
  CalendarRange, Sparkles, ArrowUp, ArrowDown, TrendingUp, BarChart3,
  Users, Trophy, Inbox, Pencil, Wallet, Handshake, HandCoins
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { formatBRDate, formatBR, nowBR, toBR } from "@/lib/datetime";
import { SaleFormDialog } from "@/components/sales/SaleFormDialog";
import { ReceivePaymentDialog } from "@/components/sales/ReceivePaymentDialog";
import { FilterPresets } from "@/components/filters/FilterPresets";
import { StageFilterBar } from "@/components/filters/StageFilterBar";
import { useStageMatcher, useClientStageMap } from "@/hooks/useSharedStageFilter";
import { InlineStageSelect } from "@/components/clients/InlineStageSelect";
import { StageQuickMenu } from "@/components/clients/StageQuickMenu";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ComposedChart, Area, Bar, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { confirmAction } from "@/lib/confirm";
import { useAuth } from "@/hooks/useAuth";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePageSize } from "@/hooks/usePageSize";
import { saleIsFinalized, paymentReceivedAmount, paymentCompetenceYm, isPaymentPaidInFuture } from "@/lib/financial";

type StatusKey = "todos" | "pendente" | "em_andamento" | "concluida" | "cancelada";
type SortKey = "sale_date" | "client" | "product" | "partner" | "amount" | "commission" | "status" | "liquido" | "recebido";
type SortDir = "asc" | "desc";
const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const monthRange = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const safeMonth = Number.isFinite(month) ? month : new Date().getMonth() + 1;
  return {
    start: new Date(safeYear, safeMonth - 1, 1, 0, 0, 0, 0),
    end: new Date(safeYear, safeMonth, 0, 23, 59, 59, 999),
  };
};
const monthLabel = (monthKey: string) => {
  const { start } = monthRange(monthKey);
  return start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

const norm = (s: any) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const onlyDigits = (s: any) => String(s ?? "").replace(/\D+/g, "");
const isPaymentReceived = (p: any) => paymentReceivedAmount(p) > 0;
const receivedPaymentAmount = (p: any) => paymentReceivedAmount(p);
const saleReceived = (saleId: string, receiptsBySale: Map<string, any>) => Number(receiptsBySale.get(saleId)?.received || 0);
const saleRatio = (s: any, receiptsBySale: Map<string, any>) => {
  const amount = Number(s.amount || 0);
  if (amount <= 0 || !saleIsFinalized(s)) return 0;
  return Math.max(0, Math.min(1, saleReceived(s.id, receiptsBySale) / amount));
};
const saleFullCommission = (s: any, splitsBySale: Map<string, any[]>) =>
  (splitsBySale.get(s.id) ?? []).reduce((sum: number, sp: any) => sum + Number(sp.amount || 0), 0);
const saleReleasedCommission = (s: any, splitsBySale: Map<string, any[]>, receiptsBySale: Map<string, any>) =>
  saleFullCommission(s, splitsBySale) * saleRatio(s, receiptsBySale);
const saleReleasedCosts = (s: any, receiptsBySale: Map<string, any>) =>
  (Number(s.zenon_cost || 0) + Number(s.provider_cost || 0)) * saleRatio(s, receiptsBySale);
const saleRealizedLiquid = (s: any, splitsBySale: Map<string, any[]>, receiptsBySale: Map<string, any>) =>
  saleReceived(s.id, receiptsBySale) - saleReleasedCosts(s, receiptsBySale) - saleReleasedCommission(s, splitsBySale, receiptsBySale);

export default function Sales() {
  const { pageSize: __ps, setPageSize } = usePageSize();
  const PAGE_SIZE = __ps === -1 ? Number.MAX_SAFE_INTEGER : __ps;
  const { isAdmin, isAdminSecondary } = useAuth();
  const canManage = isAdmin || isAdminSecondary;
  const [open, setOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<any>(null);
  const [receivingSale, setReceivingSale] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [rangeKey, setRangeKey] = useState<"HOJE" | "7 DIAS" | "30 DIAS" | "MÊS" | "TUDO">("MÊS");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [status, setStatus] = useState<StatusKey>("todos");
  const [revenueFilter, setRevenueFilter] = useState<"todos" | "avulso" | "recorrente">("todos");
  const [partnerFilter, setPartnerFilter] = useState("todos");
  const [productFilter, setProductFilter] = useState("todos");
  const [clientFilter, setClientFilter] = useState("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sale_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  type KpiKind = "bruto" | "recebido_mes" | "a_receber" | "liquido" | "custos" | "comissoes" | "count";
  const [kpiDetail, setKpiDetail] = useState<KpiKind | null>(null);
  const [breakdownDim, setBreakdownDim] = useState<"status" | "partner" | "product" | "client" | "partner_product" | "product_client" | "partner_client" | "revenue_type" | "month">(
    () => (typeof window !== "undefined" && (localStorage.getItem("sales-breakdown-dim") as any)) || "status"
  );
  const [breakdownMetric, setBreakdownMetric] = useState<"bruto" | "recebido" | "liquido" | "qtd">(
    () => (typeof window !== "undefined" && (localStorage.getItem("sales-breakdown-metric") as any)) || "bruto"
  );
  const changeBreakdown = (dim: typeof breakdownDim, metric: typeof breakdownMetric) => {
    setBreakdownDim(dim); setBreakdownMetric(metric);
    try {
      localStorage.setItem("sales-breakdown-dim", dim);
      localStorage.setItem("sales-breakdown-metric", metric);
    } catch {}
  };
  const [density, setDensity] = useState<"compact" | "normal" | "spacious">(
    () => (typeof window !== "undefined" && (localStorage.getItem("sales-density") as any)) || "normal"
  );
  const changeDensity = (d: "compact" | "normal" | "spacious") => {
    setDensity(d);
    try { localStorage.setItem("sales-density", d); } catch {}
  };
  type ColKey = "status" | "client" | "product" | "partner" | "date" | "amount" | "commission" | "liquido" | "recebido";
  const ALL_COLS: { key: ColKey; label: string }[] = [
    { key: "status", label: "Status" },
    { key: "client", label: "Cliente" },
    { key: "product", label: "Produto" },
    { key: "partner", label: "Parceiro" },
    { key: "date", label: "Data" },
    { key: "amount", label: "Valor" },
    { key: "commission", label: "Comissão" },
    { key: "liquido", label: "Líquido" },
    { key: "recebido", label: "Recebido/Restante" },
  ];
  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>(() => {
    try {
      const saved = typeof window !== "undefined" && localStorage.getItem("sales-visible-cols");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { status: true, client: true, product: true, partner: true, date: true, amount: true, commission: true, liquido: true, recebido: true };
  });
  const toggleCol = (k: ColKey) => {
    setVisibleCols((v) => {
      const next = { ...v, [k]: !v[k] };
      try { localStorage.setItem("sales-visible-cols", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const qc = useQueryClient();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("new") === "1") setOpen(true);
    const urlSearch = searchParams.get("search");
    if (urlSearch) setSearch(urlSearch);
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [search, rangeKey, status, revenueFilter, partnerFilter, productFilter, clientFilter, dateFrom, dateTo, sortKey, sortDir]);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales-rich-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, client_id, product_id, partner_id, referrer_id, collaborator_id, service_provider_id, resource_pool_id, amount, commission_percent, referrer_percent, collaborator_percent, zenon_cost, provider_cost, status, sale_date, paid_at, notes, created_at, revenue_type, recurrence_months, closed_at, clients(id, full_name, email, document, company), products(name), partners(full_name, pix_key), referrers(full_name)")
        .order("sale_date", { ascending: false })
        .limit(250);
      if (error) {
        console.error("[Sales] query error:", error);
        toast.error("Erro ao carregar vendas: " + error.message);
        return [];
      }
      return data ?? [];
    },
    staleTime: 90_000,
  });

  const { data: partnersList = [] } = usePartnersRef();
  const { data: productsList = [] } = useProductsRef();
  const { data: clientsList = [] } = useClientsRef();

  const { data: allSplits = [] } = useQuery({
    queryKey: ["sales-commission-splits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_splits")
        .select("sale_id, amount, percent, beneficiary_type, status")
        .limit(600);
      return (data as any[]) ?? [];
    },
  });

  const { data: allReceipts = [] } = useQuery({
    queryKey: ["sales-receipts-by-sale"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("sale_id, amount, amount_paid, paid_at, due_date, competence_month, status")
        .not("sale_id", "is", null)
        .limit(600);
      return (data as any[]) ?? [];
    },
  });

  const finalizedSaleIds = useMemo(() => new Set((sales as any[]).filter(saleIsFinalized).map((s: any) => s.id)), [sales]);

  const receiptsBySale = useMemo(() => {
    const m = new Map<string, { received: number; receivedThisMonth: number; lastPaidAt: string | null; count: number }>();
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    allReceipts.forEach((r: any) => {
      if (!r.sale_id) return;
      if (!finalizedSaleIds.has(r.sale_id)) return;
      const val = receivedPaymentAmount(r);
      if (val <= 0) return;
      const cur = m.get(r.sale_id) ?? { received: 0, receivedThisMonth: 0, lastPaidAt: null, count: 0 };
      cur.received += val;
      if (paymentCompetenceYm(r) === ym) cur.receivedThisMonth += val;
      cur.count += 1;
      if (r.paid_at && (!cur.lastPaidAt || r.paid_at > cur.lastPaidAt)) cur.lastPaidAt = r.paid_at;
      m.set(r.sale_id, cur);
    });
    return m;
  }, [allReceipts, finalizedSaleIds]);

  const splitsBySale = useMemo(() => {
    const m = new Map<string, any[]>();
    allSplits.forEach((s: any) => {
      if (!s.sale_id) return;
      const arr = m.get(s.sale_id) ?? [];
      arr.push(s);
      m.set(s.sale_id, arr);
    });
    return m;
  }, [allSplits]);

  const usingManualRange = !!dateFrom || !!dateTo;

  const { matchesClientId, stageIds: sharedStageIds } = useStageMatcher();
  const { data: clientStageMap } = useClientStageMap();

  const filtered = useMemo(() => {
    const today = nowBR();
    let start: Date = startOfToday();
    let end: Date = endOfDay(today);

    if (usingManualRange) {
      start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date(0);
      end = dateTo ? new Date(`${dateTo}T23:59:59`) : new Date(8640000000000000);
    } else if (rangeKey === "7 DIAS") {
      start = subDays(today, 6);
    } else if (rangeKey === "30 DIAS") {
      start = subDays(today, 29);
    } else if (rangeKey === "MÊS") {
      const range = monthRange(selectedMonth);
      start = range.start;
      end = range.end;
    } else if (rangeKey === "TUDO") {
      start = new Date(0);
      end = new Date(8640000000000000);
    }

    const q = norm(search);
    const qDigits = onlyDigits(search);

    return sales.filter((s: any) => {
      const saleDate = s.sale_date ? parseISO(s.sale_date) : null;
      if (!saleDate) return false;
      if (saleDate < start || saleDate > end) return false;
      if (status !== "todos" && s.status !== status) return false;
      if (revenueFilter !== "todos" && (s.revenue_type || "avulso") !== revenueFilter) return false;
      if (partnerFilter === "sem" && s.partner_id) return false;
      if (partnerFilter !== "todos" && partnerFilter !== "sem" && s.partner_id !== partnerFilter) return false;
      if (productFilter !== "todos" && s.product_id !== productFilter) return false;
      if (clientFilter !== "todos" && s.client_id !== clientFilter) return false;
      if (!matchesClientId(s.client_id)) return false;
      if (q) {
        const hay = norm(
          `${s.id ?? ""} ${s.clients?.full_name ?? ""} ${s.clients?.company ?? ""} ${s.clients?.email ?? ""} ${s.products?.name ?? ""} ${s.partners?.full_name ?? ""}`
        );
        const docHay = onlyDigits(s.clients?.document ?? "");
        const matches = hay.includes(q) || (qDigits && docHay.includes(qDigits));
        if (!matches) return false;
      }
      return true;
    });
  }, [sales, status, revenueFilter, partnerFilter, productFilter, clientFilter, dateFrom, dateTo, search, rangeKey, selectedMonth, usingManualRange, matchesClientId, sharedStageIds]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a: any, b: any) => {
      const v = (x: any) => {
        switch (sortKey) {
          case "sale_date": return new Date(x.sale_date).getTime();
          case "client": return norm(x.clients?.full_name);
          case "product": return norm(x.products?.name);
          case "partner": return norm(x.partners?.full_name);
          case "amount": return Number(x.amount || 0);
          case "commission": return saleReleasedCommission(x, splitsBySale, receiptsBySale);
          case "status": return String(x.status || "");
          case "liquido": {
            return saleRealizedLiquid(x, splitsBySale, receiptsBySale);
          }
          case "recebido": return Math.min(receiptsBySale.get(x.id)?.received ?? 0, Number(x.amount || 0));
        }
      };
      const va = v(a), vb = v(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir, splitsBySale, receiptsBySale]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "sale_date" || key === "amount" || key === "commission" || key === "liquido" || key === "recebido" ? "desc" : "asc"); }
  };

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sorted, currentPage]
  );

  const kpis = useMemo(() => {
    const acc = { total: 0, concluida: 0, pendente: 0, em_andamento: 0, cancelada: 0, count: filtered.length, comissao: 0, zenon: 0, provider: 0, custos: 0, liquido: 0, recebido: 0, aReceber: 0 };
    filtered.forEach((s: any) => {
      const v = Number(s.amount || 0);
      const rec = receiptsBySale.get(s.id)?.received ?? 0;
      const ratio = saleRatio(s, receiptsBySale);
      const z = Number(s.zenon_cost || 0) * ratio;
      const pc = Number(s.provider_cost || 0) * ratio;
      const comm = saleReleasedCommission(s, splitsBySale, receiptsBySale);
      acc.total += v;
      acc.zenon += z;
      acc.provider += pc;
      acc.custos += z + pc;
      acc.comissao += comm;
      acc.liquido += Math.min(rec, v) - z - pc - comm;
      if (s.status !== "cancelada") {
        if (saleIsFinalized(s)) {
          acc.recebido += Math.min(rec, v);
          acc.aReceber += Math.max(v - rec, 0);
        }
      }
      if (s.status === "concluida") acc.concluida += v;
      else if (s.status === "pendente") acc.pendente += v;
      else if (s.status === "em_andamento") acc.em_andamento += v;
      else if (s.status === "cancelada") acc.cancelada += v;
    });
    return acc;
  }, [filtered, splitsBySale, receiptsBySale]);

  // Recebido no mês selecionado quando o filtro mensal estiver ativo.
  const recebidoNoMes = useMemo(() => {
    const today = nowBR();
    const range = !usingManualRange && rangeKey === "MÊS"
      ? monthRange(selectedMonth)
      : { start: startOfMonth(today), end: endOfDay(today) };
    return allReceipts.reduce((sum: number, r: any) => {
      if (!r.sale_id || !finalizedSaleIds.has(r.sale_id)) return sum;
      const val = receivedPaymentAmount(r);
      if (val <= 0) return sum;
      // Usa competência (competence_month || due_date) para posicionar no mês certo
      const ymRaw = paymentCompetenceYm(r);
      if (!ymRaw) return sum;
      const d = new Date(`${ymRaw}-15T12:00:00`);
      if (d < range.start || d > range.end) return sum;
      return sum + val;
    }, 0);
  }, [allReceipts, rangeKey, selectedMonth, usingManualRange, finalizedSaleIds]);

  const chartSeries = useMemo(() => {
    const today = nowBR();
    let start: Date;
    let end: Date = endOfDay(today);

    if (usingManualRange) {
      start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : subDays(today, 29);
      end = dateTo ? new Date(`${dateTo}T23:59:59`) : endOfDay(today);
    } else if (rangeKey === "HOJE") {
      start = startOfToday();
    } else if (rangeKey === "7 DIAS") {
      start = subDays(today, 6);
    } else if (rangeKey === "MÊS") {
      const range = monthRange(selectedMonth);
      start = range.start;
      end = range.end;
    } else if (rangeKey === "TUDO") {
      // fallback: últimos 90 dias para o gráfico não ficar gigante
      const earliest = filtered.reduce((acc: Date | null, s: any) => {
        const d = s.sale_date ? parseISO(s.sale_date) : null;
        if (!d) return acc;
        return !acc || d < acc ? d : acc;
      }, null as Date | null);
      start = earliest ?? subDays(today, 89);
    } else {
      start = subDays(today, 29);
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / dayMs) + 1);
    const days: { key: string; label: string; bruto: number; concluida: number; pendente: number; count: number }[] = [];
    const base = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      days.push({
        key,
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }),
        bruto: 0,
        concluida: 0,
        pendente: 0,
        count: 0,
      });
    }
    const idx = Object.fromEntries(days.map((d, i) => [d.key, i]));
    filtered.forEach((s: any) => {
      if (!s.sale_date) return;
      const key = String(s.sale_date).slice(0, 10);
      const i = idx[key];
      if (i === undefined) return;
      const v = Number(s.amount || 0);
      days[i].bruto += v;
      days[i].count += 1;
      if (s.status === "concluida") days[i].concluida += v;
      else if (s.status === "pendente" || s.status === "em_andamento") days[i].pendente += v;
    });
    return days;
  }, [filtered, rangeKey, selectedMonth, usingManualRange, dateFrom, dateTo]);

  const chartTotals = useMemo(() => {
    const t = chartSeries.reduce(
      (acc, d) => {
        acc.bruto += d.bruto;
        acc.concluida += d.concluida;
        acc.count += d.count;
        return acc;
      },
      { bruto: 0, concluida: 0, count: 0 }
    );
    const ticket = t.count > 0 ? t.bruto / t.count : 0;
    return { ...t, ticket };
  }, [chartSeries]);

  const chartInterval = chartSeries.length > 60 ? Math.floor(chartSeries.length / 10) : chartSeries.length > 14 ? Math.floor(chartSeries.length / 8) : 0;

  const topPartners = useMemo(() => {
    const m = new Map<string, { name: string; total: number; deals: number }>();
    filtered.forEach((s: any) => {
      if (!s.partner_id || !s.partners?.full_name) return;
      const cur = m.get(s.partner_id) || { name: s.partners.full_name, total: 0, deals: 0 };
      cur.total += Number(s.amount || 0);
      cur.deals += 1;
      m.set(s.partner_id, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filtered]);

  const statusBreakdown = useMemo(() => {
    const palette = ["bg-indigo-500", "bg-emerald-500", "bg-sky-500", "bg-amber-500", "bg-rose-500", "bg-violet-500", "bg-teal-500", "bg-fuchsia-500", "bg-cyan-500", "bg-lime-500"];
    const statusLabel: Record<string, string> = { concluida: "Concluídas", em_andamento: "Em andamento", pendente: "Pendentes", cancelada: "Canceladas" };
    const keyOf = (s: any): { key: string; label: string } => {
      const monthOf = (iso: string | null | undefined) => {
        if (!iso) return "—";
        const d = new Date(iso);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      };
      switch (breakdownDim) {
        case "status": return { key: s.status || "—", label: statusLabel[s.status] || s.status || "—" };
        case "partner": return { key: s.partner_id || "sem", label: s.partners?.full_name || "Sem parceiro" };
        case "product": return { key: s.product_id || "sem", label: s.products?.name || "Sem produto" };
        case "client": return { key: s.client_id || "sem", label: s.clients?.full_name || s.clients?.company || "Sem cliente" };
        case "partner_product": return { key: `${s.partner_id || "sem"}::${s.product_id || "sem"}`, label: `${s.partners?.full_name || "Sem parceiro"} · ${s.products?.name || "Sem produto"}` };
        case "product_client": return { key: `${s.product_id || "sem"}::${s.client_id || "sem"}`, label: `${s.products?.name || "Sem produto"} · ${s.clients?.full_name || s.clients?.company || "Sem cliente"}` };
        case "partner_client": return { key: `${s.partner_id || "sem"}::${s.client_id || "sem"}`, label: `${s.partners?.full_name || "Sem parceiro"} · ${s.clients?.full_name || s.clients?.company || "Sem cliente"}` };
        case "revenue_type": return { key: s.revenue_type || "avulso", label: (s.revenue_type || "avulso") === "recorrente" ? "Recorrente" : "Avulso" };
        case "month": { const m = monthOf(s.sale_date || s.created_at); return { key: m, label: m }; }
      }
    };
    const valueOf = (s: any): number => {
      const v = Number(s.amount || 0);
      switch (breakdownMetric) {
        case "bruto": return v;
        case "recebido": return Math.min(receiptsBySale.get(s.id)?.received ?? 0, v);
        case "liquido": {
          return saleRealizedLiquid(s, splitsBySale, receiptsBySale);
        }
        case "qtd": return 1;
      }
    };
    const m = new Map<string, { key: string; label: string; value: number }>();
    filtered.forEach((s: any) => {
      const { key, label } = keyOf(s);
      const cur = m.get(key) ?? { key, label, value: 0 };
      cur.value += valueOf(s);
      m.set(key, cur);
    });
    const rows = Array.from(m.values()).sort((a, b) => b.value - a.value).slice(0, 10);
    const total = rows.reduce((s, r) => s + r.value, 0) || 1;
    return rows.map((r, i) => ({ ...r, pct: (r.value / total) * 100, color: palette[i % palette.length] }));
  }, [filtered, breakdownDim, breakdownMetric, receiptsBySale, splitsBySale]);


  const invalidateRelated = async () => {
    qc.invalidateQueries({ queryKey: ["sales-rich-v2"] });
    qc.invalidateQueries({ queryKey: ["sales-commission-splits"] });
    qc.invalidateQueries({ queryKey: ["commissions"] });
    qc.invalidateQueries({ queryKey: ["payments"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    qc.invalidateQueries({ queryKey: ["admin-dashboard-snapshot"] });
    qc.invalidateQueries({ queryKey: ["admin-demands"] });
    qc.invalidateQueries({ queryKey: ["client-sales"] });
    qc.invalidateQueries({ queryKey: ["client-payments"] });
    qc.invalidateQueries({ queryKey: ["client-products"] });
  };

  const updateStatus = async (s: any, next: Exclude<StatusKey, "todos">) => {
    if (!canManage) return;
    if (s.status === next) { toast.info("Status já está aplicado"); return; }
    if (next === "cancelada") {
      await cancelSale(s);
      return;
    }
    const patch: any = { status: next };
    if (next === "concluida") patch.closed_at = s.closed_at || new Date().toISOString();
    else patch.closed_at = null;
    const { error } = await supabase.from("sales").update(patch).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Status atualizado");
    invalidateRelated();
  };

  const updateClosedAt = async (s: any, dateStr: string) => {
    if (!canManage) return;
    const iso = dateStr ? new Date(dateStr + "T12:00:00").toISOString() : null;
    const { error } = await supabase.from("sales").update({ closed_at: iso }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Data de conclusão atualizada");
    invalidateRelated();
  };

  const cancelSale = async (s: any, opts?: { skipConfirm?: boolean }) => {
    if (!canManage) return;
    const message = s.status === "concluida"
      ? "Cancelar uma venda já concluída pode afetar comissões e recebimentos. Continuar?"
      : "Marcar venda como cancelada?";
    if (!opts?.skipConfirm && !(await confirmAction(message))) return;

    const { error } = await supabase.from("sales").update({ status: "cancelada" }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }

    const [paymentsResult, splitsResult, commissionsResult] = await Promise.all([
      supabase.from("payments").update({ status: "cancelado" }).eq("sale_id", s.id).neq("status", "pago"),
      supabase.from("commission_splits").update({ status: "cancelado" }).eq("sale_id", s.id).neq("status", "pago"),
      supabase.from("commissions").update({ status: "cancelado", workflow_status: "cancelada", paid_at: null, approval_date: null }).eq("sale_id", s.id).neq("status", "pago"),
    ]);

    const relatedError = paymentsResult.error || splitsResult.error || commissionsResult.error;
    if (relatedError) toast.warning(`Venda cancelada, mas houve erro ao atualizar vínculos: ${relatedError.message}`);
    else toast.success("Venda cancelada");
    invalidateRelated();
  };

  const editOne = (s: any) => {
    setEditingSale(s);
    setOpen(true);
  };

  const removeOne = async (s: any) => {
    if (!canManage) return;
    const { count: linkedPaymentsCount, error: linkedPaymentsError } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("sale_id", s.id);
    if (linkedPaymentsError) { toast.error(linkedPaymentsError.message); return; }
    const hasReceipts = (linkedPaymentsCount ?? receiptsBySale.get(s.id)?.count ?? 0) > 0;
    if (hasReceipts) {
      if (await confirmAction("Esta venda tem recebimentos vinculados. Para preservar o histórico, ela será cancelada em vez de excluída. Continuar?")) {
        await cancelSale(s, { skipConfirm: true });
      }
      return;
    }
    if (!(await confirmAction(`Excluir venda de ${formatBRL(s.amount)}? Esta ação não pode ser desfeita.`))) return;
    const { error } = await supabase.from("sales").delete().eq("id", s.id);
    if (error) {
      const isLinkedDataError = error.code === "23503" || /violates foreign key constraint/i.test(error.message);
      if (isLinkedDataError && await confirmAction("Não foi possível excluir porque há dados vinculados. Deseja cancelar a venda em vez disso?")) {
        await cancelSale(s, { skipConfirm: true });
        return;
      }
      toast.error(error.message);
    } else { toast.success("Venda excluída"); invalidateRelated(); }
  };

  const exportCSV = () => {
    const headers = ["Data", "Cliente", "Empresa", "Produto", "Parceiro", "Valor", "Comissão %", "Comissão R$", "Status"];
    const rows = sorted.map((s: any) => {
      const splits = splitsBySale.get(s.id) ?? [];
      const com = saleReleasedCommission(s, splitsBySale, receiptsBySale);
      const baseAmt = Number(s.amount || 0);
      const received = saleReceived(s.id, receiptsBySale);
      const pct = received > 0 ? (com / received) * 100 : 0;
      return [
        s.sale_date,
        s.clients?.full_name ?? "",
        s.clients?.company ?? "",
        s.products?.name ?? "",
        s.partners?.full_name ?? "",
        baseAmt.toFixed(2),
        pct.toFixed(2),
        com.toFixed(2),
        s.status,
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `vendas-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => { setSearch(""); setStatus("todos"); setPartnerFilter("todos"); setProductFilter("todos"); setClientFilter("todos"); setDateFrom(""); setDateTo(""); setSelectedMonth(currentMonthKey()); setRangeKey("MÊS"); };
  const activeChips: { label: string; clear: () => void }[] = [];
  if (search) activeChips.push({ label: `Busca: ${search}`, clear: () => setSearch("") });
  if (status !== "todos") activeChips.push({ label: `Status: ${status}`, clear: () => setStatus("todos") });
  if (partnerFilter !== "todos") {
    const name = partnerFilter === "sem" ? "Sem parceiro" : (partnersList.find((p: any) => p.id === partnerFilter)?.full_name ?? "Parceiro");
    activeChips.push({ label: `Parceiro: ${name}`, clear: () => setPartnerFilter("todos") });
  }
  if (productFilter !== "todos") {
    const name = productsList.find((p: any) => p.id === productFilter)?.name ?? "Produto";
    activeChips.push({ label: `Produto: ${name}`, clear: () => setProductFilter("todos") });
  }
  if (clientFilter !== "todos") {
    const c: any = clientsList.find((c: any) => c.id === clientFilter);
    activeChips.push({ label: `Cliente: ${c?.full_name ?? "Cliente"}`, clear: () => setClientFilter("todos") });
  }
  if (!usingManualRange && rangeKey === "MÊS") activeChips.push({ label: `Mês: ${monthLabel(selectedMonth)}`, clear: () => setRangeKey("30 DIAS") });
  if (dateFrom) activeChips.push({ label: `De: ${dateFrom}`, clear: () => setDateFrom("") });
  if (dateTo) activeChips.push({ label: `Até: ${dateTo}`, clear: () => setDateTo("") });
  const hasActiveFilters = activeChips.length > 0;

  return (
    <div className="min-h-dvh bg-slate-50/60 text-slate-900 font-sans admin-shell">
      <PageHero
        eyebrow="Ledger"
        category="Sales Activity"
        title="Vendas"
        description="Log operacional de transações sincronizado em tempo real."
        icon={<ShoppingBag className="size-6" />}
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={rangeKey === "TUDO" ? "TUDO" : (rangeKey === "MÊS" && !usingManualRange ? selectedMonth : "TUDO")}
              onChange={(e) => {
                const v = e.target.value;
                setDateFrom(""); setDateTo("");
                if (v === "TUDO") { setRangeKey("TUDO"); return; }
                setSelectedMonth(v);
                setRangeKey("MÊS");
              }}
              className="h-10 bg-white border border-slate-200/70 rounded-lg px-3 text-xs font-bold text-slate-700 shadow-sm capitalize outline-none focus:ring-2 focus:ring-indigo-200 min-w-[190px]"
            >
              {Array.from({ length: 12 }).map((_, i) => {
                const d = new Date();
                d.setDate(1);
                d.setMonth(d.getMonth() - i);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
                return <option key={key} value={key}>{i === 0 ? `${label} (atual)` : label}</option>;
              })}
              <option value="TUDO">Todo período</option>
            </select>

            <Button variant="outline" size="sm" onClick={exportCSV} className="h-10 px-4 gap-2 border-slate-200/70 bg-white hover:bg-slate-50">
              <Download className="size-4" /> Exportar
            </Button>
            {canManage && (
              <Button size="sm" onClick={() => setOpen(true)} className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                <Plus className="size-4" /> Nova Venda
              </Button>
            )}
          </div>
        }
        kpis={[
          { label: "Volume Bruto", value: formatBRL(kpis.total), tone: "primary", icon: <CircleDollarSign className="size-4" />, onClick: () => setKpiDetail("bruto") },
          { label: !usingManualRange && rangeKey === "MÊS" ? `Recebido (${monthLabel(selectedMonth)})` : "Recebido (mês atual)", value: formatBRL(recebidoNoMes), tone: "success", icon: <HandCoins className="size-4" />, hint: !usingManualRange && rangeKey === "MÊS" ? "Entradas confirmadas no mês selecionado" : "Entradas confirmadas no mês atual", onClick: () => setKpiDetail("recebido_mes") },
          { label: "A Receber (saldo)", value: formatBRL(kpis.aReceber), tone: "warning", icon: <Wallet className="size-4" />, hint: kpis.recebido > 0 ? `Já recebido ${formatBRL(kpis.recebido)}` : undefined, onClick: () => setKpiDetail("a_receber") },
          { label: "Líquido", value: formatBRL(kpis.liquido), tone: "success", icon: <Sparkles className="size-4" />, hint: kpis.total > 0 ? `${((kpis.liquido / kpis.total) * 100).toFixed(1)}% margem` : undefined, onClick: () => setKpiDetail("liquido") },
          { label: "Custos (Zenon + Prestador)", value: formatBRL(kpis.custos), tone: "warning", icon: <Wallet className="size-4" />, hint: kpis.provider > 0 ? `Prestador ${formatBRL(kpis.provider)}` : undefined, onClick: () => setKpiDetail("custos") },
          { label: "Comissões", value: formatBRL(kpis.comissao), tone: "info", icon: <Handshake className="size-4" />, onClick: () => setKpiDetail("comissoes") },
          { label: "Total Registros", value: String(kpis.count), tone: "primary", icon: <TrendingUp className="size-4" />, onClick: () => setKpiDetail("count") },
        ]}
      />


      {/* INSIGHTS */}
      <section className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 px-5 lg:px-8 mt-4">
        <div className="lg:col-span-7 bg-white border border-slate-200/70 rounded-lg shadow-sm p-5">
          <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.22em] font-bold text-slate-500">
                <BarChart3 className="size-3 text-indigo-500" /> Performance · {usingManualRange ? "Período personalizado" : rangeKey}
              </div>
              <h3 className="text-base font-bold mt-1 text-slate-900">Fluxo de Receita Diário</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Bruto vs. Concluído · {chartSeries.length} {chartSeries.length === 1 ? "dia" : "dias"}</p>
            </div>
            <div className="flex items-center gap-5">
              <div className="text-right">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Bruto</p>
                <p className="text-base font-bold font-mono text-indigo-700">{formatBRL(chartTotals.bruto)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Concluído</p>
                <p className="text-base font-bold font-mono text-emerald-600">{formatBRL(chartTotals.concluida)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Ticket médio</p>
                <p className="text-base font-bold font-mono text-slate-900">{formatBRL(chartTotals.ticket)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Vendas</p>
                <p className="text-base font-bold font-mono text-slate-900">{chartTotals.count}</p>
              </div>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartSeries} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradBruto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  interval={chartInterval}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000
                      ? `R$ ${(v / 1_000_000).toFixed(1)}M`
                      : v >= 1_000
                      ? `R$ ${(v / 1_000).toFixed(0)}k`
                      : `R$ ${v}`
                  }
                />
                <Tooltip
                  formatter={(v: any, name: any) => [formatBRL(Number(v)), name]}
                  contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 12px rgba(15,23,42,0.08)" }}
                  labelStyle={{ fontSize: 11, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}
                  cursor={{ fill: "rgba(99,102,241,0.06)" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar dataKey="bruto" name="Bruto" fill="url(#salesGradBruto)" stroke="#6366f1" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line type="monotone" dataKey="concluida" name="Concluído" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: "#10b981" }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="pendente" name="Pend./Andamento" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>


        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.22em] font-bold text-slate-500">
                <Sparkles className="size-3 text-indigo-500" /> Distribuição
              </div>
              <div className="flex items-center gap-1.5">
                <Select value={breakdownDim} onValueChange={(v) => changeBreakdown(v as any, breakdownMetric)}>
                  <SelectTrigger className="h-7 w-[170px] text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status">Por status</SelectItem>
                    <SelectItem value="partner">Por parceiro</SelectItem>
                    <SelectItem value="product">Por produto</SelectItem>
                    <SelectItem value="client">Por cliente</SelectItem>
                    <SelectItem value="revenue_type">Avulso vs Recorrente</SelectItem>
                    <SelectItem value="month">Por mês</SelectItem>
                    <SelectItem value="partner_product">Parceiro · Produto</SelectItem>
                    <SelectItem value="product_client">Produto · Cliente</SelectItem>
                    <SelectItem value="partner_client">Parceiro · Cliente</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={breakdownMetric} onValueChange={(v) => changeBreakdown(breakdownDim, v as any)}>
                  <SelectTrigger className="h-7 w-[110px] text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bruto">Bruto</SelectItem>
                    <SelectItem value="recebido">Recebido</SelectItem>
                    <SelectItem value="liquido">Líquido</SelectItem>
                    <SelectItem value="qtd">Qtd.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {statusBreakdown.length === 0 ? (
              <p className="text-[12px] text-slate-400 text-center py-3">Sem dados para o filtro atual.</p>
            ) : (
              <div className="space-y-2.5">
                {statusBreakdown.map((row) => (
                  <div key={row.key}>
                    <div className="flex items-center justify-between text-[11px] mb-1 gap-2">
                      <span className="font-semibold text-slate-700 truncate">{row.label}</span>
                      <span className="font-mono font-bold text-slate-900 whitespace-nowrap">
                        {breakdownMetric === "qtd" ? row.value : formatBRL(row.value)}
                        <span className="text-slate-400 font-medium ml-1">({row.pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${Math.min(100, row.pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>


          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.22em] font-bold text-slate-500">
                <Trophy className="size-3 text-amber-500" /> Top Parceiros
              </div>
              <Users className="size-3.5 text-slate-300" />
            </div>
            {topPartners.length === 0 ? (
              <p className="text-[12px] text-slate-400 text-center py-3">Sem vendas via parceiros no período.</p>
            ) : (
              <div className="space-y-2">
                {topPartners.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className={cn(
                      "size-7 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0",
                      i === 0 && "bg-amber-100 text-amber-700",
                      i === 1 && "bg-slate-100 text-slate-700",
                      i === 2 && "bg-orange-100 text-orange-700",
                      i > 2 && "bg-slate-50 text-slate-600",
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-slate-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-500">{p.deals} {p.deals === 1 ? "venda" : "vendas"}</p>
                    </div>
                    <p className="text-[12px] font-bold font-mono text-indigo-700">{formatBRL(p.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 mt-4">
        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por cliente, empresa, produto, parceiro, documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border-slate-200 h-10 pl-10 pr-4 text-sm rounded-md"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusKey)}>
            <SelectTrigger className="h-10 w-[150px] rounded-md bg-white border-slate-200 text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="concluida">Concluídas</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="cancelada">Canceladas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={revenueFilter} onValueChange={(v) => setRevenueFilter(v as any)}>
            <SelectTrigger className="h-10 w-[150px] rounded-md bg-white border-slate-200 text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos tipos</SelectItem>
              <SelectItem value="avulso">Avulsa (na cabeça)</SelectItem>
              <SelectItem value="recorrente">Recorrente (MRR)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={partnerFilter} onValueChange={setPartnerFilter}>
            <SelectTrigger className="h-10 w-[170px] rounded-md bg-white border-slate-200 text-xs font-medium">
              <SelectValue placeholder="Parceiro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos parceiros</SelectItem>
              <SelectItem value="sem">Sem parceiro (Direto)</SelectItem>
              {partnersList.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="h-10 w-[170px] rounded-md bg-white border-slate-200 text-xs font-medium">
              <SelectValue placeholder="Produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos produtos</SelectItem>
              {productsList.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="h-10 w-[190px] rounded-md bg-white border-slate-200 text-xs font-medium">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos clientes</SelectItem>
              {clientsList.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.full_name}{c.company ? ` · ${c.company}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2.5 h-10">
            <CalendarRange className="size-3.5 text-slate-400" />
            <input type="date" value={dateFrom} onChange={(e) => {
              setDateFrom(e.target.value);
              if (dateTo && e.target.value && e.target.value > dateTo) setDateTo(e.target.value);
            }} className="bg-transparent text-xs text-slate-700 outline-none w-[120px]" />
            <span className="text-slate-300">→</span>
            <input type="date" value={dateTo} onChange={(e) => {
              setDateTo(e.target.value);
              if (dateFrom && e.target.value && e.target.value < dateFrom) setDateFrom(e.target.value);
            }} className="bg-transparent text-xs text-slate-700 outline-none w-[120px]" />
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2.5 h-10">
            <CalendarRange className="size-3.5 text-slate-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(e.target.value || currentMonthKey()); setRangeKey("MÊS"); setDateFrom(""); setDateTo(""); }}
              className="bg-transparent text-xs text-slate-700 outline-none w-[132px] capitalize"
              title="Filtrar por mês fechado"
            />
          </div>

          <StageFilterBar />

          <FilterPresets
            scope="sales"
            getState={() => ({
              search, status, revenueFilter, partnerFilter, productFilter, clientFilter,
              dateFrom, dateTo, selectedMonth, rangeKey,
            })}
            applyState={(s) => {
              setSearch(s.search ?? "");
              setStatus((s.status ?? "todos") as any);
              setRevenueFilter((s.revenueFilter ?? "todos") as any);
              setPartnerFilter(s.partnerFilter ?? "todos");
              setProductFilter(s.productFilter ?? "todos");
              setClientFilter(s.clientFilter ?? "todos");
              setDateFrom(s.dateFrom ?? "");
              setDateTo(s.dateTo ?? "");
              if (s.selectedMonth) setSelectedMonth(s.selectedMonth);
              if (s.rangeKey) setRangeKey(s.rangeKey);
            }}
            currentSignature={JSON.stringify({
              search, status, revenueFilter, partnerFilter, productFilter, clientFilter,
              dateFrom, dateTo, selectedMonth, rangeKey,
            })}
          />

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 text-slate-500 hover:text-slate-900">
              <X className="size-3.5 mr-1" /> Limpar
            </Button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {activeChips.map((c, i) => (
              <button
                key={i}
                onClick={c.clear}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-semibold border border-indigo-100 hover:bg-indigo-100"
              >
                {c.label}
                <X className="size-3" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 mt-4 mb-10">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            {sorted.length} {sorted.length === 1 ? "venda" : "vendas"}
          </p>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <Eye className="size-3.5" />
                  Colunas <span className="text-slate-400 font-mono">({Object.values(visibleCols).filter(Boolean).length}/{ALL_COLS.length})</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {ALL_COLS.map((c) => (
                  <DropdownMenuItem key={c.key} onSelect={(e) => { e.preventDefault(); toggleCol(c.key); }} className="cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleCols[c.key]}
                      readOnly
                      className="mr-2 size-3.5 accent-indigo-600 pointer-events-none"
                    />
                    {c.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="inline-flex items-center gap-0.5 bg-white border border-slate-200 rounded-md p-0.5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">Tamanho</span>
              {(["compact", "normal", "spacious"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => changeDensity(d)}
                  className={cn(
                    "px-2.5 py-1 text-[10.5px] font-semibold rounded transition-colors",
                    density === d ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
                  )}
                  title={d === "compact" ? "Compacto" : d === "normal" ? "Normal" : "Confortável"}
                >
                  {d === "compact" ? "S" : d === "normal" ? "M" : "L"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <SalesTableScroll density={density}>
            <table className={cn("w-full min-w-[700px]", density === "normal" && "text-[13px]")}>

              <thead>
                <tr className="border-b border-slate-200/70 bg-slate-50/60">
                  <Th align="left">Ações</Th>
                  {visibleCols.status && <SortableTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />}
                  {visibleCols.client && <SortableTh label="Cliente" k="client" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />}
                  {visibleCols.product && <SortableTh label="Produto" k="product" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />}
                  {visibleCols.partner && <SortableTh label="Parceiro" k="partner" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />}
                  {visibleCols.date && <SortableTh label="Data" k="sale_date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />}
                  {visibleCols.amount && <SortableTh label="Valor" k="amount" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />}
                  {visibleCols.commission && <SortableTh label="Comissão" k="commission" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />}
                  {visibleCols.liquido && <SortableTh label="Líquido" k="liquido" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />}
                  {visibleCols.recebido && <SortableTh label="Recebido / Restante" k="recebido" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 10 }).map((__, j) => (
                        <td key={j} className="px-5 py-4"><div className="h-3 bg-slate-100 rounded w-3/4" /></td>
                      ))}
                    </tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Inbox className="size-8" />
                        <p className="text-sm font-medium">
                          {hasActiveFilters ? "Nenhuma venda encontrada com esses filtros." : "Nenhuma venda registrada ainda."}
                        </p>
                        {hasActiveFilters && (
                          <Button variant="link" size="sm" onClick={clearFilters} className="text-indigo-600">Limpar filtros</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : pageRows.map((s: any) => {
                  const splits = splitsBySale.get(s.id) ?? [];
                  const fullCommissionVal = saleFullCommission(s, splitsBySale);
                  const commissionVal = saleReleasedCommission(s, splitsBySale, receiptsBySale);
                  const baseAmt = Number(s.amount || 0);
                  const ratio = saleRatio(s, receiptsBySale);
                  const zenonCost = Number(s.zenon_cost || 0) * ratio;
                  const providerCost = Number(s.provider_cost || 0) * ratio;
                  const totalCustos = zenonCost + providerCost;
                  const paidCount = splits.filter((sp: any) => sp.status === "pago").length;
                  const rec = receiptsBySale.get(s.id);
                  const received = rec?.received ?? 0;
                  const liquido = received - totalCustos - commissionVal;
                  const liquidoPct = received > 0 ? (liquido / received) * 100 : 0;
                  const commissionPct = received > 0 ? (commissionVal / received) * 100 : 0;
                  const remaining = Math.max(baseAmt - received, 0);
                  const receivedPct = baseAmt > 0 ? Math.min(100, (received / baseAmt) * 100) : 0;
                  const fullyReceived = baseAmt > 0 && remaining < 0.01;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors group">
                      <Td>
                        {canManage ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Mais ações" className="size-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {s.clients?.id && (
                                <DropdownMenuItem asChild>
                                  <Link to={`/clientes/${s.clients.id}`}>
                                    <Eye className="size-3.5 mr-2" /> Ver Cliente
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => editOne(s)}>
                                <Pencil className="size-3.5 mr-2 text-indigo-600" /> Editar Venda
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setReceivingSale(s)}>
                                <HandCoins className="size-3.5 mr-2 text-emerald-600" /> Registrar Recebimento
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem disabled={s.status === "concluida"} onClick={() => updateStatus(s, "concluida")}>
                                <CheckCircle2 className="size-3.5 mr-2 text-emerald-600" /> Marcar finalizada
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={s.status === "em_andamento"} onClick={() => updateStatus(s, "em_andamento")}>
                                <PlayCircle className="size-3.5 mr-2 text-sky-600" /> Em andamento
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={s.status === "pendente"} onClick={() => updateStatus(s, "pendente")}>
                                <Clock3 className="size-3.5 mr-2 text-amber-600" /> Pendente
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={s.status === "cancelada"} onClick={() => updateStatus(s, "cancelada")}>
                                <XCircle className="size-3.5 mr-2 text-rose-600" /> Cancelar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => removeOne(s)} className="text-rose-600 focus:text-rose-700">
                                <Trash2 className="size-3.5 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          s.clients?.id && (
                            <Button asChild variant="ghost" size="icon" aria-label="Ver cliente" className="size-8 text-slate-400 hover:text-slate-900">
                              <Link to={`/clientes/${s.clients.id}`}><Eye className="size-4" /></Link>
                            </Button>
                          )
                        )}
                      </Td>
                      {visibleCols.status && (
                        <Td>
                          <div className="flex flex-col gap-1">
                            <StatusPill status={s.status} />
                            {s.status === "concluida" && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    disabled={!canManage}
                                    className={cn(
                                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold transition-colors w-fit",
                                      s.closed_at
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                        : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 animate-pulse",
                                      !canManage && "cursor-not-allowed opacity-70"
                                    )}
                                    title="Editar data de conclusão"
                                  >
                                    <CalendarRange className="size-3" />
                                    {s.closed_at ? formatBRDate(s.closed_at) : "definir data"}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent align="start" className="w-auto p-3">
                                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Data de conclusão</label>
                                  <Input
                                    type="date"
                                    defaultValue={s.closed_at ? new Date(s.closed_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)}
                                    onBlur={(e) => updateClosedAt(s, e.target.value)}
                                    className="h-8 text-xs"
                                  />
                                </PopoverContent>
                              </Popover>
                            )}

                          </div>
                        </Td>
                      )}
                      {visibleCols.client && (
                        <Td>
                          <div className="min-w-0 space-y-1">
                            <Link
                              className="font-semibold text-slate-900 truncate hover:text-indigo-700 transition-colors text-left block"
                              to={s.clients?.id ? `/clientes/${s.clients.id}` : "#"}
                            >
                              {s.clients?.full_name ?? "—"}
                            </Link>
                            <p className="text-[11px] font-medium text-slate-500 truncate">{s.clients?.company || "Conta Pessoal"}</p>
                            {s.clients?.id && (
                              <InlineStageSelect
                                clientId={s.clients.id}
                                stageId={clientStageMap?.get(s.clients.id) ?? null}
                                variant="compact"
                              />
                            )}
                          </div>
                        </Td>
                      )}

                      {visibleCols.product && (
                        <Td>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-700">{s.products?.name ?? "—"}</span>
                            {s.revenue_type === "recorrente" ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">MRR{s.recurrence_months ? ` ${s.recurrence_months}m` : ""}</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">Avulso</span>
                            )}
                          </div>
                        </Td>
                      )}
                      {visibleCols.partner && (
                        <Td>
                          {s.partners?.full_name ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-semibold border border-indigo-100">
                              <span className="size-1.5 rounded-full bg-indigo-500" />
                              {s.partners.full_name}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Direto</span>
                          )}
                        </Td>
                      )}
                      {visibleCols.date && <Td className="text-slate-600 text-xs font-mono">{s.sale_date ? formatBRDate(parseISO(s.sale_date)) : "—"}</Td>}
                      {visibleCols.amount && <Td align="right"><span className="font-semibold text-slate-900 font-mono">{formatBRL(s.amount)}</span></Td>}

                      {visibleCols.commission && (
                      <Td align="right">

                        {commissionVal > 0 ? (
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <span className="font-bold font-mono text-[12.5px] text-emerald-700 tabular-nums leading-none">
                              {formatBRL(commissionVal)}
                            </span>
                            {fullCommissionVal > commissionVal + 0.01 && (
                              <span className="text-[10px] text-slate-400 font-mono leading-none">de {formatBRL(fullCommissionVal)}</span>
                            )}
                            <div className="flex items-center gap-1 mt-1">
                              <span className="inline-flex items-center px-1.5 py-px rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9.5px] font-bold font-mono tabular-nums tracking-tight">
                                {commissionPct.toFixed(1)}%
                              </span>
                              <span className="inline-flex items-center px-1.5 py-px rounded bg-slate-50 text-slate-600 border border-slate-200 text-[9.5px] font-semibold tabular-nums">
                                {splits.length}
                              </span>
                              {paidCount > 0 && (
                                <span
                                  title={`${paidCount} pago${paidCount > 1 ? "s" : ""}`}
                                  className="inline-flex items-center px-1.5 py-px rounded bg-emerald-600 text-white text-[9.5px] font-bold tabular-nums"
                                >
                                  ✓ {paidCount}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </Td>
                      )}
                      {visibleCols.liquido && (
                      <Td align="right">

                        {baseAmt > 0 ? (
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <span className={cn(
                              "font-bold font-mono text-[12.5px] tabular-nums leading-none",
                              liquido > 0 ? "text-indigo-700" : liquido < 0 ? "text-rose-600" : "text-slate-500"
                            )}>
                              {formatBRL(liquido)}
                            </span>
                            <div className="flex items-center gap-1 mt-1">
                              <span className={cn(
                                "inline-flex items-center px-1.5 py-px rounded border text-[9.5px] font-bold font-mono tabular-nums tracking-tight",
                                liquidoPct >= 50 ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                                liquidoPct >= 0 ? "bg-slate-50 text-slate-600 border-slate-200" :
                                "bg-rose-50 text-rose-700 border-rose-100"
                              )}>
                                {liquidoPct.toFixed(1)}%
                              </span>
                              {zenonCost > 0 && (
                                <span
                                  title={`Custo Zenon ${formatBRL(zenonCost)}`}
                                  className="inline-flex items-center px-1.5 py-px rounded bg-amber-50 text-amber-700 border border-amber-100 text-[9.5px] font-semibold font-mono tabular-nums"
                                >
                                  −Z
                                </span>
                              )}
                              {providerCost > 0 && (
                                <span
                                  title={`Custo Prestador ${formatBRL(providerCost)}`}
                                  className="inline-flex items-center px-1.5 py-px rounded bg-orange-50 text-orange-700 border border-orange-100 text-[9.5px] font-semibold font-mono tabular-nums"
                                >
                                  −P
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </Td>
                      )}
                      {visibleCols.recebido && (
                      <Td align="right">

                        {baseAmt > 0 ? (
                          <button
                            type="button"
                            onClick={() => canManage && setReceivingSale(s)}
                            className={cn(
                              "inline-flex flex-col items-end gap-1 group/rec rounded-md px-1.5 py-1 -mr-1.5 transition-colors",
                              canManage && "hover:bg-emerald-50/60 cursor-pointer"
                            )}
                            disabled={!canManage}
                            title={canManage ? "Registrar recebimento" : undefined}
                          >
                            <div className="flex items-baseline gap-1.5">
                              <span className={cn(
                                "font-bold font-mono text-[12.5px] tabular-nums leading-none",
                                fullyReceived ? "text-emerald-700" : received > 0 ? "text-emerald-600" : "text-slate-400"
                              )}>
                                {formatBRL(received)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">/{formatBRL(baseAmt)}</span>
                            </div>
                            <div className="w-[110px] h-1 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  fullyReceived ? "bg-emerald-500" : received > 0 ? "bg-emerald-400" : "bg-slate-300"
                                )}
                                style={{ width: `${receivedPct}%` }}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              {fullyReceived ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-px rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9.5px] font-bold tabular-nums">
                                  <CheckCircle2 className="size-2.5" /> Quitado
                                </span>
                              ) : remaining > 0 && received > 0 ? (
                                <span className="inline-flex items-center px-1.5 py-px rounded bg-amber-50 text-amber-700 border border-amber-100 text-[9.5px] font-bold font-mono tabular-nums">
                                  Falta {formatBRL(remaining)}
                                </span>
                              ) : received === 0 ? (
                                <span className="inline-flex items-center px-1.5 py-px rounded bg-slate-50 text-slate-500 border border-slate-200 text-[9.5px] font-semibold uppercase tracking-wider">
                                  A receber
                                </span>
                              ) : null}
                              {rec && rec.count > 0 && (
                                <span className="text-[9.5px] text-slate-400 font-mono">{rec.count}x</span>
                              )}
                              {rec && rec.receivedThisMonth > 0 && (
                                <span
                                  title="Recebido no mês corrente"
                                  className="inline-flex items-center px-1.5 py-px rounded bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9.5px] font-bold font-mono tabular-nums"
                                >
                                  mês {formatBRL(rec.receivedThisMonth)}
                                </span>
                              )}
                            </div>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </Td>
                      )}

                    </tr>
                  );
                })}
              </tbody>
            </table>
        </SalesTableScroll>

        <PaginationControl
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={sorted.length}
          itemsPerPage={PAGE_SIZE} pageSize={__ps} onPageSizeChange={setPageSize} />

      </div>

      <SaleFormDialog 
        open={open} 
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditingSale(null);
        }} 
        onCreated={invalidateRelated}
        sale={editingSale}
      />

      <ReceivePaymentDialog
        open={!!receivingSale}
        onOpenChange={(v) => { if (!v) setReceivingSale(null); }}
        sale={receivingSale}
        onSaved={invalidateRelated}
      />

      <KpiDetailDialog
        kind={kpiDetail}
        onClose={() => setKpiDetail(null)}
        filtered={filtered}
        allReceipts={allReceipts}
        splitsBySale={splitsBySale}
        receiptsBySale={receiptsBySale}
        monthYm={!usingManualRange && rangeKey === "MÊS" ? selectedMonth : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
      />

    </div>
  );
}

function KpiDetailDialog({ kind, onClose, filtered, allReceipts, splitsBySale, receiptsBySale, monthYm }: {
  kind: null | "bruto" | "recebido_mes" | "a_receber" | "liquido" | "custos" | "comissoes" | "count";
  onClose: () => void;
  filtered: any[]; allReceipts: any[];
  splitsBySale: Map<string, any[]>; receiptsBySale: Map<string, any>;
  monthYm: string;
}) {
  const config = useMemo(() => {
    if (!kind) return null;
    const rowFor = (s: any, contribution: number, extra?: string) => ({ s, contribution, extra });
    switch (kind) {
      case "bruto": {
        const rows = filtered.filter(s => s.status !== "cancelada").map(s => rowFor(s, Number(s.amount || 0)));
        return { title: "Volume Bruto — detalhamento", subtitle: "Soma do valor de todas as vendas ativas do período.", rows, isMoney: true };
      }
      case "recebido_mes": {
        const ym = monthYm;

        const bySale = new Map<string, number>();
        allReceipts.forEach((r: any) => {
          if (paymentCompetenceYm(r) !== ym) return;
          const val = receivedPaymentAmount(r);
          if (val <= 0 || !r.sale_id) return;
          bySale.set(r.sale_id, (bySale.get(r.sale_id) || 0) + val);
        });
        const rows = Array.from(bySale.entries()).map(([id, v]) => {
          const s = filtered.find((x) => x.id === id) || { id, clients: null, products: null, partners: null, amount: 0, sale_date: null };
          return rowFor(s, v);
        });
        return { title: `Recebido em ${ym} — detalhamento`, subtitle: "Pagamentos confirmados dentro do mês selecionado, por venda.", rows, isMoney: true };
      }
      case "a_receber": {
        const rows = filtered.filter(s => s.status !== "cancelada").map(s => {
          const rec = receiptsBySale.get(s.id)?.received ?? 0;
          const saldo = Math.max(Number(s.amount || 0) - rec, 0);
          return rowFor(s, saldo, saldo > 0 ? `Já recebido ${formatBRL(rec)}` : "Quitada");
        }).filter(r => r.contribution > 0);
        return { title: "A Receber — detalhamento", subtitle: "Saldo em aberto por venda (valor − já recebido).", rows, isMoney: true };
      }
      case "liquido": {
        const rows = filtered.map(s => {
          const rec = saleReceived(s.id, receiptsBySale);
          const comm = saleReleasedCommission(s, splitsBySale, receiptsBySale);
          const costs = saleReleasedCosts(s, receiptsBySale);
          const liq = rec - costs - comm;
          return rowFor(s, liq, `Recebido ${formatBRL(rec)} · Comissão ${formatBRL(comm)} · Custos ${formatBRL(costs)}`);
        });
        return { title: "Líquido — detalhamento", subtitle: "Recebido do cliente − custos proporcionais − comissões proporcionais.", rows, isMoney: true };
      }
      case "custos": {
        const rows = filtered.map(s => {
          const ratio = saleRatio(s, receiptsBySale);
          const zenon = Number(s.zenon_cost || 0) * ratio;
          const provider = Number(s.provider_cost || 0) * ratio;
          const full = Number(s.zenon_cost || 0) + Number(s.provider_cost || 0);
          return rowFor(s, zenon + provider, `Zenon ${formatBRL(zenon)} · Prestador ${formatBRL(provider)} · Total previsto ${formatBRL(full)}`);
        }).filter(r => r.contribution > 0);
        return { title: "Custos — detalhamento", subtitle: "Custos Zenon + Prestador proporcionais ao valor recebido do cliente.", rows, isMoney: true };
      }
      case "comissoes": {
        const rows = filtered.map(s => {
          const comm = saleReleasedCommission(s, splitsBySale, receiptsBySale);
          const full = saleFullCommission(s, splitsBySale);
          return rowFor(s, comm, full > comm + 0.01 ? `Total previsto ${formatBRL(full)}` : undefined);
        }).filter(r => r.contribution > 0);
        return { title: "Comissões — detalhamento", subtitle: "Comissões liberadas proporcionalmente ao valor recebido do cliente.", rows, isMoney: true };
      }
      case "count": {
        const rows = filtered.map(s => rowFor(s, 1));
        return { title: "Total de registros — detalhamento", subtitle: "Todas as vendas do período filtrado.", rows, isMoney: false };
      }
    }
  }, [kind, filtered, allReceipts, splitsBySale, receiptsBySale, monthYm]);

  const sorted = useMemo(() => (config?.rows ?? []).slice().sort((a, b) => b.contribution - a.contribution), [config]);
  const total = useMemo(() => sorted.reduce((s, r) => s + r.contribution, 0), [sorted]);

  return (
    <Dialog open={!!kind} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{config?.title}</DialogTitle>
          <p className="text-[12px] text-slate-500">{config?.subtitle}</p>
        </DialogHeader>
        <div className="flex items-center justify-between text-[12px] px-1">
          <span className="text-slate-500">{sorted.length} {sorted.length === 1 ? "venda" : "vendas"}</span>
          <span className="font-mono font-bold text-slate-900">Total: {config?.isMoney ? formatBRL(total) : total}</span>
        </div>
        <div className="overflow-y-auto border border-slate-200/70 rounded-md">
          <table className="w-full text-[12.5px]">
            <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-bold">Data</th>
                <th className="text-left px-3 py-2 font-bold">Cliente</th>
                <th className="text-left px-3 py-2 font-bold">Produto</th>
                <th className="text-left px-3 py-2 font-bold">Parceiro</th>
                <th className="text-right px-3 py-2 font-bold">Contribuição</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={5} className="text-center text-slate-400 py-6">Nenhum registro contribui para este número.</td></tr>
              )}
              {sorted.map((r, i) => (
                <tr key={r.s.id || i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{r.s.sale_date ? formatBRDate(r.s.sale_date) : "—"}</td>
                  <td className="px-3 py-2">
                    {r.s.client_id ? (
                      <Link to={`/admin/clientes/${r.s.client_id}`} className="text-indigo-700 hover:underline font-medium">
                        {r.s.clients?.full_name || r.s.clients?.company || "—"}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{r.s.products?.name || "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{r.s.partners?.full_name || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                    {config?.isMoney ? formatBRL(r.contribution) : r.contribution}
                    {r.extra && <div className="text-[10.5px] text-slate-400 font-normal font-sans">{r.extra}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    concluida: { label: "concluída", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    em_andamento: { label: "em andamento", cls: "bg-sky-50 text-sky-700 border-sky-200" },
    pendente: { label: "pendente", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    cancelada: { label: "cancelada", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  };
  const m = map[status] ?? { label: status, cls: "bg-slate-50 text-slate-600 border-slate-200" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md border text-[10.5px] font-bold uppercase tracking-wider", m.cls)}>
      {m.label}
    </span>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={cn(
      "px-5 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500",
      align === "right" ? "text-right" : "text-left"
    )}>
      {children}
    </th>
  );
}

function SortableTh({
  label, k, sortKey, sortDir, onClick, align = "left",
}: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: SortDir; onClick: (k: SortKey) => void; align?: "left" | "right";
}) {
  const active = sortKey === k;
  return (
    <th className={cn("px-5 py-3", align === "right" ? "text-right" : "text-left")}>
      <button
        onClick={() => onClick(k)}
        className={cn(
          "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors",
          active ? "text-indigo-700" : "text-slate-500 hover:text-slate-900",
          align === "right" && "flex-row-reverse"
        )}
      >
        {label}
        {active && (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
}

function Td({ children, align = "left", className }: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={cn(
      "px-5 py-4",
      align === "right" ? "text-right" : "text-left",
      className
    )}>
      {children}
    </td>
  );
}

function SalesTableScroll({ density, children }: { density: "compact" | "normal" | "spacious"; children: React.ReactNode }) {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const update = () => {
      const inner = el.firstElementChild as HTMLElement | null;
      setWidth(inner ? inner.scrollWidth : el.scrollWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild as Element);
    return () => ro.disconnect();
  }, [children]);

  const syncFromTop = () => {
    if (topRef.current && bottomRef.current) bottomRef.current.scrollLeft = topRef.current.scrollLeft;
  };
  const syncFromBottom = () => {
    if (topRef.current && bottomRef.current) topRef.current.scrollLeft = bottomRef.current.scrollLeft;
  };

  return (
    <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
      <div ref={topRef} onScroll={syncFromTop} className="overflow-x-auto overflow-y-hidden border-b border-slate-200/70 bg-slate-50/40">
        <div style={{ width, height: 1 }} />
      </div>
      <div
        ref={bottomRef}
        onScroll={syncFromBottom}
        className={cn(
          "overflow-x-auto",
          density === "compact" && "[&_td]:!py-1.5 [&_td]:!px-3 [&_th]:!py-1.5 [&_th]:!px-3 text-[11.5px]",
          density === "spacious" && "[&_td]:!py-5 [&_th]:!py-4 text-[14px]"
        )}
      >
        {children}
      </div>
    </div>
  );
}
