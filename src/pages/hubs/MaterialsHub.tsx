import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BookOpen, Handshake, Truck, Users } from "lucide-react";

const MaterialsAdmin = lazy(() => import("@/pages/PartnerMaterialsAdmin"));

export default function MaterialsHub() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "geral";
  const set = (t: string) => { params.set("tab", t); setParams(params, { replace: true }); };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <BookOpen className="size-5 text-indigo-700" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-950 tracking-tight">Materiais</h1>
          <p className="text-[13px] text-slate-500">Biblioteca de materiais organizados por público</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={set}>
        <TabsList className="bg-white border border-slate-200/70 rounded-lg p-1 shadow-sm">
          <TabsTrigger value="geral" className="gap-1.5 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            <BookOpen className="size-3.5" /> Geral
          </TabsTrigger>
          <TabsTrigger value="parceiro" className="gap-1.5 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            <Handshake className="size-3.5" /> Parceiro
          </TabsTrigger>
          <TabsTrigger value="prestador" className="gap-1.5 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            <Truck className="size-3.5" /> Prestador
          </TabsTrigger>
          <TabsTrigger value="cliente" className="gap-1.5 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            <Users className="size-3.5" /> Cliente
          </TabsTrigger>
        </TabsList>
        <Suspense fallback={<div className="p-8 text-center text-slate-500 text-sm">Carregando…</div>}>
          <TabsContent value="geral" className="mt-4"><MaterialsAdmin audience="general" /></TabsContent>
          <TabsContent value="parceiro" className="mt-4"><MaterialsAdmin audience="partner" /></TabsContent>
          <TabsContent value="prestador" className="mt-4"><MaterialsAdmin audience="provider" /></TabsContent>
          <TabsContent value="cliente" className="mt-4"><MaterialsAdmin audience="client" /></TabsContent>
        </Suspense>
      </Tabs>
    </div>
  );
}
