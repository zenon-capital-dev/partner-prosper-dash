import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Package, User, UserCog, ClipboardCheck,
  Plus, Calendar, DollarSign, Activity, Handshake, UserPlus,
  MoreVertical, ExternalLink, Trash2, Clock, CheckCircle2,
  PauseCircle, PlayCircle, XCircle, FileText, MessageSquare,
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DelegateProviderDialog } from "@/components/clients/DelegateProviderDialog";
import { SaleFormDialog } from "@/components/sales/SaleFormDialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ClientProductSteps } from "./ClientProductSteps";
import { confirmAction } from "@/lib/confirm";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const STATUS_OPTIONS = [
  { value: "aguardando_inicio", label: "Aguardando início" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "pausado", label: "Pausado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

const STATUS_STYLE: Record<string, string> = {
  aguardando_inicio: "bg-slate-100 text-slate-600 border-slate-200",
  em_andamento: "bg-indigo-50 text-indigo-700 border-indigo-200",
  pausado: "bg-amber-50 text-amber-700 border-amber-200",
  concluido: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelado: "bg-rose-50 text-rose-700 border-rose-200",
  ativo: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function ClientProducts({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [delegateTarget, setDelegateTarget] = useState<{ id: string; providerId?: string | null; productName?: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deadlineTarget, setDeadlineTarget] = useState<{ id: string; current: string | null } | null>(null);
  const [deadlineValue, setDeadlineValue] = useState("");
  const [partnerTarget, setPartnerTarget] = useState<{ id: string; current: string | null } | null>(null);
  const [referrerTarget, setReferrerTarget] = useState<{ id: string; current: string | null } | null>(null);
  const [editSale, setEditSale] = useState<any>(null);

  const openEditSale = async (saleId: string) => {
    const { data, error } = await supabase.from("sales").select("*").eq("id", saleId).maybeSingle();
    if (error || !data) { toast.error(error?.message || "Venda não encontrada"); return; }
    setEditSale(data);
  };


  // Lista de parceiros / indicadores ativos para edição rápida
  const { data: partners = [] } = useQuery({
    queryKey: ["client-products-partners-select"],
    queryFn: async () => (await supabase.from("partners").select("id, full_name").eq("active", true).order("full_name")).data ?? [],
  });
  const { data: referrers = [] } = useQuery({
    queryKey: ["client-products-referrers-select"],
    queryFn: async () => (await supabase.from("referrers").select("id, full_name").eq("active", true).order("full_name")).data ?? [],
  });

  // Vínculos parceiro / indicador via tabela sales (1:1 com client_products via product+client)
  const { data: linksBySale = {} } = useQuery({
    queryKey: ["client-sales-links", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("id, product_id, partner_id, referrer_id, partner:partners(id, full_name), referrer:referrers(id, full_name)")
        .eq("client_id", clientId);
      const map: Record<string, any> = {};
      (data ?? []).forEach((s: any) => { map[s.product_id] = s; });
      return map;
    },
  });

  const { data: clientProducts = [], isLoading } = useQuery({
    queryKey: ["client-products", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_products")
        .select(`
          id, status, value, deadline, start_date, end_date, created_at,
          product_id, service_provider_id, responsible_employee_id,
          custom_product_name, sale_id, client_id,
          products(name, description),
          service_providers:service_provider_id(id, name, specialty)
        `)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    staleTime: 60_000,
  });


  const cpIds = clientProducts.map((c: any) => c.id);

  const { data: latestReports = {} } = useQuery({
    queryKey: ["latest-status-reports", cpIds.join(",")],
    enabled: cpIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_product_status_reports")
        .select("client_product_id, status, notes, created_at")
        .in("client_product_id", cpIds)
        .order("created_at", { ascending: false })
        .limit(200);
      const map: Record<string, any> = {};
      (data ?? []).forEach((r: any) => {
        if (!map[r.client_product_id]) map[r.client_product_id] = r;
      });
      return map;
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("client_products").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-products", clientId] });
      qc.invalidateQueries({ queryKey: ["admin-demands"] });
      toast.success("Atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-products", clientId] });
      toast.success("Demanda removida");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const changeStatus = (id: string, status: string) => {
    const patch: any = { status };
    if (status === "concluido") patch.end_date = new Date().toISOString().slice(0, 10);
    updateProduct.mutate({ id, patch });
  };

  const openDeadline = (cp: any) => {
    setDeadlineTarget({ id: cp.id, current: cp.deadline });
    setDeadlineValue(cp.deadline?.slice(0, 10) ?? "");
  };
  const saveDeadline = () => {
    if (!deadlineTarget) return;
    updateProduct.mutate({ id: deadlineTarget.id, patch: { deadline: deadlineValue || null } });
    setDeadlineTarget(null);
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Ecossistema de Soluções</h3>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500/70 mt-0.5">
            {clientProducts.length} serviço(s) ativo(s)
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-10 px-4 rounded-lg">
          <Plus className="size-4" /> Adicionar Produto
        </Button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center"><Activity className="size-6 animate-spin mx-auto text-slate-300" /></div>
      ) : clientProducts.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-16 text-center">
          <Package className="size-12 text-slate-200 mx-auto mb-4" />
          <p className="text-lg font-bold text-slate-900">Nenhum serviço contratado</p>
          <p className="text-sm text-slate-500 mt-1.5 mb-6 max-w-sm mx-auto">Vincule um produto para iniciar a gestão operacional.</p>
          <Button onClick={() => setAddOpen(true)} variant="outline" className="gap-2 rounded-lg">
            <Plus className="size-4" /> Adicionar Primeiro Produto
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {clientProducts.map((cp: any) => {
            const lastReport = (latestReports as any)[cp.id];
            const statusCls = STATUS_STYLE[cp.status] || "bg-slate-100 text-slate-600 border-slate-200";
            const statusLabel = STATUS_OPTIONS.find(s => s.value === cp.status)?.label || (cp.status || "—").replace(/_/g, " ");
            const isOverdue = cp.deadline && new Date(cp.deadline) < new Date() && cp.status !== "concluido";

            return (
              <div key={cp.id} className="bg-white border border-slate-200/70 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-200 transition-all">
                {/* HEADER */}
                <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
                  <button
                    onClick={() => navigate(`/demandas/${cp.id}`)}
                    className="flex items-start gap-4 min-w-0 flex-1 text-left group"
                  >
                    <div className="size-11 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Package className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-[16px] font-bold text-slate-900 group-hover:text-indigo-700 transition-colors truncate">
                          {cp.products?.name || cp.custom_product_name || "Produto"}
                        </h4>
                        <Badge variant="outline" className={cn("text-[9.5px] font-bold tracking-wider uppercase border px-2 py-0", statusCls)}>
                          {statusLabel}
                        </Badge>
                      </div>
                      <p className="text-[12.5px] text-slate-500 mt-1 line-clamp-1">
                        {cp.products?.description || "Acompanhamento técnico e gestão estratégica."}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline" size="sm"
                      className="h-9 rounded-lg gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
                      onClick={() => setDelegateTarget({ id: cp.id, providerId: cp.service_provider_id, productName: cp.products?.name })}
                    >
                      <UserCog className="size-3.5" /> {cp.service_providers ? "Trocar" : "Delegar"}
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      className="h-9 rounded-lg gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
                      onClick={() => navigate(`/demandas/${cp.id}`)}
                    >
                      <ExternalLink className="size-3.5" /> Abrir
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Mais ações" className="size-9 rounded-lg hover:bg-slate-100">
                          <MoreVertical className="size-4 text-slate-500" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-500">Mudar status</DropdownMenuLabel>
                        {STATUS_OPTIONS.map((s) => (
                          <DropdownMenuItem
                            key={s.value}
                            disabled={cp.status === s.value}
                            onClick={() => changeStatus(cp.id, s.value)}
                            className="gap-2 cursor-pointer text-[13px]"
                          >
                            {s.value === "concluido" ? <CheckCircle2 className="size-3.5 text-emerald-600" /> :
                             s.value === "pausado" ? <PauseCircle className="size-3.5 text-amber-600" /> :
                             s.value === "em_andamento" ? <PlayCircle className="size-3.5 text-indigo-600" /> :
                             s.value === "cancelado" ? <XCircle className="size-3.5 text-rose-600" /> :
                             <Clock className="size-3.5 text-slate-500" />}
                            {s.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openDeadline(cp)} className="gap-2 cursor-pointer text-[13px]">
                          <Calendar className="size-3.5" /> Definir prazo
                        </DropdownMenuItem>
                        {cp.sale_id && (
                          <DropdownMenuItem onClick={() => openEditSale(cp.sale_id)} className="gap-2 cursor-pointer text-[13px]">
                            <DollarSign className="size-3.5" /> Editar financeiro / venda
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => navigate(`/demandas/${cp.id}`)} className="gap-2 cursor-pointer text-[13px]">
                          <FileText className="size-3.5" /> Ver detalhes
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 text-rose-600 focus:text-rose-700 cursor-pointer text-[13px]"
                          onClick={async () => { if (await confirmAction("Remover esta demanda?")) deleteProduct.mutate(cp.id); }}
                        >
                          <Trash2 className="size-3.5" /> Remover demanda
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* DATA GRID */}
                {(() => {
                  const sale = (linksBySale as any)[cp.product_id] || null;
                  const partnerName = sale?.partner?.full_name || null;
                  const referrerName = sale?.referrer?.full_name || null;
                  return (
                    <div className="overflow-x-auto bg-slate-100">
                      <div className="grid grid-flow-col auto-cols-[minmax(170px,1fr)] gap-px min-w-full">

                      <DataField label="Investimento" value={formatBRL(cp.value)} icon={DollarSign} tone="primary" onClick={cp.sale_id ? () => openEditSale(cp.sale_id) : undefined} />
                      <DataField label="Início" value={cp.start_date ? formatDate(cp.start_date) : formatDate(cp.created_at)} icon={Calendar} />
                      <DataField
                        label="Prazo Final"
                        value={cp.deadline ? formatDate(cp.deadline) : "Definir"}
                        icon={Clock}
                        tone={isOverdue ? "danger" : cp.deadline ? "default" : "muted"}
                        onClick={() => openDeadline(cp)}
                      />
                      <DataField
                        label="Prestador"
                        value={cp.service_providers?.name || "Não delegado"}
                        icon={User}
                        tone={cp.service_providers ? "primary" : "muted"}
                        onClick={() => setDelegateTarget({ id: cp.id, providerId: cp.service_provider_id, productName: cp.products?.name })}
                      />
                      <DataField
                        label="Parceiro"
                        value={partnerName || "Direto"}
                        icon={Handshake}
                        tone={partnerName ? "primary" : "muted"}
                        onClick={sale ? () => setPartnerTarget({ id: sale.id, current: sale.partner_id }) : undefined}
                      />
                      <DataField
                        label="Indicador"
                        value={referrerName || "Sem indicação"}
                        icon={UserPlus}
                        tone={referrerName ? "primary" : "muted"}
                        onClick={sale ? () => setReferrerTarget({ id: sale.id, current: sale.referrer_id }) : undefined}
                      />
                      </div>
                    </div>

                  );
                })()}

                {/* CHECKLIST + REPORT */}
                <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
                  <div className="p-5 border-r border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <ClipboardCheck className="size-3.5 text-emerald-600" />
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Checklist de Entrega</h5>
                    </div>
                    <ClientProductSteps
                      clientProductId={cp.id}
                      initialSteps={(cp.steps ?? []).slice().sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))}
                    />
                  </div>

                  <div className="p-5 bg-slate-50/40">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="size-3.5 text-indigo-600" />
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Último Reporte Técnico</h5>
                    </div>
                    {lastReport ? (
                      <div className="space-y-3">
                        <p className="text-[13px] text-slate-700 leading-relaxed italic">"{lastReport.notes || "(sem observações)"}"</p>
                        <div className="flex items-center justify-between text-[10.5px]">
                          <Badge variant="outline" className={cn("text-[9px] font-bold uppercase border", STATUS_STYLE[lastReport.status] || "bg-slate-100 text-slate-600 border-slate-200")}>
                            {lastReport.status}
                          </Badge>
                          <span className="font-mono text-slate-500">{formatDate(lastReport.created_at)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 text-center">
                        <Activity className="size-5 text-slate-300 mx-auto mb-2" />
                        <p className="text-[12px] text-slate-500">Nenhum reporte enviado ainda.</p>
                        <Button
                          variant="outline" size="sm"
                          className="mt-3 h-8 text-[11px] rounded-lg"
                          onClick={() => navigate(`/demandas/${cp.id}`)}
                        >
                          Abrir demanda
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {delegateTarget && (
        <DelegateProviderDialog
          open={!!delegateTarget}
          onOpenChange={(v) => !v && setDelegateTarget(null)}
          clientProductId={delegateTarget.id}
          currentProviderId={delegateTarget.providerId}
          productName={delegateTarget.productName}
        />
      )}

      <SaleFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        clientId={clientId}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["client-products", clientId] });
          qc.invalidateQueries({ queryKey: ["client-sales-links", clientId] });
        }}
      />

      <SaleFormDialog
        open={!!editSale}
        onOpenChange={(v) => !v && setEditSale(null)}
        sale={editSale}
        clientId={clientId}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["client-products", clientId] });
          qc.invalidateQueries({ queryKey: ["client-sales-links", clientId] });
          setEditSale(null);
        }}
      />


      {/* Edição rápida — Parceiro */}
      <Dialog open={!!partnerTarget} onOpenChange={(v) => !v && setPartnerTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Trocar parceiro vendedor</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Parceiro</Label>
            <Select
              value={partnerTarget?.current || "__none__"}
              onValueChange={async (v) => {
                if (!partnerTarget) return;
                const newId = v === "__none__" ? null : v;
                const { error } = await supabase.from("sales").update({ partner_id: newId }).eq("id", partnerTarget.id);
                if (error) { toast.error(error.message); return; }
                toast.success("Parceiro atualizado");
                qc.invalidateQueries({ queryKey: ["client-sales-links", clientId] });
                qc.invalidateQueries({ queryKey: ["client-products", clientId] });
                qc.invalidateQueries({ queryKey: ["admin-demands"] });
                setPartnerTarget(null);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Direto / sem parceiro</SelectItem>
                {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edição rápida — Indicador */}
      <Dialog open={!!referrerTarget} onOpenChange={(v) => !v && setReferrerTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Trocar indicador</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Indicador</Label>
            <Select
              value={referrerTarget?.current || "__none__"}
              onValueChange={async (v) => {
                if (!referrerTarget) return;
                const newId = v === "__none__" ? null : v;
                const { error } = await supabase.from("sales").update({ referrer_id: newId }).eq("id", referrerTarget.id);
                if (error) { toast.error(error.message); return; }
                toast.success("Indicador atualizado");
                qc.invalidateQueries({ queryKey: ["client-sales-links", clientId] });
                qc.invalidateQueries({ queryKey: ["client-products", clientId] });
                qc.invalidateQueries({ queryKey: ["admin-demands"] });
                setReferrerTarget(null);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem indicação</SelectItem>
                {referrers.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deadlineTarget} onOpenChange={(v) => !v && setDeadlineTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Prazo final da demanda</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Data limite</Label>
            <Input type="date" value={deadlineValue} onChange={(e) => setDeadlineValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeadlineTarget(null)}>Cancelar</Button>
            <Button onClick={saveDeadline} className="bg-indigo-600 hover:bg-indigo-700 text-white">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DataField({
  label, value, icon: Icon, tone = "default", onClick,
}: {
  label: string; value: string; icon: any;
  tone?: "default" | "primary" | "muted" | "danger";
  onClick?: () => void;
}) {
  const toneCls =
    tone === "danger" ? "text-rose-600" :
    tone === "primary" ? "text-indigo-700" :
    tone === "muted" ? "text-slate-400 italic" : "text-slate-900";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "bg-white px-4 py-3 text-left flex flex-col gap-1 min-w-0",
        onClick && "hover:bg-slate-50 transition-colors cursor-pointer"
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="size-3 text-slate-400" />
        <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className={cn("text-[13.5px] font-semibold truncate", toneCls)}>{value}</p>
    </button>
  );
}
