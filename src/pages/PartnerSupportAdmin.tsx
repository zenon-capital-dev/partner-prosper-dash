import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { LifeBuoy, MessageSquare, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { SupportThread } from "@/components/partner-support/SupportThread";

const PAGE_SIZE = 10;

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

export default function PartnerSupportAdmin() {
  const qc = useQueryClient();
  const [active, setActive] = useState<Ticket | null>(null);
  const [response, setResponse] = useState("");
  const [filter, setFilter] = useState<"all" | "aberto" | "em_andamento" | "fechado">("aberto");
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

  const filtered = (tickets as any[]).filter((t) => filter === "all" || t.status === filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const respond = useMutation({
    mutationFn: async (close: boolean) => {
      if (!active) return;
      if (!response.trim()) throw new Error("Escreva uma resposta");
      const { error } = await (supabase as any).from("partner_support_tickets").update({
        admin_response: response.trim(),
        responded_at: new Date().toISOString(),
        status: close ? "fechado" : "respondido",
      }).eq("id", active.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resposta enviada");
      qc.invalidateQueries({ queryKey: ["partner-support-admin"] });
      setActive(null);
      setResponse("");
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <LifeBuoy className="size-6 text-indigo-600" /> Suporte de parceiros
          </h1>
          <p className="text-sm text-slate-500 mt-1">Chamados abertos pelos seus parceiros — responda direto por aqui.</p>
        </div>
        <div className="flex gap-2">
          {(["aberto", "respondido", "fechado", "all"] as const).map((s) => (
            <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)} className={cn(filter === s && "bg-indigo-600 hover:bg-indigo-700")}>
              {s === "all" ? "Todos" : s}
            </Button>
          ))}
        </div>
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
            {paginated.map((t: any) => (
              <li key={t.id} className="p-4 hover:bg-slate-50/40 cursor-pointer" onClick={() => { setActive(t); setResponse(t.admin_response || ""); }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-900">{t.subject}</p>
                      <Badge variant="outline" className={cn("text-[10px] capitalize", t.priority === "alta" && "border-red-200 text-red-700 bg-red-50")}>{t.priority}</Badge>
                    </div>
                    <p className="text-[12px] text-slate-500">{t.partners?.full_name} · {t.partners?.email}</p>
                    <p className="text-[12.5px] text-slate-600 mt-1 line-clamp-2">{t.message}</p>
                    <p className="text-[10.5px] text-slate-400 mt-1">{formatDate(t.created_at)}</p>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] capitalize shrink-0", t.status === "aberto" ? "bg-amber-50 text-amber-700 border-amber-200" : t.status === "respondido" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-emerald-50 text-emerald-700 border-emerald-200")}>{t.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
        <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} />
      </div>

      <Dialog open={!!active} onOpenChange={(v) => { if (!v) { setActive(null); setResponse(""); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{active?.subject}</DialogTitle></DialogHeader>
          {active && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded p-3">
                <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1">{(active as any).partners?.full_name} · {(active as any).partners?.email}</p>
                <p className="text-[13px] text-slate-800 whitespace-pre-wrap">{active.message}</p>
                <p className="text-[10.5px] text-slate-400 mt-2">{formatDate(active.created_at)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1">Sua resposta</p>
                <Textarea rows={6} value={response} onChange={(e) => setResponse(e.target.value)} maxLength={2000} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => respond.mutate(false)} disabled={respond.isPending}>Salvar resposta</Button>
            <Button onClick={() => respond.mutate(true)} disabled={respond.isPending} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="size-4" /> Responder e fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
