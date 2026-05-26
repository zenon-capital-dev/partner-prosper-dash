import { formatBR as format } from "@/lib/datetime";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, startOfDay, isBefore, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, MessageSquare, Phone,
  Mail, Video, Smartphone, CheckCircle2, Clock, AlertCircle, Flame,
  History, ArrowRight, X, User, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CHANNEL_META: Record<string, { label: string; icon: any; color: string }> = {
  whatsapp: { label: "WhatsApp", icon: Smartphone, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  call:     { label: "Ligação",  icon: Phone,      color: "text-blue-600 bg-blue-50 border-blue-200" },
  email:    { label: "E-mail",   icon: Mail,       color: "text-violet-600 bg-violet-50 border-violet-200" },
  meeting:  { label: "Reunião",  icon: Video,      color: "text-amber-600 bg-amber-50 border-amber-200" },
  sms:      { label: "SMS",      icon: MessageSquare, color: "text-slate-600 bg-slate-50 border-slate-200" },
  other:    { label: "Outro",    icon: MessageSquare, color: "text-slate-600 bg-slate-50 border-slate-200" },
};

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  baixa:   { label: "Baixa",   cls: "bg-slate-100 text-slate-600 border-slate-200" },
  normal:  { label: "Normal",  cls: "bg-blue-50 text-blue-700 border-blue-200" },
  alta:    { label: "Alta",    cls: "bg-amber-50 text-amber-700 border-amber-200" },
  urgente: { label: "Urgente", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

interface Props {
  providerId: string;
  clientProducts: any[];
}

export function ProviderAtuacao({ providerId, clientProducts }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState<Date>(new Date());
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [interactionTarget, setInteractionTarget] = useState<{ clientId: string; cpId?: string; clientName: string } | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ clientId: string; clientName: string } | null>(null);
  const [completeTarget, setCompleteTarget] = useState<any | null>(null);

  const isoDate = format(date, "yyyy-MM-dd");

  // Lista única de clientes do prestador
  const clients = useMemo(() => {
    const m = new Map<string, any>();
    for (const cp of clientProducts) {
      const c = cp.clients;
      if (!c?.id) continue;
      if (!m.has(c.id)) m.set(c.id, { ...c, products: [] });
      m.get(c.id)!.products.push(cp);
    }
    return Array.from(m.values()).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  }, [clientProducts]);

  // Agenda do dia
  const { data: scheduleDay = [] } = useQuery({
    queryKey: ["provider-schedule", providerId, isoDate],
    enabled: !!providerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("provider_schedule")
        .select("*, clients(id, full_name, company, phone), client_products(id, products(name))")
        .eq("provider_id", providerId)
        .eq("scheduled_date", isoDate)
        .order("scheduled_time", { ascending: true, nullsFirst: false })
        .order("created_at");
      return data ?? [];
    },
  });

  // Próximos 14 dias (heatmap)
  const { data: scheduleAhead = [] } = useQuery({
    queryKey: ["provider-schedule-ahead", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const start = format(startOfDay(new Date()), "yyyy-MM-dd");
      const end = format(addDays(new Date(), 30), "yyyy-MM-dd");
      const { data } = await supabase
        .from("provider_schedule")
        .select("scheduled_date, status, priority")
        .eq("provider_id", providerId)
        .gte("scheduled_date", start)
        .lte("scheduled_date", end);
      return data ?? [];
    },
  });

  // Pendências atrasadas (anteriores a hoje, ainda pendentes)
  const { data: overdue = [] } = useQuery({
    queryKey: ["provider-overdue", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("provider_schedule")
        .select("*, clients(id, full_name, company)")
        .eq("provider_id", providerId)
        .eq("status", "pendente")
        .lt("scheduled_date", today)
        .order("scheduled_date");
      return data ?? [];
    },
  });

  // Últimas interações
  const { data: recentInteractions = [] } = useQuery({
    queryKey: ["provider-interactions", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("provider_interactions")
        .select("*, clients(id, full_name)")
        .eq("provider_id", providerId)
        .order("occurred_at", { ascending: false })
        .limit(15);
      return data ?? [];
    },
  });

  const dayCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of scheduleAhead as any[]) {
      if (s.status !== "pendente") continue;
      m.set(s.scheduled_date, (m.get(s.scheduled_date) || 0) + 1);
    }
    return m;
  }, [scheduleAhead]);

  const todayStats = useMemo(() => {
    const pendentes = scheduleDay.filter((s: any) => s.status === "pendente").length;
    const concluidos = scheduleDay.filter((s: any) => s.status === "concluido").length;
    return { pendentes, concluidos, atrasados: overdue.length };
  }, [scheduleDay, overdue]);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["provider-schedule"] });
    await qc.invalidateQueries({ queryKey: ["provider-schedule-ahead"] });
    await qc.invalidateQueries({ queryKey: ["provider-overdue"] });
    await qc.invalidateQueries({ queryKey: ["provider-interactions"] });
  }

  async function markCompleted(item: any, notes: string) {
    const { error } = await supabase
      .from("provider_schedule")
      .update({ status: "concluido", completed_at: new Date().toISOString(), completion_notes: notes || null })
      .eq("id", item.id);
    if (error) return toast.error("Erro ao concluir: " + error.message);
    toast.success("Atuação concluída");
    setCompleteTarget(null);
    await refresh();
  }

  async function reschedule(item: any, newDate: Date) {
    const { error } = await supabase
      .from("provider_schedule")
      .update({ scheduled_date: format(newDate, "yyyy-MM-dd"), status: "pendente" })
      .eq("id", item.id);
    if (error) return toast.error("Erro ao reagendar");
    toast.success(`Reagendado para ${format(newDate, "dd/MM")}`);
    await refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header: date navigator + stats + action */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-9 rounded-lg" onClick={() => setDate(addDays(date, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 px-3 rounded-lg gap-2 min-w-[220px] justify-start">
                <CalendarDays className="size-4 text-indigo-600" />
                <span className="font-bold capitalize">
                  {isToday(date) ? "Hoje · " : ""}{format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                locale={ptBR}
                className={cn("p-3 pointer-events-auto")}
                modifiers={{
                  hasItems: (d) => (dayCounts.get(format(d, "yyyy-MM-dd")) || 0) > 0,
                }}
                modifiersClassNames={{
                  hasItems: "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-indigo-600",
                }}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" className="size-9 rounded-lg" onClick={() => setDate(addDays(date, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          {!isToday(date) && (
            <Button variant="ghost" size="sm" className="text-indigo-600 font-bold" onClick={() => setDate(new Date())}>
              Hoje
            </Button>
          )}
        </div>

        <div className="flex-1 grid grid-cols-3 gap-3">
          <Stat label="Pendentes do dia" value={todayStats.pendentes} icon={Clock} tone="indigo" />
          <Stat label="Concluídas hoje" value={todayStats.concluidos} icon={CheckCircle2} tone="emerald" />
          <Stat label="Atrasadas" value={todayStats.atrasados} icon={Flame} tone="rose" />
        </div>

        <Button onClick={() => setScheduleOpen(true)} className="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 shrink-0">
          <Plus className="size-4" /> Agendar atuação
        </Button>
      </div>

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <Flame className="size-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-rose-900 text-sm">
              Você tem {overdue.length} {overdue.length === 1 ? "atuação atrasada" : "atuações atrasadas"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {overdue.slice(0, 5).map((o: any) => (
                <button
                  key={o.id}
                  onClick={() => setDate(new Date(o.scheduled_date + "T12:00:00"))}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-white border border-rose-200 text-rose-700 hover:bg-rose-100"
                >
                  {o.clients?.full_name} · {format(new Date(o.scheduled_date + "T12:00:00"), "dd/MM")}
                </button>
              ))}
              {overdue.length > 5 && <span className="text-[11px] text-rose-700 self-center">+{overdue.length - 5}</span>}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agenda do dia */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/70 shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Agenda do dia</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {scheduleDay.length} {scheduleDay.length === 1 ? "atuação" : "atuações"} agendadas
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {scheduleDay.length === 0 ? (
              <div className="p-10 text-center">
                <CalendarDays className="size-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 mb-3">Nenhuma atuação agendada para este dia.</p>
                <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)} className="gap-1.5">
                  <Plus className="size-3.5" /> Agendar primeiro cliente
                </Button>
              </div>
            ) : scheduleDay.map((item: any) => (
              <div key={item.id} className={cn("p-4 flex items-start gap-4 group hover:bg-slate-50/60 transition-colors",
                item.status === "concluido" && "opacity-60")}>
                <div className="shrink-0 w-14 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hora</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5 tabular-nums">
                    {item.scheduled_time ? item.scheduled_time.slice(0, 5) : "—:—"}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm text-slate-900">{item.clients?.full_name}</p>
                    <Badge variant="outline" className={cn("text-[10px] font-bold uppercase border", PRIORITY_META[item.priority]?.cls)}>
                      {PRIORITY_META[item.priority]?.label}
                    </Badge>
                    {item.status === "concluido" && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-bold uppercase gap-1">
                        <CheckCircle2 className="size-3" /> Concluída
                      </Badge>
                    )}
                  </div>
                  <p className="text-[13px] text-slate-700 mt-1">{item.title}</p>
                  {item.description && <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">{item.description}</p>}
                  {item.client_products?.products?.name && (
                    <p className="text-[10.5px] text-indigo-600 font-semibold mt-1.5 uppercase tracking-wider">
                      Demanda: {item.client_products.products.name}
                    </p>
                  )}
                  {item.completion_notes && (
                    <div className="mt-2 p-2 rounded-md bg-emerald-50 border border-emerald-100 text-[11.5px] text-emerald-900">
                      <span className="font-bold">Resultado: </span>{item.completion_notes}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.status === "pendente" && (
                    <>
                      <Button size="sm" variant="outline" className="h-8 text-[11px] gap-1.5"
                        onClick={() => setInteractionTarget({ clientId: item.client_id, cpId: item.client_product_id, clientName: item.clients?.full_name })}>
                        <MessageSquare className="size-3" /> Registrar
                      </Button>
                      <Button size="sm" className="h-8 text-[11px] bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                        onClick={() => setCompleteTarget(item)}>
                        <CheckCircle2 className="size-3" /> Concluir
                      </Button>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 text-[10.5px] text-slate-500">Reagendar</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar mode="single" onSelect={(d) => d && reschedule(item, d)} className={cn("p-3 pointer-events-auto")} locale={ptBR} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar: clientes + interações recentes */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Meus clientes</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{clients.length} para atuar</p>
              </div>
            </div>
            <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100">
              {clients.map((c) => (
                <div key={c.id} className="p-3 hover:bg-slate-50/60 flex items-center gap-3 group">
                  <div className="size-9 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white text-[11px] font-bold flex items-center justify-center">
                    {(c.full_name || "?").split(" ").map((s: string) => s[0]).slice(0, 2).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[12.5px] text-slate-900 truncate">{c.full_name}</p>
                    <p className="text-[10.5px] text-slate-500 truncate">{c.products.length} demanda(s)</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="size-7" title="Registrar interação"
                      onClick={() => setInteractionTarget({ clientId: c.id, clientName: c.full_name })}>
                      <MessageSquare className="size-3.5 text-indigo-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7" title="Histórico"
                      onClick={() => setHistoryTarget({ clientId: c.id, clientName: c.full_name })}>
                      <History className="size-3.5 text-slate-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Últimas interações</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Histórico recente de contatos</p>
            </div>
            <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
              {recentInteractions.length === 0 ? (
                <p className="p-6 text-center text-[12px] text-slate-500">Nenhuma interação registrada ainda.</p>
              ) : recentInteractions.map((i: any) => {
                const meta = CHANNEL_META[i.channel] || CHANNEL_META.other;
                const Icon = meta.icon;
                return (
                  <div key={i.id} className="p-3 flex gap-3 hover:bg-slate-50/60">
                    <div className={cn("size-8 rounded-lg border flex items-center justify-center shrink-0", meta.color)}>
                      <Icon className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-[12px] text-slate-900 truncate">{i.clients?.full_name}</p>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {format(new Date(i.occurred_at), "dd/MM HH:mm")}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-slate-600 line-clamp-2 mt-0.5">{i.summary}</p>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mt-1 block">
                        {meta.label} · {i.direction === "outbound" ? "Enviada" : "Recebida"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ScheduleDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        clients={clients}
        providerId={providerId}
        userId={user?.id}
        defaultDate={date}
        onSaved={refresh}
      />
      <InteractionDialog
        target={interactionTarget}
        onClose={() => setInteractionTarget(null)}
        providerId={providerId}
        userId={user?.id}
        onSaved={refresh}
      />
      <HistoryDialog target={historyTarget} onClose={() => setHistoryTarget(null)} providerId={providerId} />
      <CompleteDialog target={completeTarget} onClose={() => setCompleteTarget(null)} onConfirm={markCompleted} />
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: "indigo" | "emerald" | "rose" }) {
  const tones: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/40">
      <div className={cn("size-9 rounded-lg border flex items-center justify-center", tones[tone])}>
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="font-bold text-lg text-slate-900 tabular-nums leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}

/* =========================
   Schedule Dialog
   ========================= */
function ScheduleDialog({ open, onClose, clients, providerId, userId, defaultDate, onSaved }: any) {
  const [clientId, setClientId] = useState<string>("");
  const [cpId, setCpId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState<Date>(defaultDate);
  const [scheduledTime, setScheduledTime] = useState("");
  const [priority, setPriority] = useState("normal");
  const [saving, setSaving] = useState(false);

  const client = clients.find((c: any) => c.id === clientId);

  function reset() {
    setClientId(""); setCpId(""); setTitle(""); setDescription("");
    setScheduledDate(defaultDate); setScheduledTime(""); setPriority("normal");
  }

  async function handleSave() {
    if (!clientId || !title.trim()) return toast.error("Cliente e título são obrigatórios");
    setSaving(true);
    const { error } = await supabase.from("provider_schedule").insert({
      provider_id: providerId,
      client_id: clientId,
      client_product_id: cpId || null,
      scheduled_date: format(scheduledDate, "yyyy-MM-dd"),
      scheduled_time: scheduledTime || null,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Atuação agendada");
    reset();
    onClose();
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && (reset(), onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-indigo-600" /> Agendar atuação
          </DialogTitle>
          <DialogDescription>Programe um atendimento para um cliente em uma data específica.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cliente *</label>
            <Select value={clientId} onValueChange={(v) => { setClientId(v); setCpId(""); }}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {client?.products?.length > 0 && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Demanda (opcional)</label>
              <Select value={cpId} onValueChange={setCpId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Vincular a uma demanda" /></SelectTrigger>
                <SelectContent>
                  {client.products.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.products?.name || "Demanda"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Título *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ligar para confirmar documentação" className="mt-1" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Data</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full mt-1 justify-start font-normal">
                    <CalendarDays className="size-4 mr-2" />
                    {format(scheduledDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={scheduledDate} onSelect={(d) => d && setScheduledDate(d)} initialFocus locale={ptBR} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Hora</label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Prioridade</label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Observações</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes do que precisa ser feito" className="mt-1 min-h-[80px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? "Salvando..." : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================
   Interaction Dialog
   ========================= */
function InteractionDialog({ target, onClose, providerId, userId, onSaved }: any) {
  const [channel, setChannel] = useState("whatsapp");
  const [direction, setDirection] = useState("outbound");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setChannel("whatsapp"); setDirection("outbound"); setSummary(""); setNotes("");
    setOccurredAt(format(new Date(), "yyyy-MM-dd'T'HH:mm")); setNextAction(""); setNextActionAt("");
  }

  async function handleSave() {
    if (!summary.trim()) return toast.error("Descreva o que foi conversado");
    setSaving(true);
    const { error } = await supabase.from("provider_interactions").insert({
      provider_id: providerId,
      client_id: target.clientId,
      client_product_id: target.cpId || null,
      channel,
      direction,
      summary: summary.trim(),
      notes: notes.trim() || null,
      occurred_at: new Date(occurredAt).toISOString(),
      next_action: nextAction.trim() || null,
      next_action_at: nextActionAt ? new Date(nextActionAt).toISOString() : null,
      created_by: userId,
    });

    // Cria agendamento de follow-up automático
    if (!error && nextAction.trim() && nextActionAt) {
      await supabase.from("provider_schedule").insert({
        provider_id: providerId,
        client_id: target.clientId,
        client_product_id: target.cpId || null,
        scheduled_date: format(new Date(nextActionAt), "yyyy-MM-dd"),
        scheduled_time: format(new Date(nextActionAt), "HH:mm"),
        title: nextAction.trim(),
        priority: "normal",
        created_by: userId,
      });
    }

    setSaving(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Interação registrada");
    reset();
    onClose();
    onSaved();
  }

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && (reset(), onClose())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-4 text-indigo-600" />
            Registrar interação · <span className="text-indigo-700">{target?.clientName}</span>
          </DialogTitle>
          <DialogDescription>Documente o que foi conversado, por qual canal e quando.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Canal</label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CHANNEL_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Direção</label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Enviada por mim</SelectItem>
                  <SelectItem value="inbound">Recebida do cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Quando *</label>
            <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Resumo *</label>
            <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Ex.: Confirmei os dados e enviei a proposta" className="mt-1" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Anotações</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalhes da conversa, objeções, próximos passos..." className="mt-1 min-h-[90px]" />
          </div>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Próxima ação (opcional)</p>
            <Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Ex.: Retornar a ligação após o envio do contrato" />
            <Input type="datetime-local" value={nextActionAt} onChange={(e) => setNextActionAt(e.target.value)} />
            <p className="text-[10.5px] text-indigo-700/80">Se preencher data, cria automaticamente um agendamento.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? "Salvando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================
   History Dialog
   ========================= */
function HistoryDialog({ target, onClose, providerId }: any) {
  const { data: history = [] } = useQuery({
    queryKey: ["provider-interactions-history", providerId, target?.clientId],
    enabled: !!target,
    queryFn: async () => {
      const { data } = await supabase
        .from("provider_interactions")
        .select("*")
        .eq("provider_id", providerId)
        .eq("client_id", target.clientId)
        .order("occurred_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4 text-indigo-600" />
            Histórico de interações · <span className="text-indigo-700">{target?.clientName}</span>
          </DialogTitle>
          <DialogDescription>{history.length} {history.length === 1 ? "registro encontrado" : "registros encontrados"}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
          {history.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Nenhuma interação registrada com este cliente.</p>
          ) : (
            <div className="relative pl-6 border-l-2 border-indigo-100 space-y-4">
              {history.map((i: any) => {
                const meta = CHANNEL_META[i.channel] || CHANNEL_META.other;
                const Icon = meta.icon;
                return (
                  <div key={i.id} className="relative">
                    <div className={cn("absolute -left-[31px] size-6 rounded-full border-2 border-white flex items-center justify-center", meta.color)}>
                      <Icon className="size-3" />
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-[10px] font-bold uppercase border", meta.color)}>{meta.label}</Badge>
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                            {i.direction === "outbound" ? "Enviada" : "Recebida"}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 tabular-nums">
                          {format(new Date(i.occurred_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="font-bold text-sm text-slate-900">{i.summary}</p>
                      {i.notes && <p className="text-[12.5px] text-slate-600 mt-1.5 whitespace-pre-wrap">{i.notes}</p>}
                      {i.next_action && (
                        <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-indigo-700">
                          <ArrowRight className="size-3" /> <span className="font-bold">{i.next_action}</span>
                          {i.next_action_at && <span className="text-slate-500"> · {format(new Date(i.next_action_at), "dd/MM HH:mm")}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* =========================
   Complete Dialog
   ========================= */
function CompleteDialog({ target, onClose, onConfirm }: any) {
  const [notes, setNotes] = useState("");
  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && (setNotes(""), onClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" /> Concluir atuação
          </DialogTitle>
          <DialogDescription>Resuma o que foi resolvido nesta atuação.</DialogDescription>
        </DialogHeader>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: Cliente confirmou recebimento dos documentos e pagamento" className="min-h-[100px]" />
        <DialogFooter>
          <Button variant="outline" onClick={() => { setNotes(""); onClose(); }}>Cancelar</Button>
          <Button onClick={() => { onConfirm(target, notes); setNotes(""); }} className="bg-emerald-600 hover:bg-emerald-700">
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
