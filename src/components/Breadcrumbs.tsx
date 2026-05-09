import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

const LABELS: Record<string, string> = {
  admin: "Dashboard",
  clientes: "Clientes",
  parceiros: "Parceiros",
  prestadores: "Prestadores",
  produtos: "Produtos",
  demandas: "Demandas",
  documentos: "Documentos",
  contratos: "Contratos",
  financeiro: "Financeiro",
  comissoes: "Comissões",
  vendas: "Vendas",
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
};

interface Props {
  /** Override labels for dynamic segments (e.g. { ":id": "João Silva" }) */
  override?: Record<string, string>;
}

export function Breadcrumbs({ override = {} }: Props) {
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
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground mb-4 flex-wrap">
      <Link to="/" className="hover:text-foreground transition-colors flex items-center gap-1">
        <Home className="size-3.5" />
      </Link>
      {crumbs.map((c, i) => (
        <span key={c.url} className="flex items-center gap-1">
          <ChevronRight className="size-3.5 opacity-50" />
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-foreground capitalize">{c.label}</span>
          ) : (
            <Link to={c.url} className="hover:text-foreground transition-colors capitalize">
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
