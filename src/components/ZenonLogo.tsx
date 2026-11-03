import { cn } from "@/lib/utils";

/**
 * Logo oficial da ZENON (arquivos em public/brand, vindos do pacote da marca).
 * Só exibe os arquivos: não recria a marca, não recolore e não distorce
 * (largura e altura seguem a proporção original; object-contain).
 */
const VARIANTS = {
  // Fundo escuro (azul profundo)
  "horizontal-branco": { src: "/brand/zenon-horizontal-branco.png", w: 720, h: 197 },
  "vertical-branco": { src: "/brand/zenon-vertical-branco.png", w: 640, h: 469 },
  "selo-branco": { src: "/brand/zenon-selo-arco-branco.png", w: 186, h: 256 },
  // Fundo claro
  "assinatura-azul": { src: "/brand/zenon-assinatura-azul.png", w: 720, h: 217 },
  "vertical-azul": { src: "/brand/zenon-vertical-azul.png", w: 640, h: 470 },
  "selo-azul": { src: "/brand/zenon-selo-arco-azul.png", w: 372, h: 512 },
} as const;

export type ZenonLogoVariant = keyof typeof VARIANTS;

interface Props {
  variant: ZenonLogoVariant;
  /** Altura em px; a largura acompanha a proporção do arquivo. */
  height: number;
  className?: string;
  /** Use quando a logo está dentro de um controle que já tem nome acessível. */
  decorative?: boolean;
}

export function ZenonLogo({ variant, height, className, decorative }: Props) {
  const v = VARIANTS[variant];
  const width = Math.round((v.w / v.h) * height);
  return (
    <img
      src={v.src}
      width={width}
      height={height}
      alt={decorative ? "" : "ZENON — Arquitetura de Capital"}
      aria-hidden={decorative || undefined}
      draggable={false}
      className={cn("block shrink-0 object-contain select-none", className)}
      style={{ width, height }}
    />
  );
}
