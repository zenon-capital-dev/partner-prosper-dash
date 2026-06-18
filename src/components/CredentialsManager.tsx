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

type EntityType = "cliente" | "parceiro" | "prestador" | "indicador" | "colaborador";

interface Props {
  userId?: string | null;
  currentEmail?: string | null;
  /** Entity label, e.g. "parceiro", "cliente", "prestador" */
  entityLabel?: string;
  /** Entity type used to wire the new user back to the record (clients/partners/...) */
  entityType?: EntityType;
  /** Row id of the entity (client.id, partner.id, etc.) used to link the new user */
  entityId?: string | null;
  /** Optional display name used when creating the access */
  entityName?: string | null;
  /** Render as a Card section (for tabs) or inline trigger button */
  variant?: "card" | "button";
  buttonLabel?: string;
  onUpdated?: () => void;
}

export function CredentialsManager({
  userId,
  currentEmail,
  entityLabel = "usuário",
  entityType,
  entityId,
  entityName,
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
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);


  const hasUser = !!userId;

  // FunctionsHttpError vem com o body real em `error.context` (Response).
  // O Supabase só repassa "Edge Function returned a non-2xx status code" no error.message,
  // por isso precisamos ler manualmente o JSON da resposta para mostrar o erro real ao usuário.
  const extractError = async (error: any, data: any): Promise<string | null> => {
    if (!error && !(data as any)?.error) return null;
    if ((data as any)?.error) return String((data as any).error);
    try {
      const ctx = error?.context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) return String(body.error);
      } else if (ctx && typeof ctx.text === "function") {
        const txt = await ctx.text();
        try { const j = JSON.parse(txt); if (j?.error) return String(j.error); } catch { /* */ }
        if (txt) return txt;
      }
    } catch { /* */ }
    return error?.message || "Erro desconhecido";
  };

  const saveEmail = async () => {
    if (!userId) return toast.error("Este " + entityLabel + " ainda não possui usuário vinculado.");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("E-mail inválido");
    setSavingEmail(true);
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: { action: "update_profile", user_id: userId, profile: { email } },
    });
    setSavingEmail(false);
    const errMsg = await extractError(error, data);
    if (errMsg) return toast.error(errMsg);
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
    const errMsg = await extractError(error, data);
    if (errMsg) return toast.error(errMsg);
    toast.success("Senha atualizada. O " + entityLabel + " já pode logar com a nova senha.");
    setPassword("");
    setConfirm("");
    onUpdated?.();
  };

  const canCreate = !hasUser && !!entityType && (entityType === "colaborador" || !!entityId);

  const createAccess = async () => {
    if (!canCreate) return;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("E-mail inválido");
    const check = validatePassword(password);
    if (!check.ok) return toast.error(check.errors[0]);
    if (password !== confirm) return toast.error("As senhas não conferem");
    const roleMap: Record<EntityType, string> = {
      cliente: "cliente",
      parceiro: "parceiro",
      prestador: "prestador",
      indicador: "indicador",
      colaborador: "colaborador",
    };
    const linkKey: Partial<Record<EntityType, string>> = {
      cliente: "link_client_id",
      parceiro: "link_partner_id",
      prestador: "link_service_provider_id",
      indicador: "link_referrer_id",
    };
    const body: Record<string, any> = {
      email,
      password,
      role: roleMap[entityType!],
      full_name: entityName ?? email,
      send_invite: false,
    };
    const key = linkKey[entityType!];
    if (key && entityId) body[key] = entityId;

    setCreating(true);
    const { data, error } = await supabase.functions.invoke("invite-user", { body });
    setCreating(false);
    const errMsg = await extractError(error, data);
    if (errMsg) return toast.error(errMsg);
    try { await navigator.clipboard.writeText(`Email: ${email}\nSenha: ${password}`); } catch {}
    toast.success(`Acesso criado para ${email}`, { description: "Credenciais copiadas para a área de transferência.", duration: 15000 });
    setPassword(""); setConfirm("");
    onUpdated?.();
  };

  const body = (
    <div className="space-y-6">
      {!hasUser && !canCreate && (
        <Alert variant="destructive">
          <ShieldAlert className="size-4" />
          <AlertDescription>
            Este {entityLabel} ainda não tem um usuário vinculado. Crie o acesso primeiro em "Usuários" ou no convite.
          </AlertDescription>
        </Alert>
      )}

      {canCreate && (
        <div className="space-y-3 p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.03]">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="size-4 text-primary" /> Criar acesso para este {entityLabel}
          </div>
          <p className="text-xs text-muted-foreground">Este {entityLabel} ainda não possui login. Defina e-mail e senha para gerar o acesso ao painel.</p>
          <div className="space-y-2">
            <Label className="text-xs">E-mail de login</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" />
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-xs">Senha</Label>
              <Input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mín. 8, 1 letra e 1 número" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Confirmar senha</Label>
              <Input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repita a senha" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setShow((s) => !s)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {show ? "Ocultar" : "Mostrar"} senha
            </button>
            <Button onClick={createAccess} disabled={creating || !email || !password || !confirm}>
              {creating ? "Criando..." : "Criar acesso"}
            </Button>
          </div>
        </div>
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
