import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { climaLabel, rdoStatusMeta } from "@/components/status";

type AnyRec = Record<string, any>;

// ==== Identidade FACOM ====
const NAVY: [number, number, number] = [31, 42, 68];       // #1F2A44
const ORANGE: [number, number, number] = [249, 115, 22];   // #F97316
const GRAY_HEAD: [number, number, number] = [243, 244, 246]; // #F3F4F6
const GRAY_BORDER: [number, number, number] = [209, 213, 219]; // #D1D5DB
const TEXT_DARK: [number, number, number] = [17, 24, 39];  // #111827
const MUTED: [number, number, number] = [107, 114, 128];   // #6B7280

const fmtDay = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
const fmtDayBR = (yyyyMmDd?: string | null) => (yyyyMmDd ? new Date(`${yyyyMmDd}T12:00:00-03:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
const fmtWeekday = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" });
};

// Cores dos badges de status (RGB)
const statusColor = (status?: string | null): [number, number, number] => {
  switch ((status ?? "").toLowerCase()) {
    case "aprovado": return [22, 163, 74];        // green
    case "reaberto": return [220, 38, 38];        // red
    case "em_revisao":
    case "revisao": return [234, 88, 12];         // orange-dark
    case "aguardando": return [234, 179, 8];      // amber
    case "preenchendo": return [59, 130, 246];    // blue
    case "rascunho":
    default: return [107, 114, 128];              // gray
  }
};

// Cores por status de atividade
const atividadeStatusColor = (pct: number): [number, number, number] => {
  if (pct >= 100) return [22, 163, 74];
  if (pct > 0) return ORANGE;
  return [156, 163, 175];
};
const atividadeStatusLabel = (pct: number): string => {
  if (pct >= 100) return "Concluída";
  if (pct > 0) return "Em andamento";
  return "Não iniciada";
};

async function urlToDataUrl(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 800, h: img.naturalHeight || 600 });
      img.onerror = () => resolve({ w: 800, h: 600 });
      img.src = dataUrl;
    });
    return { dataUrl, w: dims.w, h: dims.h };
  } catch { return null; }
}

export async function exportRdoPdf(args: {
  rdo: AnyRec;
  atividades: AnyRec[];
  avancos?: AnyRec[] | null;
  mao_de_obra: AnyRec[];
  equipamentos: AnyRec[];
  ocorrencias: AnyRec[];
  logs: AnyRec[];
  anexos: AnyRec[];
  empresa?: { nome?: string; cnpj?: string | null; logo_url?: string | null } | null;
  clima_dias?: AnyRec[] | null;
  clima_local?: string | null;
  mode?: "save" | "blob";
}): Promise<{ blob: Blob; url: string; filename: string } | void> {
  const { rdo, atividades, avancos, mao_de_obra, equipamentos, ocorrencias, logs, anexos, empresa, clima_dias, clima_local } = args;
  const mode = args.mode ?? "save";
  void logs;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const MARGIN = 40; // ~1.4cm (equilibrado para caber cabeçalho e rodapé fixos)
  const CONTENT_TOP = 130; // espaço para cabeçalho fixo
  const CONTENT_BOTTOM = H - 46; // espaço para rodapé fixo
  const CONTENT_W = W - MARGIN * 2;
  let y = CONTENT_TOP;

  // Pré-carrega logo (será desenhada em cada página)
  const logo = empresa?.logo_url ? await urlToDataUrl(empresa.logo_url) : null;

  const drawHeader = () => {
    // Faixa navy fina no topo
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 6, "F");

    // Área do cabeçalho
    const headerY = 16;
    const logoH = 48;
    let logoW = 0;
    if (logo) {
      const ratio = logo.w / logo.h;
      logoW = Math.min(110, logoH * ratio);
      try { doc.addImage(logo.dataUrl, "PNG", MARGIN, headerY, logoW, logoH, undefined, "FAST"); }
      catch { try { doc.addImage(logo.dataUrl, "JPEG", MARGIN, headerY, logoW, logoH, undefined, "FAST"); } catch { /* skip */ } }
    }

    const textLeft = MARGIN + (logo ? logoW + 14 : 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    const nome = String(empresa?.nome ?? "Empresa").toUpperCase();
    doc.text(nome, textLeft, headerY + 16, { maxWidth: W - textLeft - MARGIN });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    if (empresa?.cnpj) doc.text(`CNPJ: ${empresa.cnpj}`, textLeft, headerY + 30);

    // Título do documento à direita
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text("RELATÓRIO DIÁRIO DE OBRA", W - MARGIN, headerY + 16, { align: "right" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(`Nº ${rdo.numero ?? "—"} · ${fmtDay(rdo.data)}`, W - MARGIN, headerY + 30, { align: "right" });

    // Divisor navy + acento laranja
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.8);
    doc.line(MARGIN, headerY + 52, W - MARGIN, headerY + 52);
    doc.setDrawColor(...ORANGE);
    doc.setLineWidth(2.4);
    doc.line(MARGIN, headerY + 54, MARGIN + 60, headerY + 54);

  };

  const drawFooter = (pageNum: number, pageTotal: number) => {
    const yLine = H - 34;
    doc.setDrawColor(...GRAY_BORDER);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, yLine, W - MARGIN, yLine);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const left = `${String(empresa?.nome ?? "").toUpperCase()} · RDO Nº ${rdo.numero ?? "—"}${rdo.obras?.nome ? ` · ${rdo.obras.nome}` : ""}`;
    doc.text(doc.splitTextToSize(left, CONTENT_W - 120)[0] ?? "", MARGIN, yLine + 12);
    doc.text(`Página ${pageNum} de ${pageTotal}`, W - MARGIN, yLine + 12, { align: "right" });
    doc.setFontSize(7);
    doc.text("Documento gerado eletronicamente pelo App Diário de Obra.", MARGIN, yLine + 22);
  };

  // Espaço para novas páginas mantendo margens
  const ensureSpace = (needed: number) => {
    if (y + needed > CONTENT_BOTTOM) {
      doc.addPage();
      y = CONTENT_TOP;
    }
  };

  const sectionTitle = (title: string) => {
    ensureSpace(28);
    doc.setFillColor(...NAVY);
    doc.rect(MARGIN, y, CONTENT_W, 20, "F");
    doc.setFillColor(...ORANGE);
    doc.rect(MARGIN, y, 4, 20, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), MARGIN + 10, y + 13);
    y += 26;
  };

  const table = (head: string[], body: any[][], opts?: { columnStyles?: any; didParseCell?: any }) => {
    if (!body.length) return;
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: CONTENT_TOP, bottom: H - CONTENT_BOTTOM + 6 },
      head: [head],
      body,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5, textColor: TEXT_DARK, lineColor: GRAY_BORDER, lineWidth: 0.4 },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold", halign: "left" },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: opts?.columnStyles,
      didParseCell: opts?.didParseCell,
    });
    y = (doc as any).lastAutoTable.finalY + 14;
  };

  // ===== Página 1 =====
  // Dados principais
  sectionTitle("Dados do relatório");
  const contratante = rdo.obras?.cliente ?? rdo.obras?.contratante ?? rdo.obras?.contrato ?? "—";
  const responsavel = rdo.obras?.responsavel_tecnico ?? rdo.responsavel_tecnico ?? rdo.autor?.nome ?? "—";
  table(
    ["Campo", "Informação"],
    [
      ["Obra", rdo.obras?.nome ?? "—"],
      ["Endereço", rdo.obras?.endereco ?? "—"],
      ["Contratante", contratante],
      ["Responsável técnico", responsavel],
      ["Data do relatório", fmtDay(rdo.data)],
      ["Dia da semana", fmtWeekday(rdo.data)],
      ["Autor", rdo.autor?.nome ?? "—"],
      ["Aprovador", rdo.aprovador?.nome ?? "—"],
    ],
    { columnStyles: { 0: { fontStyle: "bold", cellWidth: 140, fillColor: GRAY_HEAD }, 1: { cellWidth: "auto" } } },
  );

  // Clima
  sectionTitle("Clima");
  const climaVal = (c?: string | null) => (c ? climaLabel[c] ?? c : "—");
  const isPratic = (c?: string | null) => (!c ? "—" : /chuva|tempestade|neblina/i.test(String(climaLabel[c] ?? c)) ? "Não" : "Sim");
  table(
    ["Período", "Condição climática", "Praticável"],
    [
      ["Manhã", climaVal(rdo.clima_manha), isPratic(rdo.clima_manha)],
      ["Tarde", climaVal(rdo.clima_tarde), isPratic(rdo.clima_tarde)],
      ["Noite", climaVal(rdo.clima_noite), isPratic(rdo.clima_noite)],
    ],
    { columnStyles: { 0: { fontStyle: "bold", cellWidth: 90 }, 2: { halign: "center", cellWidth: 90 } } },
  );

  // Observações
  if (rdo.observacoes) {
    sectionTitle("Observações");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_DARK);
    const lines = doc.splitTextToSize(String(rdo.observacoes), CONTENT_W);
    ensureSpace(lines.length * 12 + 6);
    doc.text(lines, MARGIN, y + 2);
    y += lines.length * 12 + 10;
  }

  // Atividades
  if (atividades.length) {
    sectionTitle("Atividades");
    table(
      ["#", "Descrição", "Status", "% Executado"],
      atividades.map((a, i) => {
        const pct = Number(a.pct_executado ?? 0);
        return [String(i + 1), a.descricao ?? "—", atividadeStatusLabel(pct), `${pct.toFixed(0)}%`];
      }),
      {
        columnStyles: { 0: { cellWidth: 28, halign: "center" }, 2: { cellWidth: 90 }, 3: { cellWidth: 70, halign: "right" } },
        didParseCell: (d: any) => {
          if (d.section === "body" && d.column.index === 2) {
            const pct = Number(atividades[d.row.index]?.pct_executado ?? 0);
            const [r, g, b] = atividadeStatusColor(pct);
            d.cell.styles.textColor = [r, g, b];
            d.cell.styles.fontStyle = "bold";
          }
        },
      },
    );
  }

  // Avanços
  if (avancos && avancos.length) {
    sectionTitle("Avanços de tarefas");
    table(
      ["Código", "Descrição", "Unid.", "Hoje", "% acum.", "Status", "Horas", "Comentário"],
      avancos.map((a) => [
        a.item_code ?? "—",
        a.descricao ?? "—",
        a.unidade ?? "—",
        a.realized_today ?? "—",
        a.accumulated_percent != null ? `${Number(a.accumulated_percent).toFixed(0)}%` : "—",
        a.status ?? "—",
        a.total_hours ?? "—",
        a.comment ?? "",
      ]),
    );
  }

  // Mão de obra
  if (mao_de_obra.length) {
    sectionTitle("Mão de obra");
    table(
      ["Pessoa", "Função", "Horas"],
      mao_de_obra.map((m) => [m.mao_de_obra?.nome ?? "—", m.mao_de_obra?.funcao ?? "—", String(m.horas ?? 0)]),
      { columnStyles: { 2: { halign: "right", cellWidth: 60 } } },
    );
  }

  // Equipamentos
  if (equipamentos.length) {
    sectionTitle("Equipamentos");
    table(
      ["Equipamento", "Tipo", "Status", "Horas"],
      equipamentos.map((e) => [e.equipamentos?.nome ?? "—", e.equipamentos?.tipo ?? "—", e.status_uso ?? "—", String(e.horas_uso ?? 0)]),
      { columnStyles: { 3: { halign: "right", cellWidth: 60 } } },
    );
  }

  // Ocorrências
  sectionTitle("Ocorrências");
  if (ocorrencias.length) {
    table(
      ["Tipo", "Severidade", "Descrição"],
      ocorrencias.map((o) => [o.tipos_ocorrencia?.nome ?? "Geral", o.tipos_ocorrencia?.severidade ?? "—", o.descricao ?? "—"]),
    );
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    ensureSpace(20);
    doc.text("Não houve ocorrências registradas neste relatório.", MARGIN, y + 2);
    y += 18;
  }

  // Clima detalhado
  if (clima_dias && clima_dias.length) {
    sectionTitle(`Evidências meteorológicas${clima_local ? ` — ${clima_local}` : ""}`);
    const ordered = [...clima_dias].sort((a, b) => String(a.data).localeCompare(String(b.data)));
    table(
      ["Data", "Dia", "Origem", "Mín/Máx (°C)", "Chuva", "Condição"],
      ordered.map((d) => [
        fmtDayBR(d.data),
        d.dia_semana ?? "—",
        d.origem ?? "—",
        `${Math.round(Number(d.t_min_c ?? 0))} / ${Math.round(Number(d.t_max_c ?? 0))}`,
        `${d.prob_chuva_pct ?? 0}% · ${d.precipitacao_mm ?? 0} mm`,
        d.descricao ?? "—",
      ]),
    );
  }

  // ===== Registros fotográficos =====
  const fotos = (anexos ?? []).filter((a: AnyRec) =>
    (a.mime_type ?? "").toString().startsWith("image/") && a.url,
  );
  if (fotos.length) {
    doc.addPage();
    y = CONTENT_TOP;
    sectionTitle("Registros fotográficos");

    const groups = new Map<string, { label: string; items: AnyRec[] }>();
    const itemLabel = (id?: string | null) => {
      if (!id) return "Sem atividade vinculada";
      const av = (avancos ?? []).find((a: AnyRec) => a.task_item_id === id || a.id === id);
      return av ? `${av.item_code ? av.item_code + " · " : ""}${av.descricao ?? "Atividade"}` : "Atividade";
    };
    for (const f of fotos) {
      const key = f.task_item_id ?? "__none";
      if (!groups.has(key)) groups.set(key, { label: itemLabel(f.task_item_id), items: [] });
      groups.get(key)!.items.push(f);
    }

    const cols = 2;
    const gap = 14;
    const cellW = (CONTENT_W - gap) / cols;
    const cellH = 170;
    const captionH = 32;

    for (const [, g] of groups) {
      ensureSpace(24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...NAVY);
      doc.text(g.label, MARGIN, y);
      y += 12;

      let col = 0;
      const loaded = await Promise.all(g.items.map((f) => urlToDataUrl(f.url as string).then((img) => ({ f, img }))));
      for (const { f, img } of loaded) {
        ensureSpace(cellH + captionH + 8);
        const x = MARGIN + col * (cellW + gap);
        // borda da célula
        doc.setDrawColor(...GRAY_BORDER);
        doc.setLineWidth(0.5);
        doc.rect(x, y, cellW, cellH);
        if (img) {
          const ratio = img.w / img.h;
          let w = cellW - 6, h = (cellW - 6) / ratio;
          if (h > cellH - 6) { h = cellH - 6; w = (cellH - 6) * ratio; }
          const ix = x + (cellW - w) / 2;
          const iy = y + (cellH - h) / 2;
          try { doc.addImage(img.dataUrl, "JPEG", ix, iy, w, h, undefined, "FAST"); }
          catch { try { doc.addImage(img.dataUrl, "PNG", ix, iy, w, h, undefined, "FAST"); } catch { /* skip */ } }
        } else {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(9);
          doc.setTextColor(...MUTED);
          doc.text("Imagem não disponível", x + cellW / 2, y + cellH / 2, { align: "center" });
        }
        // legenda
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_DARK);
        const legenda = String(f.legenda ?? "");
        const dataHora = f.created_at ? new Date(f.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
        const capLines = doc.splitTextToSize(legenda || "—", cellW);
        doc.text(capLines.slice(0, 2), x, y + cellH + 12);
        if (dataHora) {
          doc.setTextColor(...MUTED);
          doc.setFontSize(7);
          doc.text(dataHora, x, y + cellH + captionH - 2);
        }
        col++;
        if (col >= cols) {
          col = 0;
          y += cellH + captionH + 8;
        }
      }
      if (col > 0) {
        col = 0;
        y += cellH + captionH + 8;
      }
    }
  }

  // ===== Assinaturas =====
  const assinaturas = (rdo.rdo_assinaturas ?? []) as AnyRec[];
  ensureSpace(120);
  sectionTitle("Assinaturas");
  if (assinaturas.length) {
    const cols = Math.min(2, assinaturas.length);
    const gap = 20;
    const cellW = (CONTENT_W - gap * (cols - 1)) / cols;
    const cellH = 90;
    let col = 0;
    for (const a of assinaturas) {
      ensureSpace(cellH + 12);
      const x = MARGIN + col * (cellW + gap);
      const nome = a.signatario?.nome ?? a.nome ?? "—";
      const funcao = a.signatario?.funcao ?? a.funcao ?? a.papel ?? "—";
      const quando = a.created_at ? new Date(a.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
      // área de assinatura
      const img = a.assinatura_url ? await urlToDataUrl(a.assinatura_url) : null;
      if (img) {
        const ratio = img.w / img.h;
        let h = 50, w = 50 * ratio;
        if (w > cellW - 20) { w = cellW - 20; h = w / ratio; }
        try { doc.addImage(img.dataUrl, "PNG", x + (cellW - w) / 2, y + (50 - h) / 2 + 5, w, h, undefined, "FAST"); } catch { /* skip */ }
      }
      // linha de assinatura
      doc.setDrawColor(...NAVY);
      doc.setLineWidth(0.6);
      doc.line(x + 10, y + 60, x + cellW - 10, y + 60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...TEXT_DARK);
      doc.text(nome, x + cellW / 2, y + 72, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(funcao, x + cellW / 2, y + 82, { align: "center" });
      doc.text(quando, x + cellW / 2, y + 92, { align: "center" });
      col++;
      if (col >= cols) {
        col = 0;
        y += cellH + 16;
      }
    }
    if (col > 0) y += cellH + 16;
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text("Assinatura pendente.", MARGIN, y + 8);
    y += 24;
  }

  // ===== Cabeçalho + rodapé em todas as páginas =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawHeader();
    drawFooter(i, pageCount);
  }

  const safeName = String(rdo.obras?.nome ?? "obra").replace(/[^a-z0-9-_]+/gi, "-");
  const dataFile = rdo.data ? fmtDay(rdo.data).replace(/\//g, "-") : "";
  const filename = `RDO-${rdo.numero}-${safeName}${dataFile ? `-${dataFile}` : ""}.pdf`;
  if (mode === "blob") {
    const raw = doc.output("blob") as Blob;
    const blob = raw.type === "application/pdf" ? raw : new Blob([raw], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    return { blob, url, filename };
  }
  doc.save(filename);
}
