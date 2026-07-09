import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { climaLabel, rdoStatusMeta } from "@/components/status";

type AnyRec = Record<string, any>;

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
const fmtDay = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
const fmtDayBR = (yyyyMmDd?: string | null) => (yyyyMmDd ? new Date(`${yyyyMmDd}T12:00:00-03:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

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
  const MARGIN = 56; // ~2 cm (ABNT)
  const CONTENT_W = W - MARGIN * 2;
  let y = MARGIN;

  // ---------- Cabeçalho ABNT ----------
  const logo = empresa?.logo_url ? await urlToDataUrl(empresa.logo_url) : null;
  const logoH = 64;
  let logoW = 0;
  if (logo) {
    const ratio = logo.w / logo.h;
    logoW = Math.min(120, logoH * ratio);
    try { doc.addImage(logo.dataUrl, "PNG", MARGIN, y, logoW, logoH, undefined, "FAST"); }
    catch { try { doc.addImage(logo.dataUrl, "JPEG", MARGIN, y, logoW, logoH, undefined, "FAST"); } catch { /* skip */ } }
  }

  const textLeft = MARGIN + (logo ? logoW + 16 : 0);
  const textRight = W - MARGIN;
  const textW = textRight - textLeft;

  // Nome da empresa
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 31, 51);
  const nomeLines = doc.splitTextToSize(String(empresa?.nome ?? "Empresa").toUpperCase(), textW);
  doc.text(nomeLines, textLeft, y + 14);

  // CNPJ
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 107, 128);
  if (empresa?.cnpj) doc.text(`CNPJ: ${empresa.cnpj}`, textLeft, y + 14 + nomeLines.length * 14);

  y += logoH + 10;
  doc.setDrawColor(31, 58, 95);
  doc.setLineWidth(1);
  doc.line(MARGIN, y, W - MARGIN, y);
  y += 14;

  // Título centralizado (ABNT)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 31, 51);
  doc.text(`RELATÓRIO DIÁRIO DE OBRA — Nº ${rdo.numero}`, W / 2, y, { align: "center" });
  y += 20;

  // Bloco de metadados — cada campo em sua própria linha, justificado
  const metaFont = () => { doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(30, 30, 30); };
  const metaBold = (label: string, value: string) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
    doc.text(label, MARGIN, y);
    const lw = doc.getTextWidth(label);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value, CONTENT_W - lw - 4);
    doc.text(lines, MARGIN + lw + 4, y);
    y += Math.max(14, lines.length * 13);
  };
  metaFont();
  metaBold("Obra: ", rdo.obras?.nome ?? "—");
  metaBold("Endereço: ", rdo.obras?.endereco ?? "—");
  metaBold("Data do relatório: ", fmtDay(rdo.data));
  metaBold("Status: ", String(rdoStatusMeta[rdo.status as keyof typeof rdoStatusMeta]?.label ?? rdo.status ?? "—"));
  metaBold("Autor: ", rdo.autor?.nome ?? "—");
  if (rdo.aprovador?.nome) metaBold("Aprovador: ", rdo.aprovador.nome);

  y += 4;
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, W - MARGIN, y);
  y += 14;
  doc.setTextColor(0);

  // Clima
  autoTable(doc, {
    startY: y,
    head: [["Manhã", "Tarde", "Noite"]],
    body: [[
      rdo.clima_manha ? climaLabel[rdo.clima_manha] ?? rdo.clima_manha : "—",
      rdo.clima_tarde ? climaLabel[rdo.clima_tarde] ?? rdo.clima_tarde : "—",
      rdo.clima_noite ? climaLabel[rdo.clima_noite] ?? rdo.clima_noite : "—",
    ]],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 40, 40] },
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  if (rdo.observacoes) {
    doc.setFont("helvetica", "bold"); doc.text("Observações", 40, y); y += 12;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(rdo.observacoes, W - 80);
    doc.text(lines, 40, y); y += lines.length * 12 + 8;
  }

  const section = (title: string, head: string[], body: any[][]) => {
    if (!body.length) return;
    doc.setFont("helvetica", "bold");
    doc.text(title, 40, y); y += 6;
    autoTable(doc, {
      startY: y + 4, head: [head], body,
      theme: "striped", styles: { fontSize: 9 }, headStyles: { fillColor: [40, 40, 40] },
    });
    y = (doc as any).lastAutoTable.finalY + 14;
  };

  section("Atividades", ["Descrição", "% Executado"],
    atividades.map((a) => [a.descricao, `${Number(a.pct_executado ?? 0).toFixed(0)}%`]));

  if (avancos && avancos.length) {
    section(
      "Avanços de tarefas",
      ["Código", "Descrição", "Unid.", "Realizado hoje", "% acum.", "Status", "Horas", "Comentário"],
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

  section("Mão de obra", ["Pessoa", "Função", "UN"],
    mao_de_obra.map((m) => [m.mao_de_obra?.nome ?? "—", m.mao_de_obra?.funcao ?? "—", String(m.horas ?? 0)]));


  section("Equipamentos", ["Equipamento", "Tipo", "Status", "Horas"],
    equipamentos.map((e) => [e.equipamentos?.nome ?? "—", e.equipamentos?.tipo ?? "—", e.status_uso ?? "—", String(e.horas_uso ?? 0)]));

  section("Ocorrências", ["Tipo", "Severidade", "Descrição"],
    ocorrencias.map((o) => [o.tipos_ocorrencia?.nome ?? "Geral", o.tipos_ocorrencia?.severidade ?? "—", o.descricao]));

  // Seção "Anexos" removida a pedido: nomes de arquivo não devem aparecer no PDF.

  if (clima_dias && clima_dias.length) {
    const ordered = [...clima_dias].sort((a, b) => String(a.data).localeCompare(String(b.data)));
    section(
      `Evidências meteorológicas${clima_local ? ` — ${clima_local}` : ""}`,
      ["Data (BR)", "Dia", "Origem", "Mín/Máx (°C)", "Chuva", "Condição"],
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

  // Seção "Histórico de status" removida a pedido.

  // ===== Fotos por atividade =====
  const fotos = (anexos ?? []).filter((a: AnyRec) =>
    (a.mime_type ?? "").toString().startsWith("image/") && a.url,
  );
  if (fotos.length) {
    // agrupa por task_item_id (ou "Sem atividade")
    const groups = new Map<string, { label: string; items: AnyRec[] }>();
    const itemLabel = (id?: string | null) => {
      if (!id) return "Sem atividade";
      const av = (avancos ?? []).find((a: AnyRec) => a.task_item_id === id || a.id === id);
      return av ? `${av.item_code ? av.item_code + " · " : ""}${av.descricao ?? "Atividade"}` : "Atividade";
    };
    for (const f of fotos) {
      const key = f.task_item_id ?? "__none";
      if (!groups.has(key)) groups.set(key, { label: itemLabel(f.task_item_id), items: [] });
      groups.get(key)!.items.push(f);
    }

    doc.addPage();
    y = 40;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Fotos por atividade", 40, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const H = doc.internal.pageSize.getHeight();
    const cols = 2;
    const gap = 12;
    const cellW = (W - 80 - gap * (cols - 1)) / cols;
    const cellH = 150;

    for (const [, g] of groups) {
      if (y + 30 > H - 40) { doc.addPage(); y = 40; }
      doc.setFont("helvetica", "bold");
      doc.text(g.label, 40, y);
      doc.setFont("helvetica", "normal");
      y += 10;

      let col = 0;
      let rowY = y + 4;
      // Pré-carrega todas as imagens do grupo em paralelo (acelera muito o export)
      const loaded = await Promise.all(g.items.map((f) => urlToDataUrl(f.url as string).then((img) => ({ f, img }))));
      for (const { f, img } of loaded) {
        if (rowY + cellH > H - 40) { doc.addPage(); rowY = 40; y = 40; col = 0; }
        if (!img) continue;
        const ratio = img.w / img.h;
        let w = cellW, h = cellW / ratio;
        if (h > cellH) { h = cellH; w = cellH * ratio; }
        const x = 40 + col * (cellW + gap) + (cellW - w) / 2;
        const yTop = rowY + (cellH - h) / 2;
        try { doc.addImage(img.dataUrl, "JPEG", x, yTop, w, h, undefined, "FAST"); }
        catch { try { doc.addImage(img.dataUrl, "PNG", x, yTop, w, h, undefined, "FAST"); } catch { /* skip */ } }
        doc.setFontSize(8);
        doc.setTextColor(90);
        doc.text(
          doc.splitTextToSize(String(f.legenda ?? ""), cellW),
          40 + col * (cellW + gap),
          rowY + cellH + 10,
        );
        doc.setTextColor(0);
        doc.setFontSize(10);
        col++;
        if (col >= cols) { col = 0; rowY += cellH + 24; }
      }
      y = (col === 0 ? rowY : rowY + cellH + 24) + 8;
    }
  }

  // Rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} · Página ${i}/${pageCount}`, 40, doc.internal.pageSize.getHeight() - 20);
  }

  const filename = `RDO-${rdo.numero}-${String(rdo.obras?.nome ?? "obra").replace(/[^a-z0-9-_]+/gi, "_")}.pdf`;
  if (mode === "blob") {
    const raw = doc.output("blob") as Blob;
    const blob = raw.type === "application/pdf" ? raw : new Blob([raw], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    return { blob, url, filename };
  }
  doc.save(filename);
}
