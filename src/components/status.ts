export const rdoStatusMeta = {
  rascunho: { label: "Rascunho", className: "border-muted-foreground/40 text-muted-foreground bg-muted/40" },
  enviado: { label: "Aguardando", className: "border-warning text-warning bg-warning/10" },
  aprovado: { label: "Aprovado", className: "border-success text-success bg-success/10" },
  reprovado: { label: "Reprovado", className: "border-destructive text-destructive bg-destructive/10" },
} as const;

export const obraStatusMeta = {
  planejamento: { label: "Planejamento", className: "border-muted-foreground/40 text-muted-foreground bg-muted/40" },
  em_andamento: { label: "Em andamento", className: "border-brand text-brand bg-brand/10" },
  pausada: { label: "Pausada", className: "border-warning text-warning bg-warning/10" },
  concluida: { label: "Concluída", className: "border-success text-success bg-success/10" },
} as const;

export const equipStatusMeta = {
  disponivel: { label: "Disponível", className: "border-success text-success bg-success/10" },
  em_uso: { label: "Em uso", className: "border-brand text-brand bg-brand/10" },
  manutencao: { label: "Manutenção", className: "border-warning text-warning bg-warning/10" },
} as const;

export const severidadeMeta = {
  baixa: { label: "Baixa", className: "border-muted-foreground/40 text-muted-foreground" },
  media: { label: "Média", className: "border-warning text-warning bg-warning/10" },
  alta: { label: "Alta", className: "border-destructive text-destructive bg-destructive/10" },
  critica: { label: "Crítica", className: "border-destructive text-destructive-foreground bg-destructive" },
} as const;

export const climaLabel: Record<string, string> = {
  ensolarado: "Ensolarado",
  nublado: "Nublado",
  chuvoso: "Chuvoso",
  chuva_forte: "Chuva forte",
  impraticavel: "Impraticável",
};
