import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowRight, ShieldCheck, TrendingUp, Users, CheckCircle2 } from "lucide-react";
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

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
    setSubmitting(false);
    if (error) return toast.error(error.message === "Invalid login credentials" ? "Email ou senha incorretos" : error.message);
    toast.success("Bem-vindo!");
    navigate("/");
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
    toast.success("Conta criada! Você já pode acessar.");
    navigate("/");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-background">
      {/* ===== Left – Brand panel (puro CSS, sem imagem gerada) ===== */}
      <div className="hidden lg:flex flex-col justify-between p-14 relative overflow-hidden bg-[hsl(222_38%_9%)] text-white">
        {/* subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        {/* soft radial */}
        <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full bg-[hsl(252_70%_55%)]/25 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[520px] h-[520px] rounded-full bg-[hsl(210_90%_55%)]/15 blur-[140px] pointer-events-none" />

        <header className="relative flex items-center gap-3">
          <div className="size-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
            <span className="font-display font-bold text-lg">D</span>
          </div>
          <div className="font-display font-semibold text-[15px] tracking-[0.18em] uppercase">
            Painel Douglas
          </div>
        </header>

        <div className="relative space-y-10 max-w-lg">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
              Plataforma de Assessoria
            </div>
            <h1 className="font-display text-[44px] leading-[1.05] font-bold tracking-[-0.02em]">
              Toda sua operação em um só lugar.
            </h1>
            <p className="text-[15px] text-white/65 leading-relaxed">
              Clientes, indicadores, colaboradores e produtos — gerenciados com a precisão que
              um escritório sério precisa. Chega de planilha.
            </p>
          </div>

          {/* feature list */}
          <ul className="space-y-3.5">
            {[
              "Cadastro completo de clientes e produtos contratados",
              "Comissões automáticas para parceiros e indicadores",
              "Relatórios financeiros e operacionais em tempo real",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-[14px] text-white/85">
                <CheckCircle2 className="size-5 text-white/90 shrink-0 mt-0.5" strokeWidth={1.6} />
                <span>{t}</span>
              </li>
            ))}
          </ul>

          {/* metrics */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/10">
            {[
              { icon: Users, value: "+1.2k", label: "Clientes" },
              { icon: TrendingUp, value: "98%", label: "Retenção" },
              { icon: ShieldCheck, value: "256-bit", label: "Criptografia" },
            ].map((m) => (
              <div key={m.label}>
                <m.icon className="size-4 text-white/50 mb-2" strokeWidth={1.6} />
                <div className="font-display text-[22px] font-bold tabular-nums leading-none">{m.value}</div>
                <div className="text-[11px] text-white/55 mt-1.5 uppercase tracking-wider font-medium">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        <footer className="relative flex items-center justify-between text-[11px] text-white/40">
          <span>© {new Date().getFullYear()} Painel Douglas</span>
          <span>Suporte · Termos · Privacidade</span>
        </footer>
      </div>

      {/* ===== Right – Form ===== */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px] space-y-10">
          <div className="lg:hidden flex items-center gap-3">
            <div className="size-10 rounded-xl bg-foreground text-background flex items-center justify-center font-display font-bold">D</div>
            <div className="font-display font-semibold text-[15px] tracking-[0.18em] uppercase">Painel Douglas</div>
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-[30px] font-bold tracking-[-0.02em] leading-tight">Acesse sua conta</h2>
            <p className="text-[14px] text-muted-foreground">
              Entre com suas credenciais ou crie uma nova conta para começar.
            </p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-11 p-1">
              <TabsTrigger value="login" className="h-9 text-[13px] font-semibold">Entrar</TabsTrigger>
              <TabsTrigger value="signup" className="h-9 text-[13px] font-semibold">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-5 mt-7">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-[13px] font-medium">Email</Label>
                  <Input id="login-email" name="email" type="email" placeholder="voce@empresa.com" required className="h-11" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password" className="text-[13px] font-medium">Senha</Label>
                    <button
                      type="button"
                      onClick={async () => {
                        const email = (document.getElementById("login-email") as HTMLInputElement)?.value;
                        if (!email) return toast.error("Digite seu email primeiro");
                        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
                        if (error) toast.error(error.message);
                        else toast.success("Email de recuperação enviado!");
                      }}
                      className="text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <Input id="login-password" name="password" type="password" placeholder="••••••••" required className="h-11" />
                </div>
                <Button type="submit" className="w-full h-11 font-semibold" disabled={submitting}>
                  {submitting ? "Entrando..." : <>Entrar <ArrowRight className="size-4 ml-1" /></>}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-5 mt-7">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="text-[13px] font-medium">Nome completo</Label>
                  <Input id="signup-name" name="fullName" placeholder="João Silva" required className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-[13px] font-medium">Email</Label>
                  <Input id="signup-email" name="email" type="email" placeholder="voce@empresa.com" required className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-[13px] font-medium">Senha</Label>
                  <Input id="signup-password" name="password" type="password" placeholder="Mínimo 6 caracteres" required className="h-11" />
                </div>
                <Button type="submit" className="w-full h-11 font-semibold" disabled={submitting}>
                  {submitting ? "Criando..." : "Criar conta"}
                </Button>
                <p className="text-[12px] text-muted-foreground text-center pt-1">
                  Após o cadastro, peça ao administrador para liberar seu perfil.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
