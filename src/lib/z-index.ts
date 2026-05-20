// Camadas de empilhamento centralizadas. Use em Dialog, Popover, Select, Tooltip etc.
// Evita conflitos entre Selects dentro de Dialogs em mobile.
export const Z = {
  base: 0,
  sticky: 30,
  header: 40,
  dropdown: 50,
  modal: 60,
  popover: 70,
  tooltip: 80,
  toast: 90,
} as const;

export const zClass = {
  base: "z-0",
  sticky: "z-30",
  header: "z-40",
  dropdown: "z-50",
  modal: "z-[60]",
  popover: "z-[70]",
  tooltip: "z-[80]",
  toast: "z-[90]",
} as const;
