import * as XLSX from "xlsx";
import { climaLabel, rdoStatusMeta } from "@/components/status";
import { sanitizeExportRow } from "@/lib/security/sanitize-export";

type AnyRec = Record<string, any>;

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
const fmtDay = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
const fmtDayBR = (yyyyMmDd?: string | null) =>
  yyyyMmDd ? new Date(`${yyyyMmDd}T12:00:00-03:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";

function addSheet(wb: XLSX.WorkBook, name: string, rows: AnyRec[]) {
  const safeRows = rows.length ? rows.map((r) => sanitizeExportRow(r)) : [{}];
  const ws = XLSX.utils.json_to_sheet(safeRows);
  // Sheet names max 31 chars, no []:*?/\ characters
  const safe = name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safe);
}

/**
 * Exporta o RDO em Excel com 9 abas em formato "banco de dados":
 * Resumo, Atividades, Avanços, Mão de obra, Equipamentos,
 * Ocorrências, Anexos, Clima, Histórico.
 */
export function exportRdoExcel(args: {
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
  empresa?: { nome?: string; cnpj?: string | null } | null;
}) {
  const { rdo, atividades, avancos, mao_de_obra, equipamentos, ocorrencias, anexos, logs, clima_dias, clima_local, empresa } = args;
  const wb = XLSX.utils.book_new();

  addSheet(wb, "Resumo", [{
    numero: rdo.numero,
    obra: rdo.obras?.nome ?? "",
    endereco: rdo.obras?.endereco ?? "",
    data: fmtDay(rdo.data),
    status: rdoStatusMeta[rdo.status as keyof typeof rdoStatusMeta]?.label ?? rdo.status,
    autor: rdo.autor?.nome ?? "",
    aprovador: rdo.aprovador?.nome ?? "",
    empresa: empresa?.nome ?? "",
    cnpj: empresa?.cnpj ?? "",
    clima_manha: rdo.clima_manha ? climaLabel[rdo.clima_manha] ?? rdo.clima_manha : "",
    clima_tarde: rdo.clima_tarde ? climaLabel[rdo.clima_tarde] ?? rdo.clima_tarde : "",
    clima_noite: rdo.clima_noite ? climaLabel[rdo.clima_noite] ?? rdo.clima_noite : "",
    observacoes: rdo.observacoes ?? "",
    criado_em: fmtDate(rdo.created_at),
  }]);

  addSheet(wb, "Atividades", atividades.map((a) => ({
    descricao: a.descricao,
    pct_executado: Number(a.pct_executado ?? 0),
  })));

  addSheet(wb, "Avancos", (avancos ?? []).map((a) => ({
    item_code: a.item_code ?? "",
    descricao: a.descricao ?? "",
    unidade: a.unidade ?? "",
    planned_quantity: a.planned_quantity ?? "",
    realized_today: a.realized_today ?? "",
    accumulated_percent: a.accumulated_percent ?? "",
    status: a.status ?? "",
    total_hours: a.total_hours ?? "",
    comment: a.comment ?? "",
  })));

  addSheet(wb, "Mao de obra", mao_de_obra.map((m) => ({
    pessoa: m.mao_de_obra?.nome ?? "",
    funcao: m.mao_de_obra?.funcao ?? "",
    un: Number(m.horas ?? 0),
  })));


  addSheet(wb, "Equipamentos", equipamentos.map((e) => ({
    equipamento: e.equipamentos?.nome ?? "",
    tipo: e.equipamentos?.tipo ?? "",
    status_uso: e.status_uso ?? "",
    horas_uso: Number(e.horas_uso ?? 0),
  })));

  addSheet(wb, "Ocorrencias", ocorrencias.map((o) => ({
    tipo: o.tipos_ocorrencia?.nome ?? "Geral",
    severidade: o.tipos_ocorrencia?.severidade ?? "",
    descricao: o.descricao ?? "",
  })));

  const findAtiv = (id?: string | null) => {
    if (!id) return "";
    const av = (avancos ?? []).find((a: AnyRec) => a.task_item_id === id || a.id === id);
    return av ? `${av.item_code ? av.item_code + " · " : ""}${av.descricao ?? ""}` : "";
  };

  addSheet(wb, "Anexos", anexos.map((a: AnyRec) => ({
    nome: a.nome,
    atividade: findAtiv(a.task_item_id),
    autor: a.autor?.nome ?? "",
    mime_type: a.mime_type ?? "",
    tamanho_bytes: a.tamanho_bytes ?? "",
    enviado_em: fmtDate(a.created_at),
    url: a.url ?? "",
  })));

  addSheet(wb, "Fotos", anexos
    .filter((a: AnyRec) => (a.mime_type ?? "").toString().startsWith("image/"))
    .map((a: AnyRec) => ({
      atividade: findAtiv(a.task_item_id),
      nome: a.nome,
      url: a.url ?? "",
      enviado_em: fmtDate(a.created_at),
    })));

  addSheet(wb, "Clima", (clima_dias ?? []).map((d: AnyRec) => ({
    local: clima_local ?? "",
    data: fmtDayBR(d.data),
    dia_semana: d.dia_semana ?? "",
    origem: d.origem ?? "",
    t_min_c: d.t_min_c ?? "",
    t_max_c: d.t_max_c ?? "",
    prob_chuva_pct: d.prob_chuva_pct ?? "",
    precipitacao_mm: d.precipitacao_mm ?? "",
    condicao: d.descricao ?? "",
  })));

  addSheet(wb, "Historico", logs.map((l) => ({
    quando: fmtDate(l.created_at),
    acao: l.acao,
    status_anterior: l.status_anterior ?? "",
    status_novo: l.status_novo ?? "",
    autor: l.autor?.nome ?? "",
    motivo: l.motivo ?? "",
  })));

  const fname = `RDO-${rdo.numero}-${(rdo.obras?.nome ?? "obra").toString().replace(/[^a-z0-9-_]+/gi, "_")}.xlsx`;
  XLSX.writeFile(wb, fname);
}
