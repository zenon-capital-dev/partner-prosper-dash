import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Users, Wallet, FileText, UserCog, Inbox, Clock, Eye, EyeOff, Save,
} from "lucide-react";
import { PanelShell } from "@/components/panels/PanelShell";
import { PanelHero } from "@/components/panels/PanelHero";
import { PanelContainer } from "@/components/panels/PanelContainer";
import { SectionCard, EmptyState } from "@/components/panels/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatBRL, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { key: "dashboard",  label: "Início",     icon: LayoutDashboard },
  { key: "clientes",   label: "Clientes",   icon: Users },
  { key: "comissoes",  label: "Comissões",  icon: Wallet, shortLabel: "Comissões" },
  { key: "extrato",    label: "Extrato",    icon: FileText },
  { key: "perfil",     label: "Perfil",     icon: UserCog },
];

const CLIENT_TONE: Record<string, string> = {
  ativo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  prospecto: "bg-slate-100 text-slate-700 border-slate-200",
  inativo: "bg-slate-100 text-slate-500 border-slate-200",
};

const SHOW_PRODUCT_KEY = "partner_show_product_name";

export default function PartnerPanel() {
  const { user, signOut } = useAuth() as any;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { tab } = useParams<{ tab?: string }>();
  const activeKey = NAV.find((n) => n.key === tab)?.key ?? "dashboard";
  const onNavigate = (k: string) => navigate(k === "dashboard" ? "/parceiro" : `/parceiro/${k}`);

  const [showProductName, setShowProductName] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SHOW_PRODUCT_KEY) === "1";
  });
  useEffect(() => {
    localStorage.setItem(SHOW_PRODUCT_KEY, showProductName ? "1" : "0");
  }, [showProductName]);

  const { data: partner } = useQuery({
    queryKey: ["partner-self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let { data } = await supabase.from("partners").select("*").eq("user_id", user!.id).maybeSingle();
      if (!data && user?.email) {
        const { data: be } = await supabase.from("partners").select("*").ilike("email", user.email).maybeSingle();
        data = be;
      }
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["partner-clients", partner?.id],
    enabled: !!partner?.id,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name, email, phone, status, created_at").eq("partner_id", partner!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["partner-commissions", partner?.id],
    enabled: !!partner?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_splits")
        .select("id, amount, percent, status, paid_at, created_at, sale_id, sales(clients(full_name), products(name))")
        .eq("beneficiary_type", "partner")
        .eq("beneficiary_id", partner!.id)
        .order("created_at", { ascending: false });
      return (data ?? []).map((c: any) => ({
        ...c,
        clients: c.sales?.clients,
        products: c.sales?.products,
      }));
    },
  });

  const kpis = useMemo(() => {
    const all = commissions as any[];
    const paid = all.filter((c) => c.status === "pago");
    const pending = all.filter((c) => c.status === "pendente");
    const totalPaid = paid.reduce((s, c) => s + Number(c.amount || 0), 0);
    const totalPending = pending.reduce((s, c) => s + Number(c.amount || 0), 0);

    const thisMonth = new Date(); const m = thisMonth.getMonth(); const y = thisMonth.getFullYear();
    const monthPaid = paid.filter((c) => { const d = c.paid_at ? new Date(c.paid_at) : new Date(c.created_at); return d.getMonth() === m && d.getFullYear() === y; })
      .reduce((s, c) => s + Number(c.amount || 0), 0);

    return {
      totalPaid, totalPending, monthPaid,
      clients: (clients as any[]).length,
      activeClients: (clients as any[]).filter((c) => c.status === "ativo").length,
    };
  }, [commissions, clients]);

  const firstName = (partner?.full_name || user?.user_metadata?.full_name || user?.email || "Parceiro").split(" ")[0];

  // ----- Edit profile -----
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", whatsapp: "", pix_key: "" });
  useEffect(() => {
    if (partner) {
      setForm({
        full_name: partner.full_name || "",
        email: partner.email || "",
        phone: partner.phone || "",
        whatsapp: partner.whatsapp || "",
        pix_key: partner.pix_key || "",
      });
    }
  }, [partner]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!partner?.id) throw new Error("Parceiro não encontrado");
      const { error } = await supabase.from("partners").update({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        whatsapp: form.whatsapp,
        pix_key: form.pix_key,
      }).eq("id", partner.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados de contato atualizados");
      qc.invalidateQueries({ queryKey: ["partner-self"] });
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const productLabel = (c: any) => (showProductName ? (c.products?.name || "") : "Produto contratado");

  return (
    <PanelShell role="parceiro" nav={NAV} activeKey={activeKey} onNavigate={onNavigate} userName={partner?.full_name}>
      <PanelContainer>
        {activeKey === "dashboard" && (
          <>
            <PanelHero
              role="parceiro"
              eyebrow="Painel do parceiro"
              title={<>Olá, {firstName} 👋</>}
              subtitle="Veja seus clientes, comissões e desempenho em tempo real."
              stats={[
                { label: "Comissão neste mês", value: formatBRL(kpis.monthPaid) },
                { label: "Comissões pagas", value: formatBRL(kpis.totalPaid) },
                { label: "A receber", value: formatBRL(kpis.totalPending) },
                { label: "Clientes ativos", value: kpis.activeClients },
              ]}
            />
            <div className="grid lg:grid-cols-3 gap-5">
              <SectionCard className="lg:col-span-2" title="Últimos clientes" icon={Users}>
                {clients.length === 0 ? <EmptyState icon={Inbox} title="Nenhum cliente ainda" /> :
                  <ul className="divide-y divide-slate-100 -mx-1">
                    {(clients as any[]).slice(0, 6).map((c) => (
                      <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="size-9 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center text-[11px] font-semibold">{initials(c.full_name)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-slate-900 truncate">{c.full_name}</p>
                          <p className="text-[11px] text-slate-500 truncate">desde {formatDate(c.created_at)}</p>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] border capitalize", CLIENT_TONE[c.status] || "bg-slate-100")}>{c.status}</Badge>
                      </li>
                    ))}
                  </ul>}
              </SectionCard>

              <SectionCard title="Comissões recentes" icon={Wallet}>
                {commissions.length === 0 ? <EmptyState icon={Clock} title="Sem comissões" /> :
                  <ul className="divide-y divide-slate-100 -mx-1">
                    {(commissions as any[]).slice(0, 5).map((c) => (
                      <li key={c.id} className="px-3 py-2.5">
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-[13px] font-semibold text-slate-900 tabular-nums">{formatBRL(c.amount)}</p>
                          <Badge variant="outline" className={cn("text-[10px] border capitalize", (c.status === "pago" || c.status === "paga") ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{c.status}</Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{c.clients?.full_name || "—"} · {productLabel(c)}</p>
                      </li>
                    ))}
                  </ul>}
              </SectionCard>
            </div>
          </>
        )}

        {activeKey === "clientes" && (
          <>
            <PanelHero role="parceiro" eyebrow="Carteira" title="Meus clientes" subtitle={`${clients.length} cliente(s) ativos sob sua parceria.`} />
            <SectionCard title="">
              {clients.length === 0 ? <EmptyState icon={Users} title="Sem clientes" /> :
                <ul className="divide-y divide-slate-100 -mx-1">
                  {(clients as any[]).map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-3 py-3">
                      <div className="size-10 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center text-[12px] font-semibold">{initials(c.full_name)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-slate-900 truncate">{c.full_name}</p>
                        <p className="text-[11.5px] text-slate-500 truncate">{c.email || c.phone || ""}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] border capitalize", CLIENT_TONE[c.status] || "bg-slate-100")}>{c.status}</Badge>
                    </li>
                  ))}
                </ul>}
            </SectionCard>
          </>
        )}

        {activeKey === "comissoes" && (
          <>
            <PanelHero role="parceiro" eyebrow="Financeiro" title="Comissões" subtitle="Histórico completo das suas comissões." stats={[
              { label: "Pagas", value: formatBRL(kpis.totalPaid) },
              { label: "Pendentes", value: formatBRL(kpis.totalPending) },
              { label: "Total", value: commissions.length },
              { label: "Mês atual", value: formatBRL(kpis.monthPaid) },
            ]} />
            <div className="flex items-center justify-end gap-2 mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowProductName((v) => !v)}
                className="gap-2 text-[12px]"
              >
                {showProductName ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                {showProductName ? "Ocultar nome do produto" : "Mostrar nome do produto"}
              </Button>
            </div>
            <SectionCard title="">
              {commissions.length === 0 ? <EmptyState icon={Wallet} title="Sem comissões" /> :
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100">
                        <th className="px-3 py-2.5">Cliente</th>
                        {showProductName && <th className="px-3 py-2.5">Produto</th>}
                        <th className="px-3 py-2.5 text-right">Valor</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(commissions as any[]).map((c) => (
                        <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                          <td className="px-3 py-2.5 text-slate-900 font-medium">{c.clients?.full_name || "—"}</td>
                          {showProductName && <td className="px-3 py-2.5 text-slate-600">{c.products?.name || "—"}</td>}
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold">{formatBRL(c.amount)}</td>
                          <td className="px-3 py-2.5"><Badge variant="outline" className={cn("text-[10px] border capitalize", (c.status === "pago" || c.status === "paga") ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{c.status}</Badge></td>
                          <td className="px-3 py-2.5 text-slate-500">{formatDate(c.paid_at || c.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}
            </SectionCard>
          </>
        )}

        {activeKey === "extrato" && (
          <>
            <PanelHero role="parceiro" eyebrow="Atividade" title="Extrato" subtitle="Linha do tempo das suas comissões." />
            <SectionCard title="">
              {commissions.length === 0 ? <EmptyState icon={FileText} title="Sem movimentações" /> :
                <ol className="relative border-l border-slate-200 ml-4 space-y-4 py-2">
                  {(commissions as any[]).map((c) => {
                    const paid = c.status === "pago" || c.status === "paga";
                    return (
                      <li key={c.id} className="pl-5 relative">
                        <span className={cn("absolute -left-[6px] top-1.5 size-3 rounded-full ring-4", paid ? "bg-emerald-500 ring-emerald-50" : "bg-amber-500 ring-amber-50")} />
                        <div className="flex flex-wrap items-baseline gap-x-3">
                          <p className="text-[13px] font-medium text-slate-900">{formatBRL(c.amount)} · {c.clients?.full_name || "—"}</p>
                          <p className="text-[11.5px] text-slate-500">{formatDate(c.paid_at || c.created_at)}</p>
                        </div>
                        <p className="text-[11.5px] text-slate-500 capitalize">{paid ? "Comissão paga" : "Aguardando pagamento"} · {productLabel(c)}</p>
                      </li>
                    );
                  })}
                </ol>}
            </SectionCard>
          </>
        )}

        {activeKey === "perfil" && (
          <>
            <PanelHero role="parceiro" eyebrow="Perfil" title="Sua conta" subtitle={user?.email} />

            <SectionCard title="Dados de contato" icon={UserCog}>
              <p className="text-[12px] text-slate-500 mb-4">
                Esses são os dados que nossa equipe usa para entrar em contato com você. Mantenha-os sempre atualizados.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Nome</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Telefone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!editing} className="mt-1" placeholder="(00) 0000-0000" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">WhatsApp</Label>
                  <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} disabled={!editing} className="mt-1" placeholder="(00) 00000-0000" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Chave PIX</Label>
                  <Input value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} disabled={!editing} className="mt-1" placeholder="CPF, e-mail, telefone ou chave aleatória" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-5">
                {editing ? (
                  <>
                    <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                      <Save className="size-4" /> {saveProfile.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button variant="outline" onClick={() => { setEditing(false); if (partner) setForm({ full_name: partner.full_name || "", email: partner.email || "", phone: partner.phone || "", whatsapp: partner.whatsapp || "", pix_key: partner.pix_key || "" }); }}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setEditing(true)} className="bg-indigo-600 hover:bg-indigo-700">Editar dados</Button>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Preferências" icon={Eye}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium text-slate-900">Mostrar nome do produto nas comissões</p>
                  <p className="text-[11.5px] text-slate-500">Quando desativado, listas e extrato mostram apenas o cliente e o valor.</p>
                </div>
                <Switch checked={showProductName} onCheckedChange={setShowProductName} />
              </div>
            </SectionCard>

            <SectionCard title="">
              <Button variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => signOut?.()}>Sair</Button>
            </SectionCard>
          </>
        )}
      </PanelContainer>
    </PanelShell>
  );
}
