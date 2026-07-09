import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, Loader2, FileText, FileSpreadsheet } from "lucide-react";
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

  useEffect(() => {
    if (!kind || !args) return;
    let cancelled = false;
    let currentUrl: string | null = null;
    setLoading(true);
    setResult(null);
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (currentUrl) setTimeout(() => URL.revokeObjectURL(currentUrl!), 500);
    };
  }, [kind, args]);

  const open = kind !== null;
  const rdo: any = args?.rdo ?? {};
  const empresa: any = args?.empresa ?? {};
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

  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            {kind === "pdf" ? <FileText className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
            Pré-visualização — {kind === "pdf" ? "PDF" : "Planilha Excel"}
          </DialogTitle>
          <Button size="sm" onClick={download} disabled={!result || loading}>
            <Download className="h-4 w-4 mr-1" /> Baixar {kind === "pdf" ? "PDF" : "Excel"}
          </Button>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-muted/30 animate-fade-in">
          {loading && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground animate-fade-in">
              <div className="relative">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
              </div>
              <p className="text-sm font-medium">Gerando pré-visualização…</p>
              <p className="text-xs text-muted-foreground">
                Montando cabeçalho com logo e padrão ABNT
              </p>
            </div>
          )}

          {!loading && kind === "pdf" && result && (
            <PdfCanvasPreview blob={result.blob} />
          )}

          {!loading && kind === "excel" && counts && (
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
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground pt-2 border-t">
                    Cores derivadas da logo da empresa · Anexos e Histórico não são incluídos.
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

function PdfCanvasPreview({ blob }: { blob: Blob }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPageNumber(1);
    setPageCount(0);
    setError(null);
  }, [blob]);

  useEffect(() => {
    let cancelled = false;
    let resizeTimer: number | undefined;
    let pdfDocument: any = null;
    let renderTask: any = null;

    const renderPage = async () => {
      setRendering(true);
      setError(null);
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

        if (!pdfDocument) {
          const data = await blob.arrayBuffer();
          pdfDocument = await pdfjs.getDocument({ data }).promise;
          if (!cancelled) setPageCount(pdfDocument.numPages);
        }

        const canvas = canvasRef.current;
        const wrapper = wrapperRef.current;
        if (!canvas || !wrapper || cancelled) return;

        const page = await pdfDocument.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(wrapper.clientWidth - 48, 320);
        const scale = Math.min(availableWidth / baseViewport.width, 1.45);
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
        if (!cancelled && err?.name !== "RenderingCancelledException") {
          setError("Não foi possível montar a pré-visualização do PDF. Baixe o arquivo para conferir o conteúdo final.");
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    renderPage();
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(renderPage, 180);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      renderTask?.cancel?.();
      pdfDocument?.destroy?.();
    };
  }, [blob, pageNumber]);

  return (
    <div className="h-full flex flex-col bg-zinc-100 animate-fade-in">
      <div className="flex items-center justify-between gap-3 border-b bg-background px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>Prévia renderizada do PDF</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
            disabled={rendering || pageNumber <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-20 text-center text-xs font-medium text-muted-foreground">
            Página {pageNumber}{pageCount ? ` de ${pageCount}` : ""}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPageNumber((page) => Math.min(pageCount || page + 1, page + 1))}
            disabled={rendering || !pageCount || pageNumber >= pageCount}
            aria-label="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={wrapperRef} className="relative flex-1 overflow-auto p-4">
        {rendering && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 text-muted-foreground animate-fade-in">
            <div className="relative">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
            </div>
            <p className="text-sm font-medium">Abrindo pré-visualização do PDF…</p>
          </div>
        )}

        {error ? (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <FileText className="h-8 w-8" />
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <canvas ref={canvasRef} className="mx-auto block bg-white shadow-lg animate-scale-in" aria-label="Pré-visualização do PDF" />
        )}
      </div>
    </div>
  );
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
