import { useEffect } from "react";

/**
 * Garante que o `body` nunca fique travado depois que um overlay Radix
 * (Dialog, Sheet, Select, DropdownMenu, Popover) é fechado.
 *
 * O Radix injeta `pointer-events: none` e `overflow: hidden` no body
 * enquanto há um overlay ativo. Em algumas condições (rotas trocando
 * exatamente no momento do close, animação interrompida no mobile, etc.)
 * esses estilos podem ficar presos, e a tela inteira fica sem scroll/clique.
 *
 * Esse hook observa o `body` e limpa esses estilos sempre que NÃO houver
 * mais nenhum overlay aberto no DOM.
 */
export function useBodyScrollCleanup() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const hasOpenOverlay = () =>
      document.querySelector(
        '[data-state="open"][role="dialog"], [data-state="open"][role="menu"], [data-state="open"][role="listbox"], [data-radix-popper-content-wrapper]'
      ) !== null;

    const cleanup = () => {
      if (hasOpenOverlay()) return;
      const body = document.body;
      if (body.style.pointerEvents === "none") body.style.pointerEvents = "";
      if (body.style.overflow === "hidden") body.style.overflow = "";
      body.removeAttribute("data-scroll-locked");
    };

    const observer = new MutationObserver(() => {
      // pequeno delay para permitir a animação do Radix terminar
      window.setTimeout(cleanup, 80);
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["style", "data-scroll-locked"],
      childList: true,
      subtree: false,
    });

    // limpeza periódica defensiva (mobile pode perder eventos de animação)
    const interval = window.setInterval(cleanup, 1500);

    // limpa no popstate (navegação com modal aberto)
    const onPop = () => window.setTimeout(cleanup, 50);
    window.addEventListener("popstate", onPop);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.removeEventListener("popstate", onPop);
    };
  }, []);
}
