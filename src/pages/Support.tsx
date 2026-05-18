import { MessageCircle, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSystemSettings, buildWhatsAppLink } from "@/hooks/useSystemSettings";

export default function Support() {
  const settings = useSystemSettings();
  const waLink = buildWhatsAppLink(
    settings.support_whatsapp,
    `Olá! Preciso de suporte com ${settings.company_name}.`
  );

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6 animate-fade-in">
      <div className="vx-card max-w-xl w-full p-10 text-center shadow-xl bg-white border border-slate-200/70">
        <div className="size-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 mx-auto flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30">
          <MessageCircle className="size-10 text-white" strokeWidth={2.2} />
        </div>

        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 mb-2">
          Atendimento via WhatsApp
        </h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          Nosso canal exclusivo de suporte é o WhatsApp. Clique no botão abaixo para falar direto com nossa equipe.
        </p>

        <Button
          asChild
          size="lg"
          className="w-full h-12 text-base font-bold bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-lg shadow-emerald-500/30"
        >
          <a href={waLink} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-5 mr-2" />
            Iniciar conversa no WhatsApp
          </a>
        </Button>

        <div className="grid grid-cols-2 gap-3 mt-8 text-left">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200/70">
            <Clock className="size-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-900">Resposta rápida</p>
              <p className="text-[11px] text-muted-foreground">Em horário comercial</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200/70">
            <CheckCircle2 className="size-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-900">Atendimento humano</p>
              <p className="text-[11px] text-muted-foreground">Direto com nossa equipe</p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground">
          Telefone: <span className="font-mono font-semibold">+{settings.support_whatsapp}</span>
        </p>
      </div>
    </div>
  );
}
