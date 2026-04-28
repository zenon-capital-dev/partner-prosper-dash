import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, Building2, MapPin, Plus, FileText, ShoppingBag, Pencil } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL, formatDate, initials } from "@/lib/format";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { SaleFormDialog } from "@/components/sales/SaleFormDialog";
import { DocumentDialog } from "@/components/documents/DocumentDialog";
import { toast } from "sonner";

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);

  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, partners(full_name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: sales } = useQuery({
    queryKey: ["client-sales", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("*, products(name, product_categories(name, color))")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: docs } = useQuery({
    queryKey: ["client-docs", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const totalRevenue = (sales ?? []).reduce((s: number, x: any) => s + Number(x.amount), 0);

  if (!client) {
    return <div className="p-12 text-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
      <button onClick={() => navigate("/clientes")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="size-4" /> Voltar para clientes
      </button>

      <div className="vx-card p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-2xl bg-gradient-primary text-white flex items-center justify-center text-xl font-bold">
              {initials(client.full_name)}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">{client.full_name}</h1>
              {client.company && <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1"><Building2 className="size-3.5" /> {client.company}</p>}
              <div className="flex items-center gap-2 mt-3">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                  client.status === "ativo" ? "bg-success-muted text-success" :
                  client.status === "prospecto" ? "bg-warning-muted text-warning" :
                  "bg-muted text-muted-foreground"
                }`}>
                  <span className="size-1.5 rounded-full bg-current" /> {client.status}
                </span>
                {client.partners && (
                  <span className="text-xs text-muted-foreground">Indicado por <strong className="text-foreground">{client.partners.full_name}</strong></span>
                )}
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => setEditOpen(true)} className="gap-2"><Pencil className="size-4" /> Editar</Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Email</p>
            <p className="text-sm flex items-center gap-1.5 mt-1"><Mail className="size-3.5 text-muted-foreground" /> {client.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Telefone</p>
            <p className="text-sm flex items-center gap-1.5 mt-1"><Phone className="size-3.5 text-muted-foreground" /> {client.phone ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">CPF/CNPJ</p>
            <p className="text-sm vx-mono mt-1">{client.document ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Cidade/UF</p>
            <p className="text-sm flex items-center gap-1.5 mt-1"><MapPin className="size-3.5 text-muted-foreground" /> {[client.city, client.state].filter(Boolean).join("/") || "—"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="vx-stat-card">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Faturado</p>
          <p className="font-display text-2xl font-bold mt-2 vx-mono">{formatBRL(totalRevenue)}</p>
        </div>
        <div className="vx-stat-card">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Produtos Adquiridos</p>
          <p className="font-display text-2xl font-bold mt-2 vx-mono">{sales?.length ?? 0}</p>
        </div>
        <div className="vx-stat-card">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Documentos</p>
          <p className="font-display text-2xl font-bold mt-2 vx-mono">{docs?.length ?? 0}</p>
        </div>
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales"><ShoppingBag className="size-4 mr-2" /> Produtos / Vendas</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="size-4 mr-2" /> Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4">
          <div className="vx-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold">Produtos contratados</p>
              <Button size="sm" onClick={() => setSaleOpen(true)} className="gap-2 bg-gradient-primary hover:opacity-90"><Plus className="size-4" /> Adicionar produto</Button>
            </div>
            {(sales ?? []).length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">Este cliente ainda não tem produtos vinculados.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3 text-left font-semibold">Produto</th>
                    <th className="px-6 py-3 text-left font-semibold">Categoria</th>
                    <th className="px-6 py-3 text-left font-semibold">Valor</th>
                    <th className="px-6 py-3 text-left font-semibold">Status</th>
                    <th className="px-6 py-3 text-left font-semibold">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sales?.map((s: any) => (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-6 py-4 font-medium">{s.products?.name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase" style={{ background: `${s.products?.product_categories?.color}20`, color: s.products?.product_categories?.color }}>
                          {s.products?.product_categories?.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 vx-mono font-semibold">{formatBRL(s.amount)}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] uppercase font-semibold">{s.status.replace("_", " ")}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">{formatDate(s.sale_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <div className="vx-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold">Documentos do cliente</p>
              <Button size="sm" onClick={() => setDocOpen(true)} className="gap-2 bg-gradient-primary hover:opacity-90"><Plus className="size-4" /> Solicitar documento</Button>
            </div>
            {(docs ?? []).length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">Nenhum documento solicitado.</div>
            ) : (
              <div className="divide-y divide-border">
                {docs?.map((d: any) => (
                  <div key={d.id} className="px-6 py-4 flex items-center justify-between hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-primary-muted text-primary flex items-center justify-center"><FileText className="size-4" /></div>
                      <div>
                        <p className="text-sm font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.description || "Sem descrição"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        d.status === "aprovado" ? "bg-success-muted text-success" :
                        d.status === "enviado" ? "bg-info-muted text-info" :
                        d.status === "rejeitado" ? "bg-destructive-muted text-destructive" :
                        "bg-warning-muted text-warning"
                      }`}>{d.status}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(d.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} client={client} onCreated={() => qc.invalidateQueries({ queryKey: ["client", id] })} />
      <SaleFormDialog open={saleOpen} onOpenChange={setSaleOpen} clientId={id!} onCreated={() => { qc.invalidateQueries({ queryKey: ["client-sales", id] }); toast.success("Venda registrada"); }} />
      <DocumentDialog open={docOpen} onOpenChange={setDocOpen} clientId={id!} onCreated={() => qc.invalidateQueries({ queryKey: ["client-docs", id] })} />
    </div>
  );
}
