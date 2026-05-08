import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  clientId: string;
}

export function NpsCard({ clientId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["nps", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("nps_responses")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!clientId,
  });

  const submit = async () => {
    if (score == null) {
      toast.error("Selecione uma nota");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("nps_responses").insert({
      client_id: clientId,
      score,
      comment: comment || null,
    });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Obrigado pelo seu feedback!");
      qc.invalidateQueries({ queryKey: ["nps", clientId] });
    }
  };

  if (existing) {
    return (
      <div className="vx-card p-5 text-center space-y-2">
        <CheckCircle2 className="size-8 mx-auto text-emerald-500" />
        <p className="text-sm font-bold">Feedback enviado</p>
        <p className="text-xs text-muted-foreground">Sua nota: {existing.score}/10 — Obrigado!</p>
      </div>
    );
  }

  return (
    <div className="vx-card p-5 space-y-4">
      <div>
        <p className="text-sm font-bold flex items-center gap-2">
          <Star className="size-4 text-amber-500" />
          Como você avalia nosso atendimento?
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">De 0 (péssimo) a 10 (excelente)</p>
      </div>

      <div className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }).map((_, i) => (
          <button
            key={i}
            onClick={() => setScore(i)}
            className={`h-9 rounded-md text-xs font-bold transition-all ${
              score === i
                ? "bg-primary text-primary-foreground scale-110 shadow-md"
                : "bg-muted hover:bg-muted/70 text-foreground"
            }`}
          >
            {i}
          </button>
        ))}
      </div>

      <Textarea
        rows={2}
        placeholder="Conte mais sobre sua experiência (opcional)..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <Button onClick={submit} disabled={submitting || score == null} className="w-full">
        {submitting ? "Enviando..." : "Enviar avaliação"}
      </Button>
    </div>
  );
}
