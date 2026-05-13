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
import { ProsperLogo } from "@/components/VendxLogo";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha mínima de 6 caracteres"),
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

  const handleForgot = async () => {
    const email = (document.getElementById("login-email") as HTMLInputElement)?.value;
    if (!email) return toast.error("Digite seu email para recuperar");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Instruções enviadas para seu e-mail");
  };

  return (
    <div className="min-h-[100dvh] w-full relative bg-[#06070C] text-white overflow-hidden flex flex-col lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* ═══ Global cinematic background (mobile + behind everything) ═══ */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A0E1A] via-[#06070C] to-[#0A0E1A]" />
        <div
          className="absolute -top-40 -left-40 w-[640px] h-[640px] rounded-full opacity-[0.55] blur-[120px] animate-orb-1"
          style={{ background: "radial-gradient(circle, #3B82F6 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-1/3 -right-40 w-[560px] h-[560px] rounded-full opacity-[0.45] blur-[120px] animate-orb-2"
          style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-40 left-1/4 w-[520px] h-[520px] rounded-full opacity-[0.35] blur-[120px] animate-orb-3"
          style={{ background: "radial-gradient(circle, #06B6D4 0%, transparent 70%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, #000 30%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,#06070C_100%)]" />
      </div>

      {/* ═══ LEFT — Editorial canvas (desktop only) ═══ */}
      <div className="relative z-10 hidden lg:flex flex-col justify-between p-14 xl:p-16">
        <header className="flex items-center gap-3.5">
          <Link to="/" className="relative transition-transform active:scale-95">
            <ProsperLogo size={46} />
          </Link>
          <div>
            <div className="font-display font-bold text-[14px] tracking-[0.28em] uppercase leading-none">
              Prosper
            </div>
            <div className="text-[9.5px] text-white/40 tracking-[0.32em] uppercase mt-1.5 font-semibold">
              Strategic Management
            </div>
          </div>
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

            <h1 className="font-display text-[58px] xl:text-[64px] leading-[0.98] font-bold tracking-[-0.025em]">
              Onde decisões<br />
              <span className="bg-gradient-to-r from-white via-white to-white/40 bg-clip-text text-transparent">
                viram resultado.
              </span>
            </h1>

            <p className="text-[15.5px] text-white/50 leading-[1.65] max-w-[480px] font-light">
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
                className="group flex items-start gap-5 py-4 border-t border-white/[0.06] last:border-b transition-colors hover:bg-white/[0.015]"
              >
                <span className="font-mono text-[10.5px] text-white/30 tracking-widest mt-0.5 tabular-nums">{f.n}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-white/85 group-hover:text-white transition-colors">{f.t}</p>
                  <p className="text-[12.5px] text-white/40 mt-0.5 font-light">{f.d}</p>
                </div>
                <CheckCircle2 className="size-4 text-white/20 group-hover:text-emerald-400/80 transition-colors mt-1" strokeWidth={1.6} />
              </div>
            ))}
          </div>
        </div>

        <footer className="flex items-end justify-between">
          <div>
            <p className="font-display text-[11px] font-semibold tracking-[0.28em] uppercase text-white/40">MMXXVI</p>
            <p className="text-[10.5px] text-white/25 mt-1.5 font-light tracking-wide">© Prosper · Todos os direitos reservados</p>
          </div>
          <div className="flex items-center gap-1.5 text-[10.5px] text-white/30 font-medium tracking-wider uppercase">
            <span>SOC 2</span>
            <span className="size-1 rounded-full bg-white/30 mx-2" />
            <span>ISO 27001</span>
            <span className="size-1 rounded-full bg-white/30 mx-2" />
            <span>LGPD</span>
          </div>
        </footer>
      </div>

      {/* ═══ RIGHT — Glass form (mobile = full-screen, desktop = right column) ═══ */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 sm:px-8 py-10 sm:py-14 lg:p-12">
        {/* Mobile brand bar */}
        <div className="lg:hidden w-full max-w-[420px] flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-3 active:scale-95 transition-transform">
            <ProsperLogo size={36} />
            <div>
              <div className="font-display font-bold text-[12px] tracking-[0.28em] uppercase leading-none text-white">Prosper</div>
              <div className="text-[8.5px] text-white/40 tracking-[0.32em] uppercase mt-1 font-semibold">Strategic Management</div>
            </div>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-xl px-2.5 py-1">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">Online</span>
          </span>
        </div>

        {/* Glass card */}
        <div className="relative w-full max-w-[420px]">
          <div className="absolute -inset-px rounded-[28px] bg-gradient-to-br from-white/15 via-white/5 to-transparent opacity-80 pointer-events-none" />
          <div className="relative rounded-[28px] bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] p-6 sm:p-9 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)]">
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-7">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              <span className="font-mono text-[10px] tracking-[0.32em] uppercase text-white/40 font-semibold flex items-center gap-1.5">
                <Sparkles className="size-3 text-primary" /> Acesso · 01
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            </div>

            <div className="text-center space-y-2 mb-8">
              <h2 className="font-display text-[32px] sm:text-[38px] font-bold tracking-[-0.03em] leading-[1.05] text-white">
                Bem-vindo
                <span className="block text-white/50 text-[22px] sm:text-[26px] font-normal italic mt-1.5 tracking-tight">
                  de volta.
                </span>
              </h2>
              <p className="text-[13px] text-white/45 leading-relaxed max-w-[320px] mx-auto">
                Entre com suas credenciais para acessar o painel.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/50">
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
                    className="relative h-12 pl-11 bg-white/[0.04] hover:bg-white/[0.06] border-white/10 hover:border-white/20 focus:border-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl text-[14px] text-white placeholder:text-white/30 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password" className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/50">
                    Senha
                  </Label>
                  <button
                    type="button"
                    onClick={handleForgot}
                    className="text-[11px] font-semibold text-white/50 hover:text-white transition-colors underline-offset-2 hover:underline"
                  >
                    Esqueci a senha
                  </button>
                </div>
                <div className="relative group">
                  <Lock className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-white transition-colors z-10" strokeWidth={1.8} />
                  <Input
                    id="login-password"
                    name="password"
                    type={showPwd ? "text" : "password"}
                    placeholder="••••••••••"
                    required
                    className="relative h-12 pl-11 pr-12 bg-white/[0.04] hover:bg-white/[0.06] border-white/10 hover:border-white/20 focus:border-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl text-[14px] text-white placeholder:text-white/30 tracking-wider transition-all"
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
              <Button
                type="submit"
                className="group relative w-full h-12 mt-2 font-semibold text-[14px] rounded-xl bg-white text-slate-950 hover:bg-white/95 shadow-[0_8px_24px_-8px_rgba(255,255,255,0.4)] hover:shadow-[0_12px_32px_-8px_rgba(255,255,255,0.5)] transition-all active:scale-[0.99] overflow-hidden"
                disabled={submitting}
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-900/[0.05] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                {submitting ? (
                  <span className="relative flex items-center gap-2.5">
                    <span className="size-3.5 rounded-full border-2 border-slate-900/20 border-t-slate-900 animate-spin" />
                    Validando…
                  </span>
                ) : (
                  <span className="relative flex items-center gap-2.5 tracking-wide">
                    Entrar no painel
                    <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.2} />
                  </span>
                )}
              </Button>
            </form>

            {/* Hint */}
            <p className="text-center text-[12px] text-white/40 mt-6">
              Acesso restrito. Contas são criadas pelo administrador.
            </p>

            {/* Trust footer */}
            <div className="pt-5 mt-6 border-t border-white/[0.06] flex items-center justify-center gap-2 text-[11px] text-white/35">
              <ShieldCheck className="size-3.5 text-emerald-400/80" strokeWidth={1.8} />
              <span className="font-medium tracking-wide">Conexão criptografada · TLS 1.3</span>
            </div>
          </div>
        </div>

        {/* Mobile footer */}
        <div className="lg:hidden mt-8 flex items-center gap-2 text-[10px] text-white/30 font-medium tracking-wider uppercase">
          <span>SOC 2</span>
          <span className="size-1 rounded-full bg-white/30 mx-1.5" />
          <span>ISO 27001</span>
          <span className="size-1 rounded-full bg-white/30 mx-1.5" />
          <span>LGPD</span>
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
