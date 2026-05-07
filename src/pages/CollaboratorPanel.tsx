import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, Users, FileText, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/format";

export default function CollaboratorPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: tasks = [] } = useQuery({
    queryKey: ["collab-tasks", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", user!.id)
        .order("due_date", { ascending: true });
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["collab-clients", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, status, sale_value")
        .eq("responsible_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["collab-docs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, name, status, due_date, clients(full_name)")
        .in("status", ["solicitado", "enviado", "em_analise"])
        .order("due_date", { ascending: true })
        .limit(10);
      return data ?? [];
    },
  });

  const openTasks = tasks.filter((t: any) => t.status !== "Concluída" && t.status !== "Cancelada");
  const doneTasks = tasks.filter((t: any) => t.status === "Concluída");

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in space-y-6">
      <PageHeader title="Painel do Colaborador" description="Suas tarefas, clientes e documentos pendentes." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tarefas abertas" value={String(openTasks.length)} icon={ClipboardList} iconColor="warning" />
        <StatCard label="Tarefas concluídas" value={String(doneTasks.length)} icon={CheckCircle2} iconColor="success" />
        <StatCard label="Clientes sob responsabilidade" value={String(clients.length)} icon={Users} iconColor="primary" />
        <StatCard label="Docs pendentes (geral)" value={String(docs.length)} icon={FileText} iconColor="info" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="vx-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Minhas tarefas</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate("/tarefas")} className="gap-1 text-xs">
              Ver todas <ArrowRight className="size-3" />
            </Button>
          </div>
          {openTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa aberta</p>
          ) : (
            <div className="space-y-2">
              {openTasks.slice(0, 8).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    {t.due_date && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="size-3" /> {formatDate(t.due_date)}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="vx-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Clientes sob minha responsabilidade</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate("/clientes")} className="gap-1 text-xs">
              Ver todos <ArrowRight className="size-3" />
            </Button>
          </div>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente atribuído</p>
          ) : (
            <div className="space-y-2">
              {clients.slice(0, 8).map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/clientes/${c.id}`)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition text-left"
                >
                  <span className="text-sm font-medium truncate">{c.full_name}</span>
                  <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="vx-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Documentos pendentes</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate("/documentos")} className="gap-1 text-xs">
            Gerenciar <ArrowRight className="size-3" />
          </Button>
        </div>
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento pendente</p>
        ) : (
          <div className="divide-y divide-border">
            {docs.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{d.name}</p>
                  <p className="text-[11px] text-muted-foreground">{d.clients?.full_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {d.due_date && <span className="text-[11px] text-muted-foreground">{formatDate(d.due_date)}</span>}
                  <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
