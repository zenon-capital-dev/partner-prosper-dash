import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Partners from "./pages/Partners";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import Commissions from "./pages/Commissions";
import Documents from "./pages/Documents";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Contracts from "./pages/Contracts";
import Finance from "./pages/Finance";
import UsersPage from "./pages/UsersPage";
import Support from "./pages/Support";
import Indicators from "./pages/Indicators";
import Projects from "./pages/Projects";
import PartnerPanel from "./pages/PartnerPanel";
import ClientPanel from "./pages/ClientPanel";
import NotFound from "./pages/NotFound.tsx";
import RoleHome from "./components/RoleHome";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<RoleHome />} />
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/clientes" element={<Clients />} />
              <Route path="/clientes/:id" element={<ClientDetail />} />
              <Route path="/parceiros" element={<Partners />} />
              <Route path="/produtos" element={<Products />} />
              <Route path="/indicadores" element={<Indicators />} />
              <Route path="/projetos" element={<Projects />} />
              <Route path="/vendas" element={<Sales />} />
              <Route path="/comissoes" element={<Commissions />} />
              <Route path="/documentos" element={<Documents />} />
              <Route path="/contratos" element={<Contracts />} />
              <Route path="/financeiro" element={<Finance />} />
              <Route path="/relatorios" element={<Reports />} />
              <Route path="/configuracoes" element={<Settings />} />
              <Route path="/usuarios" element={<UsersPage />} />
              <Route path="/suporte" element={<Support />} />
              <Route path="/parceiro" element={<PartnerPanel />} />
              <Route path="/parceiro/clientes" element={<PartnerPanel />} />
              <Route path="/parceiro/comissoes" element={<PartnerPanel />} />
              <Route path="/cliente" element={<ClientPanel />} />
              <Route path="/cliente/documentos" element={<ClientPanel />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
