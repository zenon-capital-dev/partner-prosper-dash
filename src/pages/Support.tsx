import { MessageCircle, Clock, ShieldCheck, Phone, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSystemSettings, buildWhatsAppLink } from "@/hooks/useSystemSettings";

export default function Support() {
  const settings = useSystemSettings();
  const waLink = buildWhatsAppLink(
    settings.support_whatsapp,
    `Olá! Preciso de suporte com ${settings.company_name}.`
  );

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
            Suporte
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Fale com nossa equipe pelo canal oficial de atendimento.
          </p>
        </div>

        {/* Main card */}
        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 lg:p-8 flex items-start gap-5 border-b border-slate-100">
            <div className="size-11 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <MessageCircle className="size-5 text-indigo-600" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-slate-900">
                Atendimento via WhatsApp
              </h2>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Nosso canal exclusivo de suporte. Clique para conversar diretamente com nossa equipe.
              </p>
              <Button
                asChild
                className="mt-4 h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm"
              >
                <a href={waLink} target="_blank" rel="noopener noreferrer">
                  Iniciar conversa
                  <ArrowUpRight className="size-4 ml-1.5" />
                </a>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            <div className="p-5 flex items-start gap-3">
              <Clock className="size-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-900">Resposta rápida</p>
                <p className="text-xs text-slate-500 mt-0.5">Em horário comercial</p>
              </div>
            </div>
            <div className="p-5 flex items-start gap-3">
              <ShieldCheck className="size-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-900">Atendimento humano</p>
                <p className="text-xs text-slate-500 mt-0.5">Direto com nossa equipe</p>
              </div>
            </div>
            <div className="p-5 flex items-start gap-3">
              <Phone className="size-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-900">Telefone</p>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  +{settings.support_whatsapp}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
