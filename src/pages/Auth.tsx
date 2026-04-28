import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, ArrowRight, ShieldCheck, BarChart3, Users } from "lucide-react";
import { z } from "zod";
import authHero from "@/assets/auth-hero.jpg";

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
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Email ou senha incorretos" : error.message);
      return;
    }
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
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
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
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta criada! Você já pode acessar.");
    navigate("/");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[hsl(222_35%_8%)]">
      {/* Left – Hero with AI image */}
      <div className="hidden lg:flex flex-col justify-between text-white p-12 relative overflow-hidden">
        {/* Background image */}
        <img
          src={authHero}
          alt="Assistente de IA segurando um smartphone com gráficos holográficos"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark gradient overlay for legibility */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[hsl(222_45%_8%)]/95 via-[hsl(252_50%_15%)]/70 to-[hsl(252_70%_45%)]/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(222_45%_6%)] via-transparent to-transparent" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="font-display font-bold text-xl tracking-wide">PAINEL DOUGLAS</div>
              <div className="text-[10px] uppercase tracking-widest text-white/60">CRM Suite</div>
            </div>
          </div>
        </div>

        <div className="relative space-y-6 max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-success" />
            Powered by AI
          </div>
          <h1 className="font-display text-5xl font-bold leading-[1.05] drop-shadow-lg">
            Sua operação de vendas, no piloto automático.
          </h1>
          <p className="text-base text-white/75 leading-relaxed">
            Controle clientes, parceiros, comissões e documentos em um único painel construído para crescer com sua operação.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4">
            {[
              { icon: Users, label: "Multi-perfil" },
              { icon: BarChart3, label: "Relatórios em tempo real" },
              { icon: ShieldCheck, label: "Dados seguros" },
            ].map((f) => (
              <div key={f.label} className="space-y-2">
                <div className="size-9 rounded-lg bg-white/10 border border-white/15 backdrop-blur-sm flex items-center justify-center">
                  <f.icon className="size-4" />
                </div>
                <p className="text-xs text-white/80 leading-tight font-medium">{f.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-white/50">
          © {new Date().getFullYear()} PAINEL DOUGLAS. Todos os direitos reservados.
        </div>
      </div>

      {/* Right – Form */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-background relative">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="size-10 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="size-5 text-primary-foreground" />
            </div>
            <div className="font-display font-bold text-xl">PAINEL DOUGLAS</div>
          </div>

          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight">Acesse sua conta</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Entre ou cadastre-se para começar a gerenciar suas vendas.
            </p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" name="email" type="email" placeholder="voce@empresa.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input id="login-password" name="password" type="password" placeholder="••••••••" required />
                </div>
                <Button type="submit" className="w-full h-11 bg-gradient-primary hover:opacity-90 transition-opacity" disabled={submitting}>
                  {submitting ? "Entrando..." : <>Entrar <ArrowRight className="size-4 ml-1" /></>}
                </Button>
                <button
                  type="button"
                  onClick={async () => {
                    const email = (document.getElementById("login-email") as HTMLInputElement)?.value;
                    if (!email) { toast.error("Digite seu email primeiro"); return; }
                    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
                    if (error) toast.error(error.message);
                    else toast.success("Email de recuperação enviado!");
                  }}
                  className="w-full text-xs text-muted-foreground hover:text-primary mt-2 text-center"
                >
                  Esqueci minha senha
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome completo</Label>
                  <Input id="signup-name" name="fullName" placeholder="João Silva" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" name="email" type="email" placeholder="voce@empresa.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input id="signup-password" name="password" type="password" placeholder="Mínimo 6 caracteres" required />
                </div>
                <Button type="submit" className="w-full h-11 bg-gradient-primary hover:opacity-90 transition-opacity" disabled={submitting}>
                  {submitting ? "Criando..." : "Criar conta"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Após cadastro, peça ao admin para liberar seu perfil.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
