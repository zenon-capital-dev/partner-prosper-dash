import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Users,
  CheckCircle2,
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha mínima de 6 caracteres"),
});
const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, "Nome obrigatório").max(100),
});

export default function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

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

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      fullName: fd.get("fullName"),
      email: fd.get("email"),
      password: fd.get("password"),
    });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada com sucesso");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-[1.1fr_1fr] bg-[hsl(220_20%_97%)]">
      {/* ============ LEFT — BRAND CINEMATIC ============ */}
      <div className="hidden lg:flex flex-col justify-between p-14 relative overflow-hidden text-white"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, hsl(252 70% 22%) 0%, transparent 60%), radial-gradient(80% 60% at 100% 100%, hsl(210 80% 25%) 0%, transparent 55%), linear-gradient(160deg, hsl(222 38% 8%) 0%, hsl(222 40% 6%) 100%)",
        }}
      >
        {/* Mesh grid */}
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 75%)",
          }}
        />
        {/* Aurora blobs */}
        <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-[hsl(252_80%_55%)]/30 blur-[140px] pointer-events-none animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-25%] right-[-15%] w-[600px] h-[600px] rounded-full bg-[hsl(190_85%_55%)]/20 blur-[160px] pointer-events-none animate-[pulse_10s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 right-1/4 w-[280px] h-[280px] rounded-full bg-[hsl(330_75%_60%)]/15 blur-[120px] pointer-events-none" />

        {/* HEADER */}
        <header className="relative flex items-center gap-3 z-10">
          <div className="size-11 rounded-2xl bg-white/8 backdrop-blur-xl border border-white/15 flex items-center justify-center shadow-lg">
            <Sparkles className="size-5 text-white" strokeWidth={1.8} />
          </div>
          <div>
            <div className="font-display font-bold text-[15px] tracking-[0.22em] uppercase leading-none">
              Painel Douglas
            </div>
            <div className="text-[10.5px] text-white/45 tracking-[0.18em] uppercase mt-1.5 font-medium">
              Assessoria Premium
            </div>
          </div>
        </header>

        {/* MIDDLE */}
        <div className="relative space-y-12 max-w-xl z-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 backdrop-blur-md px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/85">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_hsl(152_76%_55%)]" />
              Sistema operacional ativo
            </div>
            <h1 className="font-display text-[52px] leading-[1.02] font-bold tracking-[-0.025em]">
              A operação inteira <br />
              <span className="bg-gradient-to-r from-white via-white to-white/55 bg-clip-text text-transparent">
                em um só painel.
              </span>
            </h1>
            <p className="text-[15.5px] text-white/65 leading-relaxed max-w-md">
              Clientes, indicadores, colaboradores, comissões e produtos — gerenciados
              com a precisão que sua assessoria merece. Sem planilha, sem retrabalho.
            </p>
          </div>

          {/* features */}
          <ul className="space-y-3.5">
            {[
              "Cadastro completo de clientes, contratos e produtos",
              "Comissões automáticas para parceiros e indicadores",
              "Dashboards e relatórios em tempo real",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3.5 text-[14px] text-white/85">
                <div className="mt-0.5 size-5 rounded-md bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="size-3 text-emerald-300" strokeWidth={2.5} />
                </div>
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>

          {/* metrics */}
          <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/10">
            {[
              { icon: Users, value: "+1.2k", label: "Clientes" },
              { icon: TrendingUp, value: "98%", label: "Retenção" },
              { icon: ShieldCheck, value: "256-bit", label: "Criptografia" },
            ].map((m) => (
              <div key={m.label}>
                <m.icon className="size-4 text-white/45 mb-2.5" strokeWidth={1.6} />
                <div className="font-display text-[24px] font-bold tabular-nums leading-none">
                  {m.value}
                </div>
                <div className="text-[10.5px] text-white/50 mt-2 uppercase tracking-[0.14em] font-semibold">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <footer className="relative flex items-center justify-between text-[11px] text-white/40 z-10">
          <span>© {new Date().getFullYear()} Painel Douglas — Todos os direitos reservados</span>
          <div className="flex items-center gap-4">
            <span className="hover:text-white/70 transition-colors cursor-pointer">Suporte</span>
            <span className="hover:text-white/70 transition-colors cursor-pointer">Termos</span>
            <span className="hover:text-white/70 transition-colors cursor-pointer">Privacidade</span>
          </div>
        </footer>
      </div>

      {/* ============ RIGHT — FORM ============ */}
      <div className="flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-[440px] space-y-9">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-foreground text-background flex items-center justify-center">
              <Sparkles className="size-5" strokeWidth={1.8} />
            </div>
            <div>
              <div className="font-display font-bold text-[14px] tracking-[0.22em] uppercase leading-none">
                Painel Douglas
              </div>
              <div className="text-[10px] text-muted-foreground tracking-[0.18em] uppercase mt-1.5 font-medium">
                Assessoria Premium
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <h2 className="font-display text-[34px] font-bold tracking-[-0.025em] leading-[1.05]">
              Acesse sua conta
            </h2>
            <p className="text-[14px] text-muted-foreground leading-relaxed">
              Entre para gerenciar sua operação. O sistema te leva direto pro seu
              painel — você não precisa pensar em URL.
            </p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-muted/60 rounded-xl">
              <TabsTrigger
                value="login"
                className="h-10 text-[13px] font-semibold rounded-lg data-[state=active]:shadow-sm"
              >
                Entrar
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="h-10 text-[13px] font-semibold rounded-lg data-[state=active]:shadow-sm"
              >
                Criar conta
              </TabsTrigger>
            </TabsList>

            {/* LOGIN */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-5 mt-7">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-[12.5px] font-semibold">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
                    <Input
                      id="login-email"
                      name="email"
                      type="email"
                      placeholder="voce@empresa.com"
                      required
                      className="h-12 pl-10 text-[14px]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password" className="text-[12.5px] font-semibold">
                      Senha
                    </Label>
                    <button
                      type="button"
                      onClick={async () => {
                        const email = (document.getElementById("login-email") as HTMLInputElement)?.value;
                        if (!email) return toast.error("Digite seu email primeiro");
                        const { error } = await supabase.auth.resetPasswordForEmail(email, {
                          redirectTo: `${window.location.origin}/reset-password`,
                        });
                        if (error) toast.error(error.message);
                        else toast.success("Email de recuperação enviado");
                      }}
                      className="text-[12px] font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
                    <Input
                      id="login-password"
                      name="password"
                      type={showPwd ? "text" : "password"}
                      placeholder="••••••••"
                      required
                      className="h-12 pl-10 pr-10 text-[14px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors"
                    >
                      {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 font-semibold text-[14px] rounded-xl group"
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      Entrando...
                    </span>
                  ) : (
                    <>
                      Entrar na conta
                      <ArrowRight className="size-4 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* SIGNUP */}
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-5 mt-7">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="text-[12.5px] font-semibold">
                    Nome completo
                  </Label>
                  <div className="relative">
                    <UserIcon className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
                    <Input
                      id="signup-name"
                      name="fullName"
                      placeholder="João Silva"
                      required
                      className="h-12 pl-10 text-[14px]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-[12.5px] font-semibold">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="voce@empresa.com"
                      required
                      className="h-12 pl-10 text-[14px]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-[12.5px] font-semibold">
                    Senha
                  </Label>
                  <div className="relative">
                    <Lock className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
                    <Input
                      id="signup-password"
                      name="password"
                      type={showPwd2 ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      required
                      className="h-12 pl-10 pr-10 text-[14px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd2((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors"
                    >
                      {showPwd2 ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 font-semibold text-[14px] rounded-xl group"
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      Criando conta...
                    </span>
                  ) : (
                    <>
                      Criar minha conta
                      <ArrowRight className="size-4 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </Button>

                <p className="text-[11.5px] text-muted-foreground text-center leading-relaxed">
                  Ao criar sua conta você concorda com os{" "}
                  <span className="font-semibold text-foreground">Termos de uso</span> e a{" "}
                  <span className="font-semibold text-foreground">Política de privacidade</span>.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          {/* Trust strip */}
          <div className="flex items-center justify-center gap-5 pt-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-success" /> SSL 256-bit
            </span>
            <span className="size-1 rounded-full bg-muted-foreground/40" />
            <span className="flex items-center gap-1.5">
              <Lock className="size-3.5 text-success" /> Dados criptografados
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
