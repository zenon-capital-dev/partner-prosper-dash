import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateFinancialData } from "@/lib/invalidateFinancial";

const TABLES = ["sales", "payments", "commission_splits", "commissions", "expenses", "sale_deductions", "sales_goals"];

/**
 * Rede de segurança: qualquer mudança nas tabelas de dinheiro (feita nesta
 * tela, em outra aba, por outro usuário ou por gatilho do banco) atualiza
 * todas as telas financeiras em até ~1 segundo. O RLS continua valendo.
 */
export function FinancialRealtimeSync() {
  const qc = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void invalidateFinancialData(qc); }, 800);
    };
    let channel = supabase.channel("financial-sync");
    for (const table of TABLES) {
      channel = channel.on("postgres_changes" as any, { event: "*", schema: "public", table }, schedule);
    }
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [qc]);
  return null;
}
