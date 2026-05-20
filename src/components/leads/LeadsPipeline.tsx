import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Phone,
  MessageCircle,
  Mail,
  ChevronDown,
  ArrowRight,
  Flame,
  Clock,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  UserPlus,
} from "lucide-react";
import { initials, formatPhone, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const STATUSES = [
  "Novo",
  "Primeiro contato",
  "Diagnóstico",
  "Proposta enviada",
  "Negociação",
  "Contrato enviado",
  "Fechado",
  "Perdido",
] as const;

const STATUS_TONE: Record<string, string> = {
  "Novo": "bg-sky-50 text-sky-700 border-sky-200",
  "Primeiro contato": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Diagnóstico": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Proposta enviada": "bg-violet-50 text-violet-700 border-violet-200",
  "Negociação": "bg-orange-50 text-orange-700 border-orange-200",
  "Contrato enviado": "bg-amber-50 text-amber-700 border-amber-200",
  "Fechado": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Perdido": "bg-rose-50 text-rose-700 border-rose-200",
};

const DEFAULT_OPEN = new Set(["Novo", "Primeiro contato", "Diagnóstico", "Negociação", "Proposta enviada"]);

interface Props {
  leads: any[];
  onEdit: (lead: any) => void;
  onConvert: (lead: any) => void;
}

function daysSince(iso?: string | null) {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function isTodayOrPast(iso?: string | null) {
  if (!iso) return false;
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d.getTime() <= Date.now();
}

function brl(v?: number | string | null) {
  if (v == null || v === "") return null;
  return `R$ ${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function buildPriority(lead: any): { score: number; reason: string; tone: string } | null {
  if (lead.status === "Fechado" || lead.status === "Perdido") return null;
  if (isTodayOrPast(lead.next_action_date)) {
    return { score: 100, reason: lead.next_action || "Follow-up agendado", tone: "text-rose-600" };
  }
  if (lead.close_probability != null && Number(lead.close_probability) >= 70) {
    return { score: 90, reason: `Lead quente · ${lead.close_probability}%`, tone: "text-orange-600" };
  }
  if (lead.status === "Novo" && daysSince(lead.created_at) >= 1) {
    return { score: 80, reason: `Novo há ${daysSince(lead.created_at)}d sem contato`, tone: "text-sky-600" };
  }
  if (
    ["Proposta enviada", "Negociação", "Contrato enviado"].includes(lead.status) &&
    daysSince(lead.updated_at || lead.created_at) >= 3
  ) {
    return {
      score: 70,
      reason: `Sem follow-up há ${daysSince(lead.updated_at || lead.created_at)}d`,
      tone: "text-amber-600",
    };
  }
  return null;
}

export function LeadsPipeline({ leads, onEdit, onConvert }: Props) {
  const qc = useQueryClient();
  const [openGroups, setOpenGroups] = useState<Set<string>>(DEFAULT_OPEN);

  const moveLead = async (id: string, status: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    const prev = lead.status;
    qc.setQueryData(["leads"], (old: any[] | undefined) =>
      old?.map((l) => (l.id === id ? { ...l, status } : l)),
    );
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) {
      qc.setQueryData(["leads"], (old: any[] | undefined) =>
        old?.map((l) => (l.id === id ? { ...l, status: prev } : l)),
      );
      toast.error("Erro ao mover lead");
    } else {
      toast.success(`Status alterado para "${status}"`);
    }
  };

  const todayQueue = useMemo(() => {
    return leads
      .map((l) => ({ lead: l, pri: buildPriority(l) }))
      .filter((x) => x.pri)
      .sort((a, b) => b.pri!.score - a.pri!.score)
      .slice(0, 30);
  }, [leads]);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    STATUSES.forEach((s) => (map[s] = []));
    const others: any[] = [];
    leads.forEach((l) => {
      if (map[l.status]) map[l.status].push(l);
      else others.push(l);
    });
    // ordena cada bucket por urgência: follow-up vencido/hoje > quente > recente
    const sortBucket = (arr: any[]) =>
      arr.sort((a, b) => {
        const ap = buildPriority(a)?.score ?? 0;
        const bp = buildPriority(b)?.score ?? 0;
        if (bp !== ap) return bp - ap;
        const ad = a.next_action_date ? new Date(a.next_action_date).getTime() : Infinity;
        const bd = b.next_action_date ? new Date(b.next_action_date).getTime() : Infinity;
        if (ad !== bd) return ad - bd;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    Object.keys(map).forEach((k) => sortBucket(map[k]));
    sortBucket(others);
    return { map, others };
  }, [leads]);

  const funnelStats = useMemo(() => {
    const counts = STATUSES.map((s) => ({ status: s, count: grouped.map[s].length }));
    const main = ["Novo", "Primeiro contato", "Proposta enviada", "Negociação", "Fechado"];
    return main.map((s, i) => {
      const cur = counts.find((c) => c.status === s)?.count || 0;
      const prevName = main[i - 1];
      const prev = prevName ? counts.find((c) => c.status === prevName)?.count || 0 : null;
      const rate = prev && prev > 0 ? Math.round((cur / prev) * 100) : null;
      return { status: s, count: cur, rate };
    });
  }, [grouped]);

  const totalValue = (list: any[]) =>
    list.reduce((acc, l) => acc + Number(l.estimated_value || 0), 0);

  const toggleGroup = (s: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Funil compacto */}
      <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500">
            Funil de conversão
          </h3>
          <span className="text-[10px] font-bold text-slate-500">
            {leads.length} leads no recorte atual
          </span>
        </div>
        <div className="flex items-end gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none">
          {funnelStats.map((s, i) => (
            <div key={s.status} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="flex flex-col items-center min-w-[64px] sm:min-w-[88px]">
                <div className="text-lg sm:text-2xl font-black font-mono text-slate-900">{s.count}</div>
                <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center leading-tight">
                  {s.status}
                </div>
                <div className="mt-1.5 h-1 w-full rounded-full bg-indigo-100 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600"
                    style={{
                      width: `${Math.min(100, (s.count / Math.max(1, funnelStats[0].count)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              {i < funnelStats.length - 1 && (
                <div className="flex flex-col items-center justify-center text-[9px] sm:text-[10px] font-bold text-slate-400">
                  <ArrowRight className="size-3 sm:size-3.5" />
                  {s.rate != null && <span>{s.rate}%</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pra agir hoje */}
      <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-rose-50/50 via-orange-50/30 to-transparent">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-rose-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Pra agir hoje
            </h3>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700">
              {todayQueue.length}
            </span>
          </div>
        </div>
        {todayQueue.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-900">Nada pendente. Bom trabalho!</p>
            <p className="text-xs text-slate-500 mt-1">
              Agende follow-ups nos leads pra eles aparecerem aqui.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {todayQueue.map(({ lead, pri }) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                priority={pri!}
                onEdit={onEdit}
                onConvert={onConvert}
                onStatusChange={(s) => moveLead(lead.id, s)}
              />
            ))}
          </ul>
        )}
      </div>


      {/* Funil agrupado */}
      <div className="space-y-2.5">
        {STATUSES.map((status) => {
          const list = grouped.map[status];
          const isOpen = openGroups.has(status);
          const tone = STATUS_TONE[status];
          return (
            <div key={status} className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
              <button
                onClick={() => toggleGroup(status)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ChevronDown
                    className={cn(
                      "size-4 text-slate-400 transition-transform shrink-0",
                      !isOpen && "-rotate-90",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border",
                      tone,
                    )}
                  >
                    {status}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 font-mono">
                    {list.length}
                  </span>
                </div>
                {totalValue(list) > 0 && (
                  <span className="text-[11px] font-bold text-emerald-600 font-mono shrink-0 ml-2">
                    {brl(totalValue(list))}
                  </span>
                )}
              </button>
              {isOpen &&
                (list.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-500 border-t border-slate-100">
                    Nenhum lead nesta etapa.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 border-t border-slate-100">
                    {list.map((lead) => (
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        onEdit={onEdit}
                        onConvert={onConvert}
                        onStatusChange={(s) => moveLead(lead.id, s)}
                      />
                    ))}
                  </ul>
                ))}
            </div>
          );
        })}

        {grouped.others.length > 0 && (
          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
            <button
              onClick={() => toggleGroup("__others__")}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <ChevronDown className={cn("size-4 text-slate-400 transition-transform", !openGroups.has("__others__") && "-rotate-90")} />
                <span className="text-[10.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border bg-slate-50 text-slate-600 border-slate-200">
                  Outros status
                </span>
                <span className="text-[11px] font-bold text-slate-500 font-mono">{grouped.others.length}</span>
              </div>
            </button>
            {openGroups.has("__others__") && (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {grouped.others.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} onEdit={onEdit} onConvert={onConvert} onStatusChange={(s) => moveLead(lead.id, s)} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LeadRow({
  lead,
  priority,
  onEdit,
  onConvert,
  onStatusChange,
}: {
  lead: any;
  priority?: { reason: string; tone: string };
  onEdit: (l: any) => void;
  onConvert: (l: any) => void;
  onStatusChange: (s: string) => void;
}) {
  const phone = lead.whatsapp || lead.phone;
  const phoneDigits = phone ? String(phone).replace(/\D/g, "") : "";
  const waUrl = phoneDigits
    ? `https://wa.me/${phoneDigits.length <= 11 ? "55" + phoneDigits : phoneDigits}?text=${encodeURIComponent(
        `Olá ${String(lead.full_name || "").split(" ")[0] || ""}, tudo bem?`,
      )}`
    : null;

  return (
    <li className="px-3 sm:px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center font-bold text-[11px] text-primary shrink-0">
          {initials(lead.full_name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onEdit(lead)}
              className="text-sm font-bold text-foreground truncate hover:text-primary transition-colors text-left"
            >
              {lead.full_name}
            </button>
            {lead.estimated_value && (
              <span className="text-[10.5px] font-bold text-emerald-600 font-mono">
                {brl(lead.estimated_value)}
              </span>
            )}
            {lead.close_probability != null && (
              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                {lead.close_probability}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
            {lead.company && <span className="truncate">{lead.company}</span>}
            {phone && (
              <span className="flex items-center gap-1">
                <MessageCircle className="size-3" />
                {formatPhone(phone)}
              </span>
            )}
            {!phone && lead.email && (
              <span className="flex items-center gap-1 truncate">
                <Mail className="size-3" />
                {lead.email}
              </span>
            )}
            <span className="flex items-center gap-1 text-muted-foreground/70">
              <Clock className="size-3" />
              {formatDate(lead.created_at)}
            </span>
          </div>
          {priority ? (
            <p className={cn("text-[11px] font-semibold mt-1 truncate", priority.tone)}>
              → {priority.reason}
            </p>
          ) : (
            lead.next_action && (
              <p className="text-[11px] text-muted-foreground/80 mt-1 truncate italic">
                → {lead.next_action}
                {lead.next_action_date && ` · ${formatDate(lead.next_action_date)}`}
              </p>
            )
          )}
        </div>

        {/* Ações desktop */}
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {waUrl && (
            <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0" title="WhatsApp">
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4 text-emerald-600" />
              </a>
            </Button>
          )}
          {phone && (
            <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0" title="Ligar">
              <a href={`tel:${phoneDigits}`}>
                <Phone className="size-4 text-sky-600" />
              </a>
            </Button>
          )}
          {lead.email && (
            <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0" title="E-mail">
              <a href={`mailto:${lead.email}`}>
                <Mail className="size-4 text-indigo-600" />
              </a>
            </Button>
          )}
          <Select value={lead.status} onValueChange={onStatusChange}>
            <SelectTrigger className="h-8 w-[150px] text-[11px] font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs font-semibold">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onEdit(lead)}>
                <Pencil className="size-3.5 mr-2" /> Editar
              </DropdownMenuItem>
              {lead.status !== "Fechado" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onConvert(lead)} className="text-primary">
                    <UserPlus className="size-3.5 mr-2" /> Converter em cliente
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Ações mobile */}
        <div className="flex sm:hidden items-center gap-1 shrink-0">
          {waUrl && (
            <Button asChild size="sm" variant="ghost" className="h-9 w-9 p-0">
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4 text-emerald-600" />
              </a>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-9 w-9 p-0">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {phone && (
                <DropdownMenuItem asChild>
                  <a href={`tel:${phoneDigits}`}>
                    <Phone className="size-3.5 mr-2 text-sky-600" /> Ligar
                  </a>
                </DropdownMenuItem>
              )}
              {lead.email && (
                <DropdownMenuItem asChild>
                  <a href={`mailto:${lead.email}`}>
                    <Mail className="size-3.5 mr-2 text-indigo-600" /> E-mail
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Mudar status
                </div>
                <Select value={lead.status} onValueChange={onStatusChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(lead)}>
                <Pencil className="size-3.5 mr-2" /> Editar
              </DropdownMenuItem>
              {lead.status !== "Fechado" && (
                <DropdownMenuItem onClick={() => onConvert(lead)} className="text-primary">
                  <UserPlus className="size-3.5 mr-2" /> Converter em cliente
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
}
