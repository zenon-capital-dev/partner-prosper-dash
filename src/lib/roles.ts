// Fonte única de roles e helpers de permissão.
export const ROLES = [
  "admin",
  "admin_secondary",
  "colaborador",
  "vendedor",
  "parceiro",
  "prestador",
  "cliente",
  "lead",
  "indicador",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  admin_secondary: "Administrador Secundário",
  colaborador: "Colaborador",
  vendedor: "Vendedor",
  parceiro: "Parceiro",
  prestador: "Prestador",
  cliente: "Cliente",
  lead: "Lead",
  indicador: "Indicador",
};

export const isAdmin = (roles: Role[] | string[]) =>
  roles.includes("admin" as Role) || roles.includes("admin_secondary" as Role);

export const isCollaborator = (roles: Role[] | string[]) =>
  roles.includes("colaborador" as Role);

export const isPartner = (roles: Role[] | string[]) =>
  roles.includes("parceiro" as Role);

export const isProvider = (roles: Role[] | string[]) =>
  roles.includes("prestador" as Role);

/** Quem pode escrever na ficha de cliente: admin e admin_secondary. Colaborador é read-only. */
export const canWriteClient = (roles: Role[] | string[]) => isAdmin(roles);

/** Roteamento padrão por perfil. */
export const homeForRoles = (roles: Role[] | string[]): string => {
  if (isAdmin(roles)) return "/admin/dashboard";
  if (isCollaborator(roles)) return "/colaborador";
  if (isPartner(roles)) return "/parceiro";
  if (isProvider(roles)) return "/prestador";
  if ((roles as string[]).includes("cliente")) return "/cliente";
  return "/";
};
