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
  empresa?: { nome?: string; cnpj?: string | null } | null;
  clima_dias?: AnyRec[] | null;
  clima_local?: string | null;
}) {
  const { rdo, atividades, avancos, mao_de_obra, equipamentos, ocorrencias, logs, anexos, empresa, clima_dias, clima_local } = args;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 40;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Relatório Diário de Obra #${rdo.numero}`, 40, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y += 18;
  doc.text(`${empresa?.nome ?? "Empresa"}${empresa?.cnpj ? ` · CNPJ ${empresa.cnpj}` : ""}`, 40, y);
  y += 14;
  doc.text(`Obra: ${rdo.obras?.nome ?? "—"}   Data: ${fmtDay(rdo.data)}   Status: ${rdoStatusMeta[rdo.status as keyof typeof rdoStatusMeta]?.label ?? rdo.status}`, 40, y);
  y += 14;
  doc.text(`Autor: ${rdo.autor?.nome ?? "—"}${rdo.aprovador?.nome ? `   Aprovador: ${rdo.aprovador.nome}` : ""}`, 40, y);
  y += 10;
  doc.setDrawColor(200);
  doc.line(40, y, W - 40, y);
  y += 14;

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
      for (const f of g.items) {
        if (rowY + cellH > H - 40) { doc.addPage(); rowY = 40; y = 40; col = 0; }
        const img = await urlToDataUrl(f.url as string);
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
          doc.splitTextToSize(f.nome ?? "", cellW),
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

  doc.save(`RDO-${rdo.numero}-${rdo.obras?.nome ?? "obra"}.pdf`);
}
