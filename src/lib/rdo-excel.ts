import ExcelJS from "exceljs";
import { climaLabel, rdoStatusMeta } from "@/components/status";
import { sanitizeExportRow } from "@/lib/security/sanitize-export";
import { paletteFromLogo, type LogoImage, type LogoPalette, DEFAULT_PALETTE } from "@/lib/logo-palette";

type AnyRec = Record<string, any>;

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
const fmtDay = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
const fmtDayBR = (yyyyMmDd?: string | null) =>
  yyyyMmDd
    ? new Date(`${yyyyMmDd}T12:00:00-03:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "";

// ---------- Paleta corporativa (derivada da logo da empresa) ----------
function buildColors(p: LogoPalette) {
  return {
    brand: `FF${p.brand}`,
    brandDark: `FF${p.brandDark}`,
    brandSoft: `FF${p.brandSoft}`,
    headerFill: `FF${p.brandDark}`,
    headerText: `FF${p.onBrand}`,
    border: "FFB5C2D1",
    label: "FF5A6B80",
    title: "FF0F1F33",
    zebra: "FFF6F8FB",
  };
}
type ColorSet = ReturnType<typeof buildColors>;
let COLOR: ColorSet = buildColors(DEFAULT_PALETTE);

type ColDef = {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
  align?: "left" | "center" | "right";
};

/**
 * Insere a faixa de identificação da empresa (logo + nome) nas duas
 * primeiras linhas da planilha e define-as como títulos de impressão para
 * que apareçam em todas as páginas. Retorna a próxima linha disponível.
 */
function brandBand(
  ws: ExcelJS.Worksheet,
  cols: number,
  empresaLabel: string,
  logoImageId: number | null,
  sheetTitle: string,
  subtitle: string,
) {
  const width = Math.max(cols, 6);
  // Linha 1: faixa colorida com logo à esquerda e nome da empresa
  ws.mergeCells(1, 1, 1, width);
  const c1 = ws.getCell(1, 1);
  c1.value = empresaLabel || "Empresa";
  c1.font = { name: "Calibri", size: 14, bold: true, color: { argb: COLOR.headerText } };
  c1.alignment = { vertical: "middle", horizontal: "left", indent: logoImageId != null ? 8 : 1 };
  c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.brand } };
  ws.getRow(1).height = 42;

  if (logoImageId != null) {
    // Coloca a logo dentro da faixa, ancorada em A1
    ws.addImage(logoImageId, {
      tl: { col: 0.1, row: 0.15 } as any,
      ext: { width: 110, height: 44 },
      editAs: "oneCell",
    });
  }

  // Linha 2: título do relatório + subtítulo (obra/data)
  ws.mergeCells(2, 1, 2, width);
  const c2 = ws.getCell(2, 1);
  c2.value = { richText: [
    { text: `${sheetTitle}   `, font: { name: "Calibri", size: 12, bold: true, color: { argb: COLOR.title } } },
    { text: subtitle, font: { name: "Calibri", size: 10, color: { argb: COLOR.label } } },
  ] } as any;
  c2.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.brandSoft } };
  ws.getRow(2).height = 22;

  // Linha 3: separadora fina
  ws.getRow(3).height = 6;

  // Repetir linhas 1-2 em todas as páginas impressas
  (ws.pageSetup as any).printTitlesRow = "1:2";
}

function writeTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  columns: ColDef[],
  rows: AnyRec[],
  sectionTitle?: string,
): number {
  let r = startRow;

  if (sectionTitle) {
    ws.mergeCells(r, 1, r, columns.length);
    const c = ws.getCell(r, 1);
    c.value = sectionTitle;
    c.font = { name: "Calibri", size: 12, bold: true, color: { argb: COLOR.title } };
    c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.brandSoft } };
    ws.getRow(r).height = 22;
    r += 1;
  }

  // cabeçalho
  columns.forEach((col, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = col.header;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLOR.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.headerFill } };
    cell.alignment = {
      vertical: "middle",
      horizontal: col.align ?? "left",
      wrapText: true,
      indent: 1,
    };
    cell.border = {
      top: { style: "thin", color: { argb: COLOR.border } },
      bottom: { style: "thin", color: { argb: COLOR.border } },
      left: { style: "thin", color: { argb: COLOR.border } },
      right: { style: "thin", color: { argb: COLOR.border } },
    };
    const wsCol = ws.getColumn(i + 1);
    if (col.width && (!wsCol.width || wsCol.width < col.width)) wsCol.width = col.width;
  });
  ws.getRow(r).height = 24;
  const headerRow = r;
  r += 1;

  const dataStart = r;
  const safeRows = rows.length ? rows : [{ __empty: "— sem registros —" }];

  safeRows.forEach((raw, idx) => {
    const isEmpty = rows.length === 0;
    const row = isEmpty ? {} : sanitizeExportRow(raw);
    columns.forEach((col, i) => {
      const cell = ws.getCell(r, i + 1);
      if (isEmpty && i === 0) {
        ws.mergeCells(r, 1, r, columns.length);
        cell.value = "— sem registros —";
        cell.font = { name: "Calibri", size: 10, italic: true, color: { argb: COLOR.label } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (!isEmpty) {
        const v = (row as AnyRec)[col.key];
        cell.value = v === undefined || v === null ? "" : v;
        cell.font = { name: "Calibri", size: 10, color: { argb: COLOR.title } };
        cell.alignment = {
          vertical: "middle",
          horizontal: col.align ?? "left",
          wrapText: true,
          indent: 1,
        };
        if (col.numFmt) cell.numFmt = col.numFmt;
      }
      cell.border = {
        top: { style: "hair", color: { argb: COLOR.border } },
        bottom: { style: "hair", color: { argb: COLOR.border } },
        left: { style: "hair", color: { argb: COLOR.border } },
        right: { style: "hair", color: { argb: COLOR.border } },
      };
      if (!isEmpty && idx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.zebra } };
      }
    });
    ws.getRow(r).height = 20;
    r += 1;
  });

  if (rows.length) {
    ws.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: r - 1, column: columns.length },
    };
  }
  ws.views = [{ state: "frozen", ySplit: headerRow }];

  columns.forEach((col, i) => {
    const wsCol = ws.getColumn(i + 1);
    let max = col.header.length + 2;
    for (let rr = dataStart; rr < r; rr++) {
      const v = ws.getCell(rr, i + 1).value;
      const len = v == null ? 0 : String(v).length;
      if (len > max) max = Math.min(60, len + 2);
    }
    if (!wsCol.width || wsCol.width < max) wsCol.width = max;
  });

  return r + 1;
}

function addSection(
  wb: ExcelJS.Workbook,
  name: string,
  title: string,
  subtitle: string,
  columns: ColDef[],
  rows: AnyRec[],
  brand: { empresaLabel: string; logoImageId: number | null },
) {
  const safe = name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31);
  const ws = wb.addWorksheet(safe, {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    headerFooter: {
      oddFooter: `&L${brand.empresaLabel}  &C&A  &RPág. &P de &N`,
    },
  });
  brandBand(ws, Math.max(columns.length, 4), brand.empresaLabel, brand.logoImageId, title, subtitle);
  writeTable(ws, 4, columns, rows);
}

/**
 * Exporta o RDO em Excel com layout profissional (cores corporativas,
 * cabeçalhos, filtros, zebra, freeze panes e formatação numérica).
 */
export async function exportRdoExcel(args: {
  rdo: AnyRec;
  atividades: AnyRec[];
  avancos?: AnyRec[] | null;
  mao_de_obra: AnyRec[];
  equipamentos: AnyRec[];
  ocorrencias: AnyRec[];
  anexos: AnyRec[];
  logs: AnyRec[];
  clima_dias?: AnyRec[] | null;
  clima_local?: string | null;
  empresa?: { nome?: string; cnpj?: string | null; logo_url?: string | null } | null;
  mode?: "save" | "blob";
}): Promise<{ blob: Blob; url: string; filename: string } | void> {
  const mode = args.mode ?? "save";
  const {
    rdo, atividades, avancos, mao_de_obra, equipamentos,
    ocorrencias, anexos, clima_dias, clima_local, empresa,
  } = args;

  // Paleta derivada da logo + carregamento da imagem
  const { logo, palette } = await paletteFromLogo(empresa?.logo_url ?? null);
  COLOR = buildColors(palette);

  const wb = new ExcelJS.Workbook();
  wb.creator = empresa?.nome ?? "Sistema RDO";
  wb.company = empresa?.nome ?? "";
  wb.created = new Date();
  wb.title = `RDO ${rdo.numero} — ${rdo.obras?.nome ?? ""}`;
  wb.subject = "Relatório Diário de Obra";

  // Registra logo uma única vez no workbook (referenciada em cada aba)
  let logoImageId: number | null = null;
  if (logo) {
    try {
      logoImageId = wb.addImage({ buffer: logo.bytes.buffer as ArrayBuffer, extension: logo.ext === "jpg" ? "jpeg" : "png" });
    } catch { logoImageId = null; }
  }

  const empresaLinha = [empresa?.nome, empresa?.cnpj ? `CNPJ ${empresa.cnpj}` : null]
    .filter(Boolean).join(" · ");
  const subtitleBase = `Obra: ${rdo.obras?.nome ?? "—"} · Data: ${fmtDay(rdo.data)}`;
  const brand = { empresaLabel: empresaLinha || "Empresa", logoImageId };

  // ---------- Capa / Resumo ----------
  const capa = wb.addWorksheet("Capa", {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    headerFooter: {
      oddFooter: `&L${brand.empresaLabel}  &C&A  &RPág. &P de &N`,
    },
  });

  brandBand(capa, 4, brand.empresaLabel, brand.logoImageId,
    `Relatório Diário de Obra Nº ${rdo.numero}`, subtitleBase);

  const info: Array<[string, string]> = [
    ["Obra", rdo.obras?.nome ?? "—"],
    ["Endereço", rdo.obras?.endereco ?? "—"],
    ["Data do relatório", fmtDay(rdo.data)],
    ["Status", rdoStatusMeta[rdo.status as keyof typeof rdoStatusMeta]?.label ?? rdo.status ?? "—"],
    ["Autor", rdo.autor?.nome ?? "—"],
    ["Aprovador", rdo.aprovador?.nome ?? "—"],
    ["Criado em", fmtDate(rdo.created_at)],
  ];

  let row = 4;
  for (const [label, value] of info) {
    capa.mergeCells(row, 1, row, 1);
    capa.mergeCells(row, 2, row, 4);
    const l = capa.getCell(row, 1);
    const v = capa.getCell(row, 2);
    l.value = label;
    v.value = value;
    l.font = { name: "Calibri", size: 10, bold: true, color: { argb: COLOR.label } };
    v.font = { name: "Calibri", size: 11, color: { argb: COLOR.title } };
    l.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    v.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
    l.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.brandSoft } };
    for (const c of [l, v]) {
      c.border = {
        top: { style: "hair", color: { argb: COLOR.border } },
        bottom: { style: "hair", color: { argb: COLOR.border } },
        left: { style: "hair", color: { argb: COLOR.border } },
        right: { style: "hair", color: { argb: COLOR.border } },
      };
    }
    capa.getRow(row).height = 22;
    row += 1;
  }

  // Bloco de clima do dia
  row += 1;
  capa.mergeCells(row, 1, row, 4);
  const climaTitle = capa.getCell(row, 1);
  climaTitle.value = "Condições climáticas do dia";
  climaTitle.font = { name: "Calibri", size: 12, bold: true, color: { argb: COLOR.title } };
  climaTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.brandSoft } };
  climaTitle.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  capa.getRow(row).height = 22;
  row += 1;

  const climaHead = ["Manhã", "Tarde", "Noite", "Observações"];
  climaHead.forEach((h, i) => {
    const c = capa.getCell(row, i + 1);
    c.value = h;
    c.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLOR.headerText } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.headerFill } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.border = {
      top: { style: "thin", color: { argb: COLOR.border } },
      bottom: { style: "thin", color: { argb: COLOR.border } },
      left: { style: "thin", color: { argb: COLOR.border } },
      right: { style: "thin", color: { argb: COLOR.border } },
    };
  });
  capa.getRow(row).height = 22;
  row += 1;

  const climaVals = [
    rdo.clima_manha ? climaLabel[rdo.clima_manha] ?? rdo.clima_manha : "—",
    rdo.clima_tarde ? climaLabel[rdo.clima_tarde] ?? rdo.clima_tarde : "—",
    rdo.clima_noite ? climaLabel[rdo.clima_noite] ?? rdo.clima_noite : "—",
    rdo.observacoes ?? "",
  ];
  climaVals.forEach((v, i) => {
    const c = capa.getCell(row, i + 1);
    c.value = v;
    c.font = { name: "Calibri", size: 10, color: { argb: COLOR.title } };
    c.alignment = { vertical: "middle", horizontal: i === 3 ? "left" : "center", wrapText: true, indent: i === 3 ? 1 : 0 };
    c.border = {
      top: { style: "hair", color: { argb: COLOR.border } },
      bottom: { style: "hair", color: { argb: COLOR.border } },
      left: { style: "hair", color: { argb: COLOR.border } },
      right: { style: "hair", color: { argb: COLOR.border } },
    };
  });
  capa.getRow(row).height = Math.max(24, Math.min(80, 18 + Math.ceil(((rdo.observacoes ?? "").length) / 60) * 14));

  capa.getColumn(1).width = 22;
  capa.getColumn(2).width = 24;
  capa.getColumn(3).width = 24;
  capa.getColumn(4).width = 40;

  // ---------- Abas de dados (Anexos e Histórico removidos) ----------
  addSection(wb, "Atividades", "Atividades executadas", subtitleBase,
    [
      { header: "Descrição", key: "descricao", width: 50 },
      { header: "% Executado", key: "pct", width: 14, numFmt: "0%", align: "right" },
    ],
    atividades.map((a) => ({
      descricao: a.descricao ?? "",
      pct: Number(a.pct_executado ?? 0) / 100,
    })),
    brand,
  );

  addSection(wb, "Avancos", "Avanços de tarefas", subtitleBase,
    [
      { header: "Código", key: "item_code", width: 14 },
      { header: "Descrição", key: "descricao", width: 45 },
      { header: "Unidade", key: "unidade", width: 12, align: "center" },
      { header: "Planejado", key: "planned_quantity", width: 14, align: "right", numFmt: "#,##0.00" },
      { header: "Realizado hoje", key: "realized_today", width: 16, align: "right", numFmt: "#,##0.00" },
      { header: "% Acumulado", key: "accumulated_percent", width: 14, align: "right", numFmt: "0.0%" },
      { header: "Status", key: "status", width: 14, align: "center" },
      { header: "Horas", key: "total_hours", width: 10, align: "right", numFmt: "#,##0.00" },
      { header: "Comentário", key: "comment", width: 40 },
    ],
    (avancos ?? []).map((a) => ({
      item_code: a.item_code ?? "",
      descricao: a.descricao ?? "",
      unidade: a.unidade ?? "",
      planned_quantity: a.planned_quantity != null ? Number(a.planned_quantity) : "",
      realized_today: a.realized_today != null ? Number(a.realized_today) : "",
      accumulated_percent: a.accumulated_percent != null ? Number(a.accumulated_percent) / 100 : "",
      status: a.status ?? "",
      total_hours: a.total_hours != null ? Number(a.total_hours) : "",
      comment: a.comment ?? "",
    })),
    brand,
  );

  addSection(wb, "Mao de obra", "Mão de obra", subtitleBase,
    [
      { header: "Pessoa", key: "pessoa", width: 32 },
      { header: "Função", key: "funcao", width: 24 },
      { header: "Horas", key: "horas", width: 12, align: "right", numFmt: "#,##0.00" },
    ],
    mao_de_obra.map((m) => ({
      pessoa: m.mao_de_obra?.nome ?? "",
      funcao: m.mao_de_obra?.funcao ?? "",
      horas: Number(m.horas ?? 0),
    })),
    brand,
  );

  addSection(wb, "Equipamentos", "Equipamentos", subtitleBase,
    [
      { header: "Equipamento", key: "equipamento", width: 32 },
      { header: "Tipo", key: "tipo", width: 20 },
      { header: "Status de uso", key: "status_uso", width: 18, align: "center" },
      { header: "Horas de uso", key: "horas_uso", width: 14, align: "right", numFmt: "#,##0.00" },
    ],
    equipamentos.map((e) => ({
      equipamento: e.equipamentos?.nome ?? "",
      tipo: e.equipamentos?.tipo ?? "",
      status_uso: e.status_uso ?? "",
      horas_uso: Number(e.horas_uso ?? 0),
    })),
    brand,
  );

  addSection(wb, "Ocorrencias", "Ocorrências", subtitleBase,
    [
      { header: "Tipo", key: "tipo", width: 24 },
      { header: "Severidade", key: "severidade", width: 16, align: "center" },
      { header: "Descrição", key: "descricao", width: 60 },
    ],
    ocorrencias.map((o) => ({
      tipo: o.tipos_ocorrencia?.nome ?? "Geral",
      severidade: o.tipos_ocorrencia?.severidade ?? "",
      descricao: o.descricao ?? "",
    })),
    brand,
  );

  void clima_dias; void clima_local;

  // ---------- Anexos (imagens embutidas) ----------
  const fotos = (anexos ?? []).filter(
    (a: AnyRec) => (a.mime_type ?? "").toString().startsWith("image/") && a.url,
  );
  if (fotos.length) {
    const wsA = wb.addWorksheet("Anexos", {
      views: [{ showGridLines: false }],
      pageSetup: {
        paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      },
      headerFooter: { oddFooter: `&L${brand.empresaLabel}  &C&A  &RPág. &P de &N` },
    });
    brandBand(wsA, 4, brand.empresaLabel, brand.logoImageId, "Anexos", subtitleBase);
    wsA.getColumn(1).width = 4;
    wsA.getColumn(2).width = 60;
    wsA.getColumn(3).width = 40;

    const itemLabel = (id?: string | null) => {
      if (!id) return "Sem atividade";
      const av = (avancos ?? []).find((a: AnyRec) => a.task_item_id === id || a.id === id);
      return av ? `${av.item_code ? av.item_code + " · " : ""}${av.descricao ?? "Atividade"}` : "Atividade";
    };

    let r = 4;
    for (const f of fotos) {
      try {
        const resp = await fetch(f.url as string);
        if (!resp.ok) continue;
        const buf = await resp.arrayBuffer();
        const mime = (f.mime_type ?? "").toString();
        const ext = mime.includes("png") ? "png" : mime.includes("gif") ? "gif" : "jpeg";
        const imgId = wb.addImage({ buffer: buf, extension: ext as "png" | "jpeg" | "gif" });
        const rowHeight = 180;
        wsA.getRow(r).height = rowHeight;
        wsA.addImage(imgId, {
          tl: { col: 1, row: r - 1 } as any,
          ext: { width: 380, height: rowHeight * 1.25 },
          editAs: "oneCell",
        });
        const legenda = (f.legenda ?? "").toString().trim() || "(sem descrição)";
        const c = wsA.getCell(r, 3);
        c.value = { richText: [
          { text: itemLabel(f.task_item_id) + "\n", font: { name: "Calibri", size: 10, bold: true, color: { argb: COLOR.title } } },
          { text: legenda, font: { name: "Calibri", size: 10, color: { argb: COLOR.label } } },
        ] } as any;
        c.alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: 1 };
        r += 1;
      } catch { /* pula anexo com erro de carregamento */ }
    }
  }


  // ---------- Download ----------
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const filename = `RDO-${rdo.numero}-${(rdo.obras?.nome ?? "obra").toString().replace(/[^a-z0-9-_]+/gi, "_")}.xlsx`;
  const url = URL.createObjectURL(blob);
  if (mode === "blob") return { blob, url, filename };
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
