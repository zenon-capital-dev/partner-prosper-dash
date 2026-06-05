import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyRound, Mail, Eye, EyeOff, AlertCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { validatePassword } from "@/lib/password";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

interface Props {
  userId?: string | null;
  currentEmail?: string | null;
  /** Entity label, e.g. "parceiro", "cliente", "prestador" */
  entityLabel?: string;
  /** Render as a Card section (for tabs) or inline trigger button */
  variant?: "card" | "button";
  buttonLabel?: string;
  onUpdated?: () => void;
}

export function CredentialsManager({
  userId,
  currentEmail,
  entityLabel = "usuário",
  variant = "card",
  buttonLabel = "Alterar acesso",
  onUpdated,
}: Props) {
  const [email, setEmail] = useState(currentEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const hasUser = !!userId;

  const saveEmail = async () => {
    if (!userId) return toast.error("Este " + entityLabel + " ainda não possui usuário vinculado.");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("E-mail inválido");
    setSavingEmail(true);
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: { action: "update_profile", user_id: userId, profile: { email } },
    });
    setSavingEmail(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error || error?.message || "Falha ao atualizar e-mail");
    }
    toast.success("E-mail atualizado. O " + entityLabel + " poderá logar com o novo e-mail.");
    onUpdated?.();
  };

  const savePassword = async () => {
    if (!userId) return toast.error("Este " + entityLabel + " ainda não possui usuário vinculado.");
    const check = validatePassword(password);
    if (!check.ok) return toast.error(check.errors[0]);
    if (password !== confirm) return toast.error("As senhas não conferem");
    setSavingPw(true);
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: { action: "set_password", user_id: userId, password },
    });
    setSavingPw(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error || error?.message || "Falha ao atualizar senha");
    }
    toast.success("Senha atualizada. O " + entityLabel + " já pode logar com a nova senha.");
    setPassword("");
    setConfirm("");
    onUpdated?.();
  };

  const body = (
    <div className="space-y-6">
      {!hasUser && (
        <Alert variant="destructive">
          <ShieldAlert className="size-4" />
          <AlertDescription>
            Este {entityLabel} ainda não tem um usuário vinculado. Crie o acesso primeiro em "Usuários" ou no convite.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="size-4 text-primary" /> Alterar e-mail de login
        </div>
        <div className="grid sm:grid-cols-[1fr_auto] gap-2">
          <Input
            type="email"
            placeholder="novo@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!hasUser}
          />
          <Button onClick={saveEmail} disabled={!hasUser || savingEmail || email === (currentEmail ?? "")}>
            {savingEmail ? "Salvando..." : "Atualizar e-mail"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          O novo e-mail é confirmado automaticamente. O {entityLabel} passará a logar com este endereço.
        </p>
      </div>

      <div className="space-y-3 pt-4 border-t">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="size-4 text-primary" /> Definir nova senha
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Nova senha</Label>
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              placeholder="Mínimo 8 caracteres, 1 letra e 1 número"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!hasUser}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Confirmar senha</Label>
          <Input
            type={show ? "text" : "password"}
            placeholder="Repita a senha"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={!hasUser}
          />
        </div>
        <Button
          onClick={savePassword}
          disabled={!hasUser || savingPw || !password || !confirm}
          className="w-full sm:w-auto"
        >
          {savingPw ? "Atualizando..." : "Definir nova senha"}
        </Button>
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription className="text-xs">
            A nova senha é aplicada imediatamente. Compartilhe com o {entityLabel} por um canal seguro.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );

  if (variant === "button") {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <KeyRound className="size-4" /> {buttonLabel}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Acesso do {entityLabel}</DialogTitle>
          </DialogHeader>
          {body}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4 text-primary" /> Acesso ao painel
        </CardTitle>
        <CardDescription>
          Atualize o e-mail e a senha que o {entityLabel} usa para entrar no sistema.
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
