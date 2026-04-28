import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="size-9 rounded-lg border border-border hover:bg-accent flex items-center justify-center transition-colors"
      aria-label="Alternar tema"
      title={theme === "dark" ? "Tema claro" : "Tema escuro"}
    >
      {theme === "dark" ? <Sun className="size-4 text-muted-foreground" /> : <Moon className="size-4 text-muted-foreground" />}
    </button>
  );
}
