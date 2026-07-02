import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileSignature, Handshake, Users, Truck } from "lucide-react";

const PartnerContractsAdmin = lazy(() => import("@/pages/PartnerContractsAdmin"));

function Placeholder({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <FileSignature className="size-8 text-slate-300 mx-auto mb-3" />
      <p className="text-sm font-bold text-slate-700">Contratos de {label}</p>
      <p className="text-[13px] text-slate-500 mt-1">
        Em breve. Por enquanto os contratos de {label.toLowerCase()} podem ser gerenciados dentro do próprio cadastro do {label.toLowerCase()}.
      </p>
    </div>
  );
}

export default function ContractsHub() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "parceiros";
  const set = (t: string) => { params.set("tab", t); setParams(params, { replace: true }); };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <FileSignature className="size-5 text-indigo-700" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-950 tracking-tight">Contratos</h1>
          <p className="text-[13px] text-slate-500">Todos os contratos e NDAs organizados por origem</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={set}>
        <TabsList className="bg-white border border-slate-200/70 rounded-lg p-1 shadow-sm">
          <TabsTrigger value="parceiros" className="gap-1.5 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            <Handshake className="size-3.5" /> Parceiros
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-1.5 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            <Users className="size-3.5" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="prestadores" className="gap-1.5 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            <Truck className="size-3.5" /> Prestadores
          </TabsTrigger>
        </TabsList>
        <Suspense fallback={<div className="p-8 text-center text-slate-500 text-sm">Carregando…</div>}>
          <TabsContent value="parceiros" className="mt-4"><PartnerContractsAdmin /></TabsContent>
          <TabsContent value="clientes" className="mt-4"><Placeholder label="Clientes" /></TabsContent>
          <TabsContent value="prestadores" className="mt-4"><Placeholder label="Prestadores" /></TabsContent>
        </Suspense>
      </Tabs>
    </div>
  );
}
