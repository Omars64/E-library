"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react";
import "./notes-workspace.css";

export type WorkspaceNote = {
  id: string; title: string; body?: string; content?: string; folderId?: string | null;
  template?: "plain" | "lined" | "dotted"; strokes?: Stroke[]; favorite?: boolean;
  trash?: boolean; trashedAt?: string | null; createdAt?: string; updatedAt?: string;
};
type Folder = { id: string; name: string; parentId: string | null; color: string };
type Point = { x: number; y: number };
type Stroke = { color: string; width: number; points: Point[] };
type Scope = "all" | "favorites" | "trash" | string;

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Could not save your changes. Please try again.");
  return result as T;
}
function json(data: unknown) { return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }; }
function plainText(value: string) { return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim(); }

export function NotesWorkspace({ notes, selected, setSelected, onChanged, onError }: {
  notes: WorkspaceNote[]; selected: WorkspaceNote | null; setSelected: (note: WorkspaceNote | null) => void;
  onChanged: () => void; onError: (message: string) => void;
}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [scope, setScope] = useState<Scope>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"updated" | "created" | "title">("updated");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [chosen, setChosen] = useState<string[]>([]);
  const [draft, setDraft] = useState<WorkspaceNote | null>(selected);
  const [busy, setBusy] = useState(false);
  const [folderForm, setFolderForm] = useState<{ parentId: string; name: string; color: string } | null>(null);
  const [inkMode, setInkMode] = useState(false);
  const [inkColor, setInkColor] = useState("#8c526e");
  const [inkWidth, setInkWidth] = useState(3);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStroke = useRef<Stroke | null>(null);

  const loadFolders = useCallback(async () => {
    try { const result = await api<{ folders: Folder[] }>("/api/folders"); setFolders(result.folders); }
    catch (error) { onError(error instanceof Error ? error.message : "Could not load folders."); }
  }, [onError]);
  useEffect(() => { void loadFolders(); }, [loadFolders]);
  useEffect(() => { setDraft(selected); setInkMode(false); }, [selected]);

  const visible = useMemo(() => notes.filter((note) => {
    const trashed = Boolean(note.trash || note.trashedAt);
    if (scope === "trash") { if (!trashed) return false; }
    else if (trashed) return false;
    else if (scope === "favorites" && !note.favorite) return false;
    else if (scope !== "all" && scope !== "favorites" && note.folderId !== scope) return false;
    return `${note.title} ${plainText(note.body ?? note.content ?? "")}`.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) :
    new Date(b[sort === "created" ? "createdAt" : "updatedAt"] || 0).valueOf() - new Date(a[sort === "created" ? "createdAt" : "updatedAt"] || 0).valueOf()), [notes, scope, search, sort]);

  async function patchNote(id: string, data: Record<string, unknown>) {
    await api(`/api/notes/${id}`, { method: "PATCH", ...json(data) });
    onChanged();
  }
  async function bulk(data: Record<string, unknown>) {
    setBusy(true);
    try { await Promise.all(chosen.map((id) => patchNote(id, data))); setChosen([]); }
    catch (error) { onError(error instanceof Error ? error.message : "Could not update notes."); }
    finally { setBusy(false); }
  }
  async function saveNote() {
    if (!draft) return;
    setBusy(true);
    try {
      const payload = { title: draft.title.trim() || "Untitled note", body: draft.body ?? draft.content ?? "", folderId: draft.folderId ?? null, template: draft.template ?? "plain", strokes: draft.strokes ?? [] };
      if (draft.id) await patchNote(draft.id, payload);
      else {
        const created = await api<{ note: WorkspaceNote }>("/api/notes", { method: "POST", ...json({ ...payload, folderId: draft.folderId }) });
        if (payload.template !== "plain" || payload.strokes.length) await patchNote(created.note.id, { template: payload.template, strokes: payload.strokes });
      }
      setDraft(null); setSelected(null); onChanged();
    } catch (error) { onError(error instanceof Error ? error.message : "Could not save note."); }
    finally { setBusy(false); }
  }
  async function updateNote(id: string, data: Record<string, unknown>) {
    setBusy(true);
    try { await patchNote(id, data); if (draft?.id === id) setDraft({ ...draft, ...data } as WorkspaceNote); }
    catch (error) { onError(error instanceof Error ? error.message : "Could not update note."); }
    finally { setBusy(false); }
  }
  async function deleteForever(id: string) {
    if (!window.confirm("Delete this note permanently? This cannot be undone.")) return;
    setBusy(true);
    try { await api(`/api/notes/${id}`, { method: "DELETE" }); setDraft(null); setSelected(null); onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : "Could not delete note."); }
    finally { setBusy(false); }
  }
  async function createFolder(event: FormEvent) {
    event.preventDefault(); if (!folderForm?.name.trim()) return;
    setBusy(true);
    try { await api("/api/folders", { method: "POST", ...json({ name: folderForm.name.trim(), parentId: folderForm.parentId || null, color: folderForm.color }) }); setFolderForm(null); await loadFolders(); }
    catch (error) { onError(error instanceof Error ? error.message : "Could not create folder."); }
    finally { setBusy(false); }
  }
  async function renameFolder(folder: Folder) {
    const name = window.prompt("Rename folder", folder.name)?.trim();
    if (!name || name === folder.name) return;
    try { await api(`/api/folders/${folder.id}`, { method: "PATCH", ...json({ name }) }); await loadFolders(); }
    catch (error) { onError(error instanceof Error ? error.message : "Could not rename folder."); }
  }
  async function removeFolder(folder: Folder) {
    if (!window.confirm(`Delete “${folder.name}”? Its notes will move to Unfiled.`)) return;
    try { await api(`/api/folders/${folder.id}`, { method: "DELETE" }); if (scope === folder.id) setScope("all"); await loadFolders(); onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : "Could not delete folder."); }
  }
  function folderTree(parentId: string | null, depth = 0): React.ReactNode {
    return folders.filter((folder) => folder.parentId === parentId).map((folder) => <div key={folder.id} className="nw-folder-row" style={{ paddingLeft: 12 + depth * 15 }}>
      <button className={`nw-scope ${scope === folder.id ? "is-active" : ""}`} onClick={() => { setScope(folder.id); setDraft(null); }}><i style={{ background: folder.color }} />{folder.name}</button>
      <button title={`Add subfolder in ${folder.name}`} aria-label={`Add subfolder in ${folder.name}`} onClick={() => setFolderForm({ parentId: folder.id, name: "", color: folder.color })}>+</button>
      <button title={`Rename ${folder.name}`} aria-label={`Rename ${folder.name}`} onClick={() => void renameFolder(folder)}>⋯</button>
      {folderTree(folder.id, depth + 1)}
    </div>);
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas || !draft) return;
    const box = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(box.width * ratio)); canvas.height = Math.max(1, Math.round(box.height * ratio));
    const context = canvas.getContext("2d"); if (!context) return;
    context.scale(ratio, ratio); context.clearRect(0, 0, box.width, box.height);
    for (const stroke of draft.strokes ?? []) {
      if (!stroke.points.length) continue;
      context.beginPath(); context.lineCap = "round"; context.lineJoin = "round";
      context.strokeStyle = stroke.color; context.lineWidth = stroke.width;
      stroke.points.forEach((point, index) => index ? context.lineTo(point.x * box.width, point.y * box.height) : context.moveTo(point.x * box.width, point.y * box.height));
      context.stroke();
    }
  }, [draft]);
  useEffect(() => { if (!draft) return; draw(); const resize = new ResizeObserver(draw); if (canvasRef.current) resize.observe(canvasRef.current); return () => resize.disconnect(); }, [draft, draw, inkMode]);
  function point(event: PointerEvent<HTMLCanvasElement>): Point { const rect = event.currentTarget.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)) }; }
  function startInk(event: PointerEvent<HTMLCanvasElement>) { if (!inkMode) return; event.currentTarget.setPointerCapture(event.pointerId); activeStroke.current = { color: inkColor, width: inkWidth, points: [point(event)] }; }
  function moveInk(event: PointerEvent<HTMLCanvasElement>) { if (!activeStroke.current) return; activeStroke.current.points.push(point(event)); const canvas = event.currentTarget; const ctx = canvas.getContext("2d"); const points = activeStroke.current.points; if (!ctx || points.length < 2) return; const box = canvas.getBoundingClientRect(); ctx.beginPath(); ctx.strokeStyle = inkColor; ctx.lineWidth = inkWidth; ctx.lineCap = "round"; ctx.moveTo(points[points.length - 2].x * box.width, points[points.length - 2].y * box.height); ctx.lineTo(points[points.length - 1].x * box.width, points[points.length - 1].y * box.height); ctx.stroke(); }
  function endInk() { if (!activeStroke.current || !draft) return; setDraft({ ...draft, strokes: [...(draft.strokes ?? []), activeStroke.current] }); activeStroke.current = null; }

  if (draft) return <section className="nw-editor" aria-label="Note editor">
    <div className="nw-editor-head"><button className="btn btn-secondary" onClick={() => { setDraft(null); setSelected(null); }}>← Notes</button><span>{draft.id ? "EDIT NOTE" : "NEW NOTE"}</span><button className="btn btn-primary" onClick={() => void saveNote()} disabled={busy}>{busy ? "Saving…" : "Save note"}</button></div>
    <div className="nw-editor-tools"><label>Folder<select value={draft.folderId ?? ""} onChange={(e) => setDraft({ ...draft, folderId: e.target.value || null })}><option value="">Unfiled</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label><label>Paper<select value={draft.template ?? "plain"} onChange={(e) => setDraft({ ...draft, template: e.target.value as WorkspaceNote["template"] })}><option value="plain">Plain</option><option value="lined">Lined</option><option value="dotted">Dotted</option></select></label><button className={inkMode ? "is-active" : ""} onClick={() => setInkMode(!inkMode)}>{inkMode ? "✎ Ink on" : "✎ Draw"}</button>{inkMode && <><label>Pen colour<input type="color" value={inkColor} onChange={(e) => setInkColor(e.target.value)} /></label><label>Size<input type="range" min="1" max="9" value={inkWidth} onChange={(e) => setInkWidth(Number(e.target.value))} /></label><button onClick={() => setDraft({ ...draft, strokes: (draft.strokes ?? []).slice(0, -1) })}>Undo ink</button></>}</div>
    <div className={`nw-paper nw-paper--${draft.template ?? "plain"}`}><input className="nw-title" aria-label="Note title" placeholder="Give this note a title" maxLength={200} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /><textarea aria-label="Note content" placeholder="A thought worth keeping..." value={draft.body ?? draft.content ?? ""} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={17} disabled={inkMode} /><canvas ref={canvasRef} aria-label="Drawing canvas" className={inkMode ? "nw-canvas is-inking" : "nw-canvas"} onPointerDown={startInk} onPointerMove={moveInk} onPointerUp={endInk} onPointerCancel={endInk} /></div>
    {draft.id && <div className="nw-editor-foot"><button onClick={() => void updateNote(draft.id, { favorite: !draft.favorite })}>{draft.favorite ? "★ Favourited" : "☆ Favourite"}</button>{draft.trash ? <><button onClick={() => void updateNote(draft.id, { trash: false })}>Restore</button><button className="nw-danger" onClick={() => void deleteForever(draft.id)}>Delete forever</button></> : <button className="nw-danger" onClick={() => void updateNote(draft.id, { trash: true })}>Move to Trash</button>}</div>}
  </section>;

  return <section className="nw-workspace" aria-label="Notes workspace"><div className="nw-heading"><div><span className="eyebrow">YOUR NOTEBOOK</span><h1>Notes</h1><p>Keep the thoughts you want to return to.</p></div><button className="btn btn-primary" onClick={() => setDraft({ id: "", title: "", body: "", folderId: scope !== "all" && scope !== "favorites" && scope !== "trash" ? scope : null, template: "plain", strokes: [] })}>+ New note</button></div>
    <div className="nw-layout"><aside className="nw-sidebar"><button className={`nw-scope ${scope === "all" ? "is-active" : ""}`} onClick={() => setScope("all")}>▤ &nbsp; All notes</button><button className={`nw-scope ${scope === "favorites" ? "is-active" : ""}`} onClick={() => setScope("favorites")}>☆ &nbsp; Favourites</button><div className="nw-folder-title"><span>FOLDERS</span><button aria-label="New folder" onClick={() => setFolderForm({ parentId: "", name: "", color: "#b99279" })}>+</button></div>{folderTree(null)}<button className={`nw-scope ${scope === "trash" ? "is-active" : ""}`} onClick={() => setScope("trash")}>♻ &nbsp; Trash</button>{scope !== "all" && scope !== "favorites" && scope !== "trash" && <button className="nw-delete-folder" onClick={() => { const folder = folders.find((f) => f.id === scope); if (folder) void removeFolder(folder); }}>Delete selected folder</button>}</aside>
      <div className="nw-main"><div className="nw-toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Search notes" placeholder="Search your notes" value={search} onChange={(e) => setSearch(e.target.value)} /></label><select aria-label="Sort notes" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="updated">Recently updated</option><option value="created">Recently created</option><option value="title">Title A–Z</option></select><div className="nw-view"><button className={layout === "grid" ? "is-active" : ""} onClick={() => setLayout("grid")} aria-label="Grid view">▦</button><button className={layout === "list" ? "is-active" : ""} onClick={() => setLayout("list")} aria-label="List view">☷</button></div></div>
      {chosen.length > 0 && <div className="nw-bulk"><span>{chosen.length} selected</span>{scope === "trash" ? <button disabled={busy} onClick={() => void bulk({ trash: false })}>Restore</button> : <><button disabled={busy} onClick={() => void bulk({ favorite: true })}>★ Favourite</button><select aria-label="Move selected notes" defaultValue="" onChange={(e) => { void bulk({ folderId: e.target.value || null }); e.target.value = ""; }}><option value="">Move to folder…</option><option value="unfiled">Unfiled</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><button disabled={busy} onClick={() => void bulk({ trash: true })}>Move to Trash</button></>}<button onClick={() => setChosen([])}>Clear</button></div>}
      <div className="nw-count">{visible.length} {visible.length === 1 ? "note" : "notes"}</div>{visible.length ? <div className={`nw-cards nw-cards--${layout}`}>{visible.map((note) => <article className="nw-card" key={note.id}><label className="nw-check"><input type="checkbox" aria-label={`Select ${note.title}`} checked={chosen.includes(note.id)} onChange={(e) => setChosen(e.target.checked ? [...chosen, note.id] : chosen.filter((id) => id !== note.id))} /></label><button className="nw-card-open" onClick={() => { setDraft(note); setSelected(note); }}><span className={`nw-card-paper nw-card-paper--${note.template ?? "plain"}`}><strong>{note.title}</strong><small>{plainText(note.body ?? note.content ?? "").slice(0, 150) || "A blank page"}</small></span><span className="nw-card-foot"><strong>{note.title}</strong><small>{note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : "New"}</small></span></button><button className="nw-star" aria-label={note.favorite ? `Remove ${note.title} from favourites` : `Add ${note.title} to favourites`} onClick={() => void updateNote(note.id, { favorite: !note.favorite })}>{note.favorite ? "★" : "☆"}</button></article>)}</div> : <div className="nw-empty"><span>✎</span><h2>{scope === "trash" ? "Trash is empty" : search ? "No matching notes" : "A blank page, full of possibility"}</h2><p>{scope === "trash" ? "Notes moved here can be restored." : "Write something you would like to remember."}</p></div>}</div></div>
    {folderForm && <div className="nw-modal-backdrop"><form className="nw-modal" onSubmit={(e) => void createFolder(e)}><h2>{folderForm.parentId ? "New subfolder" : "New folder"}</h2><label>Folder name<input autoFocus maxLength={80} required value={folderForm.name} onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })} /></label><label>Colour<input type="color" value={folderForm.color} onChange={(e) => setFolderForm({ ...folderForm, color: e.target.value })} /></label><div><button type="button" className="btn btn-secondary" onClick={() => setFolderForm(null)}>Cancel</button><button className="btn btn-primary" disabled={busy}>Create folder</button></div></form></div>}
  </section>;
}
