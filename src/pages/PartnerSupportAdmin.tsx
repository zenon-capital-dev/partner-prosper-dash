import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { LifeBuoy, MessageSquare, UserCheck, Hand } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { SupportThread } from "@/components/partner-support/SupportThread";
import { usePageSize } from "@/hooks/usePageSize";

type Ticket = {
  id: string;
  partner_id: string;
  subject: string;
  message: string;
  priority: string;
  status: string;
  admin_response: string | null;
  responded_at: string | null;
  created_at: string;
};

type QueueFilter = "fila" | "meus" | "pendentes" | "em_andamento" | "fechado" | "all";

export default function PartnerSupportAdmin() {
  const { pageSize: __ps, setPageSize } = usePageSize();
  const PAGE_SIZE = __ps === -1 ? Number.MAX_SAFE_INTEGER : __ps;
  const qc = useQueryClient();
  const { user } = useAuth();
  const [active, setActive] = useState<Ticket | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("fila");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { setCurrentPage(1); }, [filter]);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["partner-support-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("partner_support_tickets")
        .select("*, partners(full_name, email)").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch admin display names for assignees
  const assigneeIds = useMemo(
    () => Array.from(new Set((tickets as any[]).map((t) => t.assigned_to).filter(Boolean))) as string[],
    [tickets]
  );
  const { data: assignees = {} } = useQuery({
    queryKey: ["pst-assignees", assigneeIds],
    enabled: assigneeIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase as any).from("profiles").select("id, full_name, email").in("id", assigneeIds);
      const map: Record<string, { name: string; email: string }> = {};
      (data || []).forEach((p: any) => { map[p.id] = { name: p.full_name || p.email, email: p.email }; });
      return map;
    },
  });

  const isOpen = (s: string) => s !== "fechado" && s !== "resolvido";
  const filtered = (tickets as any[]).filter((t) => {
    if (filter === "all") return true;
    if (filter === "fila") return isOpen(t.status) && !t.assigned_to;
    if (filter === "meus") return isOpen(t.status) && t.assigned_to === user?.id;
    if (filter === "pendentes") return isOpen(t.status);
    if (filter === "em_andamento") return t.status === "em_andamento";
    if (filter === "fechado") return t.status === "fechado" || t.status === "resolvido";
    return true;
  });
  const counts = {
    fila: (tickets as any[]).filter((t) => isOpen(t.status) && !t.assigned_to).length,
    meus: (tickets as any[]).filter((t) => isOpen(t.status) && t.assigned_to === user?.id).length,
    pendentes: (tickets as any[]).filter((t) => isOpen(t.status)).length,
    em_andamento: (tickets as any[]).filter((t) => t.status === "em_andamento").length,
    fechado: (tickets as any[]).filter((t) => t.status === "fechado" || t.status === "resolvido").length,
    all: (tickets as any[]).length,
  };
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const claim = useMutation({
    mutationFn: async (ticket: any) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { error } = await (supabase as any).from("partner_support_tickets").update({
        assigned_to: user.id,
        assigned_at: new Date().toISOString(),
        status: ticket.status === "aberto" ? "em_andamento" : ticket.status,
      }).eq("id", ticket.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chamado assumido");
      qc.invalidateQueries({ queryKey: ["partner-support-admin"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao assumir"),
  });

  const tabs: { key: QueueFilter; label: string; tone?: string }[] = [
    { key: "fila", label: "Fila", tone: "amber" },
    { key: "meus", label: "Meus", tone: "indigo" },
    { key: "pendentes", label: "Todos pendentes" },
    { key: "em_andamento", label: "Em andamento" },
    { key: "fechado", label: "Fechado", tone: "emerald" },
    { key: "all", label: "Todos" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <LifeBuoy className="size-6 text-indigo-600" /> Suporte de parceiros
        </h1>
        <p className="text-sm text-slate-500 mt-1">Chamados abertos pelos seus parceiros — responda direto por aqui e mantenha a conversa rolando até concluir.</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5 border border-slate-200/70 bg-white rounded-lg p-1 shadow-sm w-fit">
        {tabs.map((t) => {
          const isActive = filter === t.key;
          const count = (counts as any)[t.key] ?? 0;
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[12.5px] font-medium transition flex items-center gap-2",
                isActive ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {t.label}
              <span className={cn(
                "text-[10.5px] px-1.5 py-0.5 rounded-full font-semibold",
                isActive ? "bg-white/20 text-white" :
                  t.tone === "amber" ? "bg-amber-100 text-amber-700" :
                  t.tone === "emerald" ? "bg-emerald-100 text-emerald-700" :
                  "bg-slate-100 text-slate-600"
              )}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="size-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">Nenhum chamado neste filtro.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {paginated.map((t: any) => {
              const statusTone = t.status === "fechado" || t.status === "resolvido"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : t.status === "respondido"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : t.status === "em_andamento"
                    ? "bg-violet-50 text-violet-700 border-violet-200"
                    : "bg-amber-50 text-amber-700 border-amber-200";
              return (
                <li key={t.id} className="p-4 hover:bg-slate-50/40 cursor-pointer" onClick={() => setActive(t)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-slate-900">{t.subject}</p>
                        <Badge variant="outline" className={cn("text-[10px] capitalize", t.priority === "alta" && "border-red-200 text-red-700 bg-red-50")}>{t.priority}</Badge>
                        {t.assigned_to ? (
                          <Badge variant="outline" className={cn(
                            "text-[10px] gap-1",
                            t.assigned_to === user?.id ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-slate-50 text-slate-600 border-slate-200"
                          )}>
                            <UserCheck className="size-3" />
                            {t.assigned_to === user?.id ? "Você" : ((assignees as any)[t.assigned_to]?.name || "Atribuído")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Sem responsável</Badge>
                        )}
                      </div>
                      <p className="text-[12px] text-slate-500">{t.partners?.full_name} · {t.partners?.email}</p>
                      <p className="text-[12.5px] text-slate-600 mt-1 line-clamp-2">{t.message}</p>
                      <p className="text-[10.5px] text-slate-400 mt-1">{formatDate(t.created_at)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge variant="outline" className={cn("text-[10px] capitalize", statusTone)}>{(t.status || "aberto").replace("_"," ")}</Badge>
                      {!t.assigned_to && t.status !== "fechado" && t.status !== "resolvido" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); claim.mutate(t); }}
                          disabled={claim.isPending}
                          className="gap-1.5 h-7 text-[11.5px] text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                        >
                          <Hand className="size-3" /> Assumir
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} pageSize={__ps} onPageSizeChange={setPageSize} />
      </div>

      <Dialog open={!!active} onOpenChange={(v) => { if (!v) { setActive(null); qc.invalidateQueries({ queryKey: ["partner-support-admin"] }); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {active?.subject}
              <Badge variant="outline" className="text-[10px] capitalize">{((active as any)?.status || "aberto").replace("_"," ")}</Badge>
            </DialogTitle>
            {active && (
              <p className="text-[12px] text-slate-500">{(active as any).partners?.full_name} · {(active as any).partners?.email}</p>
            )}
          </DialogHeader>
          {active && (
            <SupportThread
              ticket={active}
              viewerRole="admin"
              onChanged={() => qc.invalidateQueries({ queryKey: ["partner-support-admin"] })}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
