import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowRight,
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { z } from "zod";
import { ProsperLogo } from "@/components/VendxLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

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

  return (
    <div className="min-h-[100dvh] w-full grid lg:grid-cols-[1.15fr_1fr] bg-[#06070C] text-white overflow-hidden">
      {/* ╔══════════════════════ LEFT — CINEMATIC CANVAS ══════════════════════╗ */}
      <div className="relative hidden lg:flex flex-col justify-between p-14 xl:p-16 overflow-hidden">
        {/* Animated mesh background */}
        <div className="absolute inset-0 z-0">
          {/* Base */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A0E1A] via-[#06070C] to-[#0A0E1A]" />
          {/* Animated orbs */}
          <div className="absolute -top-40 -left-40 w-[640px] h-[640px] rounded-full opacity-[0.55] blur-[120px] animate-orb-1"
               style={{ background: "radial-gradient(circle, #3B82F6 0%, transparent 70%)" }} />
          <div className="absolute top-1/3 -right-40 w-[560px] h-[560px] rounded-full opacity-[0.45] blur-[120px] animate-orb-2"
               style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }} />
          <div className="absolute -bottom-40 left-1/4 w-[520px] h-[520px] rounded-full opacity-[0.35] blur-[120px] animate-orb-3"
               style={{ background: "radial-gradient(circle, #06B6D4 0%, transparent 70%)" }} />

          {/* Precision grid */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, #000 30%, transparent 100%)",
            }}
          />

          {/* Noise texture */}
          <div
            className="absolute inset-0 opacity-[0.025] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            }}
          />

          {/* Edge vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,#06070C_100%)]" />
        </div>

        {/* ──── HEADER: brand mark ──── */}
        <header className="relative z-10 flex items-center gap-3.5">
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

        {/* ──── MIDDLE: editorial composition ──── */}
        <div className="relative z-10 max-w-xl space-y-12">
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
              A plataforma que centraliza clientes, parceiros e indicadores
              num único fluxo — do primeiro contato ao pagamento da comissão.
            </p>
          </div>

          {/* Numbered features — editorial style */}
          <div className="space-y-px">
            {[
              { n: "01", t: "Operação centralizada", d: "Clientes, vendas e contratos em um só lugar." },
              { n: "02", t: "Comissionamento automático", d: "Splits entre parceiro, indicador e colaborador." },
              { n: "03", t: "Inteligência de gestão", d: "Relatórios e exportações em tempo real." },
            ].map((f) => (
              <div key={f.n} className="group flex items-start gap-5 py-4 border-t border-white/[0.06] last:border-b transition-colors hover:bg-white/[0.015]">
                <span className="font-mono text-[10.5px] text-white/30 tracking-widest mt-0.5 tabular-nums">
                  {f.n}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-white/85 group-hover:text-white transition-colors">{f.t}</p>
                  <p className="text-[12.5px] text-white/40 mt-0.5 font-light">{f.d}</p>
                </div>
                <CheckCircle2 className="size-4 text-white/20 group-hover:text-emerald-400/80 transition-colors mt-1" strokeWidth={1.6} />
              </div>
            ))}
          </div>
        </div>

        {/* ──── FOOTER ──── */}
        <footer className="relative z-10 flex items-end justify-between">
          <div>
            <p className="font-display text-[11px] font-semibold tracking-[0.28em] uppercase text-white/40">
              MMXXVI
            </p>
            <p className="text-[10.5px] text-white/25 mt-1.5 font-light tracking-wide">
              © Prosper · Todos os direitos reservados
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10.5px] text-white/30 font-medium tracking-wider uppercase">
            <span className="size-1 rounded-full bg-white/30" />
            <span>SOC 2</span>
            <span className="size-1 rounded-full bg-white/30 mx-2" />
            <span>ISO 27001</span>
            <span className="size-1 rounded-full bg-white/30 mx-2" />
            <span>LGPD</span>
          </div>
        </footer>
      </div>

      {/* ╔══════════════════════ RIGHT — FORM ══════════════════════╗ */}
      <div className="relative flex flex-col items-center justify-center p-6 sm:p-10 lg:p-12 bg-white dark:bg-[#06070C] text-foreground transition-colors duration-500 overflow-y-auto">
        <div className="absolute top-6 right-6 z-20">
          <ThemeToggle />
        </div>

        {/* Dynamic ambient backgrounds */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.4] dark:opacity-[0.15]">
          <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] rounded-full blur-[100px] bg-primary/20 animate-pulse" />
          <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] rounded-full blur-[100px] bg-blue-500/20 animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* subtle texture */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
             style={{
               backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
             }} />

        <div className="relative w-full max-w-[420px] space-y-10">
          {/* Progress bar indication */}
          <div className="absolute -top-12 left-0 w-full h-1 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-primary animate-progress-glow" />
          </div>
          {/* Mobile brand */}
          <div className="lg:hidden flex flex-col items-center text-center space-y-4 mb-2">
            <ProsperLogo size={56} />
            <div>
              <div className="font-display font-bold text-[15px] tracking-[0.28em] uppercase">PROSPER</div>
              <div className="text-[9.5px] text-slate-500 tracking-[0.3em] uppercase mt-1 font-semibold">Strategic Management</div>
            </div>
          </div>

          {/* Eyebrow */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
            <span className="font-mono text-[10px] tracking-[0.32em] uppercase text-slate-400 font-semibold">
              Acesso · 01
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
          </div>

          <div className="space-y-3 text-center">
            <h2 className="font-display text-[42px] font-bold tracking-[-0.03em] leading-[1] text-foreground">
              Bem-vindo
              <span className="block text-muted-foreground text-[28px] font-normal italic mt-2 tracking-tight">
                de volta.
              </span>
            </h2>
            <p className="text-[13.5px] text-muted-foreground leading-relaxed max-w-[320px] mx-auto">
              Entre com suas credenciais para acessar o painel de gestão.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  E-mail
                </Label>
                <div className="relative group">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-slate-900/[0.03] to-transparent pointer-events-none" />
                  <Mail className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors z-10" strokeWidth={1.8} />
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                    className="relative h-13 pl-11 bg-white border-slate-200/80 hover:border-slate-300 focus:border-slate-900 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl text-[14px] text-slate-900 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password" className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    Senha
                  </Label>
                  <button
                    type="button"
                    onClick={async () => {
                      const email = (document.getElementById("login-email") as HTMLInputElement)?.value;
                      if (!email) return toast.error("Digite seu email para recuperar");
                      const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
                      if (error) toast.error(error.message);
                      else toast.success("Instruções enviadas");
                    }}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 transition-colors underline-offset-2 hover:underline"
                  >
                    Esqueci a senha
                  </button>
                </div>
                <div className="relative group">
                  <Lock className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors z-10" strokeWidth={1.8} />
                  <Input
                    id="login-password"
                    name="password"
                    type={showPwd ? "text" : "password"}
                    placeholder="••••••••••"
                    required
                    className="relative h-13 pl-11 pr-12 bg-white border-slate-200/80 hover:border-slate-300 focus:border-slate-900 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl text-[14px] text-slate-900 placeholder:text-slate-400 tracking-wider shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 size-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
                    aria-label="Mostrar senha"
                  >
                    {showPwd ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="group relative w-full h-13 font-semibold text-[14px] rounded-xl bg-slate-950 hover:bg-slate-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(15,23,42,0.4)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.05),0_12px_32px_-8px_rgba(15,23,42,0.5)] transition-all active:scale-[0.99] overflow-hidden"
              disabled={submitting}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              {submitting ? (
                <span className="relative flex items-center gap-2.5">
                  <span className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
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

          {/* Sign-up link */}
          <div className="text-center">
            <p className="text-[12.5px] text-slate-500">
              Não tem uma conta?{" "}
              <Link
                to="/cadastro"
                className="text-slate-900 font-semibold underline underline-offset-2 hover:text-slate-700"
              >
                Criar conta
              </Link>
            </p>
          </div>

          {/* Footer trust */}
          <div className="pt-6 border-t border-slate-200/60">
            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="size-3.5 text-emerald-600/70" strokeWidth={1.8} />
              <span className="font-medium tracking-wide">Conexão criptografada · TLS 1.3</span>
            </div>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes orb-1 {
          0%, 100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(80px, 60px) scale(1.1); }
        }
        @keyframes orb-2 {
          0%, 100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(-60px, 80px) scale(0.95); }
        }
        @keyframes orb-3 {
          0%, 100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(40px, -60px) scale(1.05); }
        }
        .animate-orb-1 { animation: orb-1 18s ease-in-out infinite; }
        .animate-orb-2 { animation: orb-2 22s ease-in-out infinite; }
        .animate-orb-3 { animation: orb-3 26s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function CornerMark({ className = "", rotate = "" }: { className?: string; rotate?: string }) {
  return (
    <div className={`absolute size-4 ${className} ${rotate} pointer-events-none z-10`}>
      <div className="absolute top-0 left-0 w-full h-[1.5px] bg-slate-900/20 dark:bg-white/20" />
      <div className="absolute top-0 left-0 h-full w-[1.5px] bg-slate-900/20 dark:bg-white/20" />
      <div className="absolute top-0 left-0 size-1 bg-primary/40 dark:bg-primary/60 rounded-full -translate-x-1/2 -translate-y-1/2" />
    </div>
  );
}
