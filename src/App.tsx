import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ThemeProvider";
import AppLayout from "@/components/AppLayout";
import PanelLayout from "@/components/PanelLayout";
import { ThemeColorManager } from "@/components/ThemeColorManager";
import AdminLayout from "@/components/admin/AdminLayout";
import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { ConfirmRoot } from "@/lib/confirm";
import { useBodyScrollCleanup } from "@/hooks/use-body-scroll-cleanup";
import { RouteGuard } from "@/components/RouteGuard";
import { LegacyClientRedirect } from "@/components/LegacyClientRedirect";

const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/DashboardAdmin"));
const Clients = lazy(() => import("./pages/Clients"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Partners = lazy(() => import("./pages/Partners"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Sales = lazy(() => import("./pages/Sales"));
const Documents = lazy(() => import("./pages/Documents"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Automations = lazy(() => import("./pages/Automations"));
const ProviderDetail = lazy(() => import("./pages/ProviderDetail"));
const PartnerDetail = lazy(() => import("./pages/PartnerDetail"));
const AdminProfile = lazy(() => import("./pages/AdminProfile"));
const Finance = lazy(() => import("./pages/Finance"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const Indicators = lazy(() => import("./pages/Indicators"));
const Leads = lazy(() => import("./pages/Leads"));
const PartnerPanel = lazy(() => import("./pages/PartnerPanel"));
const PartnerMaterialsAdmin = lazy(() => import("./pages/PartnerMaterialsAdmin"));
const PartnerContractsAdmin = lazy(() => import("./pages/PartnerContractsAdmin"));
const PartnerSupportAdmin = lazy(() => import("./pages/PartnerSupportAdmin"));
const ClientSupportAdmin = lazy(() => import("./pages/ClientSupportAdmin"));
const RequestsInbox = lazy(() => import("./pages/RequestsInbox"));
const SupportHub = lazy(() => import("./pages/hubs/SupportHub"));
const ContractsHub = lazy(() => import("./pages/hubs/ContractsHub"));
const DocumentsHub = lazy(() => import("./pages/hubs/DocumentsHub"));
const MaterialsHub = lazy(() => import("./pages/hubs/MaterialsHub"));

const ClientPanel = lazy(() => import("./pages/ClientPanel"));
const ClientOnboarding = lazy(() => import("./pages/ClientOnboarding"));
const Collaborators = lazy(() => import("./pages/Collaborators"));
const Providers = lazy(() => import("./pages/Providers"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const CollaboratorPanel = lazy(() => import("./pages/CollaboratorPanel"));
const ProviderPanel = lazy(() => import("./pages/ProviderPanel"));
const ReferrerPanel = lazy(() => import("./pages/ReferrerPanel"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const RoleHome = lazy(() => import("./components/RoleHome"));
const MessageTemplates = lazy(() => import("./pages/MessageTemplates"));
const ProviderReports = lazy(() => import("./pages/ProviderReports"));
const ProviderPerformance = lazy(() => import("./pages/ProviderPerformance"));
const Demands = lazy(() => import("./pages/Demands"));
const DemandDetail = lazy(() => import("./pages/DemandDetail"));
const SLAPages = lazy(() => import("./pages/SLAPages"));
const OperationalCockpit = lazy(() => import("./pages/OperationalCockpit"));
const Proposals = lazy(() => import("./pages/Proposals"));
const FinanceCenter = lazy(() => import("./pages/FinanceCenter"));
const ResourcePools = lazy(() => import("./pages/ResourcePools"));
const SalesGoals = lazy(() => import("./pages/SalesGoals"));
const OperationalExpenses = lazy(() => import("./pages/OperationalExpenses"));
const ClientJourney = lazy(() => import("./pages/ClientJourney"));
const Agenda = lazy(() => import("./pages/Agenda"));
const NotificationsCenter = lazy(() => import("./pages/NotificationsCenter"));

function RouteFallback() {
  return <div className="min-h-dvh bg-background" />;
}

// Pré-carrega os chunks das rotas mais usadas no idle do browser
// (não muda nada visual, só evita o "tela branca" ao trocar de aba).
if (typeof window !== "undefined") {
  const warm = () => {
    const preload = [
      () => import("./pages/DashboardAdmin"),
      () => import("./pages/Clients"),
      () => import("./pages/ClientDetail"),
      () => import("./pages/Demands"),
      () => import("./pages/DemandDetail"),
      () => import("./pages/FinanceCenter"),
      () => import("./pages/Sales"),
      () => import("./pages/Agenda"),
      () => import("./pages/Leads"),
      () => import("./pages/ClientJourney"),
    ];
    preload.forEach((load, i) => setTimeout(() => { void load().catch(() => {}); }, i * 150));
  };
  const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, opts?: { timeout: number }) => number);
  if (ric) ric(warm, { timeout: 3000 });
  else setTimeout(warm, 2000);
}

function GlobalEffects() {
  useBodyScrollCleanup();
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Não refaz toda hora que troca de aba — evita travar o app a cada foco.
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      // 5min frescos + 10min em cache: trocar entre páginas vira instantâneo.
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
      // Mantém os dados antigos visíveis durante refetch — sem flash de "carregando".
      placeholderData: keepPreviousData,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" storageKey="crm-theme" enableSystem={true} disableTransitionOnChange>
      <TooltipProvider>
      <Toaster />
      <Sonner />
      <ConfirmRoot />
      <GlobalEffects />
      <ThemeColorManager />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/cadastro" element={<Navigate to="/auth" replace />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/cockpit" element={<OperationalCockpit />} />
              <Route path="/demandas" element={<Demands />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/atuacoes" element={<Navigate to="/agenda?kind=ligacao" replace />} />
              <Route path="/clientes" element={<Clients />} />
              <Route path="/clientes/:id" element={<ClientDetail />} />
              <Route path="/parceiros" element={<Partners />} />
              <Route path="/parceiros/:id" element={<PartnerDetail />} />
              <Route path="/parceiros-materiais" element={<PartnerMaterialsAdmin />} />
              <Route path="/parceiros-suporte" element={<PartnerSupportAdmin />} />
              <Route path="/clientes-suporte" element={<ClientSupportAdmin />} />
              <Route path="/parceiros-contratos" element={<PartnerContractsAdmin />} />
              <Route path="/hub/suporte" element={<SupportHub />} />
              <Route path="/hub/contratos" element={<ContractsHub />} />
              <Route path="/hub/documentos" element={<DocumentsHub />} />
              <Route path="/hub/materiais" element={<MaterialsHub />} />

              <Route path="/produtos" element={<Products />} />
              <Route path="/produtos/:id" element={<ProductDetail />} />
              <Route path="/indicadores" element={<Indicators />} />
              <Route path="/projetos" element={<Navigate to="/demandas" replace />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/colaboradores" element={<Collaborators />} />
              <Route path="/prestadores" element={<Providers />} />
              <Route path="/prestadores/reportes" element={<ProviderReports />} />
              <Route path="/prestadores/performance" element={<ProviderPerformance />} />
              <Route path="/prestadores/:id" element={<ProviderDetail />} />
              <Route path="/perfil" element={<AdminProfile />} />
              <Route path="/tarefas" element={<Navigate to="/agenda" replace />} />
              <Route path="/vendas" element={<Sales />} />
              <Route path="/propostas" element={<Proposals />} />
              <Route path="/comissoes" element={<Navigate to="/financeiro/central?tab=comissoes" replace />} />
              <Route path="/documentos" element={<Documents />} />
              
              <Route path="/financeiro" element={<Finance />} />
              <Route path="/financeiro/central" element={<FinanceCenter />} />
              <Route path="/financeiro/caixinhas" element={<ResourcePools />} />
              <Route path="/metas-comerciais" element={<SalesGoals />} />
              <Route path="/despesas-operacionais" element={<OperationalExpenses />} />
              <Route path="/esteira" element={<ClientJourney />} />
              <Route path="/relatorios" element={<Reports />} />
              <Route path="/auditoria" element={<AuditLog />} />
              <Route path="/sla" element={<SLAPages />} />
              <Route path="/configuracoes" element={<Settings />} />
              <Route path="/automacoes" element={<Automations />} />
              <Route path="/usuarios" element={<UsersPage />} />
              <Route path="/suporte" element={<Navigate to="/configuracoes" replace />} />
              <Route path="/templates" element={<MessageTemplates />} />
              <Route path="/solicitacoes" element={<RequestsInbox />} />
            </Route>



            {/* RoleHome roda fora de qualquer layout para não dar flash da sidebar admin
                em quem é cliente/parceiro/etc. antes de o redirect levar pro painel certo. */}
            <Route path="/" element={<RouteGuard><RoleHome /></RouteGuard>} />

            <Route element={<AppLayout />}>
              <Route path="/cliente/onboarding" element={<ClientOnboarding />} />
            </Route>

            <Route path="/demandas/:id" element={<RouteGuard><DemandDetail /></RouteGuard>} />
            <Route path="/minhas-solicitacoes" element={<RouteGuard><RequestsInbox /></RouteGuard>} />
            <Route path="/notificacoes" element={<RouteGuard><NotificationsCenter /></RouteGuard>} />


            <Route element={<PanelLayout />}>
              <Route path="/parceiro" element={<PartnerPanel />} />
              <Route path="/parceiro/:tab" element={<PartnerPanel />} />
              <Route path="/portal-cliente" element={<ClientPanel />} />
              <Route path="/portal-cliente/:tab" element={<ClientPanel />} />
              <Route path="/cliente" element={<LegacyClientRedirect />} />
              <Route path="/cliente/:tab" element={<LegacyClientRedirect />} />
              <Route path="/colaborador" element={<CollaboratorPanel />} />
              <Route path="/colaborador/:tab" element={<CollaboratorPanel />} />
              <Route path="/indicador" element={<ReferrerPanel />} />
              <Route path="/indicador/:tab" element={<ReferrerPanel />} />
              <Route path="/prestador" element={<ProviderPanel />} />
              <Route path="/prestador/:tab" element={<ProviderPanel />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
