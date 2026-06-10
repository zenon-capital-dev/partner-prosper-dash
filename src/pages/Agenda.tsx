import { formatBR as format } from "@/lib/datetime";
import { isTodayBR as isToday } from "@/lib/datetime";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isPast, startOfDay, endOfDay, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, differenceInCalendarDays, parseISO,  } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarClock, Plus, Search, CheckCircle2, Clock, AlertTriangle, Filter,
  Phone, Video, FileText, Bell, MapPin, ExternalLink, ChevronLeft, ChevronRight,
  CalendarDays, LayoutList, Columns3, Trash2, Edit3, RotateCcw, X, User2,
} from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";

type Kind = "tarefa" | "reuniao" | "ligacao" | "pendencia_documento" | "lembrete" | "follow_up";
type Status = "a_fazer" | "em_andamento" | "aguardando_terceiros" | "sem_atuacao" | "bloqueada" | "concluida" | "cancelada";

const KIND_META: Record<Kind, { label: string; icon: any; color: string; ring: string; dot: string }> = {
  tarefa:              { label: "Tarefa",     icon: CheckCircle2, color: "bg-slate-100 text-slate-700 border-slate-200",     ring: "ring-slate-200",   dot: "bg-slate-500" },
  reuniao:             { label: "Reunião",    icon: Video,        color: "bg-violet-50 text-violet-700 border-violet-200",   ring: "ring-violet-200",  dot: "bg-violet-500" },
  ligacao:             { label: "Ligação",    icon: Phone,        color: "bg-emerald-50 text-emerald-700 border-emerald-200",ring: "ring-emerald-200", dot: "bg-emerald-500" },
  pendencia_documento: { label: "Documento",  icon: FileText,     color: "bg-amber-50 text-amber-700 border-amber-200",      ring: "ring-amber-200",   dot: "bg-amber-500" },
  lembrete:            { label: "Lembrete",   icon: Bell,         color: "bg-blue-50 text-blue-700 border-blue-200",         ring: "ring-blue-200",    dot: "bg-blue-500" },
  follow_up:           { label: "Follow-up",  icon: RotateCcw,    color: "bg-indigo-50 text-indigo-700 border-indigo-200",   ring: "ring-indigo-200",  dot: "bg-indigo-500" },
};

const STATUS_META: Record<Status, { label: string; color: string }> = {
  a_fazer:              { label: "A fazer",       color: "bg-slate-100 text-slate-700 border-slate-200" },
  em_andamento:         { label: "Em andamento",  color: "bg-blue-50 text-blue-700 border-blue-200" },
  aguardando_terceiros: { label: "Aguardando",    color: "bg-amber-50 text-amber-700 border-amber-200" },
  sem_atuacao:          { label: "Sem atuação",   color: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  bloqueada:            { label: "Bloqueada",     color: "bg-rose-50 text-rose-700 border-rose-200" },
  concluida:            { label: "Concluída",     color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelada:            { label: "Cancelada",     color: "bg-slate-100 text-slate-500 border-slate-200" },
};


const PRIORITY_META: Record<string, { label: string; color: string }> = {
  baixa:   { label: "Baixa",   color: "bg-slate-50 text-slate-600 border-slate-200" },
  normal:  { label: "Normal",  color: "bg-blue-50 text-blue-700 border-blue-200" },
  media:   { label: "Normal",  color: "bg-blue-50 text-blue-700 border-blue-200" },
  alta:    { label: "Alta",    color: "bg-orange-50 text-orange-700 border-orange-200" },
  urgente: { label: "Urgente", color: "bg-rose-50 text-rose-700 border-rose-200" },
};

type AgendaItem = {
  id: string;
  title: string;
  description: string | null;
  kind: Kind;
  due_date: string | null;
  duration_minutes: number | null;
  location: string | null;
  meeting_url: string | null;
  reminder_minutes: number | null;
  priority: string;
  status_new: Status;
  assigned_to: string | null;
  outcome: string | null;
  visible_to_client: boolean | null;
  client_id: string | null;
  client_product_id: string | null;
  completed_at: string | null;
  created_at: string;
  client?: { id: string; full_name: string } | null;
  assignee?: { id: string; full_name: string | null; email: string | null } | null;
};

function dueBadge(item: AgendaItem) {
  if (!item.due_date) return null;
  const d = parseISO(item.due_date);
  if (item.status_new === "concluida") return { text: "Concluída", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (item.status_new === "cancelada") return { text: "Cancelada", tone: "bg-slate-100 text-slate-500 border-slate-200" };
  
  const diff = differenceInCalendarDays(d, new Date());
  const isOverdue = d < new Date();

  if (isOverdue && item.status_new !== ("concluida" as any)) {
    if (diff === 0) return { text: `Atrasada (${format(d, "HH:mm")})`, tone: "bg-rose-100 text-rose-700 border-rose-200 animate-pulse" };
    return { text: `Atrasou ${Math.abs(diff)}d`, tone: "bg-rose-50 text-rose-700 border-rose-200" };
  }

  if (isToday(d)) return { text: `Hoje ${format(d, "HH:mm")}`, tone: "bg-orange-50 text-orange-700 border-orange-200" };
  if (diff === 1) return { text: `Amanhã ${format(d, "HH:mm")}`, tone: "bg-amber-50 text-amber-700 border-amber-200" };
  if (diff <= 7) return { text: `Em ${diff}d`, tone: "bg-blue-50 text-blue-700 border-blue-200" };
  return { text: format(d, "dd/MM HH:mm"), tone: "bg-slate-100 text-slate-700 border-slate-200" };
}

export default function Agenda() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<"hoje" | "atrasados" | "proximos" | "concluidos" | "calendario" | "kanban">("hoje");
  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState<string>(searchParams.get("kind") || "all");
  const [filterMine, setFilterMine] = useState(false);
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<AgendaItem | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [rescheduling, setRescheduling] = useState<AgendaItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleTime, setRescheduleTime] = useState<string>("09:00");


  const presetClientId = searchParams.get("client");

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setOpenCreate(true);
      searchParams.delete("new");
      setSearchParams(searchParams, { replace: true });
    }
  }, []); // eslint-disable-line


  // Lista de clientes pra autocomplete e filtro
  const { data: clients = [] } = useQuery({
    queryKey: ["agenda-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name").order("full_name").limit(500);
      return data ?? [];
    },
  });

  // Lista de responsáveis (admin+colaboradores)
  const { data: assignees = [] } = useQuery({
    queryKey: ["agenda-assignees"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email, active").eq("active", true).order("full_name").limit(200);
      return data ?? [];
    },
  });

  // Tasks (Agenda items)
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["agenda", filterKind, filterMine, filterClient, filterAssignee, user?.id, assignees.length],
    queryFn: async () => {

      let q = supabase
        .from("tasks")
        .select(`
          id, title, description, kind, due_date, duration_minutes, location,
          meeting_url, reminder_minutes, priority, status_new, assigned_to,
          outcome, visible_to_client, client_id, client_product_id,
          completed_at, created_at,
          client:clients(id, full_name)
        `)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(500);
      if (filterKind !== "all") q = q.eq("kind", filterKind as any);
      if (filterMine && user?.id) q = q.eq("assigned_to", user.id);
      if (filterClient !== "all") q = q.eq("client_id", filterClient);
      if (filterAssignee !== "all") q = q.eq("assigned_to", filterAssignee);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as any[];
      const assigneeMap = new Map(assignees.map((a: any) => [a.id, a]));
      return rows.map((r) => ({
        ...r,
        assignee: r.assigned_to ? assigneeMap.get(r.assigned_to) || null : null,
      })) as unknown as AgendaItem[];
    },

  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (i) =>
        i.title?.toLowerCase().includes(s) ||
        i.description?.toLowerCase().includes(s) ||
        i.client?.full_name?.toLowerCase().includes(s),
    );
  }, [items, search]);

  const buckets = useMemo(() => {
    const now = new Date();
    const today: AgendaItem[] = [];
    const overdue: AgendaItem[] = [];
    const upcoming: AgendaItem[] = [];
    const done: AgendaItem[] = [];
    for (const it of filtered) {
      if (it.status_new === "concluida" || it.status_new === "cancelada") {
        done.push(it);
        continue;
      }
      if (!it.due_date) {
        upcoming.push(it);
        continue;
      }
      const d = parseISO(it.due_date);
      if (isToday(d)) today.push(it);
      else if (d < startOfDay(now)) overdue.push(it);
      else upcoming.push(it);
    }
    return { today, overdue, upcoming, done };
  }, [filtered]);

  // Mutations
  const completeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status_new: "concluida" as any, completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      toast.success("Concluído");
    },
    onError: (e: any) => toast.error(e?.message || "Erro"),
  });

  const reopenMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status_new: "a_fazer" as any, completed_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      toast.success("Reaberta");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      toast.success("Excluído");
    },
    onError: (e: any) => toast.error(e?.message || "Erro"),
  });

  const rescheduleMut = useMutation({
    mutationFn: async ({ id, date }: { id: string; date: Date }) => {
      const { error } = await supabase.from("tasks").update({ due_date: date.toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      toast.success("Reagendado");
    },
  });

  const setStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const upd: any = { status_new: status };
      if (status === "concluida") upd.completed_at = new Date().toISOString();
      else upd.completed_at = null;
      const { error } = await supabase.from("tasks").update(upd).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      toast.success(`Status: ${STATUS_META[vars.status]?.label || vars.status}`);
    },
    onError: (e: any) => toast.error(e?.message || "Erro"),
  });


  const handleDelete = async (id: string) => {
    if (await confirmAction({ title: "Excluir item da agenda?", description: "Esta ação não pode ser desfeita." })) {
      deleteMut.mutate(id);
    }
  };

  const openReschedule = (item: AgendaItem) => {
    const base = item.due_date ? parseISO(item.due_date) : new Date();
    setRescheduleDate(base);
    setRescheduleTime(format(base, "HH:mm"));
    setRescheduling(item);
  };


  const stats = {
    today: buckets.today.length,
    overdue: buckets.overdue.length,
    upcoming: buckets.upcoming.length,
    done: buckets.done.length,
  };

  return (
    <div className="space-y-6">
      <PageHero
        icon={<CalendarClock className="size-5" />}
        title="Agenda"
        description="Tarefas, reuniões, ligações e pendências em um único lugar."
        actions={
          <Button onClick={() => setOpenCreate(true)} className="gap-2">
            <Plus className="size-4" /> Novo item
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Hoje"      value={stats.today}    icon={CalendarClock} tone="text-orange-700 bg-orange-50 border-orange-200" />
        <KpiCard label="Atrasados" value={stats.overdue}  icon={AlertTriangle} tone="text-rose-700 bg-rose-50 border-rose-200" />
        <KpiCard label="Próximos"  value={stats.upcoming} icon={Clock}         tone="text-blue-700 bg-blue-50 border-blue-200" />
        <KpiCard label="Concluídos" value={stats.done}    icon={CheckCircle2}  tone="text-emerald-700 bg-emerald-50 border-emerald-200" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="Buscar por título, descrição ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterKind} onValueChange={setFilterKind}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {(Object.keys(KIND_META) as Kind[]).map((k) => (
              <SelectItem key={k} value={k}>{KIND_META[k].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            {assignees.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-slate-700 px-2">
          <Switch checked={filterMine} onCheckedChange={setFilterMine} />
          Só meus
        </label>
      </div>

      {/* Views */}
      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList className="bg-slate-100/70">
          <TabsTrigger value="hoje" className="gap-1.5"><CalendarClock className="size-3.5" />Hoje</TabsTrigger>
          <TabsTrigger value="atrasados" className="gap-1.5"><AlertTriangle className="size-3.5" />Atrasados</TabsTrigger>
          <TabsTrigger value="proximos" className="gap-1.5"><Clock className="size-3.5" />Próximos</TabsTrigger>
          <TabsTrigger value="calendario" className="gap-1.5"><CalendarDays className="size-3.5" />Calendário</TabsTrigger>
          <TabsTrigger value="kanban" className="gap-1.5"><Columns3 className="size-3.5" />Kanban</TabsTrigger>
          <TabsTrigger value="concluidos" className="gap-1.5"><CheckCircle2 className="size-3.5" />Concluídos</TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="mt-4 space-y-6">
          {buckets.overdue.length > 0 && (
            <Section title="Atrasados" tone="rose" count={buckets.overdue.length}>
              <ItemList items={buckets.overdue} onComplete={(id) => completeMut.mutate(id)} onDelete={handleDelete} onEdit={setEditing} onReschedule={(id, d) => rescheduleMut.mutate({ id, date: d })} onSetStatus={(id, s) => setStatusMut.mutate({ id, status: s })} onRequestReschedule={openReschedule} />
            </Section>
          )}
          <Section title="Hoje" tone="orange" count={buckets.today.length}>
            {buckets.today.length === 0
              ? <EmptyHint text="Nenhum item pra hoje. Aproveite ou crie um." />
              : <ItemList items={buckets.today} onComplete={(id) => completeMut.mutate(id)} onDelete={handleDelete} onEdit={setEditing} onReschedule={(id, d) => rescheduleMut.mutate({ id, date: d })} onSetStatus={(id, s) => setStatusMut.mutate({ id, status: s })} onRequestReschedule={openReschedule} />}
          </Section>
        </TabsContent>

        <TabsContent value="atrasados" className="mt-4">
          {buckets.overdue.length === 0
            ? <EmptyHint text="Sem itens atrasados. Tudo em dia!" />
            : <ItemList items={buckets.overdue} onComplete={(id) => completeMut.mutate(id)} onDelete={handleDelete} onEdit={setEditing} onReschedule={(id, d) => rescheduleMut.mutate({ id, date: d })} onSetStatus={(id, s) => setStatusMut.mutate({ id, status: s })} onRequestReschedule={openReschedule} />}
        </TabsContent>

        <TabsContent value="proximos" className="mt-4">
          {buckets.upcoming.length === 0
            ? <EmptyHint text="Nada agendado pra frente." />
            : <ItemList items={buckets.upcoming} onComplete={(id) => completeMut.mutate(id)} onDelete={handleDelete} onEdit={setEditing} onReschedule={(id, d) => rescheduleMut.mutate({ id, date: d })} onSetStatus={(id, s) => setStatusMut.mutate({ id, status: s })} onRequestReschedule={openReschedule} />}
        </TabsContent>

        <TabsContent value="concluidos" className="mt-4">
          {buckets.done.length === 0
            ? <EmptyHint text="Nada concluído ainda." />
            : <ItemList items={buckets.done} onComplete={() => {}} onReopen={(id) => reopenMut.mutate(id)} onDelete={handleDelete} onEdit={setEditing} onRequestReschedule={openReschedule} />}
        </TabsContent>

        <TabsContent value="calendario" className="mt-4">
          <MonthCalendar
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            items={filtered}
            onItemClick={setEditing}
          />
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          <Kanban items={filtered} onUpdate={() => qc.invalidateQueries({ queryKey: ["agenda"] })} onItemClick={setEditing} />
        </TabsContent>
      </Tabs>

      {(openCreate || editing) && (
        <CreateOrEditDialog
          open={openCreate || !!editing}
          onClose={() => { setOpenCreate(false); setEditing(null); }}
          editing={editing}
          clients={clients}
          assignees={assignees}
          userId={user?.id}
          defaultClientId={presetClientId}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["agenda"] });
            qc.invalidateQueries({ queryKey: ["client-timeline"] });
            qc.invalidateQueries({ queryKey: ["client-tasks"] });
          }}
        />
      )}

      {/* Reschedule Dialog */}
      <Dialog open={!!rescheduling} onOpenChange={(v) => { if (!v) setRescheduling(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarDays className="size-4 text-indigo-600" /> Adiar / Reagendar</DialogTitle>
            <DialogDescription className="truncate">{rescheduling?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2">
              <Calendar mode="single" selected={rescheduleDate} onSelect={setRescheduleDate} initialFocus className="p-2 pointer-events-auto mx-auto" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs font-bold">Hora</Label>
              <Input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} className="h-9 w-32" />
              <div className="flex gap-1 ml-auto">
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setRescheduleDate(addDays(new Date(), 1)); }}>Amanhã</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setRescheduleDate(addDays(new Date(), 7)); }}>+ 7d</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduling(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!rescheduling || !rescheduleDate) { toast.error("Escolha uma data"); return; }
                const [h, m] = (rescheduleTime || "09:00").split(":").map(Number);
                const d = new Date(rescheduleDate);
                d.setHours(h || 9, m || 0, 0, 0);
                rescheduleMut.mutate({ id: rescheduling.id, date: d });
                setRescheduling(null);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}


function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={cn("inline-flex size-8 items-center justify-center rounded-lg border", tone)}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-3xl font-black tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function Section({ title, count, tone, children }: { title: string; count: number; tone: "rose" | "orange" | "blue"; children: React.ReactNode }) {
  const toneMap = { rose: "text-rose-700 bg-rose-50 border-rose-200", orange: "text-orange-700 bg-orange-50 border-orange-200", blue: "text-blue-700 bg-blue-50 border-blue-200" };
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", toneMap[tone])}>{count}</span>
      </div>
      {children}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function ItemList({
  items, onComplete, onReopen, onDelete, onEdit, onReschedule, onSetStatus, onRequestReschedule,
}: {
  items: AgendaItem[];
  onComplete: (id: string) => void;
  onReopen?: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (i: AgendaItem) => void;
  onReschedule?: (id: string, d: Date) => void;
  onSetStatus?: (id: string, s: Status) => void;
  onRequestReschedule?: (item: AgendaItem) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <ItemRow key={it.id} item={it} onComplete={onComplete} onReopen={onReopen} onDelete={onDelete} onEdit={onEdit} onReschedule={onReschedule} onSetStatus={onSetStatus} onRequestReschedule={onRequestReschedule} />
      ))}
    </div>
  );
}

function ItemRow({
  item, onComplete, onReopen, onDelete, onEdit, onReschedule, onSetStatus, onRequestReschedule,
}: {
  item: AgendaItem;
  onComplete: (id: string) => void;
  onReopen?: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (i: AgendaItem) => void;
  onReschedule?: (id: string, d: Date) => void;
  onSetStatus?: (id: string, s: Status) => void;
  onRequestReschedule?: (item: AgendaItem) => void;
}) {
  const meta = KIND_META[item.kind] || KIND_META.tarefa;
  const Icon = meta.icon;
  const due = dueBadge(item);
  const prio = PRIORITY_META[item.priority] || PRIORITY_META.normal;
  const isDone = item.status_new === "concluida" || item.status_new === "cancelada";
  const statusMeta = STATUS_META[item.status_new];

  return (
    <div className={cn(
      "group relative flex items-start gap-3 rounded-xl border bg-white p-3.5 shadow-sm hover:shadow-md transition-all",
      isDone ? "border-slate-200 opacity-70" : "border-slate-200",
    )}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            title={`Status: ${statusMeta?.label || item.status_new}`}
            className={cn(
              "mt-0.5 shrink-0 size-5 rounded-full border-2 transition-all flex items-center justify-center",
              isDone
                ? "bg-emerald-500 border-emerald-500 text-white"
                : item.status_new === "em_andamento" ? "bg-blue-500 border-blue-500 text-white"
                : item.status_new === "aguardando_terceiros" ? "bg-amber-500 border-amber-500 text-white"
                : item.status_new === "bloqueada" ? "bg-rose-500 border-rose-500 text-white"
                : "border-slate-300 hover:border-emerald-500 hover:bg-emerald-50",
            )}
          >
            {isDone && <CheckCircle2 className="size-3" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem onClick={() => onSetStatus?.(item.id, "concluida")}>
            <CheckCircle2 className="size-3.5 mr-2 text-emerald-600" /> Concluir
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSetStatus?.(item.id, "em_andamento")}>
            <RotateCcw className="size-3.5 mr-2 text-blue-600" /> Em andamento
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSetStatus?.(item.id, "aguardando_terceiros")}>
            <Clock className="size-3.5 mr-2 text-amber-600" /> Aguardando terceiros
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSetStatus?.(item.id, "sem_atuacao")}>
            <Clock className="size-3.5 mr-2 text-zinc-500" /> Sem atuação
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSetStatus?.(item.id, "bloqueada")}>
            <AlertTriangle className="size-3.5 mr-2 text-rose-600" /> Bloqueada
          </DropdownMenuItem>
          {onRequestReschedule && (
            <DropdownMenuItem onClick={() => onRequestReschedule(item)}>
              <CalendarDays className="size-3.5 mr-2 text-indigo-600" /> Adiar / Reagendar
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onEdit(item)}>
            <Edit3 className="size-3.5 mr-2" /> Detalhar / editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSetStatus?.(item.id, "cancelada")}>
            <Trash2 className="size-3.5 mr-2 text-slate-500" /> Cancelar tarefa
          </DropdownMenuItem>
          {isDone && onReopen && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onReopen(item.id)}>
                <RotateCcw className="size-3.5 mr-2" /> Reabrir
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>


      <div className={cn("shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10.5px] font-bold uppercase tracking-wider", meta.color)}>
        <Icon className="size-3" />
        {meta.label}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("text-[14px] font-bold text-slate-900 truncate", isDone && "line-through text-slate-500")}>
              {item.title}
            </p>
            {item.description && (
              <p className="text-[12px] text-slate-500 line-clamp-1 mt-0.5">{item.description}</p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
              {item.client && (
                <Link to={`/clientes/${item.client.id}`} className="inline-flex items-center gap-1 text-indigo-700 hover:underline font-semibold">
                  <User2 className="size-3" /> {item.client.full_name}
                </Link>
              )}
              {item.assignee && (
                <span className="inline-flex items-center gap-1">
                  <Avatar className="size-4"><AvatarFallback className="text-[8px] bg-slate-200">{initials(item.assignee.full_name || item.assignee.email || "?")}</AvatarFallback></Avatar>
                  {item.assignee.full_name || item.assignee.email}
                </span>
              )}
              {item.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{item.location}</span>}
              {item.meeting_url && (
                <a href={item.meeting_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-700 hover:underline">
                  <Video className="size-3" /> Link
                </a>
              )}
              {item.duration_minutes && <span className="inline-flex items-center gap-1"><Clock className="size-3" />{item.duration_minutes}min</span>}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {due && (
              <span className={cn("text-[10px] font-bold px-2 py-1 rounded-md border whitespace-nowrap", due.tone)}>
                {due.text}
              </span>
            )}
            <span className={cn("text-[10px] font-bold px-2 py-1 rounded-md border whitespace-nowrap", prio.color)}>
              {prio.label}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Ações do compromisso" className="size-7"><Edit3 className="size-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(item)}><Edit3 className="size-3.5 mr-2" />Editar</DropdownMenuItem>
                {onRequestReschedule && (
                  <DropdownMenuItem onClick={() => onRequestReschedule(item)}>
                    <CalendarDays className="size-3.5 mr-2" />Reagendar
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(item.id)} className="text-rose-600">
                  <Trash2 className="size-3.5 mr-2" />Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthCalendar({
  month, onMonthChange, items, onItemClick,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  items: AgendaItem[];
  onItemClick: (i: AgendaItem) => void;
}) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);

  const byDay = useMemo(() => {
    const m = new Map<string, AgendaItem[]>();
    for (const it of items) {
      if (!it.due_date) continue;
      const k = format(parseISO(it.due_date), "yyyy-MM-dd");
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return m;
  }, [items]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-900 capitalize">{format(month, "MMMM yyyy", { locale: ptBR })}</h3>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="size-8" aria-label="Mês anterior" onClick={() => onMonthChange(addDays(startOfMonth(month), -1))}><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => onMonthChange(new Date())}>Hoje</Button>
          <Button variant="outline" size="icon" className="size-8" aria-label="Próximo mês" onClick={() => onMonthChange(addDays(endOfMonth(month), 1))}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/50">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
          <div key={d} className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === month.getMonth();
          const dayItems = byDay.get(format(d, "yyyy-MM-dd")) || [];
          return (
            <div key={i} className={cn(
              "min-h-[100px] border-r border-b border-slate-100 p-1.5 text-[11px]",
              !inMonth && "bg-slate-50/40 text-slate-300",
              isToday(d) && "bg-orange-50/50",
            )}>
              <div className={cn("font-bold mb-1", isToday(d) && "text-orange-700")}>{format(d, "d")}</div>
              <div className="space-y-1">
                {dayItems.slice(0, 3).map((it) => {
                  const meta = KIND_META[it.kind] || KIND_META.tarefa;
                  return (
                    <button
                      key={it.id}
                      onClick={() => onItemClick(it)}
                      className={cn("w-full text-left truncate rounded px-1 py-0.5 text-[10px] font-semibold border", meta.color)}
                    >
                      {format(parseISO(it.due_date!), "HH:mm")} {it.title}
                    </button>
                  );
                })}
                {dayItems.length > 3 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded px-1 py-0.5 w-full text-left"
                      >
                        +{dayItems.length - 3} mais
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-3" align="start">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                        {format(d, "dd 'de' MMMM", { locale: ptBR })} · {dayItems.length} itens
                      </p>
                      <div className="space-y-1 max-h-80 overflow-y-auto">
                        {dayItems.map((it) => {
                          const m = KIND_META[it.kind] || KIND_META.tarefa;
                          return (
                            <button
                              key={it.id}
                              onClick={() => onItemClick(it)}
                              className={cn("w-full text-left rounded px-2 py-1.5 text-[11px] font-semibold border hover:shadow-sm transition-all", m.color)}
                            >
                              <div className="font-mono text-[10px] opacity-70">{format(parseISO(it.due_date!), "HH:mm")}</div>
                              <div className="truncate">{it.title}</div>
                              {it.client && <div className="text-[9.5px] opacity-60 truncate">{it.client.full_name}</div>}
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kanban({ items, onUpdate, onItemClick }: { items: AgendaItem[]; onUpdate: () => void; onItemClick: (i: AgendaItem) => void }) {
  const cols: { key: Status; label: string }[] = [
    { key: "a_fazer", label: "A fazer" },
    { key: "em_andamento", label: "Em andamento" },
    { key: "aguardando_terceiros", label: "Aguardando" },
    { key: "sem_atuacao", label: "Sem atuação" },
    { key: "concluida", label: "Concluídas" },
  ];

  const grouped: Record<string, AgendaItem[]> = {};
  cols.forEach((c) => (grouped[c.key] = []));
  items.forEach((i) => { if (grouped[i.status_new]) grouped[i.status_new].push(i); });

  const moveTo = async (id: string, to: Status) => {
    const upd: any = { status_new: to };
    if (to === "concluida") upd.completed_at = new Date().toISOString();
    if (to !== "concluida") upd.completed_at = null;
    const { error } = await supabase.from("tasks").update(upd).eq("id", id);
    if (error) toast.error(error.message);
    else { onUpdate(); toast.success("Atualizado"); }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {cols.map((c) => (
        <div key={c.key} className="rounded-xl border border-slate-200 bg-slate-50/40 p-2">
          <div className="flex items-center justify-between px-2 py-1.5 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">{c.label}</span>
            <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-full px-2">{grouped[c.key].length}</span>
          </div>
          <div className="space-y-2">
            {grouped[c.key].map((it) => {
              const meta = KIND_META[it.kind] || KIND_META.tarefa;
              const Icon = meta.icon;
              const due = dueBadge(it);
              return (
                <div key={it.id} className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm hover:shadow-md cursor-pointer" onClick={() => onItemClick(it)}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border", meta.color)}>
                      <Icon className="size-2.5" />{meta.label}
                    </div>
                  </div>
                  <p className="text-[12.5px] font-bold text-slate-900 leading-tight line-clamp-2">{it.title}</p>
                  {it.client && <p className="text-[10.5px] text-slate-600 mt-1 truncate">{it.client.full_name}</p>}
                  <div className="flex items-center justify-between mt-2">
                    {due && <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", due.tone)}>{due.text}</span>}
                    <Select value={it.status_new} onValueChange={(v) => moveTo(it.id, v as Status)}>
                      <SelectTrigger className="h-6 w-[110px] text-[10px] ml-auto" onClick={(e) => e.stopPropagation()}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_META) as Status[]).map((s) => (
                          <SelectItem key={s} value={s} className="text-[11px]">{STATUS_META[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
            {grouped[c.key].length === 0 && (
              <div className="text-[11px] text-slate-400 text-center py-6">Vazio</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CreateOrEditDialog({
  open, onClose, editing, clients, assignees, userId, defaultClientId, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: AgendaItem | null;
  clients: any[];
  assignees: any[];
  userId?: string;
  defaultClientId?: string | null;
  onSaved: () => void;
}) {
  const isEdit = !!editing;
  const [kind, setKind] = useState<Kind>(editing?.kind || "tarefa");
  const [title, setTitle] = useState(editing?.title || "");
  const [description, setDescription] = useState(editing?.description || "");
  const [dueDate, setDueDate] = useState<Date | undefined>(editing?.due_date ? parseISO(editing.due_date) : new Date());
  const [dueTime, setDueTime] = useState(editing?.due_date ? format(parseISO(editing.due_date), "HH:mm") : "09:00");
  const [duration, setDuration] = useState<string>(editing?.duration_minutes?.toString() || "");
  const [location, setLocation] = useState(editing?.location || "");
  const [meetingUrl, setMeetingUrl] = useState(editing?.meeting_url || "");
  const [reminderMin, setReminderMin] = useState<string>(editing?.reminder_minutes?.toString() || "0");
  const [priority, setPriority] = useState(editing?.priority || "normal");
  const [status, setStatus] = useState<Status>(editing?.status_new || "a_fazer");
  const [clientId, setClientId] = useState<string>(editing?.client_id || defaultClientId || "none");
  const [assigneeId, setAssigneeId] = useState<string>(editing?.assigned_to || userId || "none");
  const [visibleToClient, setVisibleToClient] = useState(!!editing?.visible_to_client);
  const [saving, setSaving] = useState(false);


  const handleSave = async () => {
    if (!title.trim()) { toast.error("Informe um título"); return; }
    if ((kind === "ligacao" || kind === "pendencia_documento") && clientId === "none") {
      toast.error("Selecione o cliente"); return;
    }
    setSaving(true);
    try {
      const dueIso = dueDate
        ? (() => {
            const [h, m] = dueTime.split(":").map(Number);
            const d = new Date(dueDate);
            d.setHours(h || 9, m || 0, 0, 0);
            return d.toISOString();
          })()
        : null;

      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
        kind,
        due_date: dueIso,
        duration_minutes: duration ? Number(duration) : null,
        location: location.trim() || null,
        meeting_url: meetingUrl.trim() || null,
        reminder_minutes: reminderMin ? Number(reminderMin) : null,
        priority,
        status_new: status,
        client_id: clientId !== "none" ? clientId : null,
        assigned_to: assigneeId !== "none" ? assigneeId : null,
        visible_to_client: visibleToClient,
      };

      if (isEdit) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", editing!.id);
        if (error) throw error;
        toast.success("Atualizado");
      } else {
        payload.created_by = userId;
        const { error } = await supabase.from("tasks").insert(payload);
        if (error) throw error;
        toast.success("Criado");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar item" : "Novo item na agenda"}</DialogTitle>
          <DialogDescription>Tarefa, reunião, ligação, pendência de documento ou lembrete.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo */}
          <div>
            <Label className="text-xs font-bold mb-2 block">Tipo</Label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {(Object.keys(KIND_META) as Kind[]).map((k) => {
                const m = KIND_META[k];
                const Icon = m.icon;
                const active = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border p-2 text-[11px] font-bold transition-all",
                      active ? cn(m.color, "shadow-sm ring-2", m.ring) : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    <Icon className="size-4" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold mb-1.5 block">Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={
              kind === "reuniao" ? "Reunião com..." :
              kind === "ligacao" ? "Ligar para..." :
              kind === "pendencia_documento" ? "Pedir documento..." :
              kind === "lembrete" ? "Lembrar de..." : "Tarefa"
            } />
          </div>

          <div>
            <Label className="text-xs font-bold mb-1.5 block">Descrição / Notas</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Detalhes, contexto, próximos passos..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold mb-1.5 block">Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal h-9">
                    <CalendarDays className="size-4 mr-2" />
                    {dueDate ? format(dueDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs font-bold mb-1.5 block">Hora</Label>
              <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="h-9" />
            </div>
          </div>

          {(kind === "reuniao" || kind === "ligacao") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold mb-1.5 block">Duração (min)</Label>
                <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="60" className="h-9" />
              </div>
              {kind === "reuniao" && (
                <div>
                  <Label className="text-xs font-bold mb-1.5 block">Link da reunião</Label>
                  <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/..." className="h-9" />
                </div>
              )}
            </div>
          )}

          {kind === "reuniao" && (
            <div>
              <Label className="text-xs font-bold mb-1.5 block">Local</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Endereço ou plataforma" className="h-9" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold mb-1.5 block">
                Cliente {(kind === "ligacao" || kind === "pendencia_documento") && "*"}
              </Label>
              <ClientCombobox value={clientId} onChange={setClientId} clients={clients} />
            </div>
            <div>
              <Label className="text-xs font-bold mb-1.5 block">Responsável</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {assignees.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-bold mb-1.5 block">Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold mb-1.5 block">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_META) as Status[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold mb-1.5 block">Lembrete (min antes)</Label>
              <Select value={reminderMin} onValueChange={setReminderMin}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sem lembrete</SelectItem>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="1440">1 dia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <Switch checked={visibleToClient} onCheckedChange={setVisibleToClient} />
            <Label className="text-xs">Visível ao cliente no portal</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : (isEdit ? "Salvar" : "Criar")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientCombobox({ value, onChange, clients }: { value: string; onChange: (v: string) => void; clients: any[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = clients.find((c: any) => c.id === value);
  const filtered = query.trim()
    ? clients.filter((c: any) => c.full_name?.toLowerCase().includes(query.toLowerCase()))
    : clients;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-9 w-full justify-between font-normal">
          <span className="truncate">{value === "none" || !selected ? "Nenhum" : selected.full_name}</span>
          <Search className="size-3.5 opacity-50 ml-2 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
        <div className="p-2 border-b border-slate-100">
          <Input
            autoFocus
            placeholder="Buscar cliente..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          <button
            type="button"
            onClick={() => { onChange("none"); setOpen(false); setQuery(""); }}
            className={cn("w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 italic text-slate-500", value === "none" && "bg-indigo-50 text-indigo-700")}
          >
            Nenhum
          </button>
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-xs text-slate-400 text-center">Nenhum cliente</div>
          ) : (
            filtered.map((c: any) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onChange(c.id); setOpen(false); setQuery(""); }}
                className={cn("w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 truncate", value === c.id && "bg-indigo-50 text-indigo-700 font-semibold")}
              >
                {c.full_name}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
