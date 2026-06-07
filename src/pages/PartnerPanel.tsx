import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Users, Wallet, FileText, UserCog, Inbox, Clock, Eye, EyeOff, Save,
  BookOpen, LifeBuoy, Download, ExternalLink, Plus, MessageSquare, FileSignature, Upload, FileCheck2,
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatBRL, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { key: "dashboard",  label: "Início",     icon: LayoutDashboard },
  { key: "clientes",   label: "Clientes",   icon: Users },
  { key: "comissoes",  label: "Comissões",  icon: Wallet, shortLabel: "Comissões" },
  { key: "extrato",    label: "Extrato",    icon: FileText },
  { key: "materiais",  label: "Materiais",  icon: BookOpen },
  { key: "contratos",  label: "Contratos",  icon: FileSignature },
  { key: "suporte",    label: "Suporte",    icon: LifeBuoy },
  { key: "perfil",     label: "Perfil",     icon: UserCog },
];

const MATERIAL_CATEGORIES: Record<string, string> = {
  institucional: "Institucional",
  vendas: "Argumentos de venda",
  treinamento: "Treinamentos",
  gatilhos: "Gatilhos mentais",
  produtos: "Produtos",
  outros: "Outros",
};

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
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name, email, phone, status, created_at").eq("partner_id", partner!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["partner-commissions", partner?.id],
    enabled: !!partner?.id,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 60_000,
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
  const emptyForm = {
    full_name: "", email: "", phone: "", whatsapp: "", document: "",
    pix_key: "", bank_name: "", bank_agency: "", bank_account: "", bank_account_type: "",
    address_zip: "", address_street: "", address_number: "", address_complement: "",
    address_neighborhood: "", address_city: "", address_state: "",
  };
  const [form, setForm] = useState(emptyForm);
  const hydrate = (p: any) => ({
    full_name: p?.full_name || "",
    email: p?.email || "",
    phone: p?.phone || "",
    whatsapp: p?.whatsapp || "",
    document: p?.document || "",
    pix_key: p?.pix_key || "",
    bank_name: p?.bank_name || "",
    bank_agency: p?.bank_agency || "",
    bank_account: p?.bank_account || "",
    bank_account_type: p?.bank_account_type || "",
    address_zip: p?.address_zip || "",
    address_street: p?.address_street || "",
    address_number: p?.address_number || "",
    address_complement: p?.address_complement || "",
    address_neighborhood: p?.address_neighborhood || "",
    address_city: p?.address_city || "",
    address_state: p?.address_state || "",
  });
  useEffect(() => { if (partner) setForm(hydrate(partner)); }, [partner]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!partner?.id) throw new Error("Parceiro não encontrado");
      const { error } = await supabase.from("partners").update(form as any).eq("id", partner.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados de contato atualizados");
      qc.invalidateQueries({ queryKey: ["partner-self"] });
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  // ----- Materials (read-only for partner) -----
  const { data: materials = [] } = useQuery({
    queryKey: ["partner-materials", partner?.id],
    enabled: !!partner?.id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("partner_materials").select("*").eq("active", true).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const downloadMaterial = async (m: any) => {
    if (m.external_url) { window.open(m.external_url, "_blank", "noopener"); return; }
    if (!m.file_path) return;
    const { data, error } = await supabase.storage.from("partner-materials").createSignedUrl(m.file_path, 60);
    if (error || !data?.signedUrl) { toast.error("Não foi possível abrir o arquivo"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  // ----- Support tickets -----
  const { data: tickets = [] } = useQuery({
    queryKey: ["partner-tickets", partner?.id],
    enabled: !!partner?.id,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await (supabase as any).from("partner_support_tickets").select("*").eq("partner_id", partner!.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: "", message: "", priority: "normal" });
  const submitTicket = useMutation({
    mutationFn: async () => {
      if (!partner?.id) throw new Error("Parceiro não encontrado");
      if (!ticketForm.subject.trim() || !ticketForm.message.trim()) throw new Error("Preencha assunto e mensagem");
      const { error } = await (supabase as any).from("partner_support_tickets").insert({
        partner_id: partner.id,
        user_id: user?.id,
        subject: ticketForm.subject.trim(),
        message: ticketForm.message.trim(),
        priority: ticketForm.priority,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chamado enviado. Nossa equipe responderá em breve.");
      setTicketOpen(false);
      setTicketForm({ subject: "", message: "", priority: "normal" });
      qc.invalidateQueries({ queryKey: ["partner-tickets"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao enviar chamado"),
  });

  // ----- Contratos -----
  const { data: contract } = useQuery({
    queryKey: ["partner-contract", partner?.id],
    enabled: !!partner?.id,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("partner_contracts").select("*").eq("partner_id", partner!.id).maybeSingle();
      return data;
    },
  });

  const emptyContract = {
    person_type: "pf",
    full_name: "", cpf: "", rg: "", rg_issuer: "", birth_date: "",
    marital_status: "", nationality: "Brasileira", profession: "",
    company_name: "", company_cnpj: "",
    legal_representative_name: "", legal_representative_cpf: "", legal_representative_role: "",
    email: "", phone: "", whatsapp: "",
    address_zip: "", address_street: "", address_number: "", address_complement: "",
    address_neighborhood: "", address_city: "", address_state: "",
    bank_name: "", bank_agency: "", bank_account: "", bank_account_type: "corrente", pix_key: "",
    notes: "",
  };
  const [contractForm, setContractForm] = useState<any>(emptyContract);
  useEffect(() => {
    if (contract) {
      setContractForm({ ...emptyContract, ...contract, birth_date: contract.birth_date || "" });
    } else if (partner) {
      const p: any = partner;
      setContractForm((cf: any) => ({
        ...cf,
        full_name: partner.full_name || cf.full_name,
        email: partner.email || cf.email,
        phone: partner.phone || cf.phone,
        whatsapp: partner.whatsapp || cf.whatsapp,
        cpf: partner.document || cf.cpf,
        address_zip: p.address_zip || cf.address_zip,
        address_street: p.address_street || cf.address_street,
        address_number: p.address_number || cf.address_number,
        address_complement: p.address_complement || cf.address_complement,
        address_neighborhood: p.address_neighborhood || cf.address_neighborhood,
        address_city: p.address_city || cf.address_city,
        address_state: p.address_state || cf.address_state,
        bank_name: partner.bank_name || cf.bank_name,
        bank_agency: partner.bank_agency || cf.bank_agency,
        bank_account: partner.bank_account || cf.bank_account,
        bank_account_type: p.bank_account_type || cf.bank_account_type,
        pix_key: partner.pix_key || cf.pix_key,
      }));
    }
  }, [contract, partner]);

  const contractLocked = contract?.status === "assinado";

  const saveContract = useMutation({
    mutationFn: async (submit: boolean) => {
      if (!partner?.id) throw new Error("Parceiro não encontrado");
      const payload: any = {
        ...contractForm,
        partner_id: partner.id,
        user_id: user?.id,
        birth_date: contractForm.birth_date || null,
      };
      if (submit) {
        payload.status = "enviado";
        payload.form_submitted_at = new Date().toISOString();
      }
      if (contract?.id) {
        const { error } = await (supabase as any).from("partner_contracts").update(payload).eq("id", contract.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("partner_contracts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_d, submit) => {
      toast.success(submit ? "Dados enviados para nossa equipe" : "Rascunho salvo");
      qc.invalidateQueries({ queryKey: ["partner-contract"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const downloadContractFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("partner-contracts").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) { toast.error("Não foi possível abrir o arquivo"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

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

        {activeKey === "materiais" && (
          <>
            <PanelHero role="parceiro" eyebrow="Educacional" title="Materiais" subtitle="Institucional, treinamentos, argumentos de vendas e gatilhos." />
            <SectionCard title="">
              {materials.length === 0 ? (
                <EmptyState icon={BookOpen} title="Nenhum material disponível" description="Assim que nossa equipe publicar materiais, eles aparecerão aqui." />
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(materials as any[]).map((m) => (
                    <div key={m.id} className="border border-slate-200/70 rounded-lg p-4 hover:shadow-md transition-shadow bg-white flex flex-col">
                      <Badge variant="outline" className="text-[10px] mb-2 w-fit capitalize">{MATERIAL_CATEGORIES[m.category] || m.category}</Badge>
                      <h3 className="font-semibold text-slate-900 text-[14px] mb-1">{m.title}</h3>
                      {m.description && <p className="text-[12px] text-slate-500 line-clamp-3 mb-3">{m.description}</p>}
                      <div className="mt-auto pt-3">
                        <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => downloadMaterial(m)}>
                          {m.external_url ? <><ExternalLink className="size-3.5" /> Acessar link</> : <><Download className="size-3.5" /> Baixar</>}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        )}

        {activeKey === "suporte" && (
          <>
            <PanelHero role="parceiro" eyebrow="Atendimento" title="Suporte" subtitle="Fale com nossa equipe — tire dúvidas, peça ajuda ou reporte problemas." />
            <div className="flex items-center justify-end mb-3">
              <Button onClick={() => setTicketOpen(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                <Plus className="size-4" /> Novo chamado
              </Button>
            </div>
            <SectionCard title="Seus chamados" icon={MessageSquare}>
              {tickets.length === 0 ? (
                <EmptyState icon={LifeBuoy} title="Nenhum chamado aberto" description="Clique em 'Novo chamado' para falar com nossa equipe." />
              ) : (
                <ul className="divide-y divide-slate-100 -mx-1">
                  {(tickets as any[]).map((t) => (
                    <li key={t.id} className="px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-[13.5px] font-semibold text-slate-900">{t.subject}</p>
                            <Badge variant="outline" className={cn("text-[10px] capitalize", t.priority === "alta" && "border-red-200 text-red-700 bg-red-50")}>{t.priority}</Badge>
                          </div>
                          <p className="text-[12px] text-slate-600 whitespace-pre-wrap">{t.message}</p>
                          {t.admin_response && (
                            <div className="mt-2 p-3 bg-indigo-50/60 border border-indigo-100 rounded">
                              <p className="text-[10px] uppercase tracking-wider font-bold text-indigo-700 mb-1">Resposta da equipe</p>
                              <p className="text-[12.5px] text-slate-700 whitespace-pre-wrap">{t.admin_response}</p>
                              {t.responded_at && <p className="text-[10px] text-slate-500 mt-1">{formatDate(t.responded_at)}</p>}
                            </div>
                          )}
                          <p className="text-[10.5px] text-slate-400 mt-1.5">Aberto em {formatDate(t.created_at)}</p>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] capitalize shrink-0", t.status === "aberto" ? "bg-amber-50 text-amber-700 border-amber-200" : t.status === "respondido" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-emerald-50 text-emerald-700 border-emerald-200")}>{t.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Novo chamado de suporte</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Assunto</Label>
                    <Input value={ticketForm.subject} onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })} maxLength={150} placeholder="Ex.: Dúvida sobre comissão" />
                  </div>
                  <div>
                    <Label>Prioridade</Label>
                    <Select value={ticketForm.priority} onValueChange={(v) => setTicketForm({ ...ticketForm, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Mensagem</Label>
                    <Textarea value={ticketForm.message} onChange={(e) => setTicketForm({ ...ticketForm, message: e.target.value })} rows={5} maxLength={2000} placeholder="Descreva sua dúvida ou solicitação..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTicketOpen(false)}>Cancelar</Button>
                  <Button onClick={() => submitTicket.mutate()} disabled={submitTicket.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                    {submitTicket.isPending ? "Enviando..." : "Enviar chamado"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Documento (CPF/CNPJ)</Label>
                  <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">WhatsApp</Label>
                  <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} disabled={!editing} className="mt-1" placeholder="(00) 00000-0000" />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Endereço" icon={UserCog}>
              <div className="grid sm:grid-cols-6 gap-4">
                <div className="sm:col-span-2">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">CEP</Label>
                  <Input value={form.address_zip} onChange={(e) => setForm({ ...form, address_zip: e.target.value })} disabled={!editing} className="mt-1" placeholder="00000-000" />
                </div>
                <div className="sm:col-span-4">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Rua</Label>
                  <Input value={form.address_street} onChange={(e) => setForm({ ...form, address_street: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div className="sm:col-span-1">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Número</Label>
                  <Input value={form.address_number} onChange={(e) => setForm({ ...form, address_number: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Complemento</Label>
                  <Input value={form.address_complement} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div className="sm:col-span-3">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Bairro</Label>
                  <Input value={form.address_neighborhood} onChange={(e) => setForm({ ...form, address_neighborhood: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div className="sm:col-span-4">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Cidade</Label>
                  <Input value={form.address_city} onChange={(e) => setForm({ ...form, address_city: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Estado (UF)</Label>
                  <Input value={form.address_state} onChange={(e) => setForm({ ...form, address_state: e.target.value })} disabled={!editing} className="mt-1" maxLength={2} />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Dados bancários" icon={UserCog}>
              <p className="text-[12px] text-slate-500 mb-4">Usamos esses dados para pagar suas comissões.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Chave PIX</Label>
                  <Input value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} disabled={!editing} className="mt-1" placeholder="CPF, e-mail, telefone ou chave aleatória" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Banco</Label>
                  <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Tipo de conta</Label>
                  <Select value={form.bank_account_type || "corrente"} onValueChange={(v) => setForm({ ...form, bank_account_type: v })} disabled={!editing}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Conta corrente</SelectItem>
                      <SelectItem value="poupanca">Conta poupança</SelectItem>
                      <SelectItem value="pagamento">Conta de pagamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Agência</Label>
                  <Input value={form.bank_agency} onChange={(e) => setForm({ ...form, bank_agency: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Conta</Label>
                  <Input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} disabled={!editing} className="mt-1" placeholder="00000-0" />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="">
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                      <Save className="size-4" /> {saveProfile.isPending ? "Salvando..." : "Salvar todos os dados"}
                    </Button>
                    <Button variant="outline" onClick={() => { setEditing(false); if (partner) setForm(hydrate(partner)); }}>Cancelar</Button>
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
