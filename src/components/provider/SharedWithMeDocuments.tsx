import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Download, Eye, FolderOpen, Search, Share2, Clock, User, Building2, Briefcase,
  FilePlus2, ArrowLeft, Users, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate, formatBRL, formatPhone } from "@/lib/format";

interface SharedDoc {
  id: string;
  can_download: boolean;
  message: string | null;
  expires_at: string | null;
  viewed_at: string | null;
  created_at: string;
  documents: { id: string; name: string; file_path: string | null; client_id: string | null } | null;
}

interface Demand { id: string; name: string; status: string | null; created_at: string | null }

interface ClientProfile {
  client_id: string;
  full_name: string | null;
  document: string | null;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  company: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  city: string | null;
  state: string | null;
  address_zip_code: string | null;
  source: string | null;
  status: string | null;
  created_at: string | null;
  ltv: number | null;
  demands: Demand[] | null;
}

interface DemandDoc {
  id: string;
  name: string;
  status: string;
  description: string | null;
  due_date: string | null;
  file_path: string | null;
  client_id: string | null;
  client_product_id: string | null;
  created_at: string;
}

const DOC_STATUS: Record<string, { label: string; tone: string }> = {
  solicitado: { label: "Solicitado", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  enviado: { label: "Enviado", tone: "bg-blue-50 text-blue-700 border-blue-200" },
  em_analise: { label: "Em análise", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  aprovado: { label: "Aprovado", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  reprovado: { label: "Rejeitado", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  pendente_correcao: { label: "Reenvio", tone: "bg-orange-50 text-orange-700 border-orange-200" },
  vencido: { label: "Vencido", tone: "bg-slate-100 text-slate-700 border-slate-200" },
};

const NO_CLIENT = "__sem_cliente__";

function clientLabel(p?: ClientProfile | null) {
  return p?.company || p?.full_name || "Cliente";
}

/**
 * Painel do prestador: clientes que ele atende, com perfil resumido,
 * documentos compartilhados/da demanda e solicitação de novos documentos.
 */
export function SharedWithMeDocuments() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  // Perfis dos clientes atendidos (função do banco provider_client_profiles)
  const { data: profiles = [], isLoading: loadingProfiles, error: profilesError } = useQuery({
    queryKey: ["provider-client-profiles"],
    queryFn: async (): Promise<ClientProfile[]> => {
      const { data, error } = await (supabase as any).rpc("provider_client_profiles");
      if (error) throw error;
      return (data ?? []) as ClientProfile[];
    },
    retry: false,
  });

  const { data: shares = [], isLoading: loadingShares, error: sharesError } = useQuery({
    queryKey: ["shared-with-me"],
    queryFn: async (): Promise<SharedDoc[]> => {
      const { data, error } = await (supabase as any)
        .from("document_shares")
        .select("id, can_download, message, expires_at, viewed_at, created_at, documents(id, name, file_path, client_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const demandIds = useMemo(
    () => profiles.flatMap((p) => (p.demands ?? []).map((d) => d.id)),
    [profiles],
  );

  // Documentos das demandas que o prestador atende (inclui os solicitados por ele)
  const { data: demandDocs = [] } = useQuery({
    queryKey: ["provider-demand-docs", demandIds],
    enabled: demandIds.length > 0,
    queryFn: async (): Promise<DemandDoc[]> => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, status, description, due_date, file_path, client_id, client_product_id, created_at")
        .in("client_product_id", demandIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DemandDoc[];
    },
  });

  const activeShares = useMemo(() => {
    const now = Date.now();
    return shares.filter((d) => d.documents && (!d.expires_at || new Date(d.expires_at).getTime() > now));
  }, [shares]);

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.client_id, p])), [profiles]);

  // Lista de clientes: perfis + clientes que só aparecem via compartilhamento
  const clients = useMemo(() => {
    const map = new Map<string, { id: string; profile: ClientProfile | null; shared: number; newCount: number; pending: number }>();
    for (const p of profiles) map.set(p.client_id, { id: p.client_id, profile: p, shared: 0, newCount: 0, pending: 0 });
    for (const s of activeShares) {
      const key = s.documents!.client_id || NO_CLIENT;
      const row = map.get(key) ?? { id: key, profile: profileById.get(key) ?? null, shared: 0, newCount: 0, pending: 0 };
      row.shared += 1;
      if (!s.viewed_at) row.newCount += 1;
      map.set(key, row);
    }
    for (const d of demandDocs) {
      if (!d.client_id) continue;
      const row = map.get(d.client_id);
      if (row && ["solicitado", "pendente_correcao"].includes(d.status)) row.pending += 1;
    }
    const q = search.trim().toLowerCase();
    return [...map.values()]
      .filter((c) => {
        if (!q) return true;
        const name = c.id === NO_CLIENT ? "sem cliente" : clientLabel(c.profile).toLowerCase();
        const person = (c.profile?.full_name || "").toLowerCase();
        return name.includes(q) || person.includes(q);
      })
      .sort((a, b) => {
        if (a.id === NO_CLIENT) return 1;
        if (b.id === NO_CLIENT) return -1;
        return clientLabel(a.profile).localeCompare(clientLabel(b.profile));
      });
  }, [profiles, activeShares, demandDocs, profileById, search]);

  const selected = selectedId ? clients.find((c) => c.id === selectedId) ?? null : null;
  const selectedProfile = selected?.profile ?? null;
  const selectedShares = useMemo(
    () => activeShares.filter((s) => (s.documents!.client_id || NO_CLIENT) === selectedId),
    [activeShares, selectedId],
  );
  const selectedDemandDocs = useMemo(
    () => demandDocs.filter((d) => d.client_id === selectedId),
    [demandDocs, selectedId],
  );

  async function openShared(d: SharedDoc, download: boolean) {
    const path = d.documents?.file_path;
    if (!path) return;
    const { data: signed, error } = await supabase.storage.from("documents")
      .createSignedUrl(path, 300, download ? { download: d.documents!.name } : undefined);
    if (error || !signed) { toast.error("Não foi possível abrir o arquivo"); return; }
    window.open(signed.signedUrl, "_blank", "noopener");
    if (!d.viewed_at) {
      await (supabase as any).from("document_shares").update({ viewed_at: new Date().toISOString() }).eq("id", d.id);
      qc.invalidateQueries({ queryKey: ["shared-with-me"] });
    }
  }

  async function openDemandDoc(d: DemandDoc) {
    if (!d.file_path) return;
    const { data: signed, error } = await supabase.storage.from("documents").createSignedUrl(d.file_path, 300);
    if (error || !signed) { toast.error("Não foi possível abrir o arquivo"); return; }
    window.open(signed.signedUrl, "_blank", "noopener");
  }

  const isLoading = loadingProfiles || loadingShares;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Share2 className="size-4 text-teal-600" /> Compartilhados comigo
          </h2>
          <p className="text-sm text-slate-500">Clientes que você atende e os documentos de cada um.</p>
        </div>
        {!selected && (
          <div className="relative sm:w-72">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-8" placeholder="Buscar cliente" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        )}
      </div>

      {profilesError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          Os dados do perfil dos clientes ainda não estão disponíveis. Os documentos aparecem normalmente.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : sharesError && clients.length === 0 ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-sm font-medium text-rose-700">Não foi possível carregar os documentos compartilhados.</p>
          <p className="text-xs text-rose-600 mt-1">{(sharesError as any)?.message || "Erro desconhecido"}</p>
        </div>
      ) : !selected ? (
        clients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <FolderOpen className="size-8 mx-auto text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-700">Nenhum cliente por aqui ainda</p>
            <p className="text-xs text-slate-500">Quando você atender uma demanda ou a equipe liberar arquivos, os clientes aparecem aqui.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {clients.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="text-left rounded-xl border border-slate-200/70 bg-white shadow-sm p-4 hover:border-teal-300 hover:shadow transition"
              >
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
                    {c.id === NO_CLIENT ? <FileText className="size-5" /> : <Building2 className="size-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 truncate">
                      {c.id === NO_CLIENT ? "Documentos sem cliente" : clientLabel(c.profile)}
                    </p>
                    {c.profile?.company && c.profile?.full_name && (
                      <p className="text-xs text-slate-500 truncate">{c.profile.full_name}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(c.profile?.demands?.length ?? 0) > 0 && (
                        <Badge variant="outline" className="text-[10px]">{c.profile!.demands!.length} demanda(s)</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">{c.shared} compartilhado(s)</Badge>
                      {c.newCount > 0 && <Badge className="bg-teal-600 text-[10px]">{c.newCount} novo(s)</Badge>}
                      {c.pending > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">{c.pending} pendente(s)</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} className="gap-1.5">
              <ArrowLeft className="size-4" /> <Users className="size-4" /> Todos os clientes
            </Button>
            {selectedProfile && (selectedProfile.demands?.length ?? 0) > 0 && (
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 gap-1.5" onClick={() => setRequestOpen(true)}>
                <FilePlus2 className="size-4" /> Solicitar documento
              </Button>
            )}
          </div>

          <h3 className="text-xl font-bold text-slate-900">
            {selected.id === NO_CLIENT ? "Documentos sem cliente" : clientLabel(selectedProfile)}
          </h3>

          {selectedProfile && <ClientProfileCards p={selectedProfile} />}

          {selectedDemandDocs.length > 0 && (
            <section className="rounded-xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
              <header className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Briefcase className="size-4 text-teal-600" /> Documentos das demandas
                </span>
                <Badge variant="outline" className="text-[10px]">{selectedDemandDocs.length}</Badge>
              </header>
              <ul className="divide-y divide-slate-100">
                {selectedDemandDocs.map((d) => {
                  const st = DOC_STATUS[d.status] ?? DOC_STATUS.solicitado;
                  const demand = selectedProfile?.demands?.find((x) => x.id === d.client_product_id);
                  return (
                    <li key={d.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900 truncate">{d.name}</span>
                          <Badge variant="outline" className={cn("text-[9px] uppercase tracking-widest", st.tone)}>{st.label}</Badge>
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap gap-x-3">
                          {demand && <span>{demand.name}</span>}
                          <span>Criado {formatDate(d.created_at)}</span>
                          {d.due_date && <span className="text-amber-600 flex items-center gap-1"><Clock className="size-3" />prazo {formatDate(d.due_date)}</span>}
                        </div>
                        {d.description && <p className="text-xs text-slate-600 mt-1">{d.description}</p>}
                      </div>
                      {d.file_path && (
                        <Button size="sm" variant="ghost" onClick={() => openDemandDoc(d)}><Eye className="size-3.5 mr-1" />Ver</Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
            <header className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Share2 className="size-4 text-teal-600" /> Compartilhados com você
              </span>
              <Badge variant="outline" className="text-[10px]">{selectedShares.length} arquivo(s)</Badge>
            </header>
            {selectedShares.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Nenhum arquivo compartilhado deste cliente.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {selectedShares.map((d) => (
                  <li key={d.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">{d.documents!.name}</span>
                        {!d.viewed_at && <Badge className="bg-teal-600 text-[9px] h-4 px-1.5">Novo</Badge>}
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap gap-x-3">
                        <span>Recebido {formatDate(d.created_at)}</span>
                        {d.expires_at && <span className="text-amber-600 flex items-center gap-1"><Clock className="size-3" />até {formatDate(d.expires_at)}</span>}
                      </div>
                      {d.message && <p className="text-xs text-slate-600 mt-1 italic">“{d.message}”</p>}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => openShared(d, false)}><Eye className="size-3.5 mr-1" />Ver</Button>
                    {d.can_download && <Button size="sm" variant="outline" onClick={() => openShared(d, true)}><Download className="size-3.5 mr-1" />Baixar</Button>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {selectedProfile && (
        <RequestDocumentDialog
          open={requestOpen}
          onOpenChange={setRequestOpen}
          profile={selectedProfile}
          userId={user?.id ?? null}
          onCreated={() => qc.invalidateQueries({ queryKey: ["provider-demand-docs"] })}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-sm text-slate-900 break-words">{value || "—"}</p>
    </div>
  );
}

function ClientProfileCards({ p }: { p: ClientProfile }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="rounded-xl border border-slate-200/70 bg-white shadow-sm p-4 space-y-3">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2"><User className="size-4 text-indigo-600" /> Dados Pessoais</h4>
        <Field label="Nome completo" value={p.full_name} />
        <Field label="CPF/CNPJ" value={p.document} />
        <Field label="Data de nascimento" value={p.birth_date ? formatDate(p.birth_date) : null} />
        <Field label="Email" value={p.email} />
        <Field label="Telefone" value={p.phone ? formatPhone(p.phone) : null} />
        <Field label="WhatsApp" value={p.whatsapp || p.phone ? formatPhone(p.whatsapp || p.phone) : null} />
      </div>
      <div className="rounded-xl border border-slate-200/70 bg-white shadow-sm p-4 space-y-3">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Building2 className="size-4 text-indigo-600" /> Principal Empresa</h4>
        <Field label="Razão social" value={p.company} />
        <Field label="Logradouro" value={p.address_street} />
        <Field label="Número" value={p.address_number} />
        <Field label="Bairro" value={p.address_neighborhood} />
        <Field label="Cidade/UF" value={`${p.city || "—"} / ${p.state || "—"}`} />
        <Field label="CEP" value={p.address_zip_code} />
      </div>
      <div className="rounded-xl border border-slate-200/70 bg-white shadow-sm p-4 space-y-3">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Briefcase className="size-4 text-indigo-600" /> Comercial</h4>
        <Field label="Origem" value={p.source || "Direto"} />
        <Field label="Status atual" value={p.status?.replace(/_/g, " ").toUpperCase()} />
        <Field label="Valor total LTV" value={formatBRL(Number(p.ltv || 0))} />
        <Field label="Data de entrada" value={p.created_at ? formatDate(p.created_at) : null} />
      </div>
    </div>
  );
}

function RequestDocumentDialog({
  open, onOpenChange, profile, userId, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile: ClientProfile;
  userId: string | null;
  onCreated: () => void;
}) {
  const demands = profile.demands ?? [];
  const [demandId, setDemandId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const effectiveDemand = demandId || (demands.length === 1 ? demands[0].id : "");

  function reset() {
    setDemandId(""); setName(""); setDescription(""); setDueDate("");
  }

  async function submit() {
    if (!effectiveDemand) return toast.error("Selecione a demanda");
    if (!name.trim()) return toast.error("Informe o nome do documento");
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("documents").insert({
      client_id: profile.client_id,
      client_product_id: effectiveDemand,
      name: name.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      status: "solicitado",
      source: "provider_upload",
      is_required: true,
      requested_by: userId,
      requested_at: now,
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Solicitação enviada. O cliente e a equipe já podem ver.");
    reset();
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar documento</DialogTitle>
          <DialogDescription>
            O pedido aparece para o cliente {clientLabel(profile)} e para a equipe Zenon.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Demanda *</Label>
            <Select value={effectiveDemand} onValueChange={setDemandId}>
              <SelectTrigger><SelectValue placeholder="Selecione a demanda" /></SelectTrigger>
              <SelectContent>
                {demands.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}{d.created_at ? ` · aberta em ${formatDate(d.created_at)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Documento *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Balancete 2º trimestre" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Observação para o cliente</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explique o que precisa (opcional)" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Prazo</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
            {saving ? "Enviando..." : "Enviar solicitação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
