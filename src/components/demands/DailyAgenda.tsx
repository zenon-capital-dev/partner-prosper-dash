import { formatBR, nowBR, toBR, isTodayBR, ymdBR } from "@/lib/datetime";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/current-user";
import { parseISO, isToday, isPast, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays, Phone, MessageCircle, Mail, Users2, MapPin,
  CheckCircle2, Clock, Plus, ChevronLeft, ChevronRight,
  Sparkles, History, AlertCircle, User2, Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { INTERACTION_KINDS, kindMeta, type InteractionKind } from "@/lib/interaction-kinds";

type Channel = "whatsapp" | "ligacao" | "email" | "reuniao" | "presencial" | "outro";

const CHANNEL_META: Record<Channel, { label: string; icon: any; color: string }> = {
  whatsapp:   { label: "WhatsApp",   icon: MessageCircle, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  ligacao:    { label: "Ligação",    icon: Phone,         color: "text-blue-600 bg-blue-50 border-blue-200" },
  email:      { label: "E-mail",     icon: Mail,          color: "text-violet-600 bg-violet-50 border-violet-200" },
  reuniao:    { label: "Reunião",    icon: Users2,        color: "text-amber-600 bg-amber-50 border-amber-200" },
  presencial: { label: "Presencial", icon: MapPin,        color: "text-rose-600 bg-rose-50 border-rose-200" },
  outro:      { label: "Outro",      icon: Sparkles,      color: "text-slate-600 bg-slate-50 border-slate-200" },
};

const ymd = (d: Date) => formatBR(d, "yyyy-MM-dd");
const ymdToday = () => ymdBR();
const initials = (n?: string | null) =>
  (n ?? "?").split(" ").filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join("");

export function DailyAgenda() {
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [search, setSearch] = useState("");
  const [dialogClient, setDialogClient] = useState<{ id: string; full_name: string } | null>(null);

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ["agenda-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, company, phone, email")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: interactions = [], isLoading: loadingInts } = useQuery({
    queryKey: ["client-interactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_interactions" as any)
        .select("*")
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const dateStr = ymd(selectedDate);

  // Pendentes do dia selecionado (próximas ações agendadas)
  const dayPending = useMemo(() => {
    return interactions.filter(
      (i: any) => i.status === "pendente" && i.next_action_at === dateStr
    );
  }, [interactions, dateStr]);

  // Atrasadas (pendentes com data anterior a hoje) — só mostra quando o dia selecionado é hoje
  const overdue = useMemo(() => {
    if (!isTodayBR(selectedDate)) return [];
    const today = ymdToday();
    return interactions.filter(
      (i: any) => i.status === "pendente" && i.next_action_at && i.next_action_at < today
    );
  }, [interactions, selectedDate]);

  // Map cliente -> última interação + lista de pendências
  const clientCards = useMemo(() => {
    const byClient: Record<string, { last: any | null; pending: any[]; all: any[] }> = {};
    for (const i of interactions as any[]) {
      const k = i.client_id;
      if (!byClient[k]) byClient[k] = { last: null, pending: [], all: [] };
      byClient[k].all.push(i);
      if (!byClient[k].last || new Date(i.occurred_at) > new Date(byClient[k].last.occurred_at)) {
        byClient[k].last = i;
      }
      if (i.status === "pendente" && i.next_action_at) byClient[k].pending.push(i);
    }
    return byClient;
  }, [interactions]);

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter((c: any) =>
      c.full_name?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  }, [clients, search]);

  const markDoneMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_interactions" as any)
        .update({ status: "feito", done_at: nowBR().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-interactions"] });
      toast.success("Pendência concluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Header data */}
      <div className="bg-white border border-slate-200/70 rounded-xl shadow-sm p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => setSelectedDate(d => addDays(d, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 min-w-[260px] justify-start font-semibold">
                <CalendarDays className="size-4 text-indigo-600" />
                {formatBR(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => setSelectedDate(d => addDays(d, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
          {!isTodayBR(selectedDate) && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>
              Hoje
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold">
            {dayPending.length} {dayPending.length === 1 ? "pendência do dia" : "pendências do dia"}
          </Badge>
          {overdue.length > 0 && (
            <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-semibold animate-pulse">
              {overdue.length} atrasada{overdue.length > 1 ? "s" : ""}
            </Badge>
          )}
          {dayPending.some((i: any) => i.next_action_at && new Date(i.next_action_at) < new Date()) && (
            <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-bold flex items-center gap-1">
              <AlertCircle className="size-3" /> Horário passou
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="dia" className="space-y-4">
        <TabsList className="bg-white border border-slate-200/70 p-1 h-11">
          <TabsTrigger value="dia" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 gap-2">
            <CalendarDays className="size-4" /> Agenda do dia
          </TabsTrigger>
          <TabsTrigger value="clientes" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 gap-2">
            <Users2 className="size-4" /> Clientes ({clients.length})
          </TabsTrigger>
          <TabsTrigger value="historico" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 gap-2">
            <History className="size-4" /> Histórico completo
          </TabsTrigger>
        </TabsList>

        {/* AGENDA DO DIA */}
        <TabsContent value="dia" className="space-y-4 mt-0">
          {overdue.length > 0 && (
            <section className="bg-white border border-rose-200/70 rounded-xl shadow-sm overflow-hidden">
              <header className="px-4 py-3 border-b border-rose-100 bg-rose-50/60 flex items-center gap-2">
                <AlertCircle className="size-4 text-rose-600" />
                <h3 className="font-semibold text-rose-800 text-sm">Atrasadas — precisam de atenção</h3>
              </header>
              <ul className="divide-y divide-slate-100">
                {overdue.map((i: any) => {
                  const client = clients.find((c: any) => c.id === i.client_id);
                  return (
                    <PendingRow
                      key={i.id}
                      interaction={i}
                      client={client}
                      onDone={(id) => markDoneMutation.mutate(id)}
                      onOpen={() => client && setDialogClient({ id: client.id, full_name: client.full_name })}
                      overdue
                    />
                  );
                })}
              </ul>
            </section>
          )}

          <section className="bg-white border border-slate-200/70 rounded-xl shadow-sm overflow-hidden">
            <header className="px-4 py-3 border-b border-slate-100 bg-slate-50/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-indigo-600" />
                <h3 className="font-semibold text-slate-800 text-sm">
                  Pendências para {formatBR(selectedDate, "dd/MM", { locale: ptBR })}
                </h3>
              </div>
            </header>
            {loadingInts ? (
              <div className="p-6 space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : dayPending.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="size-10 text-emerald-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">Nenhuma pendência para este dia.</p>
                <p className="text-xs text-slate-400 mt-1">Agende ações no card de cada cliente na aba "Clientes".</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {dayPending.map((i: any) => {
                  const client = clients.find((c: any) => c.id === i.client_id);
                  return (
                    <PendingRow
                      key={i.id}
                      interaction={i}
                      client={client}
                      onDone={(id) => markDoneMutation.mutate(id)}
                      onOpen={() => client && setDialogClient({ id: client.id, full_name: client.full_name })}
                    />
                  );
                })}
              </ul>
            )}
          </section>
        </TabsContent>

        {/* CLIENTES */}
        <TabsContent value="clientes" className="space-y-4 mt-0">
          <Input
            placeholder="Buscar cliente por nome, empresa ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-11 max-w-md bg-white"
          />
          {loadingClients ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredClients.map((c: any) => {
                const data = clientCards[c.id] ?? { last: null, pending: [], all: [] };
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setDialogClient({ id: c.id, full_name: c.full_name })}
                    className="text-left bg-white border border-slate-200/70 hover:border-indigo-300 hover:shadow-md transition-all rounded-xl p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="size-10 bg-indigo-50">
                        <AvatarFallback className="bg-indigo-50 text-indigo-700 text-xs font-semibold">
                          {initials(c.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800 truncate">{c.full_name}</div>
                        {c.company && (
                          <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                            <Building2 className="size-3" /> {c.company}
                          </div>
                        )}
                      </div>
                      {data.pending.length > 0 && (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">
                          {data.pending.length}
                        </Badge>
                      )}
                    </div>
                    {data.last ? (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Clock className="size-3" />
                          Último contato: {formatBR(parseISO(data.last.occurred_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </div>
                        <p className="text-xs text-slate-700 line-clamp-2">{data.last.summary}</p>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400 italic">
                        Sem registros ainda — clique para registrar o primeiro atendimento.
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="historico" className="mt-0">
          <section className="bg-white border border-slate-200/70 rounded-xl shadow-sm overflow-hidden">
            {loadingInts ? (
              <div className="p-6 space-y-3">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : interactions.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500">
                Nenhuma interação registrada ainda.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-[600px] overflow-auto">
                {interactions.slice(0, 200).map((i: any) => {
                  const c = clients.find((x: any) => x.id === i.client_id);
                  const meta = CHANNEL_META[i.channel as Channel] ?? CHANNEL_META.outro;
                  const Icon = meta.icon;
                  return (
                    <li key={i.id} className="px-4 py-3 hover:bg-slate-50/60 cursor-pointer"
                        onClick={() => c && setDialogClient({ id: c.id, full_name: c.full_name })}>
                      <div className="flex items-start gap-3">
                        <div className={cn("size-9 rounded-lg border flex items-center justify-center shrink-0", meta.color)}>
                          <Icon className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-slate-800">{c?.full_name ?? "Cliente"}</span>
                            <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                            <span className="text-[11px] text-slate-400">
                              {formatBR(parseISO(i.occurred_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 mt-1">{i.summary}</p>
                          {i.next_action_at && (
                            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                              <CalendarDays className="size-3" />
                              Próxima ação: {formatBR(parseISO(i.next_action_at), "dd/MM", { locale: ptBR })}
                              {i.next_action_note && <span>— {i.next_action_note}</span>}
                              {i.status === "feito" && <Badge className="ml-1 bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">feita</Badge>}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>

      {dialogClient && (
        <ClientInteractionDialog
          client={dialogClient}
          interactions={(interactions as any[]).filter((i: any) => i.client_id === dialogClient.id)}
          onClose={() => setDialogClient(null)}
        />
      )}
    </div>
  );
}

function PendingRow({
  interaction, client, onDone, onOpen, overdue,
}: {
  interaction: any;
  client?: any;
  onDone: (id: string) => void;
  onOpen: () => void;
  overdue?: boolean;
}) {
  const meta = CHANNEL_META[interaction.channel as Channel] ?? CHANNEL_META.outro;
  const Icon = meta.icon;
  return (
    <li className="px-4 py-3 hover:bg-slate-50/60 flex items-start gap-3">
      <button onClick={onOpen} className="flex items-start gap-3 flex-1 min-w-0 text-left">
        <div className={cn("size-10 rounded-lg border flex items-center justify-center shrink-0", meta.color)}>
          <Icon className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-800">{client?.full_name ?? "Cliente"}</span>
            {client?.company && <span className="text-xs text-slate-500">· {client.company}</span>}
            {overdue && (
              <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[9px] font-bold">
                {formatBR(parseISO(interaction.next_action_at), "dd/MM", { locale: ptBR })}
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-700 mt-0.5">
            <span className="font-medium text-indigo-700">Fazer: </span>
            {interaction.next_action_note || "Dar continuidade no atendimento"}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
            <span className="font-medium">Último contato:</span> {interaction.summary}
          </p>
        </div>
      </button>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
        onClick={() => onDone(interaction.id)}
      >
        <CheckCircle2 className="size-3.5" /> Feito
      </Button>
    </li>
  );
}

function ClientInteractionDialog({
  client, interactions, onClose,
}: {
  client: { id: string; full_name: string };
  interactions: any[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [kind, setKind] = useState<InteractionKind>("abordado");
  const [summary, setSummary] = useState("");
  const [occurredAt, setOccurredAt] = useState<string>(
    formatBR(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  const [nextActionAt, setNextActionAt] = useState<string>("");
  const [nextActionNote, setNextActionNote] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const uid = await getCurrentUserId();
      const payload: any = {
        client_id: client.id,
        channel,
        kind,
        summary,
        occurred_at: toBR(occurredAt).toISOString(),
        next_action_at: nextActionAt || null,
        next_action_note: nextActionNote || null,
        created_by: uid,
      };
      const { error } = await supabase.from("client_interactions" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-interactions"] });
      toast.success("Atendimento registrado");
      setSummary(""); setNextActionNote(""); setNextActionAt("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_interactions" as any)
        .update({ status: "feito", done_at: nowBR().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-interactions"] });
      toast.success("Marcado como feito");
    },
  });

  const sorted = [...interactions].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User2 className="size-5 text-indigo-600" />
            {client.full_name}
          </DialogTitle>
          <DialogDescription>
            Registre o atendimento e agende a próxima ação para este cliente.
          </DialogDescription>
        </DialogHeader>

        {/* Form novo registro */}
        <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
            <Plus className="size-4" /> Novo atendimento
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Canal</label>
              <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CHANNEL_META).map(([k, m]) => (
                    <SelectItem key={k} value={k}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Quando aconteceu</label>
              <Input
                type="datetime-local"
                value={occurredAt}
                onChange={e => setOccurredAt(e.target.value)}
                className="bg-white"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">O que foi falado *</label>
            <Textarea
              placeholder="Resumo da conversa, o que o cliente disse, próximos passos combinados..."
              value={summary}
              onChange={e => setSummary(e.target.value)}
              className="bg-white min-h-[80px]"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-indigo-100">
            <div>
              <label className="text-xs font-medium text-slate-600">📅 Agendar próxima ação para</label>
              <Input
                type="date"
                value={nextActionAt}
                onChange={e => setNextActionAt(e.target.value)}
                className="bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">O que fazer nesse dia</label>
              <Input
                placeholder="Ex: ligar para confirmar contrato"
                value={nextActionNote}
                onChange={e => setNextActionNote(e.target.value)}
                className="bg-white"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!summary.trim() || createMutation.isPending}
              className="gap-2"
            >
              <Plus className="size-4" />
              {createMutation.isPending ? "Salvando..." : "Registrar atendimento"}
            </Button>
          </div>
        </div>

        {/* Histórico */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <History className="size-4" /> Histórico ({sorted.length})
          </h4>
          {sorted.length === 0 ? (
            <div className="text-sm text-slate-400 italic py-4 text-center">
              Nenhum atendimento ainda.
            </div>
          ) : (
            <ul className="space-y-2 max-h-[300px] overflow-auto">
              {sorted.map((i: any) => {
                const meta = CHANNEL_META[i.channel as Channel] ?? CHANNEL_META.outro;
                const Icon = meta.icon;
                return (
                  <li key={i.id} className="border border-slate-200 rounded-lg p-3 bg-white">
                    <div className="flex items-start gap-3">
                      <div className={cn("size-8 rounded-lg border flex items-center justify-center shrink-0", meta.color)}>
                        <Icon className="size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                          <span className="text-[11px] text-slate-400">
                            {formatBR(parseISO(i.occurred_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 mt-1">{i.summary}</p>
                        {i.next_action_at && (
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <Badge className={cn(
                              "text-[10px] font-semibold",
                              i.status === "feito"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : isPast(parseISO(i.next_action_at)) && !isToday(parseISO(i.next_action_at))
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            )}>
                              <CalendarDays className="size-3 mr-1" />
                              {formatBR(parseISO(i.next_action_at), "dd/MM", { locale: ptBR })}
                              {i.status === "feito" ? " · feita" : " · pendente"}
                            </Badge>
                            {i.next_action_note && (
                              <span className="text-[11px] text-slate-600">{i.next_action_note}</span>
                            )}
                            {i.status === "pendente" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[11px] text-emerald-700 hover:bg-emerald-50"
                                onClick={() => markDone.mutate(i.id)}
                              >
                                <CheckCircle2 className="size-3 mr-1" /> Marcar feito
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
