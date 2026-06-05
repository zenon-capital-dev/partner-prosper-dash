import { formatBR as format } from "@/lib/datetime";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, User, Briefcase, ClipboardList, FileText, FileSignature, TrendingUp, CreditCard, MessageSquare, Star, KeyRound } from "lucide-react";
import { CredentialsManager } from "@/components/CredentialsManager";
;
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/format";

export default function ProviderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<any>(null);
  const [demands, setDemands] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: p } = await supabase.from("service_providers").select("*").eq("id", id).maybeSingle();
      setProvider(p);

      const { data: d } = await supabase
        .from("client_products")
        .select("*, clients(full_name), products(name)")
        .or(`service_provider_id.eq.${id},responsible_provider_id.eq.${id}`);
      setDemands(d || []);

      const { data: r } = await supabase
        .from("client_product_status_reports")
        .select("*")
        .eq("service_provider_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      setReports(r || []);

      if (p?.user_id) {
        const { data: docs } = await supabase
          .from("documents")
          .select("*")
          .eq("approved_by", p.user_id)
          .order("reviewed_at", { ascending: false })
          .limit(50);
        setDocuments(docs || []);
      }

      const { data: c } = await supabase
        .from("contracts")
        .select("*")
        .eq("provider_id", id)
        .order("created_at", { ascending: false });
      setContracts(c || []);

      // Commissions for the provider via splits
      const { data: splits } = await supabase
        .from("commission_splits")
        .select("*, sales(clients(full_name), products(name))")
        .eq("beneficiary_type", "service_provider")
        .eq("beneficiary_id", id)
        .order("created_at", { ascending: false });
      setCommissions(splits || []);

      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-12 text-center text-muted-foreground">Carregando...</div>;
  if (!provider) return <div className="p-12 text-center text-destructive">Prestador não encontrado.</div>;

  const active = demands.filter((d) => !["concluido", "concluida"].includes(d.status));
  const completed = demands.filter((d) => ["concluido", "concluida"].includes(d.status));
  const today = new Date();
  const late = active.filter((d) => d.deadline && new Date(d.deadline) < today);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate("/prestadores")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{provider.name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{provider.specialty || "Sem especialidade"}</Badge>
            <Badge variant={provider.active ? "default" : "secondary"}>
              {provider.active ? "Ativo" : "Inativo"}
            </Badge>
            {provider.internal_rating != null && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                {Number(provider.internal_rating).toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Demandas ativas</p><p className="text-2xl font-bold">{active.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Concluídas</p><p className="text-2xl font-bold">{completed.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Atrasadas</p><p className="text-2xl font-bold text-destructive">{late.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Reportes</p><p className="text-2xl font-bold">{reports.length}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="dados">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dados"><User className="h-3 w-3 mr-1" />Dados</TabsTrigger>
          <TabsTrigger value="especialidade"><Briefcase className="h-3 w-3 mr-1" />Especialidade</TabsTrigger>
          <TabsTrigger value="demandas"><ClipboardList className="h-3 w-3 mr-1" />Demandas</TabsTrigger>
          <TabsTrigger value="reportes"><MessageSquare className="h-3 w-3 mr-1" />Reportes</TabsTrigger>
          <TabsTrigger value="documentos"><FileText className="h-3 w-3 mr-1" />Documentos</TabsTrigger>
          <TabsTrigger value="performance"><TrendingUp className="h-3 w-3 mr-1" />Performance</TabsTrigger>
          <TabsTrigger value="contrato"><FileSignature className="h-3 w-3 mr-1" />Contrato</TabsTrigger>
          <TabsTrigger value="pagamento"><CreditCard className="h-3 w-3 mr-1" />Pagamento</TabsTrigger>
          <TabsTrigger value="acesso"><KeyRound className="h-3 w-3 mr-1" />Acesso</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <Card><CardContent className="p-6 grid md:grid-cols-2 gap-4 text-sm">
            <Field label="Nome" value={provider.name} />
            <Field label="E-mail" value={provider.email} />
            <Field label="Telefone" value={provider.phone} />
            <Field label="Documento" value={provider.document_number} />
            <Field label="Especialidade" value={provider.specialty} />
            <Field label="Status" value={provider.active ? "Ativo" : "Inativo"} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="especialidade" className="mt-4">
          <Card><CardContent className="p-6 space-y-2 text-sm">
            <Field label="Área" value={provider.specialty} />
            <Field label="Notas internas" value={provider.internal_notes} />
            <Field label="Avaliação" value={provider.internal_rating != null ? `${provider.internal_rating}/5` : "—"} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="demandas" className="mt-4">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead>Status</TableHead><TableHead>Prazo</TableHead></TableRow></TableHeader>
              <TableBody>
                {demands.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.clients?.full_name || "—"}</TableCell>
                    <TableCell>{d.products?.name || d.custom_product_name || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{d.status}</Badge></TableCell>
                    <TableCell>{d.deadline ? format(new Date(d.deadline), "dd/MM/yyyy") : "—"}</TableCell>
                  </TableRow>
                ))}
                {demands.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma demanda</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="reportes" className="mt-4">
          <Card><CardContent className="p-4 space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="border rounded p-3 text-sm">
                <div className="flex justify-between mb-1">
                  <Badge variant="outline">{r.status}</Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                </div>
                <p>{r.notes || "—"}</p>
              </div>
            ))}
            {reports.length === 0 && <p className="text-muted-foreground text-sm text-center">Nenhum reporte</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="documentos" className="mt-4">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
              <TableBody>
                {documents.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.name}</TableCell>
                    <TableCell><Badge variant="outline">{d.status}</Badge></TableCell>
                    <TableCell>{d.reviewed_at ? format(new Date(d.reviewed_at), "dd/MM/yyyy") : "—"}</TableCell>
                  </TableRow>
                ))}
                {documents.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum documento analisado</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <Card><CardContent className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Field label="Total demandas" value={demands.length} />
            <Field label="Concluídas" value={completed.length} />
            <Field label="Atrasadas" value={late.length} />
            <Field label="Reportes" value={reports.length} />
            <Field label="Documentos" value={documents.length} />
            <Field label="Avaliação" value={provider.internal_rating != null ? `${provider.internal_rating}/5` : "—"} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="contrato" className="mt-4">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Status</TableHead><TableHead>Validade</TableHead></TableRow></TableHeader>
              <TableBody>
                {contracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                    <TableCell>{c.expires_at ? format(new Date(c.expires_at), "dd/MM/yyyy") : "—"}</TableCell>
                  </TableRow>
                ))}
                {contracts.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum contrato</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="pagamento" className="mt-4">
          <Card><CardContent className="p-4 space-y-2">
            {commissions.map((c) => (
              <div key={c.id} className="border rounded p-3 text-sm flex justify-between">
                <div>
                  <p className="font-medium">{formatBRL(Number(c.amount))}</p>
                  <p className="text-xs text-muted-foreground">{c.payment_method || "—"}</p>
                </div>
                <Badge variant="outline">{c.status}</Badge>
              </div>
            ))}
            {commissions.length === 0 && <p className="text-muted-foreground text-sm text-center">Sem pagamentos registrados</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="acesso" className="mt-4">
          <CredentialsManager userId={provider.user_id} currentEmail={provider.email} entityLabel="prestador" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
