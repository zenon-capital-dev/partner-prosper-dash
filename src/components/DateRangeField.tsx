import { formatBR as format } from "@/lib/datetime";
import * as React from "react";
;
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateRangeFieldProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
}

/**
 * Filtro de intervalo de datas com validação data_final >= data_inicial garantida pelo Calendar.
 */
export function DateRangeField({
  value,
  onChange,
  placeholder = "Selecione o período",
  className,
  align = "start",
}: DateRangeFieldProps) {
  const label = React.useMemo(() => {
    if (!value?.from) return placeholder;
    if (!value.to) return format(value.from, "dd/MM/yyyy", { locale: ptBR });
    return `${format(value.from, "dd/MM/yyyy", { locale: ptBR })} → ${format(
      value.to,
      "dd/MM/yyyy",
      { locale: ptBR }
    )}`;
  }, [value, placeholder]);

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "justify-start text-left font-normal",
              !value?.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={value}
            onSelect={onChange}
            locale={ptBR}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {value?.from && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onChange(undefined)}
          aria-label="Limpar período"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
