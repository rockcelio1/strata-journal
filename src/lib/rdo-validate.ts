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
