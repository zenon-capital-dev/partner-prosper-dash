import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { MessageSquare, Send, Bot, Sparkles, X, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AIAssistant() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! Sou o assistente de IA da Prosper. Como posso te ajudar hoje?",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, isMinimized]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { 
          message: userMessage,
          history: messages,
          userId: user?.id,
          context: "CRM Admin/Staff Assistant"
        },
      });

      if (error) throw error;

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (error) {
      console.error("AI Error:", error);
      toast.error("Erro ao processar sua solicitação.");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Desculpe, tive um problema ao processar isso. Tente novamente mais tarde." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 size-14 rounded-full shadow-2xl bg-indigo-600 hover:bg-indigo-700 text-white z-50 group transition-all duration-300 hover:scale-105"
      >
        <Bot className="size-6 group-hover:hidden" />
        <Sparkles className="size-6 hidden group-hover:block animate-pulse" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 w-[400px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 flex flex-col transition-all duration-300 overflow-hidden",
        isMinimized ? "h-14" : "h-[600px]"
      )}
    >
      {/* Header */}
      <div className="h-14 bg-indigo-600 px-4 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="size-5" />
          <span className="font-semibold text-sm">Prosper AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-white hover:bg-white/20"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <Maximize2 className="size-4" /> : <Minimize2 className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-white hover:bg-white/20"
            onClick={() => setIsOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col max-w-[85%] gap-1",
                    msg.role === "user" ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-tr-none shadow-md"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none shadow-sm"
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-1.5 items-center text-slate-400 p-2">
                  <div className="size-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="size-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="size-1.5 bg-slate-400 rounded-full animate-bounce" />
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer/Input */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex gap-2">
              <Input
                placeholder="Como posso ajudar?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="rounded-full bg-slate-50 dark:bg-slate-800 border-none focus-visible:ring-1 focus-visible:ring-indigo-500"
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="size-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 p-0 shadow-lg hover:shadow-indigo-500/25 transition-all"
              >
                <Send className="size-4" />
              </Button>
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-3">
              Desenvolvido pela equipe de IA Prosper
            </p>
          </div>
        </>
      )}
    </div>
  );
}
