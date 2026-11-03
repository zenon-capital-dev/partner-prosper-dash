import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      // Identidade Zenon. Regra oficial do manual: Times (principal) e Montserrat (secundária).
      // Adaptação de interface: Montserrat no trabalho operacional; Times só em títulos institucionais.
      // Times New Roman não é empacotada (fonte Monotype): usa a instalada no sistema.
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'system-ui', 'sans-serif'],
        serif: ['"Times New Roman"', 'Times', '"Liberation Serif"', 'serif'],
        mono: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Paleta oficial do manual de marca (cores institucionais).
        zenon: {
          navy: "#172D44",
          steel: "#586879",
          ivory: "#EEE9DF",
          sand: "#C6BEAF",
          graphite: "#333330",
          bronze: "#C79662",
          terracotta: "#6F3C2C",
          // Adaptação de interface: tons auxiliares para legibilidade e estados.
          "navy-deep": "#0F1F30",
          "navy-soft": "#223B56",
          "bronze-text": "#7A5530",
          paper: "#F7F5F0",
        },
        // Adaptação de interface: as telas usam "indigo" como cor de marca e "slate" como neutro.
        // As escalas abaixo trocam o anil pelo azul Zenon (600 = #172D44) e o cinza frio por um
        // neutro quente com a mesma luminância do original (contraste preservado).
        indigo: {
          50: "#EEF2F6", 100: "#DFE6EE", 200: "#C3D0DD", 300: "#9DAFC3", 400: "#6F86A0",
          500: "#4A6683", 600: "#172D44", 700: "#13263A", 800: "#0F1F30", 900: "#0B1826", 950: "#07111B",
        },
        slate: {
          50: "#FAFAF9", 100: "#F5F4F3", 200: "#E9E7E4", 300: "#D7D4CE", 400: "#A5A19A",
          500: "#777269", 600: "#57544D", 700: "#42403B", 800: "#2A2825", 900: "#181716", 950: "#070706",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          muted: "hsl(var(--primary-muted))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          muted: "hsl(var(--success-muted))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          muted: "hsl(var(--warning-muted))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          muted: "hsl(var(--info-muted))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          muted: "hsl(var(--destructive-muted))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
          muted: "hsl(var(--sidebar-muted))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
        },
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-success': 'var(--gradient-success)',
        'gradient-card': 'var(--gradient-card)',
        'gradient-sidebar': 'var(--gradient-sidebar)',
      },
      boxShadow: {
        'vx-sm': 'var(--shadow-sm)',
        'vx-md': 'var(--shadow-md)',
        'vx-lg': 'var(--shadow-lg)',
        'vx-glow': 'var(--shadow-glow)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "slide-in": { from: { opacity: "0", transform: "translateX(-8px)" }, to: { opacity: "1", transform: "translateX(0)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in 0.25s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
