import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, RotateCcw, LayoutDashboard, Layout, Sidebar as SidebarIcon } from "lucide-react";
import { updateThemeColors, ThemeColors } from './ThemeColorManager';
import { Card, CardContent } from "@/components/ui/card";

const DEFAULT_COLORS: ThemeColors = {
  primary: '#1d4ed8',
  sidebarBackground: '#020617',
  sidebarForeground: '#94a3b8',
  accent: '#f1f5f9',
  radius: '0.5rem',
};

const PRESETS = [
  { name: 'Padrão', colors: DEFAULT_COLORS },
  { name: 'Ocean', colors: { ...DEFAULT_COLORS, primary: '#0ea5e9', sidebarBackground: '#0c4a6e', sidebarForeground: '#bae6fd' } },
  { name: 'Emerald', colors: { ...DEFAULT_COLORS, primary: '#10b981', sidebarBackground: '#064e3b', sidebarForeground: '#d1fae5' } },
  { name: 'Midnight', colors: { ...DEFAULT_COLORS, primary: '#8b5cf6', sidebarBackground: '#1e1b4b', sidebarForeground: '#e0e7ff' } },
  { name: 'Rose', colors: { ...DEFAULT_COLORS, primary: '#f43f5e', sidebarBackground: '#4c0519', sidebarForeground: '#ffe4e6' } },
];

export const ThemeCustomizer: React.FC = () => {
  const [colors, setColors] = useState<ThemeColors>(() => {
    const saved = localStorage.getItem('custom-theme-colors');
    return saved ? JSON.parse(saved) : DEFAULT_COLORS;
  });

  const handleChange = (key: keyof ThemeColors, value: string) => {
    const newColors = { ...colors, [key]: value };
    setColors(newColors);
    updateThemeColors(newColors);
  };

  const applyPreset = (presetColors: ThemeColors) => {
    setColors(presetColors);
    updateThemeColors(presetColors);
  };

  const handleReset = () => {
    applyPreset(DEFAULT_COLORS);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Palette className="size-4" />
          Personalizar Cores da Plataforma
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personalização de Aparência</DialogTitle>
          <DialogDescription>
            Ajuste as cores da plataforma e visualize as mudanças em tempo real.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
          {/* Controls */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Sugestões de Temas</Label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Button 
                    key={p.name} 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-[11px] gap-1.5"
                    onClick={() => applyPreset(p.colors)}
                  >
                    <div className="size-2.5 rounded-full" style={{ backgroundColor: p.colors.primary }} />
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-primary" />
                  Cor Principal
                </Label>
                <div className="flex gap-2">
                  <Input 
                    type="color" 
                    value={colors.primary} 
                    onChange={(e) => handleChange('primary', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <Input 
                    value={colors.primary} 
                    onChange={(e) => handleChange('primary', e.target.value)}
                    className="flex-1 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <SidebarIcon className="size-3" />
                  Fundo da Barra Lateral
                </Label>
                <div className="flex gap-2">
                  <Input 
                    type="color" 
                    value={colors.sidebarBackground} 
                    onChange={(e) => handleChange('sidebarBackground', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <Input 
                    value={colors.sidebarBackground} 
                    onChange={(e) => handleChange('sidebarBackground', e.target.value)}
                    className="flex-1 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <div className="size-3 rounded-full border border-slate-300" />
                  Texto da Barra Lateral
                </Label>
                <div className="flex gap-2">
                  <Input 
                    type="color" 
                    value={colors.sidebarForeground} 
                    onChange={(e) => handleChange('sidebarForeground', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <Input 
                    value={colors.sidebarForeground} 
                    onChange={(e) => handleChange('sidebarForeground', e.target.value)}
                    className="flex-1 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Arredondamento das Bordas</Label>
                <select 
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={colors.radius}
                  onChange={(e) => handleChange('radius', e.target.value)}
                >
                  <option value="0rem">Reto (0px)</option>
                  <option value="0.3rem">Suave (4.8px)</option>
                  <option value="0.5rem">Padrão (8px)</option>
                  <option value="0.75rem">Arredondado (12px)</option>
                  <option value="1rem">Extra (16px)</option>
                </select>
              </div>
            </div>

            <Button variant="outline" onClick={handleReset} className="w-full gap-2">
              <RotateCcw className="size-4" />
              Restaurar Padrão
            </Button>
          </div>

          {/* Live Preview */}
          <div className="space-y-4">
            <Label>Pré-visualização</Label>
            <div className="border rounded-xl overflow-hidden shadow-2xl scale-[0.85] origin-top bg-slate-50 dark:bg-slate-950 min-h-[400px]">
              <div className="flex h-full">
                {/* Mock Sidebar */}
                <div 
                  className="w-20 border-r transition-colors duration-300"
                  style={{ backgroundColor: colors.sidebarBackground }}
                >
                  <div className="p-4 space-y-4">
                    <div className="size-8 rounded-lg opacity-20 bg-white mx-auto" />
                    {[1, 2, 3, 4].map(i => (
                      <div 
                        key={i} 
                        className="size-8 rounded-lg mx-auto" 
                        style={{ backgroundColor: i === 1 ? colors.primary : 'transparent' }}
                      />
                    ))}
                  </div>
                </div>
                {/* Mock Content */}
                <div className="flex-1 p-6 space-y-4 bg-white dark:bg-slate-900">
                  <div className="flex justify-between items-center mb-6">
                    <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div 
                      className="h-8 w-24 rounded-md transition-all"
                      style={{ backgroundColor: colors.primary, borderRadius: colors.radius }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2].map(i => (
                      <Card key={i} style={{ borderRadius: colors.radius }}>
                        <CardContent className="p-4 space-y-2">
                          <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-800 rounded" />
                          <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="h-32 w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed flex items-center justify-center">
                    <LayoutDashboard className="size-8 text-slate-300" />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-bold">
              Vista Mockup do Sistema
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
