import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ArrowRight,
  ShieldCheck,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  Check,
} from "lucide-react";
import { z } from "zod";
import { ProsperLogo } from "@/components/VendxLogo";

const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Informe seu nome completo").max(120),
    email: z.string().trim().email("Email inválido").max(255),
    password: z
      .string()
      .min(8, "A senha deve ter no mínimo 8 caracteres")
      .max(72, "Senha muito longa")
      .regex(/[A-Z]/, "Inclua ao menos uma letra maiúscula")
      .regex(/[a-z]/, "Inclua ao menos uma letra minúscula")
      .regex(/[0-9]/, "Inclua ao menos um número"),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Você precisa aceitar os termos" }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

function passwordStrength(pwd: string) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(score, 4);
}

export default function SignupPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [pwd, setPwd] = useState("");
  const [accept, setAccept] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  const strength = passwordStrength(pwd);
  const strengthLabel = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"][strength];
  const strengthColor = [
    "bg-red-400",
    "bg-orange-400",
    "bg-amber-400",
    "bg-emerald-400",
    "bg-emerald-500",
  ][strength];

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      fullName: fd.get("fullName"),
      email: fd.get("email"),
      password: fd.get("password"),
      confirmPassword: fd.get("confirmPassword"),
      acceptTerms: accept,
    });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);

    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: parsed.data.fullName },
      },
    });
    setSubmitting(false);

    if (error) {
      const msg = error.message.includes("already registered")
        ? "Este email já está cadastrado"
        : error.message;
      return toast.error(msg);
    }
    toast.success("Conta criada! Verifique seu email para confirmar.");
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-[100dvh] w-full grid lg:grid-cols-[1.15fr_1fr] bg-[#06070C] text-white overflow-hidden">
      {/* LEFT — CINEMATIC CANVAS */}
      <div className="relative hidden lg:flex flex-col justify-between p-14 xl:p-16 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A0E1A] via-[#06070C] to-[#0A0E1A]" />
          <div
            className="absolute -top-40 -left-40 w-[640px] h-[640px] rounded-full opacity-[0.55] blur-[120px] animate-orb-1"
            style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }}
          />
          <div
            className="absolute top-1/3 -right-40 w-[560px] h-[560px] rounded-full opacity-[0.45] blur-[120px] animate-orb-2"
            style={{ background: "radial-gradient(circle, #06B6D4 0%, transparent 70%)" }}
          />
          <div
            className="absolute -bottom-40 left-1/4 w-[520px] h-[520px] rounded-full opacity-[0.35] blur-[120px] animate-orb-3"
            style={{ background: "radial-gradient(circle, #3B82F6 0%, transparent 70%)" }}
          />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage:
                "radial-gradient(ellipse 80% 70% at 50% 40%, #000 30%, transparent 100%)",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,#06070C_100%)]" />
        </div>

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

        <div className="relative z-10 max-w-xl space-y-12">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-xl pl-2 pr-4 py-1.5">
              <span className="relative flex size-2">
                <span className="absolute inset-0 rounded-full bg-purple-400 animate-ping opacity-60" />
                <span className="relative size-2 rounded-full bg-purple-400 shadow-[0_0_12px_#a78bfa]" />
              </span>
              <span className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-white/70">
                Criação de conta
              </span>
            </div>

            <h1 className="font-display text-[58px] xl:text-[64px] leading-[0.98] font-bold tracking-[-0.025em]">
              Comece a operar<br />
              <span className="bg-gradient-to-r from-white via-white to-white/40 bg-clip-text text-transparent">
                em minutos.
              </span>
            </h1>

            <p className="text-[15.5px] text-white/50 leading-[1.65] max-w-[480px] font-light">
              Crie sua conta para acessar a plataforma de gestão estratégica
              que conecta clientes, parceiros e comissões num só fluxo.
            </p>
          </div>

          <div className="space-y-px">
            {[
              { n: "01", t: "Sem cartão de crédito", d: "Cadastro gratuito e imediato." },
              { n: "02", t: "Dados protegidos", d: "Criptografia de ponta a ponta." },
              { n: "03", t: "Cancele quando quiser", d: "Sem fidelidade ou multas." },
            ].map((f) => (
              <div
                key={f.n}
                className="group flex items-start gap-5 py-4 border-t border-white/[0.06] last:border-b transition-colors hover:bg-white/[0.015]"
              >
                <span className="font-mono text-[10.5px] text-white/30 tracking-widest mt-0.5 tabular-nums">
                  {f.n}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-white/85 group-hover:text-white transition-colors">
                    {f.t}
                  </p>
                  <p className="text-[12.5px] text-white/40 mt-0.5 font-light">{f.d}</p>
                </div>
                <CheckCircle2
                  className="size-4 text-white/20 group-hover:text-emerald-400/80 transition-colors mt-1"
                  strokeWidth={1.6}
                />
              </div>
            ))}
          </div>
        </div>

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

      {/* RIGHT — FORM */}
      <div className="relative flex flex-col items-center justify-center p-6 sm:p-10 lg:p-12 bg-[#FAFAF7] text-slate-900">
        <div
          className="absolute inset-0 opacity-[0.4] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent pointer-events-none" />

        <CornerMark className="top-6 left-6" />
        <CornerMark className="top-6 right-6" rotate="rotate-90" />
        <CornerMark className="bottom-6 left-6" rotate="-rotate-90" />
        <CornerMark className="bottom-6 right-6" rotate="rotate-180" />

        <div className="relative w-full max-w-[440px] space-y-7">
          {/* Mobile brand */}
          <div className="lg:hidden flex flex-col items-center text-center space-y-3 mb-2">
            <div className="size-12 rounded-2xl bg-slate-900 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="size-6" fill="none">
                <path
                  d="M4 20V4h6c2.8 0 5 2 5 4.8 0 2.6-1.8 4.4-4.4 4.6L15 20"
                  stroke="white"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <div className="font-display font-bold text-[15px] tracking-[0.28em] uppercase">
                PROSPER
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
            <span className="font-mono text-[10px] tracking-[0.32em] uppercase text-slate-400 font-semibold">
              Cadastro · 02
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
          </div>

          <div className="space-y-2 text-center">
            <h2 className="font-display text-[36px] font-bold tracking-[-0.03em] leading-[1] text-slate-950">
              Crie sua conta
              <span className="block text-slate-400 text-[22px] font-normal italic mt-2 tracking-tight">
                em poucos passos.
              </span>
            </h2>
            <p className="text-[13px] text-slate-500 leading-relaxed max-w-[340px] mx-auto">
              Preencha os dados abaixo para começar a usar a plataforma.
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            {/* Full name */}
            <div className="space-y-1.5">
              <Label
                htmlFor="signup-name"
                className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500"
              >
                Nome completo
              </Label>
              <div className="relative group">
                <User
                  className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors z-10"
                  strokeWidth={1.8}
                />
                <Input
                  id="signup-name"
                  name="fullName"
                  type="text"
                  placeholder="Seu nome"
                  required
                  className="relative h-12 pl-11 bg-white border-slate-200/80 hover:border-slate-300 focus:border-slate-900 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl text-[14px] text-slate-900 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label
                htmlFor="signup-email"
                className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500"
              >
                E-mail
              </Label>
              <div className="relative group">
                <Mail
                  className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors z-10"
                  strokeWidth={1.8}
                />
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  required
                  className="relative h-12 pl-11 bg-white border-slate-200/80 hover:border-slate-300 focus:border-slate-900 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl text-[14px] text-slate-900 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label
                htmlFor="signup-password"
                className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500"
              >
                Senha
              </Label>
              <div className="relative group">
                <Lock
                  className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors z-10"
                  strokeWidth={1.8}
                />
                <Input
                  id="signup-password"
                  name="password"
                  type={showPwd ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  required
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  className="relative h-12 pl-11 pr-12 bg-white border-slate-200/80 hover:border-slate-300 focus:border-slate-900 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl text-[14px] text-slate-900 placeholder:text-slate-400 tracking-wider shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all"
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

              {/* Strength meter */}
              {pwd.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i < strength ? strengthColor : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[10.5px] text-slate-500 font-medium tracking-wide">
                    Força: <span className="text-slate-900">{strengthLabel}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div className="space-y-1.5">
              <Label
                htmlFor="signup-confirm"
                className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500"
              >
                Confirmar senha
              </Label>
              <div className="relative group">
                <Lock
                  className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors z-10"
                  strokeWidth={1.8}
                />
                <Input
                  id="signup-confirm"
                  name="confirmPassword"
                  type={showPwd2 ? "text" : "password"}
                  placeholder="Repita a senha"
                  required
                  className="relative h-12 pl-11 pr-12 bg-white border-slate-200/80 hover:border-slate-300 focus:border-slate-900 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl text-[14px] text-slate-900 placeholder:text-slate-400 tracking-wider shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd2((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
                  aria-label="Mostrar senha"
                >
                  {showPwd2 ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>

            {/* Terms */}
            <label className="flex items-start gap-3 pt-1 cursor-pointer group">
              <Checkbox
                id="accept"
                checked={accept}
                onCheckedChange={(c) => setAccept(c === true)}
                className="mt-0.5 size-4 rounded border-slate-300 data-[state=checked]:bg-slate-950 data-[state=checked]:border-slate-950"
              />
              <span className="text-[12.5px] text-slate-600 leading-relaxed">
                Li e concordo com os{" "}
                <a
                  href="/termos"
                  target="_blank"
                  rel="noopener"
                  className="text-slate-900 font-semibold underline underline-offset-2 hover:text-slate-700"
                >
                  Termos de Uso
                </a>{" "}
                e a{" "}
                <a
                  href="/privacidade"
                  target="_blank"
                  rel="noopener"
                  className="text-slate-900 font-semibold underline underline-offset-2 hover:text-slate-700"
                >
                  Política de Privacidade
                </a>
                .
              </span>
            </label>

            {/* Submit */}
            <Button
              type="submit"
              className="group relative w-full h-12 mt-2 font-semibold text-[14px] rounded-xl bg-slate-950 hover:bg-slate-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(15,23,42,0.4)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.05),0_12px_32px_-8px_rgba(15,23,42,0.5)] transition-all active:scale-[0.99] overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={submitting || !accept}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              {submitting ? (
                <span className="relative flex items-center gap-2.5">
                  <span className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Criando conta…
                </span>
              ) : (
                <span className="relative flex items-center gap-2.5 tracking-wide">
                  Criar conta
                  <ArrowRight
                    className="size-4 group-hover:translate-x-0.5 transition-transform"
                    strokeWidth={2.2}
                  />
                </span>
              )}
            </Button>
          </form>

          {/* Sign-in link */}
          <div className="text-center">
            <p className="text-[12.5px] text-slate-500">
              Já tem uma conta?{" "}
              <Link
                to="/auth"
                className="text-slate-900 font-semibold underline underline-offset-2 hover:text-slate-700"
              >
                Entrar
              </Link>
            </p>
          </div>

          <div className="pt-5 border-t border-slate-200/60">
            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="size-3.5 text-emerald-600/70" strokeWidth={1.8} />
              <span className="font-medium tracking-wide">
                Seus dados são criptografados · TLS 1.3
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes orb-1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(80px,60px) scale(1.1); } }
        @keyframes orb-2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-60px,80px) scale(0.95); } }
        @keyframes orb-3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,-60px) scale(1.05); } }
        .animate-orb-1 { animation: orb-1 18s ease-in-out infinite; }
        .animate-orb-2 { animation: orb-2 22s ease-in-out infinite; }
        .animate-orb-3 { animation: orb-3 26s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function CornerMark({ className = "", rotate = "" }: { className?: string; rotate?: string }) {
  return (
    <div className={`absolute size-3 ${className} ${rotate} pointer-events-none`}>
      <div className="absolute top-0 left-0 w-full h-px bg-slate-300/60" />
      <div className="absolute top-0 left-0 h-full w-px bg-slate-300/60" />
    </div>
  );
}
