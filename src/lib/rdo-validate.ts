// Pure helpers used by the RDO form (client) and the sync flow.
// Keeping them framework-free makes them easy to unit-test.

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && UUID_RE.test(v);

export interface RdoFormLike {
  equipamentos?: Array<{ equipamento_id?: string | null }>;
  ocorrencias?: Array<{ descricao?: string | null }>;
  mao_de_obra?: Array<{ mao_de_obra_id?: string | null }>;
  atividades?: Array<{ descricao?: string | null }>;
}

export interface RdoValidation {
  equipInvalidIdx: number[];
  ocInvalidIdx: number[];
  maoInvalidIdx: number[];
  ativInvalidIdx: number[];
  valid: boolean;
}

export function validateRdoForm(form: RdoFormLike): RdoValidation {
  const equipInvalidIdx = (form.equipamentos ?? [])
    .map((e, i) => (isUuid(e?.equipamento_id) ? -1 : i))
    .filter((i) => i >= 0);
  const ocInvalidIdx = (form.ocorrencias ?? [])
    .map((o, i) => (o?.descricao?.trim() ? -1 : i))
    .filter((i) => i >= 0);
  const maoInvalidIdx = (form.mao_de_obra ?? [])
    .map((m, i) => (isUuid(m?.mao_de_obra_id) ? -1 : i))
    .filter((i) => i >= 0);
  const ativInvalidIdx = (form.atividades ?? [])
    .map((a, i) => (a?.descricao?.trim() ? -1 : i))
    .filter((i) => i >= 0);
  return {
    equipInvalidIdx,
    ocInvalidIdx,
    maoInvalidIdx,
    ativInvalidIdx,
    valid:
      equipInvalidIdx.length === 0 &&
      ocInvalidIdx.length === 0 &&
      maoInvalidIdx.length === 0 &&
      ativInvalidIdx.length === 0,
  };
}

export interface SanitizeResult<T> {
  sane: T;
  dropped: {
    equipamentos: number;
    ocorrencias: number;
    mao_de_obra: number;
    atividades: number;
  };
  total_dropped: number;
}

/** Remove linhas inválidas (UUID quebrado/descrição vazia) antes de enviar. */
export function sanitizeRdoPayload<T extends RdoFormLike>(
  payload: T,
): SanitizeResult<T> {
  const atividades = (payload.atividades ?? []).filter((a) =>
    a?.descricao?.trim(),
  );
  const mao_de_obra = (payload.mao_de_obra ?? []).filter((m) =>
    isUuid(m?.mao_de_obra_id),
  );
  const equipamentos = (payload.equipamentos ?? []).filter((e) =>
    isUuid(e?.equipamento_id),
  );
  const ocorrencias = (payload.ocorrencias ?? []).filter((o) =>
    o?.descricao?.trim(),
  );
  const dropped = {
    equipamentos: (payload.equipamentos?.length ?? 0) - equipamentos.length,
    ocorrencias: (payload.ocorrencias?.length ?? 0) - ocorrencias.length,
    mao_de_obra: (payload.mao_de_obra?.length ?? 0) - mao_de_obra.length,
    atividades: (payload.atividades?.length ?? 0) - atividades.length,
  };
  return {
    sane: {
      ...payload,
      atividades,
      mao_de_obra,
      equipamentos,
      ocorrencias,
    } as T,
    dropped,
    total_dropped:
      dropped.equipamentos +
      dropped.ocorrencias +
      dropped.mao_de_obra +
      dropped.atividades,
  };
}

/** Validação backend: garante que cada linha tenha UUID válido / descrição
 *  preenchida e produz uma mensagem mapeada por etapa do wizard. Bloqueia
 *  tentativas de burlar a UI mesmo se o cliente enviar JSON manualmente. */
export function assertRowsValid(data: any): void {
  const byStep: Record<string, string[]> = {};
  const push = (etapa: string, msg: string) => {
    (byStep[etapa] ??= []).push(msg);
  };

  if (data?.obra_id && typeof data.obra_id === "string" && !UUID_RE.test(data.obra_id)) {
    push("Etapa 1 · Obra", "obra_id inválido");
  }
  if (data?.data && typeof data.data !== "string") {
    push("Etapa 2 · Clima", "data do RDO inválida");
  }
  (data?.atividades ?? []).forEach((a: any, i: number) => {
    if (!a || typeof a.descricao !== "string" || !a.descricao.trim()) {
      push("Etapa 3 · Atividades", `linha ${i + 1}: descrição obrigatória`);
    }
    if (a && a.pct_executado != null && (a.pct_executado < 0 || a.pct_executado > 100)) {
      push("Etapa 3 · Atividades", `linha ${i + 1}: % executado deve estar entre 0 e 100`);
    }
  });
  (data?.mao_de_obra ?? []).forEach((m: any, i: number) => {
    if (!m || typeof m.mao_de_obra_id !== "string" || !UUID_RE.test(m.mao_de_obra_id)) {
      push("Etapa 4 · Mão de obra", `linha ${i + 1}: selecione a pessoa`);
    }
    if (m && m.horas != null && (m.horas < 0 || m.horas > 24)) {
      push("Etapa 4 · Mão de obra", `linha ${i + 1}: horas devem estar entre 0 e 24`);
    }
  });
  (data?.equipamentos ?? []).forEach((e: any, i: number) => {
    if (!e || typeof e.equipamento_id !== "string" || !UUID_RE.test(e.equipamento_id)) {
      push("Etapa 5 · Equipamentos", `linha ${i + 1}: selecione o equipamento`);
    }
    if (e && e.horas_uso != null && (e.horas_uso < 0 || e.horas_uso > 24)) {
      push("Etapa 5 · Equipamentos", `linha ${i + 1}: horas de uso devem estar entre 0 e 24`);
    }
  });
  (data?.ocorrencias ?? []).forEach((o: any, i: number) => {
    if (!o || typeof o.descricao !== "string" || !o.descricao.trim()) {
      push("Etapa 6 · Ocorrências", `linha ${i + 1}: descrição obrigatória`);
    }
  });

  const stepsWithErrors = Object.keys(byStep);
  if (stepsWithErrors.length) {
    const message =
      "RDO_INVALID_ROWS: " +
      stepsWithErrors.map((s) => `${s} — ${byStep[s].join("; ")}`).join(" | ");
    const err: any = new Error(message);
    err.code = "RDO_INVALID_ROWS";
    err.byStep = byStep;
    err.rows = stepsWithErrors.flatMap((s) => byStep[s].map((m) => `${s}: ${m}`));
    throw err;
  }
}
