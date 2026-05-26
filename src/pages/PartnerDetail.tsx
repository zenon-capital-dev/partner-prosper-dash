import { formatBR as format } from "@/lib/datetime";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, User, Users, Wallet, FileSignature, Building2, History } from "lucide-react";
;
import { formatBRL } from "@/lib/format";

export default function PartnerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: p } = await supabase.from("partners").select("*").eq("id", id).maybeSingle();
      setPartner(p);

      const { data: cl } = await supabase.from("clients").select("*").eq("partner_id", id);
      setClients(cl || []);

      const { data: comm } = await supabase
        .from("commissions")
        .select("*, clients(full_name), products(name)")
        .eq("partner_id", id)
        .order("created_at", { ascending: false });
      setCommissions(comm || []);

      const { data: ct } = await supabase
        .from("contracts")
        .select("*")
        .eq("partner_id", id)
        .order("created_at", { ascending: false });
      setContracts(ct || []);

      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-12 text-center text-muted-foreground">Carregando...</div>;
  if (!partner) return <div className="p-12 text-center text-destructive">Parceiro não encontrado.</div>;

  const paid = commissions.filter((c) => c.status === "paga");
  const pending = commissions.filter((c) => c.status !== "paga" && c.status !== "cancelada");
  const totalPaid = paid.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalPending = pending.reduce((s, c) => s + Number(c.amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate("/parceiros")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{partner.full_name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{partner.partner_category || partner.partner_type || "Parceiro"}</Badge>
            <Badge variant={partner.active ? "default" : "secondary"}>
              {partner.active ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Clientes indicados</p><p className="text-2xl font-bold">{clients.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Comissões pagas</p><p className="text-2xl font-bold">{formatBRL(totalPaid)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">A receber</p><p className="text-2xl font-bold">{formatBRL(totalPending)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">% Padrão</p><p className="text-2xl font-bold">{partner.commission_percent ?? 0}%</p></CardContent></Card>
      </div>

      <Tabs defaultValue="dados">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dados"><User className="h-3 w-3 mr-1" />Dados</TabsTrigger>
          <TabsTrigger value="clientes"><Users className="h-3 w-3 mr-1" />Clientes</TabsTrigger>
          <TabsTrigger value="comissoes"><Wallet className="h-3 w-3 mr-1" />Comissões</TabsTrigger>
          <TabsTrigger value="contrato"><FileSignature className="h-3 w-3 mr-1" />Contrato</TabsTrigger>
          <TabsTrigger value="bancarios"><Building2 className="h-3 w-3 mr-1" />Bancários</TabsTrigger>
          <TabsTrigger value="historico"><History className="h-3 w-3 mr-1" />Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <Card><CardContent className="p-6 grid md:grid-cols-2 gap-4 text-sm">
            <Field label="Nome" value={partner.full_name} />
            <Field label="E-mail" value={partner.email} />
            <Field label="Telefone" value={partner.phone} />
            <Field label="WhatsApp" value={partner.whatsapp} />
            <Field label="Documento" value={partner.document} />
            <Field label="Tipo" value={partner.partner_type} />
            <Field label="Categoria" value={partner.partner_category} />
            <Field label="Comissão padrão" value={`${partner.commission_percent ?? 0}%`} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="clientes" className="mt-4">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Status</TableHead><TableHead>Cadastro</TableHead></TableRow></TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/clientes/${c.id}`)}>
                    <TableCell className="font-medium">{c.full_name}</TableCell>
                    <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                    <TableCell>{format(new Date(c.created_at), "dd/MM/yyyy")}</TableCell>
                  </TableRow>
                ))}
                {clients.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum cliente indicado</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="comissoes" className="mt-4">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
              <TableBody>
                {commissions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.clients?.full_name || "—"}</TableCell>
                    <TableCell>{c.products?.name || "—"}</TableCell>
                    <TableCell>{formatBRL(Number(c.amount || 0))}</TableCell>
                    <TableCell><Badge variant="outline">{c.workflow_status || c.status}</Badge></TableCell>
                    <TableCell>{c.paid_at ? format(new Date(c.paid_at), "dd/MM/yyyy") : (c.expected_date ? format(new Date(c.expected_date), "dd/MM/yyyy") : "—")}</TableCell>
                  </TableRow>
                ))}
                {commissions.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma comissão</TableCell></TableRow>}
              </TableBody>
            </Table>
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

        <TabsContent value="bancarios" className="mt-4">
          <Card><CardContent className="p-6 grid md:grid-cols-2 gap-4 text-sm">
            <Field label="Banco" value={partner.bank_name} />
            <Field label="Agência" value={partner.bank_agency} />
            <Field label="Conta" value={partner.bank_account} />
            <Field label="Chave PIX" value={partner.pix_key} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <Card><CardContent className="p-4 space-y-2">
            {paid.length === 0 && <p className="text-muted-foreground text-sm text-center">Nenhum pagamento ainda</p>}
            {paid.map((c) => (
              <div key={c.id} className="border rounded p-3 text-sm flex justify-between">
                <div>
                  <p className="font-medium">{formatBRL(Number(c.amount))}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.paid_at ? format(new Date(c.paid_at), "dd/MM/yyyy") : "—"} · {c.payment_method || "—"}
                  </p>
                </div>
                <Badge>Pago</Badge>
              </div>
            ))}
          </CardContent></Card>
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
