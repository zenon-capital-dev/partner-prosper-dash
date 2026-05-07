import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Mail, Phone, Building2, MapPin, Plus, FileText, ShoppingBag,
  Pencil, Wallet, Activity as ActivityIcon, TrendingUp, Tag,
  IdCard, Sparkles, CircleDollarSign,
  CheckCircle2, Clock3, MessageSquarePlus, Eye,
  Trash2, MoreHorizontal, Download, Filter, ArrowUpRight,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL, formatDate, formatDoc, formatPhone, initials } from "@/lib/format";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { SaleFormDialog } from "@/components/sales/SaleFormDialog";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, partners(id,full_name,email,commission_percent)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["client-sales", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("*, products(name, product_categories(name, color))")
        .eq("client_id", id!)
        .order("sale_date", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
    const paid = sales.filter((s: any) => s.status === "pago" || s.status === "concluida").reduce((sum, x: any) => sum + Number(x.amount || 0), 0);
    const pending = sales.filter((s: any) => s.status === "pendente" || s.status === "em_andamento").reduce((sum, x: any) => sum + Number(x.amount || 0), 0);
    return { totalRevenue, paid, pending, salesCount: sales.length };
  }, [sales]);

  if (isLoading) return <div className="p-12 text-center text-white/20 font-mono">Loading account details...</div>;
  if (!client) return <div className="p-12 text-center text-rose-400 font-mono">Account not found.</div>;

  return (
    <div className="px-6 py-6 space-y-6 max-w-[1600px] admin-shell">
      {/* Header with back button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/clientes")} className="size-8 rounded-md bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white transition-colors">
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
               <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400">● active record</span>
               <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/30">CLIENT FILE</span>
            </div>
            <h1 className="text-[24px] font-semibold tracking-tight text-white leading-none">{client.full_name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <button onClick={() => setEditOpen(true)} className="h-8 px-3 rounded-md bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] text-[11.5px] font-mono uppercase tracking-wider text-white/60 hover:text-white flex items-center gap-1.5 transition-colors">
            <Pencil className="size-3" /> edit
           </button>
           <button onClick={() => setSaleOpen(true)} className="h-8 px-4 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold uppercase tracking-wider text-[11.5px] flex items-center gap-1.5 transition-colors">
            <Plus className="size-3.5" strokeWidth={3} /> New Transaction
           </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Profile Card */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
           <div className="cp-panel p-6">
              <div className="flex items-center gap-5 mb-8">
                 <div className="size-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-2xl font-mono text-white/60">
                    {initials(client.full_name)}
                 </div>
                 <div>
                    <h2 className="text-white font-semibold text-lg">{client.full_name}</h2>
                    <p className="text-[11px] font-mono text-white/30 uppercase tracking-widest mt-0.5">{client.company || "Personal Account"}</p>
                 </div>
              </div>

              <div className="space-y-4">
                 <ProfileDetail icon={Mail} label="Email Address" value={client.email} />
                 <ProfileDetail icon={Phone} label="Contact Phone" value={formatPhone(client.phone)} />
                 <ProfileDetail icon={IdCard} label="Document ID" value={formatDoc(client.document)} />
                 <ProfileDetail icon={MapPin} label="Geography" value={`${client.city || "—"} / ${client.state || "—"}`} />
              </div>

              <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between">
                 <div>
                    <p className="cp-stat-label">Member Since</p>
                    <p className="text-white font-mono text-[13px] mt-1">{formatDate(client.created_at)}</p>
                 </div>
                 <StatusPill status={client.status} />
              </div>
           </div>

           {/* Quick KPI Strip */}
           <div className="grid grid-cols-2 gap-px bg-white/[0.06] rounded-lg overflow-hidden border border-white/[0.06]">
              <div className="bg-[#0d0e12] p-5">
                 <p className="cp-stat-label mb-2">Total LTV</p>
                 <p className="cp-stat-value text-[20px]">{formatBRL(stats.totalRevenue)}</p>
              </div>
              <div className="bg-[#0d0e12] p-5">
                 <p className="cp-stat-label mb-2">Sales Count</p>
                 <p className="cp-stat-value text-[20px]">{stats.salesCount}</p>
              </div>
           </div>
        </div>

        {/* Sales Table / Activity */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
           <div className="cp-panel">
              <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                 <h3 className="text-[13px] font-semibold tracking-tight text-white uppercase tracking-wider">Transaction History</h3>
                 <span className="text-[11px] font-mono text-white/20 uppercase tracking-widest">Historical Log</span>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-[12.5px]">
                    <thead className="bg-white/[0.02]">
                       <tr className="border-b border-white/[0.06]">
                          <Th>Status</Th>
                          <Th>Product / Service</Th>
                          <Th>Date</Th>
                          <Th align="right">Amount</Th>
                       </tr>
                    </thead>
                    <tbody>
                       {sales.length === 0 ? (
                         <tr><td colSpan={4} className="py-20 text-center text-white/20 font-mono">No transactions recorded for this account.</td></tr>
                       ) : sales.map((s: any) => (
                         <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                            <Td><StatusPill status={s.status} /></Td>
                            <Td>
                               <div className="flex items-center gap-2">
                                  {s.products?.product_categories && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: `${s.products.product_categories.color}30`, color: s.products.product_categories.color }}>
                                      {s.products.product_categories.name.toUpperCase()}
                                    </span>
                                  )}
                                  <span className="text-white font-medium">{s.products?.name ?? "—"}</span>
                               </div>
                            </Td>
                            <Td className="text-white/40 font-mono">{formatDate(s.sale_date)}</Td>
                            <Td align="right"><span className="font-mono font-semibold text-white tabular-nums">{formatBRL(s.amount)}</span></Td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-6">
              <div className="cp-panel p-6 flex flex-col justify-center items-center text-center space-y-4">
                 <div className="size-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="size-6" />
                 </div>
                 <div>
                    <p className="cp-stat-label">Settled Amount</p>
                    <p className="text-[20px] font-mono font-bold text-emerald-400 mt-1">{formatBRL(stats.paid)}</p>
                 </div>
              </div>
              <div className="cp-panel p-6 flex flex-col justify-center items-center text-center space-y-4">
                 <div className="size-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <Clock3 className="size-6" />
                 </div>
                 <div>
                    <p className="cp-stat-label">Pending / AR</p>
                    <p className="text-[20px] font-mono font-bold text-amber-400 mt-1">{formatBRL(stats.pending)}</p>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["client", id] })} />
      <SaleFormDialog open={saleOpen} onOpenChange={setSaleOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["client-sales", id] })} />
    </div>
  );
}

function ProfileDetail({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-3">
       <Icon className="size-4 text-white/20 mt-1" />
       <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-white/20">{label}</p>
          <p className="text-[13px] text-white/70 truncate max-w-[200px]">{value || "Not provided"}</p>
       </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ativo: { label: "active", cls: "cp-pill-success" },
    prospecto: { label: "prospect", cls: "cp-pill-warning" },
    inativo: { label: "inactive", cls: "cp-pill-danger" },
    concluida: { label: "succeeded", cls: "cp-pill-success" },
    pago: { label: "settled", cls: "cp-pill-success" },
    pendente: { label: "pending", cls: "cp-pill-warning" },
    cancelado: { label: "canceled", cls: "cp-pill-danger" },
  };
  const m = map[status] ?? { label: status, cls: "cp-pill-muted" };
  return <span className={cn("cp-pill uppercase tracking-widest text-[9px]", m.cls)}>{m.label}</span>;
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={cn(
      "px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-white/40",
      align === "right" ? "text-right" : "text-left"
    )}>
      {children}
    </th>
  );
}

function Td({ children, align = "left", className }: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={cn(
      "px-5 py-4",
      align === "right" ? "text-right" : "text-left",
      className
    )}>
      {children}
    </td>
  );
}
