import React, { useEffect, useState, useCallback, useMemo } from 'react';

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

// Helper to convert hex to HSL for Tailwind
const hexToHSL = (hex: string) => {
  if (!hex) return "0 0% 0%";
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

export const ThemeColorManager: React.FC = () => {
  const [colors, setColors] = useState<ThemeColors>(() => {
    const saved = localStorage.getItem('custom-theme-colors');
    return saved ? JSON.parse(saved) : DEFAULT_COLORS;
  });

  const applyColors = useCallback((colorsToApply: ThemeColors) => {
    const root = document.documentElement;
    
    // We update individually to avoid heavy calculations if only one changed
    root.style.setProperty('--primary', hexToHSL(colorsToApply.primary));
    root.style.setProperty('--custom-primary', hexToHSL(colorsToApply.primary));
    root.style.setProperty('--ring', hexToHSL(colorsToApply.primary));
    root.style.setProperty('--sidebar-background', hexToHSL(colorsToApply.sidebarBackground));
    root.style.setProperty('--sidebar-foreground', hexToHSL(colorsToApply.sidebarForeground));
    root.style.setProperty('--accent', hexToHSL(colorsToApply.accent));
    root.style.setProperty('--custom-accent', hexToHSL(colorsToApply.accent));
    root.style.setProperty('--radius', colorsToApply.radius);
    
    // Admin sidebar specific
    root.style.setProperty('--admin-sidebar-active', hexToHSL(colorsToApply.primary));
    
    // Also update primary-foreground based on brightness of primary
    // This is a bit more complex, but let's stick to the basics first
  }, []);

  useEffect(() => {
    applyColors(colors);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'custom-theme-colors' && e.newValue) {
        try {
          const newColors = JSON.parse(e.newValue);
          setColors(newColors);
          applyColors(newColors);
        } catch (err) {
          console.error("Error parsing theme colors from storage", err);
        }
      }
    };

    const handleUpdate = (e: any) => {
      if (e.detail) {
        setColors(e.detail);
        applyColors(e.detail);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('theme-colors-updated', handleUpdate);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('theme-colors-updated', handleUpdate);
    };
  }, [applyColors, colors]);

  return null;
};

export const updateThemeColors = (newColors: ThemeColors) => {
  localStorage.setItem('custom-theme-colors', JSON.stringify(newColors));
  window.dispatchEvent(new CustomEvent('theme-colors-updated', { detail: newColors }));
};