import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import { formatBRL, formatDate } from "./format";

export interface ExportRow {
  [key: string]: string | number | null | undefined;
}

interface PDFOpts {
  title: string;
  subtitle?: string;
  columns: { header: string; dataKey: string }[];
  rows: ExportRow[];
  filename?: string;
  totals?: { label: string; value: string }[];
}

export function exportToPDF({ title, subtitle, columns, rows, filename, totals }: PDFOpts) {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(36, 35, 99);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("VENDX CRM", 14, 13);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, pageWidth - 14, 13, { align: "right" });
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 22);

  if (subtitle) {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, 14, 36);
  }

  autoTable(doc, {
    startY: subtitle ? 42 : 36,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => String(r[c.dataKey] ?? "—"))),
    theme: "grid",
    headStyles: { fillColor: [36, 35, 99], textColor: 255, fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    margin: { left: 14, right: 14 },
  });

  if (totals?.length) {
    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(36, 35, 99);
    totals.forEach((t, i) => {
      doc.text(`${t.label}: ${t.value}`, 14, finalY + i * 6);
    });
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });
    doc.text("VENDX CRM · Relatório confidencial", 14, doc.internal.pageSize.getHeight() - 8);
  }

  doc.save(filename ?? `${title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.pdf`);
}

interface ExcelOpts {
  sheetName: string;
  columns: { header: string; dataKey: string; width?: number }[];
  rows: ExportRow[];
  filename: string;
  title?: string;
}

export function exportToExcel({ sheetName, columns, rows, filename, title }: ExcelOpts) {
  const wb = XLSX.utils.book_new();
  const headerRow = columns.map((c) => ({
    v: c.header,
    s: {
      font: { bold: true, color: { rgb: "FFFFFFFF" }, sz: 11 },
      fill: { fgColor: { rgb: "FF242363" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "FF000000" } },
        bottom: { style: "thin", color: { rgb: "FF000000" } },
        left: { style: "thin", color: { rgb: "FF000000" } },
        right: { style: "thin", color: { rgb: "FF000000" } },
      },
    },
  }));
  const dataRows = rows.map((r, idx) =>
    columns.map((c) => ({
      v: r[c.dataKey] ?? "",
      s: {
        font: { sz: 10 },
        fill: { fgColor: { rgb: idx % 2 === 0 ? "FFFFFFFF" : "FFF8F9FC" } },
        border: {
          top: { style: "thin", color: { rgb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { rgb: "FFE5E7EB" } },
          left: { style: "thin", color: { rgb: "FFE5E7EB" } },
          right: { style: "thin", color: { rgb: "FFE5E7EB" } },
        },
      },
    })),
  );
  const aoa: any[][] = [];
  if (title) aoa.push([{ v: title, s: { font: { bold: true, sz: 14, color: { rgb: "FF242363" } } } }]);
  aoa.push(headerRow);
  dataRows.forEach((r) => aoa.push(r));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = columns.map((c) => ({ wch: c.width ?? Math.max(c.header.length + 2, 14) }));
  if (title) ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }];
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export { formatBRL, formatDate };
