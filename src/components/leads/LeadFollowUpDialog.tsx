import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: any | null;
  onSaved?: () => void;
}

function defaultDateTimeLocal() {
  const d = new Date();
  d.setHours(d.getHours() + 24, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LeadFollowUpDialog({ open, onOpenChange, lead, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && lead) {
      setTitle(lead.next_action || `Follow-up com ${lead.full_name}`);
      setDueDate(defaultDateTimeLocal());
      setNotes("");
    }
  }, [open, lead]);

  const reset = () => { setTitle(""); setDueDate(""); setNotes(""); };

  const handleSave = async () => {
    if (!lead) return;
    if (!title.trim()) { toast.error("Informe um título"); return; }
    if (!dueDate) { toast.error("Informe data e hora"); return; }

    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const dueIso = new Date(dueDate).toISOString();

      const { error: tErr } = await supabase.from("tasks").insert({
        title: title.trim(),
        description: notes || `Follow-up com ${lead.full_name}`,
        due_date: dueIso,
        status: "pendente",
        status_new: "a_fazer",
        priority: "media",
        related_to_type: "lead",
        related_to_id: lead.id,
        assigned_to: u.user?.id ?? lead.responsible_id ?? null,
        created_by: u.user?.id ?? null,
      });
      if (tErr) throw tErr;

      // Mirror na tabela de leads para aparecer no Pipeline "Pra agir hoje"
      const onlyDate = dueIso.slice(0, 10);
      await supabase.from("leads").update({
        next_action: title.trim(),
        next_action_date: onlyDate,
      }).eq("id", lead.id);

      toast.success("Follow-up agendado!");
      reset();
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao agendar follow-up");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <CalendarClock className="size-5 text-indigo-600" />
            Agendar Follow-up
          </DialogTitle>
          <DialogDescription>
            {lead ? `Lembrete para retornar ao lead ${lead.full_name}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fu-title">Título *</Label>
            <Input id="fu-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Ligar para confirmar proposta" maxLength={150} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fu-date">Data e hora *</Label>
            <Input id="fu-date" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fu-notes">Observações</Label>
            <Textarea id="fu-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pontos a abordar..." maxLength={1000} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {saving ? "Salvando..." : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
