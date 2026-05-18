import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  admin: "Dashboard",
  cliente: "Painel",
  parceiro: "Painel",
  prestador: "Painel",
  indicador: "Painel",
  clientes: "Clientes",
  parceiros: "Parceiros",
  prestadores: "Prestadores",
  produtos: "Produtos",
  demandas: "Demandas",
  documentos: "Documentos",
  contratos: "Contratos",
  financeiro: "Financeiro",
  central: "Central",
  comissoes: "Comissões",
  vendas: "Vendas",
  propostas: "Propostas",
  leads: "Leads",
  tarefas: "Tarefas",
  relatorios: "Relatórios",
  auditoria: "Auditoria",
  configuracoes: "Configurações",
  automacoes: "Automações",
  perfil: "Perfil",
  performance: "Performance",
  reportes: "Reportes",
  usuarios: "Usuários",
  templates: "Templates",
  suporte: "Suporte",
  colaboradores: "Colaboradores",
  indicadores: "Indicadores",
  projetos: "Projetos",
  cockpit: "Alertas",
  sla: "SLA",
};

interface Props {
  /** Override labels for dynamic segments (e.g. { ":id": "João Silva" }) */
  override?: Record<string, string>;
  className?: string;
}

export function Breadcrumbs({ override = {}, className }: Props) {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 0) return null;

  const crumbs = parts.map((seg, i) => {
    const url = "/" + parts.slice(0, i + 1).join("/");
    const isUUID = /^[0-9a-f-]{20,}$/i.test(seg);
    const label = override[seg] || (isUUID ? "Detalhe" : LABELS[seg] || seg.replace(/-/g, " "));
    return { url, label };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground/70 flex-wrap",
        className
      )}
    >
      <Link
        to="/"
        className="hover:text-foreground transition-colors flex items-center"
        aria-label="Início"
      >
        <Home className="size-3" strokeWidth={2.25} />
      </Link>
      {crumbs.map((c, i) => (
        <span key={c.url} className="flex items-center gap-1.5">
          <ChevronRight className="size-3 text-muted-foreground/40" strokeWidth={2.25} />
          {i === crumbs.length - 1 ? (
            <span className="text-foreground capitalize tracking-tight">{c.label}</span>
          ) : (
            <Link
              to={c.url}
              className="hover:text-foreground transition-colors capitalize tracking-tight"
            >
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
