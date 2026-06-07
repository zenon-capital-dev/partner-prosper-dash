import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { validatePassword } = await import("@/lib/password");
    const check = validatePassword(password);
    if (!check.ok) { toast.error(check.errors.join(" · ")); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Senha alterada com sucesso!");
    navigate("/");
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-6">
      <form onSubmit={submit} className="w-full max-w-md space-y-6 vx-card p-8">
        <div>
          <h1 className="font-display text-2xl font-bold">Definir nova senha</h1>
          <p className="text-sm text-muted-foreground mt-1">Digite sua nova senha abaixo.</p>
        </div>
        <div className="space-y-2">
          <Label>Nova senha</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres · 1 letra · 1 número" required />
        </div>
        <Button type="submit" disabled={submitting} className="w-full bg-gradient-primary hover:opacity-90">
          {submitting ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </div>
  );
}
