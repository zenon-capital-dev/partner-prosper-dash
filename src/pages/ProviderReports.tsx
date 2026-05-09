import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardList, Eye, Search } from "lucide-react";
import { Link } from "react-router-dom";

const STATUS_LABELS: Record<string, string> = {
  aguardando_documentos: "Aguardando Documentos",
  em_analise: "Em Análise",
  aguardando_cliente: "Aguardando Cliente",
  em_andamento: "Em Andamento",
  pendente_correcao: "Pendente de Correção",
  documento_insuficiente: "Documento Insuficiente",
  pendente_cliente: "Pendente Cliente",
  em_execucao: "Em Execução",
  aguardando_validacao: "Aguardando Validação",
  finalizado: "Finalizado",
  concluido: "Concluído",
  atencao_admin: "Atenção do Admin",
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (["finalizado", "concluido"].includes(s)) return "default";
  if (["atencao_admin", "documento_insuficiente", "pendente_correcao"].includes(s)) return "destructive";
  if (["em_andamento", "em_execucao", "em_analise"].includes(s)) return "secondary";
  return "outline";
};

export default function ProviderReports() {
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pendingFilter, setPendingFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selected, setSelected] = useState<any | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["admin-provider-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_product_status_reports")
        .select(`
          id, status, notes, pending, next_steps, created_at,
          service_provider_id,
          client_product_id,
          service_providers ( id, name ),
          client_products (
            id, custom_product_name,
            clients ( id, full_name, company ),
            products ( id, name )
          )
        `)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const providers = useMemo(() => {
    const m = new Map<string, string>();
    reports.forEach((r: any) => {
      const sp = r.service_providers;
      if (sp?.id) m.set(sp.id, sp.name);
    });
    return [...m.entries()];
  }, [reports]);

  const clients = useMemo(() => {
    const m = new Map<string, string>();
    reports.forEach((r: any) => {
      const c = r.client_products?.clients;
      if (c?.id) m.set(c.id, c.full_name);
    });
    return [...m.entries()];
  }, [reports]);

  const products = useMemo(() => {
    const m = new Map<string, string>();
    reports.forEach((r: any) => {
      const p = r.client_products?.products;
      const name = p?.name ?? r.client_products?.custom_product_name;
      const id = p?.id ?? r.client_products?.id;
      if (id && name) m.set(id, name);
    });
    return [...m.entries()];
  }, [reports]);

  const filtered = useMemo(() => {
    return reports.filter((r: any) => {
      const provName = r.service_providers?.name ?? "";
      const clientName = r.client_products?.clients?.full_name ?? "";
      const productName = r.client_products?.products?.name ?? r.client_products?.custom_product_name ?? "";
      const text = `${provName} ${clientName} ${productName} ${r.notes ?? ""} ${r.pending ?? ""}`.toLowerCase();

      if (search && !text.includes(search.toLowerCase())) return false;
      if (providerFilter !== "all" && r.service_providers?.id !== providerFilter) return false;
      if (clientFilter !== "all" && r.client_products?.clients?.id !== clientFilter) return false;
      if (productFilter !== "all") {
        const pid = r.client_products?.products?.id ?? r.client_products?.id;
        if (pid !== productFilter) return false;
      }
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (pendingFilter === "with" && !r.pending) return false;
      if (pendingFilter === "without" && r.pending) return false;
      if (dateFrom && new Date(r.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(r.created_at) > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [reports, search, providerFilter, clientFilter, productFilter, statusFilter, pendingFilter, dateFrom, dateTo]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Reportes dos Prestadores"
        description="Acompanhe todos os reportes enviados pelos prestadores de serviço."
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar prestador, cliente, produto, observação..."
                className="pl-9"
              />
            </div>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger><SelectValue placeholder="Prestador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos prestadores</SelectItem>
                {providers.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos clientes</SelectItem>
                {clients.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos produtos</SelectItem>
                {products.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={pendingFilter} onValueChange={setPendingFilter}>
              <SelectTrigger><SelectValue placeholder="Pendência" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="with">Com pendência</SelectItem>
                <SelectItem value="without">Sem pendência</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="De" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="Até" />
          </div>

          <div className="text-sm text-muted-foreground">
            {filtered.length} reporte{filtered.length === 1 ? "" : "s"} encontrado{filtered.length === 1 ? "" : "s"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Prestador</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pendência</TableHead>
                <TableHead>Próximo passo</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum reporte encontrado.</TableCell></TableRow>
              ) : filtered.map((r: any) => {
                const productName = r.client_products?.products?.name ?? r.client_products?.custom_product_name ?? "—";
                const clientName = r.client_products?.clients?.full_name ?? "—";
                const clientId = r.client_products?.clients?.id;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{r.service_providers?.name ?? "—"}</TableCell>
                    <TableCell>
                      {clientId ? (
                        <Link to={`/clientes/${clientId}`} className="hover:underline text-primary">
                          {clientName}
                        </Link>
                      ) : clientName}
                    </TableCell>
                    <TableCell>{productName}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {r.pending || "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {r.next_steps || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reporte do Prestador</DialogTitle>
            <DialogDescription>
              {selected && format(new Date(selected.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Prestador</div>
                  <div className="font-medium">{selected.service_providers?.name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Cliente</div>
                  <div className="font-medium">{selected.client_products?.clients?.full_name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Produto</div>
                  <div className="font-medium">
                    {selected.client_products?.products?.name ?? selected.client_products?.custom_product_name ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <Badge variant={statusVariant(selected.status)}>
                    {STATUS_LABELS[selected.status] ?? selected.status}
                  </Badge>
                </div>
              </div>

              {selected.notes && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Descrição do andamento</div>
                  <div className="rounded-md border p-3 text-sm whitespace-pre-wrap">{selected.notes}</div>
                </div>
              )}
              {selected.pending && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Pendências</div>
                  <div className="rounded-md border p-3 text-sm whitespace-pre-wrap">{selected.pending}</div>
                </div>
              )}
              {selected.next_steps && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Próximos passos</div>
                  <div className="rounded-md border p-3 text-sm whitespace-pre-wrap">{selected.next_steps}</div>
                </div>
              )}

              {selected.client_products?.clients?.id && (
                <div className="flex justify-end">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/clientes/${selected.client_products.clients.id}`}>
                      Abrir cliente
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
