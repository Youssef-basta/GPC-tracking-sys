import "server-only";
import { jsPDF } from "jspdf";
import autoTable, { type RowInput, type Styles } from "jspdf-autotable";

export interface PdfReportOptions {
  title: string;
  subtitle?: string;
  meta?: { label: string; value: string }[];
  columns: { header: string; dataKey: string; align?: "left" | "right" | "center" }[];
  rows: Record<string, unknown>[];
  summary?: { label: string; value: string }[];
  /** Optional accent color (RGB triple). Defaults to a slate primary. */
  accent?: [number, number, number];
}

export function buildPdfReport(opts: PdfReportOptions): Uint8Array {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const accent = opts.accent ?? [56, 88, 220]; // sky-fuchsia mid

  // Title bar
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 50, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(opts.title, 24, 30);
  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.text(opts.subtitle, 24, 44);
  }

  // Meta block
  let y = 70;
  if (opts.meta && opts.meta.length > 0) {
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(9);
    const parts = opts.meta.map((m) => `${m.label}: ${m.value}`);
    doc.text(parts.join("   ·   "), 24, y);
    y += 14;
  }
  doc.setTextColor(20, 20, 20);

  // Summary block (optional)
  if (opts.summary && opts.summary.length > 0) {
    doc.setFontSize(10);
    doc.text("Summary", 24, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [opts.summary.map((s) => s.label)],
      body: [opts.summary.map((s) => s.value)],
      theme: "grid",
      headStyles: {
        fillColor: [240, 240, 244],
        textColor: [60, 60, 80],
        fontSize: 8,
      } as Partial<Styles>,
      bodyStyles: { fontSize: 9 } as Partial<Styles>,
      margin: { left: 24, right: 24 },
    });
    // @ts-expect-error autoTable adds previousAutoTable to doc
    y = (doc.lastAutoTable?.finalY ?? y) + 16;
  }

  // Main table
  autoTable(doc, {
    startY: y,
    head: [opts.columns.map((c) => c.header)],
    body: opts.rows.map(
      (r) =>
        opts.columns.map((c) => {
          const v = r[c.dataKey];
          if (v == null) return "";
          if (typeof v === "string") return v;
          if (typeof v === "number") return String(v);
          if (typeof v === "boolean") return v ? "✓" : "";
          if (v instanceof Date) return v.toISOString();
          return JSON.stringify(v);
        }) as RowInput,
    ),
    theme: "striped",
    headStyles: { fillColor: accent, textColor: [255, 255, 255], fontSize: 9 } as Partial<Styles>,
    bodyStyles: { fontSize: 9 } as Partial<Styles>,
    alternateRowStyles: { fillColor: [248, 250, 254] } as Partial<Styles>,
    columnStyles: opts.columns.reduce(
      (acc, c, i) => {
        if (c.align) acc[i] = { halign: c.align };
        return acc;
      },
      {} as Record<number, Partial<Styles>>,
    ),
    margin: { left: 24, right: 24 },
    didDrawPage: (data) => {
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.getHeight();
      const pageWidth = pageSize.getWidth();
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(
        `Generated ${new Date().toISOString()} · GPC Tracking sys`,
        24,
        pageHeight - 16,
      );
      doc.text(
        `Page ${data.pageNumber}`,
        pageWidth - 60,
        pageHeight - 16,
      );
    },
  });

  return doc.output("arraybuffer") as unknown as Uint8Array;
}

export function pdfResponse(bytes: Uint8Array, filename: string): Response {
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function timestampedPdfFilename(base: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${base}-${ts}.pdf`;
}
