import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import { ArrowUpRight, Inbox, Clock, CheckCircle2, MessageSquare, X } from "lucide-react";

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
  admin: "Admin", parceiro: "Parceiro", prestador: "Prestador",
  cliente: "Cliente", colaborador: "Colaborador",
};

function roleForInbox(roles: string[]): "admin" | "parceiro" | "prestador" | "cliente" | "colaborador" {
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
  const { roles } = useAuth();
  const myRole = useMemo(() => roleForInbox(roles as any), [roles]);
  const [tab, setTab] = useState<"pendentes" | "todas">("pendentes");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["requests-inbox", myRole],
    queryFn: async () => {
      let q = supabase
        .from("demand_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      // For non-admin, filter to items targeted to their role.
      if (myRole !== "admin") q = q.eq("target_role", myRole);
      const { data, error } = await q;
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
        .select("id, client_id, product_id, clients(full_name), products(name)")
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
    return items;
  }, [items, tab]);

  const counts = useMemo(() => ({
    pendentes: items.filter((i: any) => i.status === "aberta" || i.status === "respondida").length,
    todas: items.length,
  }), [items]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
          <Inbox className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Caixa de solicitações</h1>
          <p className="text-sm text-slate-500">
            Pedidos entre {ROLE_LABEL[myRole]} e demais envolvidos nas demandas.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes ({counts.pendentes})</TabsTrigger>
          <TabsTrigger value="todas">Todas ({counts.todas})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <Card><CardContent className="p-8 text-sm text-slate-500">Carregando...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-slate-500">
          Nenhuma solicitação {tab === "pendentes" ? "pendente" : ""}.
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
    </div>
  );
}
