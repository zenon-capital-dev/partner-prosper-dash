import { ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Building2, ShoppingBag, FileText, ClipboardList, FileSignature,
  FilePlus2, MapPin, Mail, Phone, Clock, Download, Eye, Briefcase, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate, formatDoc, formatPhone } from "@/lib/format";

interface DossierClient {
  id: string; full_name: string | null; company: string | null; document: string | null;
  email: string | null; phone: string | null; whatsapp: string | null; status: string | null;
  source: string | null; created_at: string | null; city: string | null; state: string | null;
}
interface DossierCompany {
  id: string; name: string; trade_name: string | null; document: string | null; email: string | null; phone: string | null;
  address_street: string | null; address_number: string | null; address_neighborhood: string | null;
  address_city: string | null; address_state: string | null; address_zip_code: string | null;
}
interface DossierDemand {
  id: string; name: string; status: string | null; priority: string | null;
  deadline: string | null; sla_due_date: string | null; end_date: string | null; created_at: string | null;
}
interface DeliveryFile { path: string; name?: string; size?: number }
interface DossierDelivery {
  id: string; client_product_id: string; title: string; description: string | null; status: string | null;
  files: DeliveryFile[] | null; file_url: string | null; created_at: string | null;
}
interface DossierContract {
  id: string; client_product_id: string | null; name: string; contract_type: string | null; status: string | null;
  sent_at: string | null; signed_at: string | null; expires_at: string | null;
  file_path: string | null; signed_file_path: string | null; created_at: string | null;
}
export interface Dossier {
  client: DossierClient | null;
  companies: DossierCompany[];
  demands: DossierDemand[];
  deliveries: DossierDelivery[];
  contracts: DossierContract[];
}

const TABS = [
  { id: "empresas", label: "Empresas", icon: Building2 },
  { id: "produtos", label: "Produtos/Demandas", icon: ShoppingBag },
  { id: "documentos", label: "Documentos", icon: FileText },
  { id: "entregas", label: "Entregas", icon: ClipboardList },
  { id: "contratos", label: "Contratos", icon: FileSignature },
] as const;

function humanize(v?: string | null) {
  return v ? v.replace(/_/g, " ") : "—";
}

// Datas sem hora (prazos) não podem passar por fuso: "2026-11-10" vira 10/11/2026.
function formatDay(value: string | null | undefined) {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value ? formatDate(value) : "—";
}

function statusTone(status?: string | null) {
  const s = (status || "").toLowerCase();
  if (/(cancel|reprov|recus|inativo|vencid|atras)/.test(s)) return "bg-rose-50 text-rose-700 border-rose-200";
  if (/(conclu|finaliz|aprovad|assinad|entregue|ativo)/.test(s)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (/(aguard|pend|solicit|enviad|rascunho)/.test(s)) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function StatusBadge({ status }: { status?: string | null }) {
  return (
    <Badge variant="outline" className={cn("text-[9px] uppercase tracking-widest", statusTone(status))}>
      {humanize(status)}
    </Badge>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="p-10 text-center text-sm text-slate-500 border border-dashed border-slate-300 rounded-xl bg-white">{text}</div>
  );
}

function MiniStat({ label, value, icon, tone }: { label: string; value: number | string; icon: ReactNode; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm p-4 flex items-start justify-between gap-2">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
      </div>
      <div className={cn("size-10 rounded-xl flex items-center justify-center", tone)}>{icon}</div>
    </div>
  );
}

/**
 * Ficha do cliente no painel do prestador, no estilo da ficha do admin,
 * só com as abas Empresas, Produtos/Demandas, Documentos, Entregas e Contratos.
 * Tudo é só leitura, exceto a aba Documentos (solicitar e baixar).
 */
export function ProviderClientDossier({
  clientId, fallbackName, fallbackCompany, pendingDocs, overview, documentsTab, onBack, onRequest,
}: {
  clientId: string;
  fallbackName: string;
  fallbackCompany?: string | null;
  pendingDocs: number;
  overview?: ReactNode;
  documentsTab: ReactNode;
  onBack: () => void;
  onRequest?: () => void;
}) {
  const [tab, setTab] = useState<string>("documentos");

  const { data, isLoading, error } = useQuery({
    queryKey: ["provider-client-dossier", clientId],
    queryFn: async (): Promise<Dossier | null> => {
      const { data, error } = await (supabase as any).rpc("provider_client_dossier", { _client_id: clientId });
      if (error) throw error;
      return (data ?? null) as Dossier | null;
    },
    retry: false,
  });

  const client = data?.client ?? null;
  const name = client?.full_name || fallbackName;
  const company = client?.company || fallbackCompany || null;
  const demands = data?.demands ?? [];
  const demandName = (id: string | null) => demands.find((d) => d.id === id)?.name;
  const activeDemands = demands.filter((d) => !/(conclu|finaliz|cancel)/i.test(d.status || "")).length;
  const unavailable = !!error || (!isLoading && !data);

  async function openFile(bucket: string, path: string) {
    const { data: signed, error: err } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
    if (err || !signed) return toast.error("Arquivo disponível só para a equipe Zenon");
    window.open(signed.signedUrl, "_blank", "noopener");
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
        <ArrowLeft className="size-4" /> Todos os clientes
      </Button>

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="size-20 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-3xl font-bold text-indigo-600 shrink-0">
          {(name || "C").trim().charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 truncate">{name}</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
            {company && <span className="flex items-center gap-1.5"><Building2 className="size-4" />{company}</span>}
            {client?.email && <span className="flex items-center gap-1.5"><Mail className="size-4" />{client.email}</span>}
            {(client?.whatsapp || client?.phone) && (
              <span className="flex items-center gap-1.5"><Phone className="size-4" />{formatPhone(client.whatsapp || client.phone)}</span>
            )}
            {client?.status && <StatusBadge status={client.status} />}
          </div>
        </div>
        {onRequest && (
          <Button className="bg-indigo-600 hover:bg-indigo-700 gap-1.5 shrink-0" onClick={onRequest}>
            <FilePlus2 className="size-4" /> Solicitar documento
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Demandas ativas" value={activeDemands} icon={<ShoppingBag className="size-5 text-indigo-600" />} tone="bg-indigo-50" />
        <MiniStat label="Doc. pendentes" value={pendingDocs} icon={<FileText className="size-5 text-emerald-600" />} tone="bg-emerald-50" />
        <MiniStat label="Entregas" value={data?.deliveries.length ?? 0} icon={<ClipboardList className="size-5 text-amber-600" />} tone="bg-amber-50" />
        <MiniStat label="Contratos" value={data?.contracts.length ?? 0} icon={<FileSignature className="size-5 text-violet-600" />} tone="bg-violet-50" />
      </div>

      {unavailable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          Empresas, demandas, entregas e contratos ainda não estão disponíveis. Os documentos aparecem normalmente.
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <div className="-mx-1 overflow-x-auto pb-1">
          <TabsList className="bg-transparent border-b border-slate-200 justify-start rounded-none h-12 p-0 gap-6 sm:gap-8 px-1 flex-nowrap w-max min-w-full">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-3 pt-2 gap-2 text-sm text-slate-500 data-[state=active]:text-slate-900 whitespace-nowrap"
              >
                <t.icon className="size-4" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="empresas" className="m-0 space-y-4">
          {overview}
          {isLoading ? <Skeleton className="h-32 w-full rounded-xl" /> : (data?.companies.length ?? 0) === 0 ? (
            <Empty text={company ? `Nenhuma empresa cadastrada. Razão social principal: ${company}` : "Nenhuma empresa cadastrada."} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data!.companies.map((co) => (
                <div key={co.id} className="rounded-xl border border-slate-200/70 bg-white shadow-sm p-4 space-y-1">
                  <p className="font-bold text-sm text-slate-900 flex items-center gap-2"><Building2 className="size-4 text-indigo-600" />{co.name}</p>
                  {co.trade_name && <p className="text-xs text-slate-500">{co.trade_name}</p>}
                  {co.document && <p className="text-[11px] font-mono text-slate-500">{formatDoc(co.document)}</p>}
                  {(co.address_street || co.address_city) && (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <MapPin className="size-3" />
                      {[co.address_street, co.address_number, co.address_neighborhood].filter(Boolean).join(", ")}
                      {co.address_city ? ` · ${co.address_city}${co.address_state ? `/${co.address_state}` : ""}` : ""}
                      {co.address_zip_code ? ` · ${co.address_zip_code}` : ""}
                    </p>
                  )}
                  {(co.email || co.phone) && (
                    <p className="text-[11px] text-slate-500">{[co.email, co.phone ? formatPhone(co.phone) : null].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="produtos" className="m-0">
          {isLoading ? <Skeleton className="h-32 w-full rounded-xl" /> : demands.length === 0 ? (
            <Empty text="Nenhuma demanda sua com este cliente." />
          ) : (
            <div className="rounded-xl border border-slate-200/70 bg-white shadow-sm divide-y divide-slate-100">
              {demands.map((d) => (
                <div key={d.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="size-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                    <Briefcase className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">{d.name}</p>
                      <StatusBadge status={d.status} />
                      {d.priority && <Badge variant="outline" className="text-[9px] uppercase tracking-widest">{humanize(d.priority)}</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 flex flex-wrap gap-x-3">
                      <span>Aberta em {formatDay(d.created_at)}</span>
                      {(d.deadline || d.sla_due_date) && (
                        <span className="text-amber-600 flex items-center gap-1"><Clock className="size-3" />prazo {formatDay(d.deadline || d.sla_due_date)}</span>
                      )}
                      {d.end_date && <span>Concluída em {formatDay(d.end_date)}</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documentos" className="m-0 space-y-4">
          {documentsTab}
        </TabsContent>

        <TabsContent value="entregas" className="m-0">
          {isLoading ? <Skeleton className="h-32 w-full rounded-xl" /> : (data?.deliveries.length ?? 0) === 0 ? (
            <Empty text="Nenhuma entrega registrada nas suas demandas." />
          ) : (
            <div className="space-y-3">
              {data!.deliveries.map((dl) => {
                const files = (dl.files ?? []) as DeliveryFile[];
                return (
                  <div key={dl.id} className="rounded-xl border border-slate-200/70 bg-white shadow-sm p-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">{dl.title}</p>
                      <StatusBadge status={dl.status} />
                    </div>
                    <p className="text-xs text-slate-500 flex flex-wrap gap-x-3">
                      {demandName(dl.client_product_id) && <span>{demandName(dl.client_product_id)}</span>}
                      <span>Registrada em {formatDay(dl.created_at)}</span>
                    </p>
                    {dl.description && <p className="text-sm text-slate-600">{dl.description}</p>}
                    {files.length > 0 && (
                      <ul className="flex flex-wrap gap-2 pt-1">
                        {files.map((f) => (
                          <li key={f.path}>
                            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => openFile("documents", f.path)}>
                              <Download className="size-3.5" /> {f.name || f.path.split("/").pop()}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {dl.file_url && (
                      <a href={dl.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 underline">Abrir link da entrega</a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="contratos" className="m-0">
          {isLoading ? <Skeleton className="h-32 w-full rounded-xl" /> : (data?.contracts.length ?? 0) === 0 ? (
            <Empty text="Nenhum contrato ligado às suas demandas." />
          ) : (
            <div className="rounded-xl border border-slate-200/70 bg-white shadow-sm divide-y divide-slate-100">
              {data!.contracts.map((ct) => (
                <div key={ct.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="size-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 shrink-0">
                    <FileSignature className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">{ct.name}</p>
                      <StatusBadge status={ct.status} />
                    </div>
                    <p className="text-xs text-slate-500 flex flex-wrap gap-x-3">
                      {ct.contract_type && <span>{humanize(ct.contract_type)}</span>}
                      {demandName(ct.client_product_id) && <span>{demandName(ct.client_product_id)}</span>}
                      {ct.signed_at ? <span>Assinado em {formatDay(ct.signed_at)}</span> : ct.sent_at ? <span>Enviado em {formatDay(ct.sent_at)}</span> : null}
                      {ct.expires_at && <span>Vence em {formatDay(ct.expires_at)}</span>}
                    </p>
                  </div>
                  {(ct.signed_file_path || ct.file_path) && (
                    <Button size="sm" variant="ghost" onClick={() => openFile("contracts", (ct.signed_file_path || ct.file_path)!)}>
                      <Eye className="size-3.5 mr-1" /> Ver
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
