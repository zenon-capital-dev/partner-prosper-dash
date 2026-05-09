import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCcw, LogOut } from "lucide-react";

interface LoadingScreenProps {
  message?: string;
  timeoutMessage?: string;
}

export function LoadingScreen({ 
  message = "Sincronizando ambiente seguro...", 
  timeoutMessage = "Não conseguimos carregar suas permissões a tempo. Pode ser instabilidade na conexão."
}: LoadingScreenProps) {
  const { signOut } = useAuth();
  const [showTimeout, setShowTimeout] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTimeout(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
      <div className="relative mb-6">
        <div className="size-12 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin" />
        <div className="absolute inset-0 size-12 rounded-full border border-primary/10 blur-sm" />
      </div>
      
      {showTimeout ? (
        <div className="animate-fade-up max-w-sm">
          <h3 className="text-xl font-bold mb-2 text-foreground">Identificamos um atraso...</h3>
          <p className="text-sm text-muted-foreground mb-8 px-4">
            {timeoutMessage}
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => window.location.reload()} size="lg" className="w-full">
              <RefreshCcw className="size-4 mr-2" /> Tentar Novamente
            </Button>
            <Button onClick={() => signOut()} variant="ghost" size="lg" className="w-full text-muted-foreground hover:text-foreground">
              <LogOut className="size-4 mr-2" /> Sair do sistema
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60 animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}
