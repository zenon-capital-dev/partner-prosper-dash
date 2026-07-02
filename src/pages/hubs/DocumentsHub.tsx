import { lazy, Suspense } from "react";
import { FileText } from "lucide-react";

const Documents = lazy(() => import("@/pages/Documents"));

export default function DocumentsHub() {
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <FileText className="size-5 text-indigo-700" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-950 tracking-tight">Documentos</h1>
          <p className="text-[13px] text-slate-500">Arquivos, uploads e pastas compartilhadas com clientes, parceiros e prestadores</p>
        </div>
      </div>
      <Suspense fallback={<div className="p-8 text-center text-slate-500 text-sm">Carregando…</div>}>
        <Documents />
      </Suspense>
    </div>
  );
}
