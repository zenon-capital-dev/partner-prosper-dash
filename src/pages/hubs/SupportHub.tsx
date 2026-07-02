import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LifeBuoy, Users, MessageSquare } from "lucide-react";

const PartnerSupportAdmin = lazy(() => import("@/pages/PartnerSupportAdmin"));
const ClientSupportAdmin = lazy(() => import("@/pages/ClientSupportAdmin"));
const RequestsInbox = lazy(() => import("@/pages/RequestsInbox"));

export default function SupportHub() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "parceiros";
  const set = (t: string) => { params.set("tab", t); setParams(params, { replace: true }); };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <LifeBuoy className="size-5 text-indigo-700" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-950 tracking-tight">Suporte</h1>
          <p className="text-[13px] text-slate-500">Atendimento a parceiros, clientes e solicitações internas</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={set}>
        <TabsList className="bg-white border border-slate-200/70 rounded-lg p-1 shadow-sm">
          <TabsTrigger value="parceiros" className="gap-1.5 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            <LifeBuoy className="size-3.5" /> Parceiros
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-1.5 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            <Users className="size-3.5" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="solicitacoes" className="gap-1.5 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            <MessageSquare className="size-3.5" /> Solicitações
          </TabsTrigger>
        </TabsList>
        <Suspense fallback={<div className="p-8 text-center text-slate-500 text-sm">Carregando…</div>}>
          <TabsContent value="parceiros" className="mt-4"><PartnerSupportAdmin /></TabsContent>
          <TabsContent value="clientes" className="mt-4"><ClientSupportAdmin /></TabsContent>
          <TabsContent value="solicitacoes" className="mt-4"><RequestsInbox /></TabsContent>
        </Suspense>
      </Tabs>
    </div>
  );
}
