import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowRight, ShieldCheck, Lock, Mail, Eye, EyeOff, CheckCircle2, Sparkles,
} from "lucide-react";
import { z } from "zod";
import { ZenonLogo } from "@/components/ZenonLogo";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Senha mínima de 8 caracteres"),
});

export default function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setSubmitting(false);
    if (error)
      return toast.error(
        error.message === "Invalid login credentials" ? "Email ou senha incorretos" : error.message,
      );
    toast.success("Bem-vindo de volta");
    navigate("/", { replace: true });
  };


  return (
    <div className="min-h-[100dvh] w-full relative bg-zenon-navy-deep text-white overflow-hidden flex flex-col lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Fundo: azul profundo da marca, sem efeitos decorativos */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-zenon-navy via-zenon-navy-deep to-zenon-navy-deep" />
      </div>

      {/* ═══ LEFT — Editorial canvas (desktop only) ═══ */}
      <div className="relative z-10 hidden lg:flex flex-col justify-between p-14 xl:p-16">
        <header className="flex items-center gap-3.5">
          <Link to="/" className="relative rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenon-bronze">
            <ZenonLogo variant="horizontal-branco" height={60} />
          </Link>
        </header>

        <div className="max-w-xl space-y-12">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-xl pl-2 pr-4 py-1.5">
              <span className="relative flex size-2">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                <span className="relative size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />
              </span>
              <span className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-white/70">
                Sistema operacional
              </span>
            </div>

            <h1 className="font-serif text-[58px] xl:text-[64px] leading-[1.02] font-bold text-zenon-ivory">
              Onde decisões<br />
              <span className="text-zenon-bronze">
                viram resultado.
              </span>
            </h1>

            <p className="text-[15.5px] text-[#C6BEAF] leading-[1.65] max-w-[480px]">
              A plataforma que centraliza clientes, parceiros e indicadores num único fluxo —
              do primeiro contato ao pagamento da comissão.
            </p>
          </div>

          <div className="space-y-px">
            {[
              { n: "01", t: "Operação centralizada", d: "Clientes, vendas e contratos em um só lugar." },
              { n: "02", t: "Comissionamento automático", d: "Splits entre parceiro, indicador e colaborador." },
              { n: "03", t: "Inteligência de gestão", d: "Relatórios e exportações em tempo real." },
            ].map((f) => (
              <div
                key={f.n}
                className="group flex items-start gap-5 py-4 border-t border-white/10 last:border-b"
              >
                <span className="font-serif text-[15px] text-zenon-bronze mt-0.5 tabular-nums">{f.n}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-zenon-ivory">{f.t}</p>
                  <p className="text-[12.5px] text-[#B9C4D0] mt-0.5">{f.d}</p>
                </div>
                <CheckCircle2 className="size-4 text-zenon-bronze/70 mt-1" strokeWidth={1.6} />
              </div>
            ))}
          </div>
        </div>

        <footer className="flex items-end justify-between">
          <div>
            <p className="font-display text-[11px] font-semibold tracking-[0.28em] uppercase text-white/40">​</p>
            <p className="text-[10.5px] text-[#9DAFC3] mt-1.5 tracking-wide">© ZENON · Todos os direitos reservados</p>
          </div>
          <div className="flex items-center gap-1.5 text-[10.5px] text-[#9DAFC3] font-medium tracking-wider uppercase">
            <span>​</span>
            <span className="size-1 rounded-full bg-white/30 mx-2" />
            <span>​</span>
            <span className="size-1 rounded-full bg-white/30 mx-2" />
            <span>LGPD</span>
          </div>
        </footer>
      </div>

      {/* ═══ RIGHT — Glass form (mobile = full-screen, desktop = right column) ═══ */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 sm:px-8 py-10 sm:py-14 lg:p-12">
        {/* Mobile brand bar */}
        <div className="lg:hidden w-full max-w-[420px] flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenon-bronze">
            <ZenonLogo variant="horizontal-branco" height={44} />
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-xl px-2.5 py-1">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">Online</span>
          </span>
        </div>

        {/* Glass card */}
        <div className="relative w-full max-w-[420px]">
          <div className="relative rounded-2xl bg-zenon-navy border border-[hsl(211_35%_28%)] p-6 sm:p-9 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.6)]">
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-7">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              <span className="text-[10px] tracking-[0.32em] uppercase text-[#C6BEAF] font-semibold flex items-center gap-1.5">
                <Sparkles className="size-3 text-zenon-bronze" /> Acesso · 01
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            </div>

            <div className="text-center space-y-2 mb-8">
              <h2 className="font-serif text-[34px] sm:text-[40px] font-bold leading-[1.05] text-zenon-ivory">
                Bem-vindo
                <span className="block text-[#C6BEAF] text-[22px] sm:text-[26px] font-normal italic mt-1.5">
                  de volta.
                </span>
              </h2>
              <p className="text-[13px] text-[#B9C4D0] leading-relaxed max-w-[320px] mx-auto">
                Entre com suas credenciais para acessar o painel.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#C6BEAF]">
                  E-mail
                </Label>
                <div className="relative group">
                  <Mail className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-white transition-colors z-10" strokeWidth={1.8} />
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                    className="relative h-12 pl-11 bg-white/[0.04] hover:bg-white/[0.06] border-white/10 hover:border-white/20 focus:border-zenon-bronze focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl text-[14px] text-white placeholder:text-white/45 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#C6BEAF]">
                  Senha
                </Label>
                <div className="relative group">
                  <Lock className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-white transition-colors z-10" strokeWidth={1.8} />
                  <Input
                    id="login-password"
                    name="password"
                    type={showPwd ? "text" : "password"}
                    placeholder="••••••••••"
                    required
                    className="relative h-12 pl-11 pr-12 bg-white/[0.04] hover:bg-white/[0.06] border-white/10 hover:border-white/20 focus:border-zenon-bronze focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl text-[14px] text-white placeholder:text-white/45 tracking-wider transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 size-7 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                    aria-label="Mostrar senha"
                  >
                    {showPwd ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="group relative w-full h-12 mt-2 font-semibold text-[14px] rounded-xl bg-zenon-bronze text-zenon-navy hover:bg-[#D3A675] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenon-ivory focus-visible:ring-offset-2 focus-visible:ring-offset-zenon-navy disabled:opacity-60 disabled:cursor-not-allowed transition-colors active:scale-[0.99] overflow-hidden"
              >
                {submitting ? (
                  <span className="relative flex items-center justify-center gap-2.5">
                    <span className="size-3.5 rounded-full border-2 border-zenon-navy/30 border-t-zenon-navy animate-spin" />
                    Validando…
                  </span>
                ) : (
                  <span className="relative flex items-center justify-center gap-2.5 tracking-wide">
                    Entrar no painel
                    <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.2} />
                  </span>
                )}
              </button>
            </form>

            {/* Hint */}
            <p className="text-center text-[12px] text-[#B9C4D0] mt-6">
              Acesso restrito. <span>​</span>
            </p>

            {/* Trust footer */}
            <div className="pt-5 mt-6 border-t border-white/10 flex items-center justify-center gap-2 text-[11px] text-[#9DAFC3]">
              <ShieldCheck className="size-3.5 text-emerald-400/80" strokeWidth={1.8} />
              <span className="font-medium tracking-wide">Conexão criptografada · TLS 1.3</span>
            </div>
          </div>
        </div>

        {/* Mobile footer */}
        <div className="lg:hidden mt-8 flex items-center gap-2 text-[10px] text-[#9DAFC3] font-medium tracking-wider uppercase">
          <span>​</span>
          <span className="size-1 rounded-full bg-white/30 mx-1.5" />
          <span>​</span>
          <span className="size-1 rounded-full bg-white/30 mx-1.5" />
          <span>​</span>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes orb-1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(80px,60px) scale(1.1); } }
        @keyframes orb-2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-60px,80px) scale(0.95); } }
        @keyframes orb-3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,-60px) scale(1.05); } }
        .animate-orb-1 { animation: orb-1 18s ease-in-out infinite; }
        .animate-orb-2 { animation: orb-2 22s ease-in-out infinite; }
        .animate-orb-3 { animation: orb-3 20s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
