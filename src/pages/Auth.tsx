import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Users,
  CheckCircle2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { z } from "zod";

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
        error.message === "Invalid login credentials" ? "Email ou senha incorretos" : error.message
      );
    toast.success("Bem-vindo de volta");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-[1.1fr_1fr] bg-background">
      {/* ============ LEFT — BRAND CINEMATIC ============ */}
      <div className="hidden lg:flex flex-col justify-between p-14 relative overflow-hidden text-white bg-slate-950">
        {/* Animated gradients and effects */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,#1e293b_0%,transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,#0f172a_0%,transparent_50%)]" />
          <div 
            className="absolute inset-0 opacity-[0.03]" 
            style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }}
          />
        </div>

        {/* HEADER */}
        <header className="relative flex items-center gap-3 z-10">
          <div className="size-11 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl">
            <Sparkles className="size-5 text-white" strokeWidth={1.8} />
          </div>
          <div>
            <div className="font-display font-bold text-[15px] tracking-[0.2em] uppercase leading-none">
              Painel Douglas
            </div>
            <div className="text-[10px] text-white/40 tracking-[0.15em] uppercase mt-1.5 font-medium">
              Consultoria Corporativa
            </div>
          </div>
        </header>

        {/* MIDDLE */}
        <div className="relative space-y-12 max-w-xl z-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/70">
              <span className="size-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]" />
              Ambiente de Acesso Restrito
            </div>
            <h1 className="font-display text-[48px] leading-[1.1] font-bold tracking-tight">
              Gestão estratégica <br />
              <span className="text-white/60">de alto impacto.</span>
            </h1>
            <p className="text-[16px] text-white/50 leading-relaxed max-w-md">
              Acesse sua infraestrutura de dados para acompanhamento de clientes, 
              parceiros e indicadores em tempo real.
            </p>
          </div>

          {/* Features */}
          <ul className="grid gap-4">
            {[
              "Centralização de operações de assessoria",
              "Gestão automatizada de comissionamento",
              "Relatórios analíticos de performance",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3 text-[14px] text-white/70">
                <div className="size-5 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/5">
                  <CheckCircle2 className="size-3 text-white/80" />
                </div>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          
          <div className="grid grid-cols-3 gap-8 pt-10 border-t border-white/5">
            {[
              { icon: Users, label: "Operações", value: "24/7" },
              { icon: TrendingUp, label: "Performance", value: "Real-time" },
              { icon: ShieldCheck, label: "Segurança", value: "SSL" },
            ].map((m) => (
              <div key={m.label} className="space-y-1">
                <m.icon className="size-4 text-white/30" />
                <div className="text-[18px] font-bold text-white/90">{m.value}</div>
                <div className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <footer className="relative flex items-center justify-between text-[11px] text-white/30 z-10">
          <span>© {new Date().getFullYear()} Painel Douglas</span>
          <div className="flex gap-4">
            <span className="cursor-pointer hover:text-white/50 transition-colors">Segurança</span>
            <span className="cursor-pointer hover:text-white/50 transition-colors">Privacidade</span>
          </div>
        </footer>
      </div>

      {/* ============ RIGHT — FORM ============ */}
      <div className="flex flex-col items-center justify-center p-8 sm:p-12 md:p-16 lg:p-24 bg-background">
        <div className="w-full max-w-[400px] space-y-10">
          {/* Mobile brand visibility */}
          <div className="lg:hidden flex flex-col items-center text-center space-y-4 mb-8">
            <div className="size-12 rounded-2xl bg-foreground text-background flex items-center justify-center shadow-xl">
              <Sparkles className="size-6" />
            </div>
            <div>
              <div className="font-display font-bold text-[16px] tracking-[0.2em] uppercase">Painel Douglas</div>
              <div className="text-[10px] text-muted-foreground tracking-widest uppercase mt-1">Assessoria Premium</div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-display text-[32px] font-bold tracking-tight text-foreground">
              Autenticação
            </h2>
            <p className="text-[15px] text-muted-foreground leading-relaxed">
              Insira suas credenciais corporativas para acessar o sistema.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-[13px] font-medium text-foreground/80">
                  E-mail corporativo
                </Label>
                <div className="relative group">
                  <Mail className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    placeholder="exemplo@empresa.com"
                    required
                    className="h-13 pl-11 bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all rounded-xl text-[14px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password" className="text-[13px] font-medium text-foreground/80">
                    Sua senha
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
                      else toast.success("Instruções enviadas para seu e-mail");
                    }}
                    className="text-[12px] font-semibold text-primary/80 hover:text-primary transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative group">
                  <Lock className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                  <Input
                    id="login-password"
                    name="password"
                    type={showPwd ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    className="h-13 pl-11 pr-11 bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all rounded-xl text-[14px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-13 font-bold text-[15px] rounded-xl shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-[0.98]"
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Validando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Acessar Painel
                  <ArrowRight className="size-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="pt-8 border-t border-muted/50">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground justify-center">
              <ShieldCheck className="size-4 text-emerald-500/80" />
              <span>Conexão segura com criptografia 256-bit</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
