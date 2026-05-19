import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBodyScrollCleanup } from "@/hooks/use-body-scroll-cleanup";

describe("useBodyScrollCleanup", () => {
  beforeEach(() => {
    document.body.style.cssText = "";
    document.body.removeAttribute("data-scroll-locked");
  });

  afterEach(() => {
    document.body.style.cssText = "";
  });

  it("limpa pointer-events e overflow do body quando não há overlay aberto", async () => {
    renderHook(() => useBodyScrollCleanup());

    // Simula o estado travado que o Radix deixa após fechar um Dialog/Sheet
    document.body.style.pointerEvents = "none";
    document.body.style.overflow = "hidden";
    document.body.setAttribute("data-scroll-locked", "1");

    // Força o MutationObserver
    document.body.style.color = "red";

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    expect(document.body.style.pointerEvents).toBe("");
    expect(document.body.style.overflow).toBe("");
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
  });

  it("NÃO limpa enquanto ainda existe um overlay aberto no DOM", async () => {
    renderHook(() => useBodyScrollCleanup());

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    document.body.appendChild(dialog);

    document.body.style.pointerEvents = "none";
    document.body.style.color = "red"; // dispara observer

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    expect(document.body.style.pointerEvents).toBe("none");

    dialog.remove();
  });
});
