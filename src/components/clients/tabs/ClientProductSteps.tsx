import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ClientProductSteps({ clientProductId }: { clientProductId: string }) {
  const qc = useQueryClient();

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

  if (isLoading) return <Loader2 className="size-4 animate-spin text-white/20 mx-auto" />;
  if (!steps?.length) return null;

  const completedCount = steps.filter(s => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className="space-y-4 pt-4 mt-4 border-t border-white/5">
      <div className="flex items-center justify-between">
        <p className="editorial-label text-white/40 flex items-center gap-2">
          <CheckCircle2 className="size-3 text-primary" /> Entrega: {completedCount}/{steps.length}
        </p>
        <span className="text-[10px] font-mono text-primary font-bold">{Math.round(progress)}%</span>
      </div>
      
      <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-500" 
          style={{ width: `${progress}%` }} 
        />
      </div>

      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center gap-3 group">
            <Checkbox 
              checked={step.completed} 
              onCheckedChange={(checked) => toggleStep.mutate({ id: step.id, completed: !!checked })}
              className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <span className={`text-xs transition-colors ${step.completed ? "text-white/20 line-through" : "text-white/60 group-hover:text-white"}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
