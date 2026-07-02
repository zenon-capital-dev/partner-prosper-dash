import { useEffect, useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bookmark, BookmarkPlus, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Preset = { id: string; name: string; state: any; createdAt: string };

interface Props {
  /** unique key per page, e.g. "clients", "sales", "journey" */
  scope: string;
  /** current filter state (any JSON-serializable object) */
  getState: () => any;
  /** apply a saved preset back into the page state */
  applyState: (state: any) => void;
  /** optional: keep track of which preset is currently applied — pass a stable signature or JSON */
  currentSignature?: string;
  className?: string;
}

const key = (scope: string) => `filter-presets:${scope}:v1`;

function loadPresets(scope: string): Preset[] {
  try {
    const raw = localStorage.getItem(key(scope));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function savePresets(scope: string, presets: Preset[]) {
  try { localStorage.setItem(key(scope), JSON.stringify(presets)); } catch {}
}

export function FilterPresets({ scope, getState, applyState, currentSignature, className }: Props) {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets(scope));
  const [newName, setNewName] = useState("");
  const [appliedId, setAppliedId] = useState<string | null>(null);

  useEffect(() => { savePresets(scope, presets); }, [scope, presets]);

  // detect if applied preset still matches current state
  const activePreset = useMemo(() => {
    if (!appliedId) return null;
    const p = presets.find((x) => x.id === appliedId);
    if (!p) return null;
    try {
      const sig = currentSignature ?? JSON.stringify(getState());
      return sig === JSON.stringify(p.state) ? p : null;
    } catch { return null; }
  }, [appliedId, presets, currentSignature, getState]);

  const handleSave = () => {
    const name = newName.trim();
    if (!name) { toast.error("Dê um nome ao filtro"); return; }
    const state = getState();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const preset: Preset = { id, name, state, createdAt: new Date().toISOString() };
    setPresets((prev) => [preset, ...prev.filter((p) => p.name !== name)]);
    setNewName("");
    setAppliedId(id);
    toast.success(`Filtro "${name}" salvo`);
  };

  const handleApply = (p: Preset) => {
    applyState(p.state);
    setAppliedId(p.id);
    setOpen(false);
    toast.success(`Filtro "${p.name}" aplicado`);
  };

  const handleDelete = (p: Preset) => {
    setPresets((prev) => prev.filter((x) => x.id !== p.id));
    if (appliedId === p.id) setAppliedId(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-2 border-slate-200 text-slate-700 hover:bg-slate-50",
            activePreset && "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-50",
            className,
          )}
        >
          <Bookmark className="size-3.5" />
          <span className="font-medium">
            {activePreset ? activePreset.name : "Meus filtros"}
          </span>
          {presets.length > 0 && !activePreset && (
            <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600">
              {presets.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Salvar filtros atuais
            </div>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex.: Clientes ativos com pendência"
                className="h-8 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              />
              <Button size="sm" className="h-8 px-2" onClick={handleSave}>
                <BookmarkPlus className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="h-px bg-slate-200/70" />

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Salvos ({presets.length})
            </div>
            {presets.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
                Nenhum filtro salvo ainda.
                <br />
                Configure os filtros e salve com um nome.
              </div>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {presets.map((p) => {
                  const isActive = activePreset?.id === p.id;
                  return (
                    <li
                      key={p.id}
                      className={cn(
                        "group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50",
                        isActive && "bg-indigo-50 hover:bg-indigo-50",
                      )}
                    >
                      <button
                        onClick={() => handleApply(p)}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        {isActive ? (
                          <Check className="size-3.5 text-indigo-600" />
                        ) : (
                          <Bookmark className="size-3.5 text-slate-400" />
                        )}
                        <span className={cn("text-sm text-slate-700", isActive && "font-semibold text-indigo-700")}>
                          {p.name}
                        </span>
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="rounded p-1 text-slate-400 opacity-0 hover:bg-slate-200 hover:text-red-600 group-hover:opacity-100"
                        aria-label="Excluir filtro"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
