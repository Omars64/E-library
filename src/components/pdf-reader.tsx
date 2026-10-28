"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export function PdfReader({ url }: { url: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | undefined;
    setDocument(null); setPage(1); setError("");
    const controller = new AbortController();
    void (async () => {
      try {
        const pdf = await import("pdfjs-dist");
        pdf.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Sign in again to read this book." : "This file could not be loaded. Retry or download it below.");
        task = pdf.getDocument({ data: new Uint8Array(await response.arrayBuffer()) });
        const loaded = await task.promise;
        if (!cancelled) setDocument(loaded);
      } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not open this PDF."); }
    })();
    return () => { cancelled = true; controller.abort(); void task?.destroy(); };
  }, [url, attempt]);
  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    void (async () => {
      try {
        const pdfPage = await document.getPage(page);
        if (cancelled || !canvas.current) return;
        const viewport = pdfPage.getViewport({ scale: zoom * 1.4 });
        canvas.current.width = viewport.width; canvas.current.height = viewport.height;
        render = pdfPage.render({ canvas: canvas.current, viewport });
        await render.promise;
      } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not render this page."); }
    })();
    return () => { cancelled = true; render?.cancel(); };
  }, [document, page, zoom]);
  return <div className="pdf-reader"><div className="pdf-controls"><button disabled={!document || page <= 1} onClick={() => setPage(page - 1)}>← Previous</button><label>Page <input type="number" min={1} max={document?.numPages ?? 1} value={page} onChange={(e) => setPage(Math.max(1, Math.min(document?.numPages ?? 1, Number(e.target.value) || 1)))} /> / {document?.numPages ?? "…"}</label><button disabled={!document || page >= document.numPages} onClick={() => setPage(page + 1)}>Next →</button><button aria-label="Zoom out" disabled={zoom <= .5} onClick={() => setZoom(Math.max(.5, zoom - .25))}>−</button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom(Math.min(3, zoom + .25))}>+</button><button onClick={() => setZoom(1)}>Fit width</button><button onClick={() => void canvas.current?.parentElement?.requestFullscreen().catch(() => setError("Full screen is unavailable in this browser."))}>Full screen</button></div>{error ? <div className="word-preview" role="alert"><p>{error}</p><button className="btn btn-primary" onClick={() => setAttempt(attempt + 1)}>Retry</button><a href={url} download>Download file</a></div> : <>{!document && <p role="status">Opening your PDF…</p>}<div className="pdf-canvas"><canvas style={{ width: `${zoom * 100}%`, maxWidth: "none" }} ref={canvas} aria-label={`PDF page ${page}`} /></div></>}</div>;
}
