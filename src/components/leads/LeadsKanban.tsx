import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, MessageSquare, GripVertical, MoreHorizontal } from "lucide-react";
import { initials, formatPhone, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";

const COLUMNS: { key: string; label: string; accent: string }[] = [
  { key: "Novo", label: "Novo lead", accent: "from-sky-500/20 to-sky-500/5 border-sky-500/30" },
  { key: "Primeiro contato", label: "Primeiro contato", accent: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30" },
  { key: "Diagnóstico", label: "Diagnóstico", accent: "from-indigo-500/20 to-indigo-500/5 border-indigo-500/30" },
  { key: "Proposta enviada", label: "Proposta enviada", accent: "from-violet-500/20 to-violet-500/5 border-violet-500/30" },
  { key: "Negociação", label: "Negociação", accent: "from-orange-500/20 to-orange-500/5 border-orange-500/30" },
  { key: "Contrato enviado", label: "Contrato enviado", accent: "from-amber-500/20 to-amber-500/5 border-amber-500/30" },
  { key: "Fechado", label: "Fechado", accent: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30" },
  { key: "Perdido", label: "Perdido", accent: "from-rose-500/20 to-rose-500/5 border-rose-500/30" },
];

interface Props {
  leads: any[];
  onEdit: (lead: any) => void;
  onConvert: (lead: any) => void;
}

export function LeadsKanban({ leads, onEdit, onConvert }: Props) {
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const moveLead = async (id: string, status: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    const prev = lead.status;
    // optimistic
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
      toast.success(`Lead movido para "${status}"`);
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
      {COLUMNS.map((col) => {
        const items = leads.filter((l) => l.status === col.key);
        const isOver = overCol === col.key;
        return (
          <div
            key={col.key}
            className={`flex-shrink-0 w-[290px] rounded-2xl border bg-gradient-to-b ${col.accent} ${
              isOver ? "ring-2 ring-primary/60 scale-[1.01]" : ""
            } transition-all`}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col.key);
            }}
            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              setOverCol(null);
              if (dragId) moveLead(dragId, col.key);
              setDragId(null);
            }}
          >
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                  {col.label}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-background/70 text-muted-foreground">
                  {items.length}
                </span>
              </div>
            </div>
            <div className="px-2 pb-3 space-y-2 min-h-[120px]">
              {items.length === 0 && (
                <div className="text-[10.5px] text-muted-foreground/70 text-center py-6 border border-dashed border-border/50 rounded-xl mx-1">
                  Solte um lead aqui
                </div>
              )}
              {items.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={() => setDragId(lead.id)}
                  onDragEnd={() => setDragId(null)}
                  className={`group bg-card rounded-xl border border-border/60 p-3 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-grab active:cursor-grabbing ${
                    dragId === lead.id ? "opacity-40" : ""
                  }`}
                  onDoubleClick={() => onEdit(lead)}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="size-3.5 text-muted-foreground/40 mt-1 flex-shrink-0" />
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-[10px] text-primary ring-1 ring-primary/20 flex-shrink-0">
                        {initials(lead.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">{lead.full_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {lead.products?.name || lead.source || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 pl-5">
                    {lead.whatsapp && (
                      <span className="text-[9.5px] text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="size-2.5" /> {formatPhone(lead.whatsapp)}
                      </span>
                    )}
                    {lead.email && !lead.whatsapp && (
                      <span className="text-[9.5px] text-muted-foreground flex items-center gap-1 truncate">
                        <Mail className="size-2.5" /> {lead.email}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2 pl-5">
                    <span className="text-[9.5px] text-muted-foreground/70">
                      {formatDate(lead.created_at)}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[9.5px] font-bold"
                        onClick={() => onEdit(lead)}
                      >
                        Editar
                      </Button>
                      {lead.status !== "Virou cliente" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[9.5px] font-bold text-primary"
                          onClick={() => onConvert(lead)}
                        >
                          Converter
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
