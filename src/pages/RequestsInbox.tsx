import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { ArrowUpRight, Inbox, Clock, CheckCircle2, MessageSquare, X, Plus } from "lucide-react";

type Role = "admin" | "parceiro" | "prestador" | "cliente" | "colaborador";

const KIND: Record<string, string> = {
  documento: "Documento",
  informacao: "Informação",
  duvida: "Dúvida",
  outro: "Outro",
};

const STATUS_META: Record<string, { label: string; tone: string; icon: any }> = {
  aberta: { label: "Aberta", tone: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  respondida: { label: "Respondida", tone: "bg-blue-50 text-blue-700 border-blue-200", icon: MessageSquare },
  resolvida: { label: "Resolvida", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  cancelada: { label: "Cancelada", tone: "bg-slate-100 text-slate-600 border-slate-200", icon: X },
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Zenon (Admin)", parceiro: "Parceiro", prestador: "Prestador",
  cliente: "Cliente", colaborador: "Colaborador",
};

const TARGETS_BY_ROLE: Record<Role, Role[]> = {
  admin: ["cliente", "prestador", "parceiro", "colaborador"],
  parceiro: ["cliente", "admin", "prestador"],
  prestador: ["cliente", "admin", "parceiro"],
  cliente: ["admin", "prestador", "parceiro"],
  colaborador: ["cliente", "admin", "prestador", "parceiro"],
};

function roleForInbox(roles: string[]): Role {
  if (roles.includes("super_admin") || roles.includes("admin") || roles.includes("admin_secondary")) return "admin";
  if (roles.includes("parceiro")) return "parceiro";
  if (roles.includes("prestador")) return "prestador";
  if (roles.includes("colaborador")) return "colaborador";
  return "cliente";
}

function demandLinkFor(role: string, clientProductId: string): string {
  if (role === "admin") return `/demandas/${clientProductId}`;
  if (role === "parceiro") return `/parceiro?demanda=${clientProductId}`;
  if (role === "prestador") return `/prestador?demanda=${clientProductId}`;
  if (role === "cliente") return `/cliente?tab=servicos&demanda=${clientProductId}`;
  return `/demandas/${clientProductId}`;
}

export default function RequestsInbox() {
  const { roles, user } = useAuth();
  const qc = useQueryClient();
  const myRole = useMemo(() => roleForInbox(roles as any), [roles]);
  const [tab, setTab] = useState<"pendentes" | "todas" | "enviadas">("pendentes");
  const [newOpen, setNewOpen] = useState(false);
  const targets = TARGETS_BY_ROLE[myRole];
  const [form, setForm] = useState({
    client_product_id: "",
    target_role: targets[0],
    kind: "informacao" as "documento" | "informacao" | "duvida" | "outro",
    title: "",
    description: "",
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["requests-inbox", myRole, user?.id],
    queryFn: async () => {
      let q = supabase
        .from("demand_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (myRole !== "admin") {
        // Show items either targeted to me OR sent by me
        q = q.or(`target_role.eq.${myRole},requested_by.eq.${user?.id}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  // Demands the current user can create requests on (RLS scopes automatically)
  const { data: demands = [] } = useQuery({
    queryKey: ["requests-inbox-demands", user?.id],
    enabled: !!user?.id && newOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_products")
        .select("id, clients!client_products_client_id_fkey(full_name), products!client_products_product_id_fkey(name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const productIds = useMemo(
    () => Array.from(new Set(items.map((i: any) => i.client_product_id).filter(Boolean))),
    [items]
  );

  const { data: productMap = {} } = useQuery({
    queryKey: ["requests-inbox-products", productIds.join(",")],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_products")
        .select("id, client_id, product_id, clients!client_products_client_id_fkey(full_name), products!client_products_product_id_fkey(name)")
        .in("id", productIds as string[]);
      const map: Record<string, { client: string; product: string }> = {};
      (data ?? []).forEach((cp: any) => {
        map[cp.id] = {
          client: cp.clients?.full_name ?? "Cliente",
          product: cp.products?.name ?? "Serviço",
        };
      });
      return map;
    },
  });

  const filtered = useMemo(() => {
    if (tab === "pendentes") return items.filter((i: any) => i.status === "aberta" || i.status === "respondida");
    if (tab === "enviadas") return items.filter((i: any) => i.requested_by === user?.id);
    return items;
  }, [items, tab, user?.id]);

  const counts = useMemo(() => ({
    pendentes: items.filter((i: any) => i.status === "aberta" || i.status === "respondida").length,
    todas: items.length,
    enviadas: items.filter((i: any) => i.requested_by === user?.id).length,
  }), [items, user?.id]);

  const openNew = () => {
    setForm({
      client_product_id: "",
      target_role: targets[0],
      kind: "informacao",
      title: "",
      description: "",
    });
    setNewOpen(true);
  };

  const submitNew = async () => {
    if (!form.client_product_id) { toast.error("Escolha uma demanda"); return; }
    if (!form.title.trim()) { toast.error("Informe um título"); return; }
    const { error } = await supabase.from("demand_requests").insert({
      client_product_id: form.client_product_id,
      requested_by: user?.id,
      requested_role: myRole,
      target_role: form.target_role,
      kind: form.kind,
      title: form.title.trim(),
      description: form.description.trim() || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Solicitação enviada");
    setNewOpen(false);
    qc.invalidateQueries({ queryKey: ["requests-inbox"] });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
          <Inbox className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">Caixa de solicitações</h1>
          <p className="text-sm text-slate-500">
            Pedidos entre {ROLE_LABEL[myRole]} e demais envolvidos nas demandas.
          </p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nova solicitação
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes ({counts.pendentes})</TabsTrigger>
          <TabsTrigger value="enviadas">Enviadas ({counts.enviadas})</TabsTrigger>
          <TabsTrigger value="todas">Todas ({counts.todas})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <Card><CardContent className="p-8 text-sm text-slate-500">Carregando...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-slate-500">
          Nenhuma solicitação {tab === "pendentes" ? "pendente" : tab === "enviadas" ? "enviada" : ""}.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((it: any) => {
            const meta = STATUS_META[it.status] ?? STATUS_META.aberta;
            const Icon = meta.icon;
            const ctx = productMap[it.client_product_id];
            return (
              <Card key={it.id} className="border-slate-200/70">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={meta.tone}>
                      <Icon className="w-3 h-3 mr-1" />{meta.label}
                    </Badge>
                    <Badge variant="outline">{KIND[it.kind] ?? it.kind}</Badge>
                    <Badge variant="outline" className="bg-slate-50">
                      De {ROLE_LABEL[it.requested_role] ?? it.requested_role} → {ROLE_LABEL[it.target_role] ?? it.target_role}
                    </Badge>
                    <span className="text-xs text-slate-400 ml-auto">{formatDate(it.created_at)}</span>
                  </div>
                  <CardTitle className="text-sm font-medium text-slate-900 mt-2">
                    {it.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {it.description && <p className="text-sm text-slate-600 whitespace-pre-wrap">{it.description}</p>}
                  {it.response && (
                    <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded p-2">
                      <div className="text-xs font-medium text-slate-500 mb-1">Resposta</div>
                      {it.response}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-xs text-slate-500">
                      {ctx ? <>Demanda: <span className="font-medium text-slate-700">{ctx.client}</span> · {ctx.product}</> : null}
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to={demandLinkFor(myRole, it.client_product_id)}>
                        Abrir demanda <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Demanda</Label>
              <Select
                value={form.client_product_id}
                onValueChange={(v) => setForm({ ...form, client_product_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Escolha a demanda" /></SelectTrigger>
                <SelectContent>
                  {demands.length === 0 ? (
                    <div className="p-3 text-xs text-slate-500">Nenhuma demanda disponível</div>
                  ) : demands.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {(d.clients?.full_name ?? "Cliente")} · {(d.products?.name ?? "Serviço")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Enviar para</Label>
                <Select
                  value={form.target_role}
                  onValueChange={(v) => setForm({ ...form, target_role: v as Role })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {targets.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => setForm({ ...form, kind: v as any })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="informacao">Informação</SelectItem>
                    <SelectItem value="documento">Documento</SelectItem>
                    <SelectItem value="duvida">Dúvida</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Enviar comprovante de pagamento"
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detalhe o que você precisa..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={submitNew}>Enviar solicitação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
