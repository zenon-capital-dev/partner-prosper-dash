import { formatBRL, formatDate, formatPhone, formatDoc } from "@/lib/format";
import { Mail, Phone, IdCard, MapPin, Calendar, User, Briefcase, Globe, Building2 } from "lucide-react";

export function ClientOverview({ client, stats }: any) {
  return (
    <div className="space-y-6 animate-fade-up">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="cp-panel p-6 space-y-4">
          <h3 className="text-sm font-bold tracking-tight mb-4 flex items-center gap-2">
            <User className="size-4 text-indigo-500" /> Dados Pessoais
          </h3>
          <DetailItem label="Nome Completo" value={client.full_name} />
          <DetailItem label="CPF/CNPJ" value={formatDoc(client.document)} />
          <DetailItem label="Data de Nascimento" value={client.birth_date ? formatDate(client.birth_date) : "—"} />
          <DetailItem label="Email" value={client.email} />
          <DetailItem label="Telefone" value={formatPhone(client.phone)} />
          <DetailItem label="WhatsApp" value={formatPhone(client.whatsapp || client.phone)} />
        </div>

        <div className="cp-panel p-6 space-y-4">
          <h3 className="text-sm font-bold tracking-tight mb-4 flex items-center gap-2">
            <Building2 className="size-4 text-indigo-500" /> Principal Empresa
          </h3>
          <DetailItem label="Razão Social" value={client.company} />
          <DetailItem label="Logradouro" value={client.address_street || client.address} />
          <DetailItem label="Número" value={client.address_number} />
          <DetailItem label="Bairro" value={client.address_neighborhood} />
          <DetailItem label="Cidade/UF" value={`${client.city || "—"} / ${client.state || "—"}`} />
          <DetailItem label="CEP" value={client.address_zip_code} />
        </div>

        <div className="cp-panel p-6 space-y-4">
          <h3 className="text-sm font-bold tracking-tight mb-4 flex items-center gap-2">
            <Briefcase className="size-4 text-indigo-500" /> Comercial
          </h3>
          <DetailItem label="Origem" value={client.source || "Direto"} />
          <DetailItem label="Status Atual" value={client.status?.replace(/_/g, " ").toUpperCase()} />
          <DetailItem label="Valor Total LTV" value={formatBRL(stats.totalRevenue)} />
          <DetailItem label="Data de Entrada" value={formatDate(client.created_at)} />
        </div>
      </div>

      <div className="cp-panel p-6">
        <h3 className="text-sm font-bold tracking-tight mb-4 flex items-center gap-2">
          <Globe className="size-4 text-indigo-500" /> Vínculos e Parcerias
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <DetailItem label="Parceiro/Indicador" value={client.partners?.full_name || "Nenhum"} />
          <DetailItem label="Colaborador Responsável" value={client.collaborator_id || "Não atribuído"} />
          <DetailItem label="Prestador Vinculado" value={client.service_provider_id || "Nenhum"} />
          <DetailItem label="Prioridade" value={client.priority || "Média"} />
        </div>
      </div>

      {client.internal_notes && (
        <div className="cp-panel p-6">
          <h3 className="text-sm font-bold tracking-tight mb-2">Observações Internas</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{client.internal_notes}</p>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}
