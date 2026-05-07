import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Users, Clock, CheckCircle2, ArrowRight, ClipboardList } from "lucide-react";
import { formatDate, formatBRL } from "@/lib/format";

export default function ProviderPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: provider } = useQuery({
    queryKey: ["provider-self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("service_providers")
        .select("id, name")
        .eq("email", user!.email!)
        .maybeSingle();
      return data;
    },
  });

  const providerId = provider?.id;

  const { data: assignments = [] } = useQuery({
    queryKey: ["provider-assignments", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("service_assignments")
        .select("*, clients(full_name), products(name)")
        .eq("provider_id", providerId!)
        .order("due_date", { ascending: true });
      return data ?? [];
    },
  });

  const { data: clientProducts = [] } = useQuery({
    queryKey: ["provider-client-products", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_products")
        .select("id, status, value, deadline, clients(id, full_name), products(name)")
        .eq("service_provider_id", providerId!);
      return data ?? [];
    },
  });

  const pending = assignments.filter((a: any) => a.status !== "completed" && a.status !== "cancelled");
  const completed = assignments.filter((a: any) => a.status === "completed");
  const totalValue = clientProducts.reduce((sum: number, cp: any) => sum + Number(cp.value || 0), 0);

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in space-y-6">
      <PageHeader 
        title={`Painel do Prestador${provider ? ` — ${provider.name}` : ""}`} 
        description="Serviços atribuídos a você e clientes em execução." 
      />

      {!provider && (
        <div className="vx-card p-6 text-center text-sm text-muted-foreground">
          Sua conta de prestador ainda não foi vinculada. Peça ao administrador para associar seu e-mail ao cadastro de prestadores.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Atribuições pendentes" value={String(pending.length)} icon={Clock} iconColor="warning" />
        <StatCard label="Concluídas" value={String(completed.length)} icon={CheckCircle2} iconColor="success" />
        <StatCard label="Clientes ativos" value={String(clientProducts.length)} icon={Users} iconColor="primary" />
        <StatCard label="Valor total dos serviços" value={formatBRL(totalValue)} icon={Briefcase} iconColor="info" />
      </div>

      <div className="vx-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <ClipboardList className="size-4" /> Serviços atribuídos
          </h3>
        </div>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum serviço atribuído ainda</p>
        ) : (
          <div className="divide-y divide-border">
            {assignments.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {a.products?.name || "Serviço"} — {a.clients?.full_name}
                  </p>
                  {a.due_date && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="size-3" /> Prazo: {formatDate(a.due_date)}
                    </p>
                  )}
                  {a.notes && <p className="text-[11px] text-muted-foreground mt-1">{a.notes}</p>}
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">{a.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="vx-card p-5">
        <h3 className="font-semibold mb-4">Clientes / Produtos sob execução</h3>
        {clientProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente em execução</p>
        ) : (
          <div className="divide-y divide-border">
            {clientProducts.map((cp: any) => (
              <button
                key={cp.id}
                onClick={() => cp.clients?.id && navigate(`/clientes/${cp.clients.id}`)}
                className="w-full flex items-center justify-between py-3 hover:bg-muted/30 px-2 rounded text-left"
              >
                <div>
                  <p className="text-sm font-medium">{cp.clients?.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">{cp.products?.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  {cp.value && <span className="text-xs tabular-nums font-medium">{formatBRL(cp.value)}</span>}
                  <Badge variant="outline" className="text-[10px]">{cp.status}</Badge>
                  <ArrowRight className="size-3 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
