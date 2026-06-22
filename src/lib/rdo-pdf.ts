import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { climaLabel, rdoStatusMeta } from "@/components/status";

type AnyRec = Record<string, any>;

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString("pt-BR") : "—");
const fmtDay = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

export function exportRdoPdf(args: {
  rdo: AnyRec;
  atividades: AnyRec[];
  mao_de_obra: AnyRec[];
  equipamentos: AnyRec[];
  ocorrencias: AnyRec[];
  logs: AnyRec[];
  anexos: AnyRec[];
  empresa?: { nome?: string; cnpj?: string | null } | null;
}) {
  const { rdo, atividades, mao_de_obra, equipamentos, ocorrencias, logs, anexos, empresa } = args;
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

  section("Mão de obra", ["Pessoa", "Função", "Atividade", "Horas"],
    mao_de_obra.map((m) => [m.mao_de_obra?.nome ?? "—", m.mao_de_obra?.funcao ?? "—", m.atividade ?? "—", String(m.horas ?? 0)]));

  section("Equipamentos", ["Equipamento", "Tipo", "Status", "Horas"],
    equipamentos.map((e) => [e.equipamentos?.nome ?? "—", e.equipamentos?.tipo ?? "—", e.status_uso ?? "—", String(e.horas_uso ?? 0)]));

  section("Ocorrências", ["Tipo", "Severidade", "Descrição"],
    ocorrencias.map((o) => [o.tipos_ocorrencia?.nome ?? "Geral", o.tipos_ocorrencia?.severidade ?? "—", o.descricao]));

  section("Anexos", ["Nome", "Enviado por", "Em"],
    anexos.map((a) => [a.nome, a.autor?.nome ?? "—", fmtDate(a.created_at)]));

  section("Histórico de status", ["Quando", "Ação", "De → Para", "Por", "Motivo"],
    logs.map((l) => [
      fmtDate(l.created_at),
      l.acao,
      `${l.status_anterior ?? "—"} → ${l.status_novo ?? "—"}`,
      l.autor?.nome ?? "—",
      l.motivo ?? "",
    ]));

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
