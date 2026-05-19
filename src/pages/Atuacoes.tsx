import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, isToday, isPast, isFuture, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarClock, CheckCircle2, Clock, Plus, AlertTriangle, History as HistoryIcon,
  CalendarDays, User2, Briefcase, ChevronRight, Search, X, MessageSquare, RotateCcw,
  Flame, Target, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type DailyAction = {
  id: string;
  client_id: string;
  client_product_id: string | null;
  scheduled_date: string;
  status: "pendente" | "executada" | "cancelada";
  result: string | null;
  notes: string | null;
  execution_notes: string | null;
  priority: "baixa" | "normal" | "alta";
  executed_at: string | null;
  created_at: string;
  client?: { id: string; full_name: string; company: string | null } | null;
  product?: { id: string; product?: { name: string | null } | null; custom_product_name: string | null } | null;
};

const RESULT_LABELS: Record<string, { label: string; tone: string }> = {
  contatado: { label: "Contatado", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  sem_resposta: { label: "Sem resposta", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  fechado: { label: "Fechado", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  reagendar: { label: "Reagendar", tone: "bg-slate-100 text-slate-700 border-slate-200" },
};

const PRIORITY_TONE: Record<string, string> = {
  alta: "bg-rose-50 text-rose-700 border-rose-200",
  normal: "bg-slate-50 text-slate-600 border-slate-200",
  baixa: "bg-slate-50 text-slate-500 border-slate-200",
};

export default function Atuacoes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"hoje" | "atrasadas" | "proximas" | "historico">("hoje");
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [executing, setExecuting] = useState<DailyAction | null>(null);
  const [reschedule, setReschedule] = useState<DailyAction | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "true") {
      setOpenCreate(true);
      // Limpa a URL para não abrir de novo no refresh
      window.history.replaceState({}, "", "/atuacoes");
    }
  }, []);

  const { data: actions = [], isLoading } = useQuery({
    queryKey: ["daily_actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_actions")
        .select(`*,
          client:clients(id, full_name, company),
          product:client_products(id, custom_product_name, product:products(name))
        `)
        .order("scheduled_date", { ascending: true })
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DailyAction[];
    },
  });

  const filtered = useMemo(() => {
    const today = startOfDay(new Date());
    const term = search.trim().toLowerCase();
    const match = (a: DailyAction) =>
      !term ||
      a.client?.full_name?.toLowerCase().includes(term) ||
      a.client?.company?.toLowerCase().includes(term) ||
      a.notes?.toLowerCase().includes(term);

    const pending = actions.filter((a) => a.status === "pendente");
    const hoje = pending.filter((a) => isToday(parseISO(a.scheduled_date))).filter(match);
    const atrasadas = pending
      .filter((a) => isPast(parseISO(a.scheduled_date)) && !isToday(parseISO(a.scheduled_date)))
      .filter(match);
    const proximas = pending.filter((a) => isFuture(parseISO(a.scheduled_date))).filter(match);
    const historico = actions
      .filter((a) => a.status !== "pendente")
      .filter(match)
      .sort((a, b) => (b.executed_at ?? b.created_at).localeCompare(a.executed_at ?? a.created_at));

    const executadasHoje = actions.filter(
      (a) => a.status === "executada" && a.executed_at && isToday(parseISO(a.executed_at))
    ).length;

    return { hoje, atrasadas, proximas, historico, executadasHoje, today };
  }, [actions, search]);

  const executeMut = useMutation({
    mutationFn: async ({ id, result, execution_notes }: { id: string; result: string; execution_notes: string }) => {
      const { error } = await supabase
        .from("daily_actions")
        .update({
          status: "executada",
          result,
          execution_notes,
          executed_by: user?.id ?? null,
          executed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_actions"] });
      toast.success("Atuação registrada");
      setExecuting(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const rescheduleMut = useMutation({
    mutationFn: async ({ id, date }: { id: string; date: Date }) => {
      const { error } = await supabase
        .from("daily_actions")
        .update({ scheduled_date: format(date, "yyyy-MM-dd") })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_actions"] });
      toast.success("Reagendado");
      setReschedule(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("daily_actions").update({ status: "cancelada" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_actions"] });
      toast.success("Cancelada");
    },
  });

  const list =
    tab === "hoje" ? filtered.hoje :
    tab === "atrasadas" ? filtered.atrasadas :
    tab === "proximas" ? filtered.proximas :
    filtered.historico;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 animate-in fade-in duration-700">
      <PageHero
        eyebrow="Operação"
        category="Atuações"
        title="Atuações do dia"
        description="Agende clientes para atuar, registre o que foi feito e mantenha o histórico de cada interação."
        icon={<Target className="size-6" />}
        actions={
          <Button onClick={() => setOpenCreate(true)} className="px-6 py-6 rounded-2xl bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
            <Plus className="size-4 mr-2 stroke-[3]" />
            NOVA ATUAÇÃO
          </Button>
        }
        kpis={[
          { label: "Hoje", value: filtered.hoje.length.toString(), tone: "primary", icon: <CalendarClock className="size-4" /> },
          { label: "Atrasadas", value: filtered.atrasadas.length.toString(), tone: "danger", icon: <AlertTriangle className="size-4" /> },
          { label: "Próximas", value: filtered.proximas.length.toString(), tone: "default", icon: <CalendarDays className="size-4" /> },
          { label: "Concluídas", value: filtered.executadasHoje.toString(), tone: "success", icon: <CheckCircle2 className="size-4" /> },
        ]}
      />

      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 py-5 sm:py-8 space-y-6 animate-in slide-in-from-bottom-4 duration-1000">

      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 py-5 sm:py-8 space-y-6 animate-in slide-in-from-bottom-4 duration-1000">

      {/* Search + tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1">
          <TabsList className="bg-white border border-slate-200/70 rounded-lg p-1 h-auto w-full sm:w-auto overflow-x-auto flex-nowrap justify-start">
            <TabsTrigger value="hoje" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 text-[12.5px] font-semibold gap-1.5 px-3 py-1.5">
              <Flame className="size-3.5" /> Hoje
              {filtered.hoje.length > 0 && <span className="ml-1 text-[10px] bg-indigo-600 text-white rounded-full px-1.5 py-0.5 tabular-nums">{filtered.hoje.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="atrasadas" className="data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700 text-[12.5px] font-semibold gap-1.5 px-3 py-1.5">
              <AlertTriangle className="size-3.5" /> Atrasadas
              {filtered.atrasadas.length > 0 && <span className="ml-1 text-[10px] bg-rose-600 text-white rounded-full px-1.5 py-0.5 tabular-nums">{filtered.atrasadas.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="proximas" className="text-[12.5px] font-semibold gap-1.5 px-3 py-1.5">
              <CalendarDays className="size-3.5" /> Próximas
            </TabsTrigger>
            <TabsTrigger value="historico" className="text-[12.5px] font-semibold gap-1.5 px-3 py-1.5">
              <HistoryIcon className="size-3.5" /> Histórico
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative sm:w-[260px]">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente ou nota..."
            className="pl-8 h-9 text-[13px] bg-white border-slate-200/70"
          />
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-12 text-sm text-slate-400">Carregando...</div>
        ) : list.length === 0 ? (
          <EmptyState tab={tab} onCreate={() => setOpenCreate(true)} />
        ) : (
          list.map((a) => (
            <ActionRow
              key={a.id}
              action={a}
              onExecute={() => setExecuting(a)}
              onReschedule={() => setReschedule(a)}
              onCancel={() => cancelMut.mutate(a.id)}
            />
          ))
        )}
      </div>

      <CreateActionDialog open={openCreate} onOpenChange={setOpenCreate} userId={user?.id} />

      {/* Execute dialog */}
      <Dialog open={!!executing} onOpenChange={(o) => !o && setExecuting(null)}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Registrar atuação</DialogTitle>
            <DialogDescription>
              {executing?.client?.full_name} {executing?.client?.company && `· ${executing.client.company}`}
            </DialogDescription>
          </DialogHeader>
          <ExecuteForm
            onSubmit={(data) => executing && executeMut.mutate({ id: executing.id, ...data })}
            loading={executeMut.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog open={!!reschedule} onOpenChange={(o) => !o && setReschedule(null)}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Reagendar atuação</DialogTitle>
            <DialogDescription>{reschedule?.client?.full_name}</DialogDescription>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={reschedule ? parseISO(reschedule.scheduled_date) : undefined}
            onSelect={(d) => d && reschedule && rescheduleMut.mutate({ id: reschedule.id, date: d })}
            locale={ptBR}
            className="p-3 pointer-events-auto"
          />
        </DialogContent>
      </Dialog>
    </div>
  </div>
);
    </div>
  );
}

/* ---------------- KPI ---------------- */
function KpiCard({
  icon, label, value, tone, onClick, active,
}: {
  icon: React.ReactNode; label: string; value: number;
  tone: "indigo" | "rose" | "emerald" | "slate";
  onClick?: () => void; active?: boolean;
}) {
  const tones: Record<string, { bg: string; text: string; ring: string; iconBg: string }> = {
    indigo:  { bg: "bg-white", text: "text-indigo-700",  ring: "ring-indigo-200/60",  iconBg: "bg-indigo-50 text-indigo-600" },
    rose:    { bg: "bg-white", text: "text-rose-700",    ring: "ring-rose-200/60",    iconBg: "bg-rose-50 text-rose-600" },
    emerald: { bg: "bg-white", text: "text-emerald-700", ring: "ring-emerald-200/60", iconBg: "bg-emerald-50 text-emerald-600" },
    slate:   { bg: "bg-white", text: "text-slate-700",   ring: "ring-slate-200/60",   iconBg: "bg-slate-100 text-slate-600" },
  };
  const t = tones[tone];
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left rounded-xl border border-slate-200/70 p-4 transition-all hover:shadow-sm",
        t.bg,
        active && `ring-2 ${t.ring}`
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={cn("size-7 rounded-lg flex items-center justify-center", t.iconBg)}>{icon}</div>
        <ChevronRight className="size-3.5 text-slate-300" />
      </div>
      <div className={cn("text-2xl font-bold tabular-nums tracking-tight font-mono", t.text)}>{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mt-0.5">{label}</div>
    </button>
  );
}

/* ---------------- Row ---------------- */
function ActionRow({
  action, onExecute, onReschedule, onCancel,
}: { action: DailyAction; onExecute: () => void; onReschedule: () => void; onCancel: () => void }) {
  const date = parseISO(action.scheduled_date);
  const isOverdue = action.status === "pendente" && isPast(date) && !isToday(date);
  const isExecuted = action.status === "executada";
  const isCancelled = action.status === "cancelada";
  const productName = action.product?.product?.name ?? action.product?.custom_product_name ?? null;

  return (
    <div className={cn(
      "group bg-white border border-slate-200/70 rounded-xl p-4 hover:shadow-sm transition-all",
      isOverdue && "border-rose-200/70 bg-rose-50/20",
      isExecuted && "opacity-80",
      isCancelled && "opacity-50"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "size-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ring-1",
          isExecuted ? "bg-emerald-50 text-emerald-700 ring-emerald-200" :
          isOverdue ? "bg-rose-50 text-rose-700 ring-rose-200" :
          "bg-indigo-50 text-indigo-700 ring-indigo-200"
        )}>
          {initials(action.client?.full_name)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/clientes/${action.client_id}`}
              className="text-[14px] font-bold text-slate-900 hover:text-indigo-700 transition-colors truncate"
            >
              {action.client?.full_name ?? "—"}
            </Link>
            {action.client?.company && (
              <span className="text-[11px] text-slate-500 truncate">· {action.client.company}</span>
            )}
            {action.priority === "alta" && (
              <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider font-bold py-0 h-4", PRIORITY_TONE.alta)}>
                Alta
              </Badge>
            )}
            {isExecuted && action.result && (
              <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider font-bold py-0 h-4", RESULT_LABELS[action.result]?.tone)}>
                {RESULT_LABELS[action.result]?.label}
              </Badge>
            )}
            {isCancelled && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-bold py-0 h-4 bg-slate-100 text-slate-500 border-slate-200">
                Cancelada
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11.5px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {format(date, "dd 'de' MMM", { locale: ptBR })}
              {isOverdue && <span className="text-rose-600 font-semibold ml-1">· Atrasada</span>}
            </span>
            {productName && (
              <span className="inline-flex items-center gap-1">
                <Briefcase className="size-3" />
                {productName}
              </span>
            )}
            {isExecuted && action.executed_at && (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                <CheckCircle2 className="size-3" />
                Executada {format(parseISO(action.executed_at), "dd/MM HH:mm")}
              </span>
            )}
            <Link 
              to={`/clientes/${action.client_id}`} 
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium ml-auto sm:ml-0"
            >
              Dossiê <ExternalLink className="size-2.5" />
            </Link>
          </div>

          {action.notes && (
            <div className="mt-2.5 text-[12.5px] text-slate-700 bg-slate-50/70 border border-slate-200/60 rounded-lg px-3 py-2 leading-relaxed">
              <MessageSquare className="size-3 inline mr-1.5 text-slate-400" />
              {action.notes}
            </div>
          )}

          {isExecuted && action.execution_notes && (
            <div className="mt-2 text-[12.5px] text-emerald-900 bg-emerald-50/60 border border-emerald-200/60 rounded-lg px-3 py-2 leading-relaxed">
              <CheckCircle2 className="size-3 inline mr-1.5 text-emerald-600" />
              {action.execution_notes}
            </div>
          )}
        </div>

        {action.status === "pendente" && (
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" onClick={onExecute} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px]">
              <CheckCircle2 className="size-3.5 mr-1" /> Executar
            </Button>
            <Button size="sm" variant="ghost" onClick={onReschedule} className="h-8 px-2 text-slate-500 hover:text-slate-900" title="Reagendar">
              <RotateCcw className="size-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel} className="h-8 px-2 text-slate-400 hover:text-rose-600" title="Cancelar">
              <X className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Execute form ---------------- */
function ExecuteForm({
  onSubmit, loading,
}: { onSubmit: (data: { result: string; execution_notes: string }) => void; loading: boolean }) {
  const [result, setResult] = useState<string>("contatado");
  const [notes, setNotes] = useState("");
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Resultado</Label>
        <Select value={result} onValueChange={setResult}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="contatado">✓ Contatado com sucesso</SelectItem>
            <SelectItem value="sem_resposta">— Sem resposta</SelectItem>
            <SelectItem value="fechado">★ Fechado / convertido</SelectItem>
            <SelectItem value="reagendar">↻ Precisa reagendar</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">O que foi feito? (vai pro histórico)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: liguei, conversamos sobre o contrato, vai retornar amanhã..."
          rows={4}
          className="resize-none"
        />
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit({ result, execution_notes: notes })} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          {loading ? "Salvando..." : "Registrar atuação"}
        </Button>
      </DialogFooter>
    </div>
  );
}

/* ---------------- Empty ---------------- */
function EmptyState({ tab, onCreate }: { tab: string; onCreate: () => void }) {
  const messages: Record<string, { title: string; desc: string }> = {
    hoje: { title: "Nada agendado para hoje", desc: "Agende clientes para atuar e mantenha o foco do dia." },
    atrasadas: { title: "Nenhuma atuação atrasada 🎉", desc: "Tudo em dia." },
    proximas: { title: "Sem atuações futuras", desc: "Planeje os próximos dias agora." },
    historico: { title: "Sem histórico ainda", desc: "Ao registrar atuações, elas aparecem aqui." },
  };
  const m = messages[tab] ?? messages.hoje;
  return (
    <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
      <CalendarClock className="size-10 text-slate-300 mx-auto mb-3" />
      <h3 className="text-[14px] font-bold text-slate-700">{m.title}</h3>
      <p className="text-[12.5px] text-slate-500 mt-1 mb-4">{m.desc}</p>
      {tab !== "historico" && (
        <Button onClick={onCreate} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="size-3.5 mr-1.5" /> Nova atuação
        </Button>
      )}
    </div>
  );
}

/* ---------------- Create dialog ---------------- */
function CreateActionDialog({
  open, onOpenChange, userId,
}: { open: boolean; onOpenChange: (o: boolean) => void; userId?: string }) {
  const qc = useQueryClient();
  const [clientId, setClientId] = useState<string>("");
  const [productId, setProductId] = useState<string>("none");
  const [date, setDate] = useState<Date>(new Date());
  const [priority, setPriority] = useState<"baixa" | "normal" | "alta">("normal");
  const [notes, setNotes] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-search", clientSearch],
    queryFn: async () => {
      let q = supabase.from("clients").select("id, full_name, company").order("full_name").limit(50);
      if (clientSearch.trim()) q = q.ilike("full_name", `%${clientSearch}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["client-products-for-action", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data } = await supabase
        .from("client_products")
        .select("id, custom_product_name, product:products(name)")
        .eq("client_id", clientId);
      return data ?? [];
    },
    enabled: !!clientId,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Selecione um cliente");
      const { error } = await supabase.from("daily_actions").insert({
        client_id: clientId,
        client_product_id: productId === "none" ? null : productId,
        scheduled_date: format(date, "yyyy-MM-dd"),
        priority,
        notes: notes || null,
        created_by: userId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_actions"] });
      toast.success("Atuação agendada");
      onOpenChange(false);
      setClientId(""); setProductId("none"); setDate(new Date()); setPriority("normal"); setNotes("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Nova atuação</DialogTitle>
          <DialogDescription>Agende um cliente para atuar em uma data específica.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cliente</Label>
            <Input
              placeholder="Buscar cliente..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="h-9 text-[13px]"
            />
            <div className="max-h-[180px] overflow-y-auto border border-slate-200/70 rounded-lg divide-y divide-slate-100">
              {clients.length === 0 && <div className="p-3 text-[12px] text-slate-400 text-center">Nenhum cliente</div>}
              {clients.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setClientId(c.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-[12.5px] hover:bg-slate-50 flex items-center justify-between",
                    clientId === c.id && "bg-indigo-50 text-indigo-700 font-semibold"
                  )}
                >
                  <span className="truncate">
                    {c.full_name}
                    {c.company && <span className="text-slate-400 font-normal"> · {c.company}</span>}
                  </span>
                  {clientId === c.id && <CheckCircle2 className="size-3.5 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {clientId && products.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Demanda (opcional)</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhuma demanda específica —</SelectItem>
                  {products.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.product?.name ?? p.custom_product_name ?? "Demanda"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start h-9 font-normal text-[13px]">
                    <CalendarDays className="size-3.5 mr-2 text-slate-400" />
                    {format(date, "dd 'de' MMM", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Anotação (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: ligar pra confirmar reunião..."
              rows={3}
              className="resize-none text-[13px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => createMut.mutate()} disabled={!clientId || createMut.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {createMut.isPending ? "Agendando..." : "Agendar atuação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
