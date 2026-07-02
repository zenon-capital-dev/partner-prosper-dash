import { formatBR as format } from "@/lib/datetime";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Star, Activity, CheckCircle2, AlertTriangle, Clock, FileCheck, MessageSquare, TrendingUp } from "lucide-react";
import { PaginationControl } from "@/components/ui/PaginationControl";
;
import { ptBR } from "date-fns/locale";
import { usePageSize } from "@/hooks/usePageSize";

interface Provider {
  id: string;
  name: string;
  specialty: string | null;
  internal_notes: string | null;
  internal_rating: number | null;
  active: boolean;
  user_id?: string | null;
}

interface Metrics {
  total: number;
  active: number;
  completed: number;
  late: number;
  avgDays: number;
  reports: number;
  documents: number;
  onTimeRate: number;
  lastReport: string | null;
}

const ACTIVE_STATUSES = ["em_execucao", "em_andamento", "em_analise", "aguardando_inicio", "aguardando_documentos", "pendente_cliente", "pendente_prestador", "aguardando_aprovacao"];
const COMPLETED_STATUSES = ["concluido", "concluida"];

export default function ProviderPerformance() {
  const { pageSize: __ps, setPageSize } = usePageSize();
  const PAGE_SIZE = __ps === -1 ? Number.MAX_SAFE_INTEGER : __ps;
  const [providers, setProviders] = useState<Provider[]>([]);
  const [metricsMap, setMetricsMap] = useState<Record<string, Metrics>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [ratingDraft, setRatingDraft] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = async () => {
    setLoading(true);
    const { data: provs } = await supabase.from("service_providers").select("*").order("name").limit(300);
    const list = (provs || []) as Provider[];
    setProviders(list);

    const { data: cps } = await supabase
      .from("client_products")
      .select("id, status, service_provider_id, responsible_provider_id, created_at, end_date, deadline").limit(300);
    const { data: reports } = await supabase
      .from("client_product_status_reports")
      .select("service_provider_id, reported_by, created_at").limit(300);
    const { data: docs } = await supabase
      .from("documents")
      .select("approved_by, reviewed_at, status").limit(300);

    const map: Record<string, Metrics> = {};
    list.forEach((p) => {
      const provDemands = (cps || []).filter(
        (d: any) => d.service_provider_id === p.id || d.responsible_provider_id === p.id
      );
      const completed = provDemands.filter((d: any) => COMPLETED_STATUSES.includes(d.status));
      const active = provDemands.filter((d: any) => ACTIVE_STATUSES.includes(d.status));
      const today = new Date();
      const late = active.filter((d: any) => d.deadline && new Date(d.deadline) < today);

      const durations = completed
        .filter((d: any) => d.created_at && d.end_date)
        .map((d: any) => (new Date(d.end_date).getTime() - new Date(d.created_at).getTime()) / 86400000);
      const avgDays = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

      const onTime = completed.filter(
        (d: any) => !d.deadline || (d.end_date && new Date(d.end_date) <= new Date(d.deadline))
      ).length;
      const onTimeRate = completed.length ? (onTime / completed.length) * 100 : 0;

      const userRep = (reports || []).filter(
        (r: any) => r.service_provider_id === p.id || r.reported_by === p.user_id
      );
      const lastReport = userRep
        .map((r: any) => r.created_at)
        .sort()
        .reverse()[0] || null;

      const docCount = (docs || []).filter(
        (d: any) => d.approved_by === p.user_id && d.reviewed_at
      ).length;

      map[p.id] = {
        total: provDemands.length,
        active: active.length,
        completed: completed.length,
        late: late.length,
        avgDays,
        reports: userRep.length,
        documents: docCount,
        onTimeRate,
        lastReport,
      };
    });
    setMetricsMap(map);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const totals = useMemo(() => {
    const m = Object.values(metricsMap);
    if (!m.length) return { total: 0, active: 0, completed: 0, late: 0, avgDays: 0, reports: 0, documents: 0, onTimeRate: 0 };
    return {
      total: m.reduce((s, x) => s + x.total, 0),
      active: m.reduce((s, x) => s + x.active, 0),
      completed: m.reduce((s, x) => s + x.completed, 0),
      late: m.reduce((s, x) => s + x.late, 0),
      avgDays: m.reduce((s, x) => s + x.avgDays, 0) / m.length,
      reports: m.reduce((s, x) => s + x.reports, 0),
      documents: m.reduce((s, x) => s + x.documents, 0),
      onTimeRate: m.reduce((s, x) => s + x.onTimeRate, 0) / m.length,
    };
  }, [metricsMap]);

  const totalPages = Math.max(1, Math.ceil(providers.length / PAGE_SIZE));
  const paginatedProviders = providers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openEdit = (p: Provider) => {
    setEditing(p);
    setNoteDraft(p.internal_notes || "");
    setRatingDraft(p.internal_rating?.toString() || "");
  };

  const saveNote = async () => {
    if (!editing) return;
    const rating = ratingDraft ? Number(ratingDraft) : null;
    if (rating !== null && (rating < 0 || rating > 5)) {
      toast.error("Avaliação deve estar entre 0 e 5");
      return;
    }
    const { error } = await supabase
      .from("service_providers")
      .update({ internal_notes: noteDraft, internal_rating: rating })
      .eq("id", editing.id);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success("Avaliação atualizada");
    setEditing(null);
    loadData();
  };

  const StatCard = ({ icon: Icon, label, value, color }: any) => (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-${color}/10`}>
          <Icon className={`h-5 w-5 text-${color}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Performance dos Prestadores</h1>
        <p className="text-muted-foreground">Avaliação de desempenho e produtividade</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Activity} label="Demandas recebidas" value={totals.total} color="primary" />
        <StatCard icon={Clock} label="Em andamento" value={totals.active} color="primary" />
        <StatCard icon={CheckCircle2} label="Concluídas" value={totals.completed} color="primary" />
        <StatCard icon={AlertTriangle} label="Atrasadas" value={totals.late} color="destructive" />
        <StatCard icon={Clock} label="Tempo médio (dias)" value={totals.avgDays.toFixed(1)} color="primary" />
        <StatCard icon={MessageSquare} label="Reportes enviados" value={totals.reports} color="primary" />
        <StatCard icon={FileCheck} label="Documentos analisados" value={totals.documents} color="primary" />
        <StatCard icon={TrendingUp} label="Taxa no prazo" value={`${totals.onTimeRate.toFixed(0)}%`} color="primary" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prestadores</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prestador</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead className="text-center">Ativas</TableHead>
                  <TableHead className="text-center">Concluídas</TableHead>
                  <TableHead className="text-center">Atrasadas</TableHead>
                  <TableHead className="text-center">Tempo médio</TableHead>
                  <TableHead>Último reporte</TableHead>
                  <TableHead>Avaliação</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProviders.map((p) => {
                  const m = metricsMap[p.id];
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.specialty || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{m?.active ?? 0}</TableCell>
                      <TableCell className="text-center">{m?.completed ?? 0}</TableCell>
                      <TableCell className="text-center">
                        {m?.late ? <Badge variant="destructive">{m.late}</Badge> : 0}
                      </TableCell>
                      <TableCell className="text-center">
                        {m?.avgDays ? `${m.avgDays.toFixed(1)}d` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m?.lastReport
                          ? format(new Date(m.lastReport), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-medium">
                            {p.internal_rating?.toFixed(1) || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                          Avaliar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {providers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Nenhum prestador cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={providers.length} itemsPerPage={PAGE_SIZE} pageSize={__ps} onPageSizeChange={setPageSize} />
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avaliação Interna — {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nota (0 a 5)</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={ratingDraft}
                onChange={(e) => setRatingDraft(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notas internas</label>
              <Textarea
                rows={5}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Observações sobre desempenho, qualidade, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveNote}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
