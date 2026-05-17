import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmOptions = {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type ConfirmListener = (opts: ConfirmOptions, resolve: (v: boolean) => void) => void;

let listener: ConfirmListener | null = null;

export function confirmAction(opts: ConfirmOptions | string): Promise<boolean> {
  const normalized: ConfirmOptions =
    typeof opts === "string" ? { description: opts } : opts;
  return new Promise<boolean>((resolve) => {
    if (listener) listener(normalized, resolve);
    else resolve(window.confirm(normalized.description));
  });
}

export function ConfirmRoot() {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  useEffect(() => {
    listener = (opts, resolve) => setState({ opts, resolve });
    return () => { listener = null; };
  }, []);

  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };

  const opts = state?.opts;
  const destructive = opts?.destructive ?? /excluir|remover|cancelar|deletar/i.test(opts?.description ?? "");

  return (
    <AlertDialog open={!!state} onOpenChange={(o) => { if (!o) close(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{opts?.title ?? (destructive ? "Confirmar ação" : "Confirmar")}</AlertDialogTitle>
          <AlertDialogDescription>{opts?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>{opts?.cancelText ?? "Cancelar"}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {opts?.confirmText ?? (destructive ? "Confirmar" : "OK")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
