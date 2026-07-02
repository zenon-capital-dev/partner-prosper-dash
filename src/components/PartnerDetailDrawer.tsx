import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Package, TrendingUp, Wallet, Users, Mail, Phone, IdCard, KeyRound,
  Pencil, Trash2, Power, PowerOff, ChevronDown, Search, CheckCircle2, Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { formatBRL, formatPercent, formatDoc, formatPhone, initials, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";

type Props = {
  partnerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PartnerDetailDrawer({ partnerId, open, onOpenChange }: Props) {
  const qc = useQueryClient();

  const { data: partner } = useQuery({
    queryKey: ["partner-detail", partnerId],
    queryFn: async () => {
      if (!partnerId) return null;
      const { data } = await supabase.from("partners").select("*").eq("id", partnerId).maybeSingle();
      return data;
    },
    enabled: !!partnerId && open,
  });

  const { data: links = [] } = useQuery({
    queryKey: ["partner-products", partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data } = await supabase
        .from("partner_products")
        .select("*, products(id,name,base_price,default_commission_percent)")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!partnerId && open,
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ["all-active-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,base_price,default_commission_percent,allow_partner,active")
        .eq("active", true)
        .eq("allow_partner", true)
        .order("name");
      return data ?? [];
    },
    enabled: open,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["partner-clients", partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data } = await supabase.from("clients").select("id,full_name,email,status,created_at").eq("partner_id", partnerId);
      return data ?? [];
    },
    enabled: !!partnerId && open,
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["partner-commissions", partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data } = await supabase
        .from("commissions")
        .select("*, products(name), clients(full_name)")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!partnerId && open,
  });

  const stats = useMemo(() => {
    const total = commissions.reduce((s, c: any) => s + Number(c.amount || 0), 0);
    const paid = commissions.filter((c: any) => c.status === "paga").reduce((s, c: any) => s + Number(c.amount || 0), 0);
    const pending = commissions.filter((c: any) => ["gerada", "em_analise", "aprovada"].includes(c.status)).reduce((s, c: any) => s + Number(c.amount || 0), 0);
    const approved = commissions.filter((c: any) => c.status === "aprovada").reduce((s, c: any) => s + Number(c.amount || 0), 0);
    
    // Clients stats
    const convertedClients = clients.filter((c: any) => c.status === "ativo").length;
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthClients = clients.filter((c: any) => new Date(c.created_at) >= startMonth).length;

    return { 
      total, paid, pending, approved,
      clientsCount: clients.length, 
      convertedClients,
      monthClients,
      productsCount: links.length 
    };
  }, [commissions, clients, links]);

  // Add product
  const [addOpen, setAddOpen] = useState(false);
  const [addProductId, setAddProductId] = useState<string>("");
  const [addCommission, setAddCommission] = useState<string>("");
  const [addPrice, setAddPrice] = useState<string>("");
  const [productSearch, setProductSearch] = useState("");

  const linkedIds = new Set(links.map((l: any) => l.product_id));
  const availableProducts = allProducts.filter((p: any) =>
    !linkedIds.has(p.id) &&
    (productSearch === "" || p.name.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const handleAddLink = async () => {
    if (!partnerId || !addProductId) { toast.error("Selecione um produto"); return; }
    const product = allProducts.find((p: any) => p.id === addProductId);
    const { error } = await supabase.from("partner_products").upsert({
      partner_id: partnerId,
      product_id: addProductId,
      commission_percent: Number(addCommission || product?.default_commission_percent || 10),
      custom_price: addPrice ? Number(addPrice) : null,
      active: true,
    }, { onConflict: "partner_id,product_id" });
    if (error) { toast.error(error.message); return; }
    toast.success("Produto vinculado");
    setAddProductId(""); setAddCommission(""); setAddPrice("");
    qc.invalidateQueries({ queryKey: ["partner-products", partnerId] });
  };

  const updateLink = async (id: string, patch: any) => {
    const { error } = await supabase.from("partner_products").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["partner-products", partnerId] }); }
  };

  const removeLink = async (id: string) => {
    if (!(await confirmAction("Remover produto deste parceiro?"))) return;
    const { error } = await supabase.from("partner_products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["partner-products", partnerId] }); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        {partner && (
          <>
            <SheetHeader className="p-6 border-b border-border bg-muted/20">
              <div className="flex items-start gap-4">
                <div className="size-14 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center text-lg font-display font-bold shadow-vx-sm">
                  {initials(partner.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="font-display text-xl truncate">{partner.full_name}</SheetTitle>
                  <SheetDescription className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] uppercase">{partner.partner_type ?? "parceiro"}</Badge>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase ${partner.active ? "text-success" : "text-muted-foreground"}`}>
                      <span className={`size-1.5 rounded-full ${partner.active ? "bg-success" : "bg-muted-foreground"}`} />
                      {partner.active ? "Ativo" : "Inativo"}
                    </span>
                    <span className="text-muted-foreground">· desde {formatDate(partner.created_at)}</span>
                  </SheetDescription>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2 mt-4 px-1">
                <MiniStat label="Total Ganho" value={formatBRL(stats.total)} tone="primary" />
                <MiniStat label="Aprovado" value={formatBRL(stats.approved)} tone="success" />
                <MiniStat label="Pendente" value={formatBRL(stats.pending)} tone="warning" />
                <MiniStat label="PAGO" value={formatBRL(stats.paid)} tone="success" />
                <MiniStat label="Clientes" value={stats.clientsCount} tone="muted" />
              </div>

              <div className="grid grid-cols-3 gap-2 mt-2 px-1">
                <div className="rounded-md border border-border bg-card p-2 flex items-center justify-between">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground">Conversão</span>
                  <span className="text-xs font-bold text-primary">{stats.clientsCount ? Math.round((stats.convertedClients / stats.clientsCount) * 100) : 0}%</span>
                </div>
                <div className="rounded-md border border-border bg-card p-2 flex items-center justify-between">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground">Mês</span>
                  <span className="text-xs font-bold text-primary">+{stats.monthClients}</span>
                </div>
                <div className="rounded-md border border-border bg-card p-2 flex items-center justify-between">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground">Produtos</span>
                  <span className="text-xs font-bold text-primary">{stats.productsCount}</span>
                </div>
              </div>
            </SheetHeader>

            <Tabs defaultValue="products" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-6 mt-4 self-start">
                <TabsTrigger value="products" className="gap-1.5"><Package className="size-3.5" /> Produtos</TabsTrigger>
                <TabsTrigger value="info" className="gap-1.5"><IdCard className="size-3.5" /> Dados</TabsTrigger>
                <TabsTrigger value="clients" className="gap-1.5"><Users className="size-3.5" /> Clientes</TabsTrigger>
                <TabsTrigger value="commissions" className="gap-1.5"><Wallet className="size-3.5" /> Comissões</TabsTrigger>
              </TabsList>

              {/* PRODUTOS */}
              <TabsContent value="products" className="flex-1 overflow-y-auto px-6 pb-6 mt-4 space-y-4">
                <div className="vx-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-display font-semibold">Vincular novo produto</p>
                      <p className="text-[11px] text-muted-foreground">Defina comissão e preço específicos para este parceiro.</p>
                    </div>
                    <Sparkles className="size-4 text-primary" />
                  </div>

                  <div className="relative">
                    <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar produto disponível..."
                      className="pl-8 h-9"
                    />
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <Select value={addProductId} onValueChange={(v) => {
                        setAddProductId(v);
                        const p = allProducts.find((x: any) => x.id === v);
                        if (p) {
                          setAddCommission(String(p.default_commission_percent ?? 10));
                          setAddPrice(String(p.base_price ?? ""));
                        }
                      }}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                        <SelectContent>
                          {availableProducts.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum produto disponível</div>
                          ) : availableProducts.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>
                              <span className="inline-flex items-center gap-2">
                                {p.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input className="col-span-3 h-9" type="number" step="0.01" placeholder="% comissão" value={addCommission} onChange={(e) => setAddCommission(e.target.value)} />
                    <Input className="col-span-3 h-9" type="number" step="0.01" placeholder="Preço (opcional)" value={addPrice} onChange={(e) => setAddPrice(e.target.value)} />
                  </div>
                  <Button onClick={handleAddLink} className="w-full gap-2 bg-gradient-primary"><Plus className="size-4" /> Vincular produto</Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Produtos vinculados</p>
                    <span className="text-xs text-muted-foreground">{links.length} item{links.length !== 1 ? "s" : ""}</span>
                  </div>

                  {links.length === 0 ? (
                    <div className="vx-card p-8 text-center">
                      <Package className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum produto vinculado ainda</p>
                    </div>
                  ) : links.map((l: any) => <LinkRow key={l.id} link={l} onUpdate={updateLink} onRemove={removeLink} />)}
                </div>
              </TabsContent>

              {/* DADOS */}
              <TabsContent value="info" className="flex-1 overflow-y-auto px-6 pb-6 mt-4 space-y-3">
                <InfoRow icon={Mail} label="E-mail" value={partner.email ?? "—"} />
                <InfoRow icon={Phone} label="Telefone" value={formatPhone(partner.phone)} />
                <InfoRow icon={IdCard} label="CPF/CNPJ" value={formatDoc(partner.document)} />
                <InfoRow icon={KeyRound} label="Chave PIX" value={partner.pix_key ?? "—"} />
                <InfoRow icon={TrendingUp} label="% Comissão padrão" value={formatPercent(partner.commission_percent)} />
                {partner.notes && (
                  <div className="vx-card p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Observações</p>
                    <p className="text-sm whitespace-pre-wrap">{partner.notes}</p>
                  </div>
                )}
              </TabsContent>

              {/* CLIENTES */}
              <TabsContent value="clients" className="flex-1 overflow-y-auto px-6 pb-6 mt-4">
                {clients.length === 0 ? (
                  <div className="vx-card p-8 text-center">
                    <Users className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum cliente indicado</p>
                  </div>
                ) : (
                  <div className="vx-card divide-y divide-border">
                    {clients.map((c: any) => (
                      <div key={c.id} className="p-4 flex items-center gap-3 hover:bg-muted/30">
                        <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">{initials(c.full_name)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.full_name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{c.email ?? "sem email"}</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] uppercase">{c.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* COMISSOES */}
              <TabsContent value="commissions" className="flex-1 overflow-y-auto px-6 pb-6 mt-4">
                {commissions.length === 0 ? (
                  <div className="vx-card p-8 text-center">
                    <Wallet className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma comissão registrada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase text-muted-foreground px-1">
                      <span>Histórico de Pagamentos</span>
                    </div>
                    <div className="vx-card divide-y divide-border">
                      {commissions.map((c: any) => (
                        <div key={c.id} className="p-3.5 hover:bg-muted/30 transition-colors group">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div>
                              <p className="text-sm font-bold vx-mono text-primary">{formatBRL(c.amount)}</p>
                              <p className="text-[10px] text-muted-foreground">{formatDate(c.created_at)}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <Badge variant="outline" className={cn("text-[9px] uppercase font-bold", 
                                c.status === "paga" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                c.status === "aprovada" ? "bg-blue-50 text-blue-600 border-blue-100" :
                                c.status === "cancelada" ? "bg-rose-50 text-rose-600 border-rose-100" :
                                "bg-amber-50 text-amber-600 border-amber-100"
                              )}>
                                {c.status}
                              </Badge>
                              {c.paid_at && <span className="text-[9px] text-muted-foreground italic">Pago em {formatDate(c.paid_at)}</span>}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 p-2 bg-muted/20 rounded border border-border/40">
                             <div className="min-w-0">
                               <p className="text-[9px] uppercase text-muted-foreground font-bold">Cliente</p>
                               <p className="text-[11px] font-medium truncate">{c.clients?.full_name || "—"}</p>
                             </div>
                             <div className="min-w-0">
                               <p className="text-[9px] uppercase text-muted-foreground font-bold">Produto</p>
                               <p className="text-[11px] font-medium truncate">{c.products?.name || "—"}</p>
                             </div>
                          </div>
                          {c.notes && <p className="mt-2 text-[10px] text-muted-foreground bg-muted/10 p-1.5 rounded border-l-2 border-primary/30 italic">"{c.notes}"</p>}
                          <div className="mt-2 flex items-center justify-end gap-1.5">
                            {c.status !== "paga" && c.status !== "cancelada" && (
                              <Button size="sm" variant="default" className="h-7 text-[11px]" onClick={async () => {
                                const method = window.prompt("Forma de pagamento (ex.: PIX, TED):", c.payment_method || "PIX");
                                if (method === null) return;
                                const { error } = await supabase.from("commissions").update({
                                  status: "paga",
                                  paid_at: new Date().toISOString(),
                                  payment_date: new Date().toISOString(),
                                  payment_method: method || null,
                                } as any).eq("id", c.id);
                                if (error) return toast.error(error.message);
                                toast.success("Comissão marcada como paga");
                                qc.invalidateQueries({ queryKey: ["partner-commissions", partnerId] });
                              }}>
                                <CheckCircle2 className="size-3.5 mr-1" /> Marcar como paga
                              </Button>
                            )}
                            {c.status === "paga" && (
                              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={async () => {
                                if (!(await confirmAction({ title: "Reverter pagamento?", description: "A comissão voltará para pendente." }))) return;
                                const { error } = await supabase.from("commissions").update({
                                  status: "pendente", paid_at: null, payment_date: null,
                                } as any).eq("id", c.id);
                                if (error) return toast.error(error.message);
                                toast.success("Pagamento revertido");
                                qc.invalidateQueries({ queryKey: ["partner-commissions", partnerId] });
                              }}>Reverter</Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MiniStat({ label, value, tone }: any) {
  const map: any = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    muted: "text-foreground",
  };
  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={`font-display font-bold vx-mono text-sm mt-0.5 ${map[tone]}`}>{value}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: any) {
  return (
    <div className="vx-card p-3.5 flex items-center gap-3">
      <div className="size-9 rounded-md bg-muted/60 flex items-center justify-center text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function LinkRow({ link, onUpdate, onRemove }: any) {
  const [editing, setEditing] = useState(false);
  const [pct, setPct] = useState(String(link.commission_percent ?? ""));
  const [price, setPrice] = useState(String(link.custom_price ?? ""));
  const product = link.products;
  const color = "hsl(var(--primary))";

  const save = () => {
    onUpdate(link.id, {
      commission_percent: Number(pct || 0),
      custom_price: price ? Number(price) : null,
    });
    setEditing(false);
  };

  const effectivePrice = link.custom_price ?? product?.base_price;

  return (
    <div className="vx-card p-3.5">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-md flex items-center justify-center" style={{ background: `${color}1a`, color }}>
          <Package className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold truncate">{product?.name ?? "—"}</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdate(link.id, { active: !link.active })}
                className={`size-7 rounded-md flex items-center justify-center hover:bg-muted ${link.active ? "text-success" : "text-muted-foreground"}`}
                title={link.active ? "Desativar" : "Ativar"}
              >
                {link.active ? <Power className="size-3.5" /> : <PowerOff className="size-3.5" />}
              </button>
              <button onClick={() => setEditing(!editing)} className="size-7 rounded-md hover:bg-muted text-muted-foreground flex items-center justify-center"><Pencil className="size-3.5" /></button>
              <button onClick={() => onRemove(link.id)} className="size-7 rounded-md hover:bg-destructive-muted text-muted-foreground hover:text-destructive flex items-center justify-center"><Trash2 className="size-3.5" /></button>
            </div>
          </div>

          {!editing ? (
            <div className="flex items-center gap-4 mt-1 text-[11px] text-muted-foreground">
              <span>Preço: <span className="vx-mono font-semibold text-foreground">{formatBRL(effectivePrice)}</span></span>
              <span>Comissão: <span className="vx-mono font-semibold text-success">{formatPercent(link.commission_percent)}</span></span>
              <span className="vx-mono">≈ {formatBRL((Number(effectivePrice ?? 0) * Number(link.commission_percent ?? 0)) / 100)}</span>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-2 mt-2">
              <div className="col-span-5">
                <Label className="text-[10px]">% Comissão</Label>
                <Input value={pct} onChange={(e) => setPct(e.target.value)} type="number" step="0.01" className="h-8" />
              </div>
              <div className="col-span-5">
                <Label className="text-[10px]">Preço custom</Label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.01" className="h-8" placeholder={String(product?.base_price ?? "")} />
              </div>
              <div className="col-span-2 flex items-end">
                <Button size="sm" onClick={save} className="w-full h-8 gap-1"><CheckCircle2 className="size-3.5" /></Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
