import React, { useEffect, useState } from 'react';

export interface ThemeColors {
  primary: string;
  sidebarBackground: string;
  sidebarForeground: string;
  accent: string;
  radius: string;
}

const DEFAULT_COLORS: ThemeColors = {
  primary: '#1d4ed8',
  sidebarBackground: '#020617',
  sidebarForeground: '#94a3b8',
  accent: '#f1f5f9',
  radius: '0.5rem',
};

export const ThemeColorManager: React.FC = () => {
  const [colors, setColors] = useState<ThemeColors>(() => {
    const saved = localStorage.getItem('custom-theme-colors');
    return saved ? JSON.parse(saved) : DEFAULT_COLORS;
  });

  useEffect(() => {
    const applyColors = (colorsToApply: ThemeColors) => {
      const root = document.documentElement;
      
      // Helper to convert hex to HSL for Tailwind
      const hexToHSL = (hex: string) => {
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) {
          r = parseInt(hex[1] + hex[1], 16);
          g = parseInt(hex[2] + hex[2], 16);
          b = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length === 7) {
          r = parseInt(hex.substring(1, 3), 16);
          g = parseInt(hex.substring(3, 5), 16);
          b = parseInt(hex.substring(5, 7), 16);
        }
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s, l = (max + min) / 2;
        if (max === min) {
          h = s = 0;
        } else {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
          }
          h /= 6;
        }
        return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
      };

      root.style.setProperty('--primary', hexToHSL(colorsToApply.primary));
      root.style.setProperty('--ring', hexToHSL(colorsToApply.primary));
      root.style.setProperty('--sidebar-background', hexToHSL(colorsToApply.sidebarBackground));
      root.style.setProperty('--sidebar-foreground', hexToHSL(colorsToApply.sidebarForeground));
      root.style.setProperty('--accent', hexToHSL(colorsToApply.accent));
      root.style.setProperty('--radius', colorsToApply.radius);
      
      // Admin sidebar specific (if needed)
      root.style.setProperty('--admin-sidebar-active', hexToHSL(colorsToApply.primary));
    };

    applyColors(colors);

    // Listen for storage changes to sync across tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'custom-theme-colors' && e.newValue) {
        const newColors = JSON.parse(e.newValue);
        setColors(newColors);
        applyColors(newColors);
      }
    };

    window.addEventListener('storage', handleStorage);
    // Custom event for same-tab updates
    const handleUpdate = (e: any) => {
      if (e.detail) {
        setColors(e.detail);
        applyColors(e.detail);
      }
    };
    window.addEventListener('theme-colors-updated', handleUpdate);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('theme-colors-updated', handleUpdate);
    };
  }, [colors]);

  return null;
};

export const updateThemeColors = (newColors: ThemeColors) => {
  localStorage.setItem('custom-theme-colors', JSON.stringify(newColors));
  window.dispatchEvent(new CustomEvent('theme-colors-updated', { detail: newColors }));
};
