import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus, Search, Trash2, MoreHorizontal, Pencil, Package, ArrowUpRight, Handshake,
  Users2, Wallet, TrendingUp, CheckCircle2, Clock3, Award, Crown,
  LayoutGrid, List, Download, X, Power, PowerOff, Mail, Phone, Copy,
} from "lucide-react";
import { formatBRL, formatPercent, initials, formatPhone, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PartnerDetailDrawer } from "@/components/PartnerDetailDrawer";
import { cn } from "@/lib/utils";

const emptyForm = { active: true, commission_percent: 10 };
type SortKey = "recent" | "name" | "commissions" | "clients";
type ViewMode = "list" | "grid";

export default function Partners() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativos" | "inativos">("todos");
  const [sortBy, setSortBy] = useState<SortKey>("commissions");
  const qc = useQueryClient();

  const { data: partners } = useQuery({
    queryKey: ["partners-rich"],
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("*, commissions(amount, status, created_at), clients(id), partner_products(id)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const enriched = useMemo(() => {
    return (partners ?? []).map((p: any) => {
      const comms = p.commissions ?? [];
      const total = comms.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
      const pending = comms.filter((c: any) => c.status === "pendente").reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
      
      const now = new Date();
      const months: { key: string; total: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, total: 0 });
      }
      comms.forEach((c: any) => {
        const d = new Date(c.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const m = months.find((mm) => mm.key === key);
        if (m) m.total += Number(c.amount || 0);
      });
      return {
        ...p,
        _total: total,
        _pending: pending,
        _spark: months.map((m) => m.total),
        _clientsCount: p.clients?.length ?? 0,
        _productsCount: p.partner_products?.length ?? 0,
      };
    });
  }, [partners]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p: any) =>
        p.full_name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.phone?.includes(q),
      );
    }
    if (statusFilter === "ativos") list = list.filter((p: any) => p.active);
    else if (statusFilter === "inativos") list = list.filter((p: any) => !p.active);

    const sorted = [...list];
    if (sortBy === "name") sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    else if (sortBy === "commissions") sorted.sort((a, b) => b._total - a._total);
    else if (sortBy === "clients") sorted.sort((a, b) => b._clientsCount - a._clientsCount);
    else sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return sorted;
  }, [enriched, search, statusFilter, sortBy]);

  const topIds = useMemo(() => {
    const ranking = [...enriched].sort((a, b) => b._total - a._total).slice(0, 3);
    return new Map(ranking.filter((r) => r._total > 0).map((r, i) => [r.id, i + 1]));
  }, [enriched]);

  const kpis = useMemo(() => {
    const total = enriched.length;
    const active = enriched.filter((p: any) => p.active).length;
    const totalComms = enriched.reduce((s: number, p: any) => s + p._total, 0);
    const totalPending = enriched.reduce((s: number, p: any) => s + p._pending, 0);
    const totalClients = enriched.reduce((s: number, p: any) => s + p._clientsCount, 0);
    return { total, active, totalComms, totalPending, totalClients };
  }, [enriched]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ ...p });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.full_name) { toast.error("Nome obrigatório"); return; }
    const { error } = editing
      ? await supabase.from("partners").update(form).eq("id", editing.id)
      : await supabase.from("partners").insert(form);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Parceiro atualizado" : "Parceiro cadastrado");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["partners-rich"] });
  };

  const toggleActive = async (p: any) => {
    const { error } = await supabase.from("partners").update({ active: !p.active }).eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success(p.active ? "Parceiro desativado" : "Parceiro ativado");
      qc.invalidateQueries({ queryKey: ["partners-rich"] });
    }
  };

  return (
    <div className="page-shell space-y-10 animate-fade-up">
      <PageHero
        eyebrow="Ecosystem"
        category="Partner Network"
        title="Parceiros"
        description="Gerencie sua rede de indicações e parceiros estratégicos com visibilidade total de ganhos e performance."
        icon={<Handshake className="size-6" />}
        actions={
          <Button size="sm" onClick={openNew} className="action-button btn-primary shadow-xl">
            <Plus className="size-4" strokeWidth={3} /> Novo Parceiro
          </Button>
        }
        kpis={[
          { label: "Total Rede", value: kpis.total, tone: "primary", icon: <Users2 className="size-4" /> },
          { label: "Indicações", value: kpis.totalClients, tone: "info", icon: <TrendingUp className="size-4" /> },
          { label: "Total Comissões", value: formatBRL(kpis.totalComms), tone: "success", icon: <Wallet className="size-4" /> },
          { label: "A Pagar", value: formatBRL(kpis.totalPending), tone: "warning", icon: <Clock3 className="size-4" /> },
        ]}
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-white border-slate-200 rounded-xl focus:border-indigo-400 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-11 w-[140px] bg-white border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-700"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1">
            <button onClick={() => setView("list")} className={cn("size-9 rounded-lg flex items-center justify-center transition-all", view === "list" ? "bg-indigo-50 text-indigo-700" : "text-slate-400 hover:text-slate-700")}>
              <List className="size-4" />
            </button>
            <button onClick={() => setView("grid")} className={cn("size-9 rounded-lg flex items-center justify-center transition-all", view === "grid" ? "bg-indigo-50 text-indigo-700" : "text-slate-400 hover:text-slate-700")}>
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {view === "list" ? (
        <div className="bg-white border border-slate-200/70 rounded-lg overflow-hidden shadow-sm">
          <ListView partners={filtered} topIds={topIds} onDetail={setDrawerId} onEdit={openEdit} onToggle={toggleActive} />
        </div>
      ) : (
        <GridView partners={filtered} topIds={topIds} onDetail={setDrawerId} onEdit={openEdit} onToggle={toggleActive} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                <Handshake className="size-5" />
              </div>
              <div>
                <DialogTitle className="font-display text-xl">{editing ? "Editar Parceiro" : "Novo Parceiro"}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Cadastre indicadores e parceiros estratégicos com dados completos para repasses.</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-3">
            <PartnerSection title="Identificação" icon={<Users2 className="size-3.5" />}>
              <div className="grid grid-cols-2 gap-3">
                <PartnerField label="Nome Completo / Razão Social *" wide>
                  <Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Ex: João da Silva ou Acme Indicações" />
                </PartnerField>
                <PartnerField label="CPF / CNPJ">
                  <Input value={form.document ?? ""} onChange={(e) => setForm({ ...form, document: e.target.value })} placeholder="000.000.000-00" />
                </PartnerField>
                <PartnerField label="Categoria">
                  <Select value={form.partner_category ?? "indicador"} onValueChange={(v) => setForm({ ...form, partner_category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="indicador">Indicador (apenas indicações)</SelectItem>
                      <SelectItem value="afiliado">Afiliado (link próprio)</SelectItem>
                      <SelectItem value="estrategico">Parceiro estratégico</SelectItem>
                    </SelectContent>
                  </Select>
                </PartnerField>
              </div>
            </PartnerSection>

            <PartnerSection title="Contato" icon={<Mail className="size-3.5" />}>
              <div className="grid grid-cols-2 gap-3">
                <PartnerField label="E-mail">
                  <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
                </PartnerField>
                <PartnerField label="Telefone">
                  <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
                </PartnerField>
                <PartnerField label="WhatsApp">
                  <Input value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(11) 99999-9999" />
                </PartnerField>
                <PartnerField label="% Comissão padrão">
                  <Input type="number" step="0.01" value={form.commission_percent ?? 10} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })} />
                </PartnerField>
              </div>
            </PartnerSection>

            <PartnerSection title="Dados bancários para repasse" icon={<Wallet className="size-3.5" />}>
              <div className="grid grid-cols-2 gap-3">
                <PartnerField label="Chave Pix" wide>
                  <Input value={form.pix_key ?? ""} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} placeholder="CPF, e-mail, telefone ou chave aleatória" />
                </PartnerField>
                <PartnerField label="Banco">
                  <Input value={form.bank_name ?? ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="Ex: Itaú" />
                </PartnerField>
                <PartnerField label="Agência">
                  <Input value={form.bank_agency ?? ""} onChange={(e) => setForm({ ...form, bank_agency: e.target.value })} placeholder="0000" />
                </PartnerField>
                <PartnerField label="Conta" wide>
                  <Input value={form.bank_account ?? ""} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} placeholder="00000-0" />
                </PartnerField>
              </div>
            </PartnerSection>

            <PartnerSection title="Notas e Status" icon={<Crown className="size-3.5" />}>
              <PartnerField label="Notas internas">
                <textarea
                  value={form.notes ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Histórico, observações, condições especiais..."
                />
              </PartnerField>
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3 mt-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider">Parceria ativa</p>
                  <p className="text-[11px] text-muted-foreground">{form.active ? "Recebe novas indicações e comissões" : "Pausado / inativo"}</p>
                </div>
                <Switch checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
            </PartnerSection>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg">
              {editing ? "Salvar alterações" : "Cadastrar parceiro"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PartnerDetailDrawer partnerId={drawerId} open={!!drawerId} onOpenChange={(o) => !o && setDrawerId(null)} />
    </div>
  );
}

function ListView({ partners, topIds, onDetail, onEdit, onToggle }: any) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-white/[0.05] bg-white/[0.01]">
          <th className="px-6 py-5 text-left editorial-label">Parceiro</th>
          <th className="px-6 py-5 text-right editorial-label">Performance</th>
          <th className="px-6 py-5 text-right editorial-label">Ganhos</th>
          <th className="px-6 py-5 text-center editorial-label">Trend</th>
          <th className="px-6 py-5 text-right editorial-label">Ações</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/[0.05]">
        {partners.map((p: any) => {
          const rank = topIds.get(p.id);
          return (
            <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
              <td className="px-6 py-5">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="size-11 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-sm font-bold shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]">
                      {initials(p.full_name)}
                    </div>
                    {rank && <RankBadge rank={rank} />}
                  </div>
                  <div>
                    <p className="font-bold text-white group-hover:text-primary transition-colors text-base">{p.full_name}</p>
                    <p className="text-[11px] text-white/20 font-mono uppercase tracking-widest">{p.email || formatPhone(p.phone)}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-5 text-right">
                <p className="font-mono font-bold text-white/80">{p._clientsCount} Indicações</p>
                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{formatPercent(p.commission_percent)} Base</p>
              </td>
              <td className="px-6 py-5 text-right">
                <p className="font-mono font-bold text-primary text-base">{formatBRL(p._total)}</p>
                {p._pending > 0 && <p className="text-[10px] text-warning font-bold uppercase tracking-widest">Pendente: {formatBRL(p._pending)}</p>}
              </td>
              <td className="px-6 py-5"><Sparkline data={p._spark} /></td>
              <td className="px-6 py-5 text-right">
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => onDetail(p.id)} className="action-button btn-outline h-9 w-9 p-0">
                    <ArrowUpRight className="size-4" />
                  </button>
                  <button onClick={() => onEdit(p)} className="action-button btn-outline h-9 w-9 p-0">
                    <Pencil className="size-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function GridView({ partners, topIds, onDetail }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {partners.map((p: any) => {
        const rank = topIds.get(p.id);
        return (
          <div key={p.id} className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 hover:border-primary/30 transition-all group">
            <div className="flex items-start justify-between mb-8">
              <div className="relative">
                <div className="size-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-xl font-bold">
                  {initials(p.full_name)}
                </div>
                {rank && <RankBadge rank={rank} />}
              </div>
              <button onClick={() => onDetail(p.id)} className="size-10 rounded-full bg-white/[0.05] flex items-center justify-center hover:bg-white/10 transition-colors">
                <ArrowUpRight className="size-5" />
              </button>
            </div>
            <h3 className="text-xl font-bold text-white mb-1">{p.full_name}</h3>
            <p className="editorial-label mb-6">{p.email || formatPhone(p.phone) || "Sem contato"}</p>
            
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
              <div>
                <p className="editorial-label mb-1">Indicações</p>
                <p className="text-lg font-bold font-mono">{p._clientsCount}</p>
              </div>
              <div>
                <p className="editorial-label mb-1">Comissão Total</p>
                <p className="text-lg font-bold font-mono text-primary">{formatBRL(p._total)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0 || data.every((v) => v === 0)) return <div className="h-6 w-20 bg-white/5 rounded-full mx-auto opacity-20" />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 80;
  const H = 20;
  const points = data.map((v, i) => `${i * (W/(data.length-1))},${H - ((v - min) / range) * H}`).join(" ");
  return (
    <svg width={W} height={H} className="mx-auto opacity-60 group-hover:opacity-100 transition-opacity">
      <polyline points={points} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const Icon = rank === 1 ? Crown : Award;
  return (
    <div className="absolute -top-2 -right-2 size-6 rounded-full bg-white text-black flex items-center justify-center shadow-2xl border-2 border-black">
      <Icon className="size-3.5" />
    </div>
  );
}

function PartnerSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        <span className="size-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function PartnerField({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`space-y-1.5 ${wide ? "col-span-2" : ""}`}>
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
