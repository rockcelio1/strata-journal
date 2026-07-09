import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { exportRdoPdf } from "@/lib/rdo-pdf";
import { exportRdoExcel } from "@/lib/rdo-excel";
import { rdoStatusMeta } from "@/components/status";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

type ExportArgs = Parameters<typeof exportRdoPdf>[0];

type Props = {
  kind: "pdf" | "excel" | null;
  args: Omit<ExportArgs, "mode"> | null;
  onClose: () => void;
};

export function RdoExportPreview({ kind, args, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; url: string; filename: string } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationKey, setGenerationKey] = useState(0);

  useEffect(() => {
    if (!kind || !args) return;
    let cancelled = false;
    let currentUrl: string | null = null;
    setLoading(true);
    setResult(null);
    setGenerationError(null);
    (async () => {
      try {
        const out =
          kind === "pdf"
            ? await exportRdoPdf({ ...args, mode: "blob" })
            : await exportRdoExcel({ ...args, mode: "blob" });
        if (cancelled) {
          if (out?.url) URL.revokeObjectURL(out.url);
          return;
        }
        if (out) {
          currentUrl = out.url;
          setResult(out);
        }
      } catch (err) {
        console.error("[rdo-export-preview] Falha ao gerar arquivo para pré-visualização", {
          ...getRdoLogContext(args),
          kind,
          error: technicalError(err),
          request_id: crypto.randomUUID?.() ?? `${Date.now()}`,
          timestamp: new Date().toISOString(),
        });
        if (!cancelled) {
          setGenerationError(
            kind === "pdf"
              ? "Ocorreu um erro ao carregar o PDF. Tente novamente."
              : "Ocorreu um erro ao carregar a planilha. Tente novamente.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (currentUrl) setTimeout(() => URL.revokeObjectURL(currentUrl!), 500);
    };
  }, [kind, args, generationKey]);

  const open = kind !== null;
  const rdo: any = args?.rdo ?? {};
  const empresa: any = args?.empresa ?? {};
  const logContext = getRdoLogContext(args);
  const counts = args
    ? {
        atividades: args.atividades?.length ?? 0,
        avancos: args.avancos?.length ?? 0,
        mao: args.mao_de_obra?.length ?? 0,
        equip: args.equipamentos?.length ?? 0,
        ocor: args.ocorrencias?.length ?? 0,
        anexos: (args.anexos ?? []).filter((a: any) => (a.mime_type ?? "").startsWith("image/")).length,
      }
    : null;

  const download = useCallback(() => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [result]);

  const openInNewTab = useCallback(() => {
    if (!result) return;
    window.open(result.url, "_blank", "noopener,noreferrer");
  }, [result]);

  const copyUrl = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      toast.success("URL copiada.");
    } catch (err) {
      console.error("[rdo-export-preview] Falha ao copiar URL do PDF", { ...logContext, error: technicalError(err) });
      toast.error("Não foi possível copiar a URL.");
    }
  }, [logContext, result]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b flex-row flex-wrap items-center justify-between gap-2 space-y-0 pr-12">
          <DialogTitle className="flex items-center gap-2 text-base">
            {kind === "pdf" ? <FileText className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
            Pré-visualização — {kind === "pdf" ? "PDF" : "Planilha Excel"}
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-2">
            {kind === "pdf" && result ? (
              <Button asChild size="sm" variant="outline">
                <a href={result.url}>
                  <ExternalLink className="h-4 w-4" /> Abrir PDF nesta aba
                </a>
              </Button>
            ) : kind === "pdf" ? (
              <Button size="sm" variant="outline" disabled>
                <ExternalLink className="h-4 w-4" /> Abrir PDF nesta aba
              </Button>
            ) : null}
            {kind === "pdf" && (
              <Button size="sm" variant="outline" onClick={openInNewTab} disabled={!result || loading}>
                <ExternalLink className="h-4 w-4" /> Abrir em nova aba
              </Button>
            )}
            {kind === "pdf" && (
              <Button size="sm" variant="outline" onClick={copyUrl} disabled={!result || loading}>
                <Copy className="h-4 w-4" /> Copiar URL
              </Button>
            )}
            <Button size="sm" onClick={download} disabled={!result || loading}>
              <Download className="h-4 w-4" /> Baixar {kind === "pdf" ? "PDF" : "Excel"}
            </Button>
            <DialogClose asChild>
              <Button size="sm" variant="ghost">
                <X className="h-4 w-4" /> Fechar
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-muted/30 animate-fade-in">
          {loading && (
            <div className="h-full flex items-center justify-center animate-fade-in" role="status" aria-label="Carregando">
              <div className="relative">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
              </div>
            </div>
          )}

          {!loading && generationError && (
            kind === "pdf" ? (
              <PdfPreviewFallback
                message={generationError}
                result={result}
                onOpenNewTab={openInNewTab}
                onDownload={download}
                onCopyUrl={copyUrl}
                onRetry={() => setGenerationKey((key) => key + 1)}
              />
            ) : (
              <ExportPreviewFallback message={generationError} onDownload={download} canDownload={!!result} />
            )
          )}

          {!loading && !generationError && kind === "pdf" && result && (
            <PdfCanvasPreview
              blob={result.blob}
              url={result.url}
              filename={result.filename}
              logContext={logContext}
              onOpenNewTab={openInNewTab}
              onDownload={download}
              onCopyUrl={copyUrl}
            />
          )}

          {!loading && !generationError && kind === "excel" && counts && (
            <div className="h-full overflow-auto p-6 animate-fade-in">
              <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm border animate-scale-in">

                {/* Faixa header simulando a planilha */}
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 text-white rounded-t-lg">
                  {empresa?.logo_url ? (
                    <img src={empresa.logo_url} alt="" className="h-10 w-auto max-w-[100px] object-contain bg-white/95 rounded px-1 py-0.5" />
                  ) : (
                    <span className="text-[10px] bg-amber-100 text-amber-800 rounded px-2 py-1">Sem logo</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{empresa?.nome ?? "Empresa"}</div>
                    {empresa?.cnpj && <div className="text-xs opacity-80">CNPJ {empresa.cnpj}</div>}
                  </div>
                </div>
                <div className="px-4 py-2 bg-slate-100 border-b text-sm">
                  <span className="font-semibold">Relatório Diário de Obra Nº {rdo.numero} </span>
                  <span className="text-muted-foreground">· Obra: {rdo.obras?.nome ?? "—"} · Data: {rdo.data ? new Date(rdo.data).toLocaleDateString("pt-BR") : "—"}</span>
                </div>
                <div className="p-4 text-sm space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Info label="Status" value={rdoStatusMeta[rdo.status as keyof typeof rdoStatusMeta]?.label ?? rdo.status ?? "—"} />
                    <Info label="Autor" value={rdo.autor?.nome ?? "—"} />
                    <Info label="Aprovador" value={rdo.aprovador?.nome ?? "—"} />
                    <Info label="Endereço" value={rdo.obras?.endereco ?? "—"} />
                  </div>
                  <div className="pt-2 border-t">
                    <div className="font-semibold mb-2 text-slate-700">Abas incluídas</div>
                    <ul className="grid grid-cols-2 gap-1 text-sm">
                      <Sheet name="Capa" n={1} />
                      <Sheet name="Atividades" n={counts.atividades} />
                      <Sheet name="Avanços" n={counts.avancos} />
                      <Sheet name="Mão de obra" n={counts.mao} />
                      <Sheet name="Equipamentos" n={counts.equip} />
                      <Sheet name="Ocorrências" n={counts.ocor} />
                      <Sheet name="Clima" n={args?.clima_dias?.length ?? 0} />
                      <Sheet name="Anexos" n={counts.anexos} />
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground pt-2 border-t">
                    Cores derivadas da logo da empresa · Anexos incluídos com imagem e legenda.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type PdfPreviewResult = { blob: Blob; url: string; filename: string } | null;

type PdfLogContext = {
  report_id: string | null;
  work_id: string | null;
  company_id: string | null;
  status: string | null;
};

const MAX_PDF_PREVIEW_BYTES = 60 * 1024 * 1024;

function PdfCanvasPreview({
  blob,
  url,
  filename,
  logContext,
  onOpenNewTab,
  onDownload,
  onCopyUrl,
}: {
  blob: Blob;
  url: string;
  filename: string;
  logContext: PdfLogContext;
  onOpenNewTab: () => void;
  onDownload: () => void;
  onCopyUrl: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(760);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const update = () => setContainerWidth(wrapper.clientWidth || 760);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let pdfDocument: any = null;

    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      setPageCount(0);
      setPdfDocument(null);
      try {
        const loaded = await loadPdfBytes({ blob, url });
        if (loaded.size > MAX_PDF_PREVIEW_BYTES) {
          throw new PdfPreviewError("PDF_TOO_LARGE", "O PDF é muito grande para pré-visualização. Use o botão Baixar PDF.", summarizeLoadedPdf(loaded));
        }

        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        pdfDocument = await pdfjs.getDocument({ data: loaded.bytes }).promise;
        if (!pdfDocument?.numPages) {
          throw new PdfPreviewError("INVALID_PDF", "O arquivo retornado não é um PDF válido.", summarizeLoadedPdf(loaded));
        }
        if (!cancelled) {
          setPageCount(pdfDocument.numPages);
          setPdfDocument(pdfDocument);
        }
      } catch (err) {
        if (!cancelled) {
          const friendlyMessage = friendlyPdfError(err);
          setError(friendlyMessage);
          console.error("[rdo-pdf-preview] Falha técnica na pré-visualização", {
            ...logContext,
            filename,
            pdf_url: maskUrl(url),
            ...technicalPdfError(err),
            request_id: crypto.randomUUID?.() ?? `${Date.now()}`,
            timestamp: new Date().toISOString(),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      pdfDocument?.destroy?.();
    };
  }, [blob, filename, logContext, retryKey, url]);

  return (
    <div className="h-full flex flex-col bg-muted/40 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>{pageCount ? `${pageCount} ${pageCount === 1 ? "página" : "páginas"}` : "Prévia renderizada do PDF"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom((value) => Math.max(0.75, Number((value - 0.15).toFixed(2))))}
            disabled={loading || !!error || zoom <= 0.75}
            aria-label="Reduzir zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-14 text-center text-xs font-medium text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom((value) => Math.min(2, Number((value + 0.15).toFixed(2))))}
            disabled={loading || !!error || zoom >= 2}
            aria-label="Aumentar zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setRetryKey((key) => key + 1)} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> Recarregar
          </Button>
        </div>
      </div>

      <div ref={wrapperRef} className="relative flex-1 overflow-auto p-4">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 animate-fade-in" role="status" aria-label="Carregando">
            <div className="relative">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
            </div>
          </div>
        )}

        {error ? (
          <PdfPreviewFallback
            message={error}
            result={{ blob, url, filename }}
            onOpenNewTab={onOpenNewTab}
            onDownload={onDownload}
            onCopyUrl={onCopyUrl}
            onRetry={() => setRetryKey((key) => key + 1)}
          />
        ) : (
          <div className="mx-auto flex w-full flex-col items-center gap-4 pb-4">
            {pdfDocument && Array.from({ length: pageCount }, (_, index) => (
              <PdfPageCanvas
                key={`${retryKey}-${index + 1}-${zoom}-${containerWidth}`}
                pdfDocument={pdfDocument}
                pageNumber={index + 1}
                zoom={zoom}
                containerWidth={containerWidth}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PdfPageCanvas({
  pdfDocument,
  pageNumber,
  zoom,
  containerWidth,
}: {
  pdfDocument: any;
  pageNumber: number;
  zoom: number;
  containerWidth: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask: any = null;

    const renderPage = async () => {
      setRendering(true);
      setError(false);
      try {
        const page = await pdfDocument.getPage(pageNumber);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(containerWidth - 48, 320);
        const fitScale = availableWidth / baseViewport.width;
        const scale = Math.min(Math.max(fitScale * zoom, 0.45), 3);
        const viewport = page.getViewport({ scale });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas indisponível para a pré-visualização.");

        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);

        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
      } catch (err: any) {
        if (!cancelled && err?.name !== "RenderingCancelledException") setError(true);
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [containerWidth, pageNumber, pdfDocument, zoom]);

  return (
    <div className="w-full max-w-full animate-scale-in" aria-label={`Página ${pageNumber} do PDF`}>
      <div className="mx-auto mb-2 w-fit rounded border bg-background px-2 py-1 text-xs text-muted-foreground">
        Página {pageNumber}
      </div>
      <div className="relative mx-auto w-fit max-w-full">
        {rendering && (
          <div className="absolute inset-0 z-10 flex min-h-64 items-center justify-center bg-background/80 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {error ? (
          <div className="flex min-h-64 w-full max-w-xl items-center justify-center rounded border bg-background p-6 text-center text-sm text-muted-foreground">
            Não foi possível renderizar esta página.
          </div>
        ) : (
          <canvas ref={canvasRef} className="block max-w-full bg-background shadow-lg" />
        )}
      </div>
    </div>
  );
}

function PdfPreviewFallback({
  message,
  result,
  onOpenNewTab,
  onDownload,
  onCopyUrl,
  onRetry,
}: {
  message: string;
  result: PdfPreviewResult;
  onOpenNewTab: () => void;
  onDownload: () => void;
  onCopyUrl: () => void;
  onRetry?: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-muted-foreground">
      <div className="rounded-full bg-destructive/10 p-3 text-destructive">
        <AlertCircle className="h-8 w-8" />
      </div>
      <div className="max-w-lg space-y-2">
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="text-sm">
          Não foi possível exibir o PDF dentro do sistema. Você ainda pode abrir em nova aba ou baixar o arquivo.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {result ? (
          <Button asChild variant="outline">
            <a href={result.url}>
              <ExternalLink className="h-4 w-4" /> Abrir PDF nesta aba
            </a>
          </Button>
        ) : null}
        <Button variant="outline" onClick={onOpenNewTab} disabled={!result}>
          <ExternalLink className="h-4 w-4" /> Abrir em nova aba
        </Button>
        <Button onClick={onDownload} disabled={!result}>
          <Download className="h-4 w-4" /> Baixar PDF
        </Button>
        <Button variant="outline" onClick={onCopyUrl} disabled={!result}>
          <Copy className="h-4 w-4" /> Copiar URL
        </Button>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </Button>
        )}
      </div>
    </div>
  );
}

function ExportPreviewFallback({ message, onDownload, canDownload }: { message: string; onDownload: () => void; canDownload: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-muted-foreground">
      <div className="rounded-full bg-destructive/10 p-3 text-destructive">
        <AlertCircle className="h-8 w-8" />
      </div>
      <p className="max-w-lg text-sm font-medium text-foreground">{message}</p>
      <Button onClick={onDownload} disabled={!canDownload}>
        <Download className="h-4 w-4" /> Baixar Excel
      </Button>
    </div>
  );
}

class PdfPreviewError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    public details?: Record<string, unknown>,
  ) {
    super(userMessage);
    this.name = "PdfPreviewError";
  }
}

async function loadPdfBytes({ blob, url }: { blob: Blob; url: string }) {
  if (!url) throw new PdfPreviewError("EMPTY_URL", "Ocorreu um erro ao carregar o PDF. Tente novamente.");

  let arrayBuffer: ArrayBuffer;
  let status = 200;
  let contentType = blob.type || "";

  try {
    const response = await fetch(url, { cache: "no-store" });
    status = response.status;
    contentType = response.headers.get("content-type") || contentType;
    if (!response.ok) {
      throw new PdfPreviewError(`HTTP_${response.status}`, messageForStatus(response.status), { status, content_type: contentType });
    }
    arrayBuffer = await response.arrayBuffer();
  } catch (err) {
    if (err instanceof PdfPreviewError) throw err;
    if (!blob.size) throw new PdfPreviewError("FETCH_FAILED", "Ocorreu um erro ao carregar o PDF. Tente novamente.", { error: technicalError(err) });
    arrayBuffer = await blob.arrayBuffer();
  }

  const size = arrayBuffer.byteLength;
  if (!size) throw new PdfPreviewError("EMPTY_FILE", "O arquivo retornado não é um PDF válido.", { status, content_type: contentType, size });

  const bytes = new Uint8Array(arrayBuffer);
  if (!hasPdfSignature(bytes)) {
    throw new PdfPreviewError("INVALID_PDF", "O arquivo retornado não é um PDF válido.", { status, content_type: contentType, size });
  }

  return { bytes, status, content_type: contentType || "application/pdf", size };
}

function hasPdfSignature(bytes: Uint8Array) {
  const header = new TextDecoder("ascii").decode(bytes.slice(0, Math.min(bytes.length, 1024)));
  return header.includes("%PDF-");
}

function messageForStatus(status: number) {
  if (status === 401 || status === 403) return "Você não tem permissão para visualizar este PDF.";
  if (status === 404) return "O PDF não foi encontrado. Gere o relatório novamente.";
  if (status >= 500) return "Ocorreu um erro ao carregar o PDF. Tente novamente.";
  return "Não foi possível exibir o PDF dentro do sistema. Você ainda pode abrir em nova aba ou baixar o arquivo.";
}

function friendlyPdfError(err: unknown) {
  if (err instanceof PdfPreviewError) return err.userMessage;
  return "Não foi possível exibir o PDF dentro do sistema. Você ainda pode abrir em nova aba ou baixar o arquivo.";
}

function technicalPdfError(err: unknown) {
  if (err instanceof PdfPreviewError) return { code: err.code, message: err.message, ...(err.details ?? {}) };
  return { code: "UNKNOWN", error: technicalError(err) };
}

function summarizeLoadedPdf(loaded: { status: number; content_type: string; size: number }) {
  return { status: loaded.status, content_type: loaded.content_type, size: loaded.size };
}

function technicalError(err: unknown) {
  if (err instanceof Error) return { name: err.name, message: err.message };
  return { message: String(err) };
}

function maskUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("blob:")) return `${url.slice(0, 18)}…`;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.search) parsed.search = "?…";
    return parsed.toString();
  } catch {
    return `${url.slice(0, 24)}…`;
  }
}

function getRdoLogContext(args: Omit<ExportArgs, "mode"> | null): PdfLogContext {
  const rdo: any = args?.rdo ?? {};
  const empresa: any = args?.empresa ?? {};
  return {
    report_id: rdo.id ?? null,
    work_id: rdo.obra_id ?? rdo.obras?.id ?? null,
    company_id: rdo.empresa_id ?? empresa.id ?? null,
    status: rdo.status ?? null,
  };
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function Sheet({ name, n }: { name: string; n: number }) {
  return (
    <li className="flex items-center justify-between border rounded px-2 py-1 bg-slate-50">
      <span>{name}</span>
      <span className="text-xs text-muted-foreground">{n} {n === 1 ? "linha" : "linhas"}</span>
    </li>
  );
}
