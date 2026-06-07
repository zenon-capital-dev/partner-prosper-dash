import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ThemeProvider";
import AppLayout from "@/components/AppLayout";
import { ThemeColorManager } from "@/components/ThemeColorManager";
import AdminLayout from "@/components/admin/AdminLayout";
import Auth from "./pages/Auth";
import { Navigate } from "react-router-dom";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/DashboardAdmin";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Partners from "./pages/Partners";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Sales from "./pages/Sales";
import Commissions from "./pages/Commissions";
import Documents from "./pages/Documents";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Automations from "./pages/Automations";
import ProviderDetail from "./pages/ProviderDetail";
import PartnerDetail from "./pages/PartnerDetail";
import AdminProfile from "./pages/AdminProfile";

import Finance from "./pages/Finance";
import UsersPage from "./pages/UsersPage";
import Indicators from "./pages/Indicators";
import Leads from "./pages/Leads";
import PartnerPanel from "./pages/PartnerPanel";
import PartnerMaterialsAdmin from "./pages/PartnerMaterialsAdmin";
import PartnerContractsAdmin from "./pages/PartnerContractsAdmin";
import PartnerSupportAdmin from "./pages/PartnerSupportAdmin";
import ClientPanel from "./pages/ClientPanel";
import ClientOnboarding from "./pages/ClientOnboarding";
import Collaborators from "./pages/Collaborators";
import Providers from "./pages/Providers";
import Tasks from "./pages/Tasks";
import AuditLog from "./pages/AuditLog";
import CollaboratorPanel from "./pages/CollaboratorPanel";
import ProviderPanel from "./pages/ProviderPanel";
import ReferrerPanel from "./pages/ReferrerPanel";
import NotFound from "./pages/NotFound.tsx";
import RoleHome from "./components/RoleHome";
import MessageTemplates from "./pages/MessageTemplates";
import ProviderReports from "./pages/ProviderReports";
import ProviderPerformance from "./pages/ProviderPerformance";
import Demands from "./pages/Demands";
import DemandDetail from "./pages/DemandDetail";
import SLAPages from "./pages/SLAPages";
import OperationalCockpit from "./pages/OperationalCockpit";
import Proposals from "./pages/Proposals";
import FinanceCenter from "./pages/FinanceCenter";
import Atuacoes from "./pages/Atuacoes";
import Agenda from "./pages/Agenda";
import Support from "./pages/Support";
import { ConfirmRoot } from "@/lib/confirm";
import { useBodyScrollCleanup } from "@/hooks/use-body-scroll-cleanup";

function GlobalEffects() {
  useBodyScrollCleanup();
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
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
              <Route path="/demandas/:id" element={<DemandDetail />} />
              <Route path="/clientes" element={<Clients />} />
              <Route path="/clientes/:id" element={<ClientDetail />} />
              <Route path="/parceiros" element={<Partners />} />
              <Route path="/parceiros/:id" element={<PartnerDetail />} />
              <Route path="/parceiros-materiais" element={<PartnerMaterialsAdmin />} />
              <Route path="/parceiros-suporte" element={<PartnerSupportAdmin />} />
              <Route path="/parceiros-contratos" element={<PartnerContractsAdmin />} />
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
              <Route path="/comissoes" element={<Commissions />} />
              <Route path="/documentos" element={<Documents />} />
              
              <Route path="/financeiro" element={<Finance />} />
              <Route path="/financeiro/central" element={<FinanceCenter />} />
              <Route path="/relatorios" element={<Reports />} />
              <Route path="/auditoria" element={<AuditLog />} />
              <Route path="/sla" element={<SLAPages />} />
              <Route path="/configuracoes" element={<Settings />} />
              <Route path="/automacoes" element={<Automations />} />
              <Route path="/usuarios" element={<UsersPage />} />
              <Route path="/suporte" element={<Navigate to="/configuracoes" replace />} />
              <Route path="/templates" element={<MessageTemplates />} />
            </Route>
            <Route element={<AppLayout />}>
              <Route path="/" element={<RoleHome />} />
              <Route path="/parceiro" element={<PartnerPanel />} />
              <Route path="/parceiro/:tab" element={<PartnerPanel />} />
              <Route path="/cliente/onboarding" element={<ClientOnboarding />} />
              <Route path="/cliente/suporte" element={<Support />} />
              <Route path="/portal-cliente" element={<ClientPanel />} />
              <Route path="/portal-cliente/:tab" element={<ClientPanel />} />
              <Route path="/cliente" element={<Navigate to="/portal-cliente" replace />} />
              <Route path="/cliente/:tab" element={<Navigate to="/portal-cliente" replace />} />
              <Route path="/colaborador" element={<CollaboratorPanel />} />
              <Route path="/colaborador/:tab" element={<CollaboratorPanel />} />
              <Route path="/indicador" element={<ReferrerPanel />} />
              <Route path="/indicador/:tab" element={<ReferrerPanel />} />
              <Route path="/prestador" element={<ProviderPanel />} />
              <Route path="/prestador/:tab" element={<ProviderPanel />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
