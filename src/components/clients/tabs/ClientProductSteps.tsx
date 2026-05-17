import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ClientProductSteps({ clientProductId, showDetails = false }: { clientProductId: string; showDetails?: boolean }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(showDetails);

  const { data: steps, isLoading } = useQuery({
    queryKey: ["product-steps", clientProductId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_product_steps")
        .select("*")
        .eq("client_product_id", clientProductId)
        .order("position", { ascending: true });
      return data ?? [];
    },
  });

  const toggleStep = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from("client_product_steps")
        .update({ 
          completed, 
          completed_at: completed ? new Date().toISOString() : null 
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-steps", clientProductId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) return <Loader2 className="size-4 animate-spin text-slate-400 mx-auto" />;
  if (!steps?.length) return null;

  const completedCount = steps.filter(s => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between cursor-pointer group/header" onClick={() => setExpanded(!expanded)}>
        <p className="editorial-label text-slate-400 flex items-center gap-2 group-hover/header:text-primary transition-colors">
          <CheckCircle2 className="size-3 text-primary" /> Entrega: {completedCount}/{steps.length}
        </p>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-primary font-bold">{Math.round(progress)}%</span>
          {expanded ? <ChevronUp className="size-3 text-slate-400" /> : <ChevronDown className="size-3 text-slate-400" />}
        </div>
      </div>
      
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-500 shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" 
          style={{ width: `${progress}%` }} 
        />
      </div>

      {expanded && (
        <div className="space-y-3 animate-fade-down pt-2">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-3 group">
              <Checkbox 
                checked={step.completed} 
                onCheckedChange={(checked) => toggleStep.mutate({ id: step.id, completed: !!checked })}
                className="border-slate-200 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className={cn(
                "text-xs transition-all",
                step.completed ? "text-slate-300 line-through" : "text-slate-600 group-hover:text-primary font-medium"
              )}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
