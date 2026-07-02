import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Percent, ArrowRight } from "lucide-react";
import { formatBR as format } from "@/lib/datetime";

const money = (v: any) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const eventTone = (e: string) => {
  if (e?.includes("delete")) return "bg-rose-500/10 text-rose-600 border-rose-500/20";
  if (e?.includes("created") || e?.includes("baseline")) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  if (e?.includes("status")) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
  if (e?.includes("amount")) return "bg-sky-500/10 text-sky-600 border-sky-500/20";
  return "bg-primary/5 text-primary border-primary/10";
};

export function FinancialAuditPanel() {
  const { data: payments = [] } = useQuery({
    queryKey: ["payment-audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) { console.error("[payment_audit_log]", error); return []; }
      return data ?? [];
    },
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["commission-audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) { console.error("[commission_audit_log]", error); return []; }
      return data ?? [];
    },
  });

  const Row = ({ items, kind }: { items: any[]; kind: "payment" | "commission" }) => (
    <div className="space-y-1">
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground italic py-6 text-center">
          Nenhum evento registrado ainda.
        </p>
      )}
      {items.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs hover:bg-card transition-colors"
        >
          <Badge className={`${eventTone(r.event)} font-medium`}>{r.event}</Badge>
          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
            {r.old_status && (
              <>
                <span className="text-muted-foreground">{r.old_status}</span>
                <ArrowRight className="size-3 text-muted-foreground" />
              </>
            )}
            {r.new_status && <span className="font-medium">{r.new_status}</span>}
            {kind === "payment" && r.amount != null && (
              <span className="ml-auto tabular-nums font-mono text-[11px] text-muted-foreground">
                {money(r.amount)}
              </span>
            )}
            {kind === "commission" && r.amount != null && (
              <span className="ml-auto tabular-nums font-mono text-[11px] text-muted-foreground">
                {money(r.amount)}
                {r.percent != null && ` · ${Number(r.percent)}%`}
              </span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground text-right shrink-0">
            <div className="truncate max-w-[140px]">{r.actor_email ?? "sistema"}</div>
            <div>{format(new Date(r.created_at), "dd/MM HH:mm")}</div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="vx-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <div className="size-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
          <CreditCard className="size-4" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">Auditoria Financeira</h2>
          <p className="text-xs text-muted-foreground">
            Toda mudança de pagamento e comissão — capturada por trigger, imune a edições diretas.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Cobertura 100%
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="size-3.5 text-muted-foreground" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Pagamentos ({payments.length})
            </p>
          </div>
          <Row items={payments} kind="payment" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Percent className="size-3.5 text-muted-foreground" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Comissões ({commissions.length})
            </p>
          </div>
          <Row items={commissions} kind="commission" />
        </div>
      </div>
    </div>
  );
}
