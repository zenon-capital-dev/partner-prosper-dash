import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Lock, Mail, Eye, EyeOff, ShieldCheck } from "lucide-react";
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
    <div className="min-h-[100dvh] w-full bg-slate-50 flex flex-col lg:flex-row">
      {/* LEFT — brand panel (desktop only) */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative bg-slate-900 text-white flex-col justify-between p-12 xl:p-16 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="absolute -top-32 -left-32 size-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 size-[28rem] rounded-full bg-blue-500/15 blur-3xl" />

        <header className="relative flex items-center gap-3">
          <ProsperLogo size={40} />
          <div>
            <div className="font-semibold text-[15px] tracking-tight leading-none">Prosper</div>
            <div className="text-[11px] text-white/50 mt-1">Strategic Management</div>
          </div>
        </header>

        <div className="relative space-y-8 max-w-md">
          <h1 className="font-display text-[44px] xl:text-[52px] leading-[1.05] font-semibold tracking-tight">
            Gestão completa<br />do seu negócio.
          </h1>
          <p className="text-[15px] text-white/60 leading-relaxed">
            Clientes, vendas, contratos e comissões em um só lugar — com a inteligência que sua operação precisa.
          </p>

          <div className="space-y-3 pt-4">
            {[
              "Operação centralizada em tempo real",
              "Comissionamento automático e transparente",
              "Relatórios e indicadores prontos para decisão",
            ].map((t) => (
              <div key={t} className="flex items-center gap-3 text-[14px] text-white/75">
                <div className="size-5 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
                  <div className="size-1.5 rounded-full bg-emerald-400" />
                </div>
                {t}
              </div>
            ))}
          </div>
        </div>

        <footer className="relative flex items-center justify-between text-[11px] text-white/40">
          <span>© {new Date().getFullYear()} Prosper</span>
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-3.5" />
            Conexão segura · TLS 1.3
          </span>
        </footer>
      </div>

      {/* RIGHT — form */}
      <div className="flex-1 flex flex-col px-5 sm:px-8 py-8 sm:py-12">
        {/* Mobile brand */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <ProsperLogo size={36} />
          <div>
            <div className="font-semibold text-[14px] tracking-tight leading-none text-slate-900">Prosper</div>
            <div className="text-[10.5px] text-slate-500 mt-0.5">Strategic Management</div>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <div className="w-full max-w-[400px] mx-auto">
            <div className="mb-8">
              <h2 className="font-display text-[28px] sm:text-[32px] font-semibold tracking-tight text-slate-900 leading-tight">
                Entre na sua conta
              </h2>
              <p className="text-[14px] text-slate-500 mt-2">
                Acesse o painel com seu e-mail e senha.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-[13px] font-medium text-slate-700">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    required
                    className="h-12 pl-10 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password" className="text-[13px] font-medium text-slate-700">
                    Senha
                  </Label>
                  <button
                    type="button"
                    onClick={handleForgot}
                    className="text-[12px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    Esqueci a senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="login-password"
                    name="password"
                    type={showPwd ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    required
                    className="h-12 pl-10 pr-11 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    aria-label="Mostrar senha"
                  >
                    {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-[14px] shadow-sm transition-all active:scale-[0.99]"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Entrando…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Entrar
                    <ArrowRight className="size-4" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-200">
              <p className="text-center text-[12.5px] text-slate-500">
                Acesso restrito. Contas são criadas pelo administrador.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 mt-6">
          <ShieldCheck className="size-3.5" />
          <span>Conexão criptografada · TLS 1.3</span>
        </div>
      </div>
    </div>
  );
}
