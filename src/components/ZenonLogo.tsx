import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  compact?: boolean;
  tone?: "light" | "dark";
}

/** Official supplied artwork; no reconstructed lettering or recolouring. */
export function ZenonLogo({ className, compact = false, tone = "dark" }: Props) {
  return (
    <img
      src={`/brand/zenon/${compact ? "seal" : "logo"}-${tone === "light" ? "white" : "black"}.png`}
      alt="Zenon — Arquitetura de Capital"
      className={cn("object-contain shrink-0", compact ? "size-10" : "w-[180px] h-[54px] max-w-full", className)}
      decoding="async"
    />
  );
}
