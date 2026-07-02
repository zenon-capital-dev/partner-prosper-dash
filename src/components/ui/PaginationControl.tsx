import { Button } from "./button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { PAGE_SIZE_OPTIONS } from "@/hooks/usePageSize";

interface PaginationControlProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  totalItems?: number;
  itemsPerPage?: number;
  /** Habilita o seletor de "quantos por página". */
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: Array<{ value: number; label: string }>;
}

export function PaginationControl({
  currentPage,
  totalPages,
  onPageChange,
  className,
  totalItems,
  itemsPerPage,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: PaginationControlProps) {
  const showSizeSelect = typeof pageSize === "number" && !!onPageSizeChange;
  // Se não há seletor e apenas 1 página, não renderiza nada (comportamento antigo).
  if (!showSizeSelect && totalPages <= 1) return null;

  const showAll = pageSize === -1;
  const effectivePerPage = showAll ? (totalItems || 0) : (itemsPerPage || pageSize || 0);
  const startItem = showAll ? 1 : (currentPage - 1) * effectivePerPage + 1;
  const endItem = showAll
    ? (totalItems || 0)
    : Math.min(currentPage * effectivePerPage, totalItems || 0);

  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-white dark:bg-card border-t border-border/60", className)}>
      <div className="flex items-center gap-3 order-2 sm:order-1">
        <div className="text-xs text-muted-foreground">
          {totalItems && effectivePerPage ? (
            <>
              Mostrando <span className="font-semibold text-foreground">{startItem}</span> a{" "}
              <span className="font-semibold text-foreground">{endItem}</span> de{" "}
              <span className="font-semibold text-foreground">{totalItems}</span> registros
            </>
          ) : (
            `Página ${currentPage} de ${totalPages}`
          )}
        </div>
        {showSizeSelect && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Ver</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange!(Number(v))}
            >
              <SelectTrigger className="h-8 w-[84px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {totalPages > 1 ? (
        <div className="flex items-center gap-1 order-1 sm:order-2">
          <Button variant="outline" size="icon" className="h-8 w-8 hidden sm:flex" onClick={() => onPageChange(1)} disabled={currentPage === 1}>
            <ChevronsLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
            <ChevronLeft className="size-4" />
          </Button>

          <div className="flex items-center gap-1 mx-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = currentPage;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else {
                if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="icon"
                  className={cn("h-8 w-8 text-xs", currentPage !== pageNum && "hidden sm:flex")}
                  onClick={() => onPageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <span className="text-xs text-muted-foreground sm:hidden font-medium mx-1">
              de {totalPages}
            </span>
          </div>

          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 hidden sm:flex" onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages}>
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
