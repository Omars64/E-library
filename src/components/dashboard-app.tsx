"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { upload } from "@vercel/blob/client";
import Image from "next/image";
import { BookCover, BOOK_PALETTES } from "./book-cover";
import { PdfReader } from "./pdf-reader";
import { CustomSection } from "./custom-section";
import { NotesWorkspace } from "./notes-workspace";

type View = "overview" | "duas" | "hadiths" | "quotes" | "books" | "reader" | "notes" | "collections";
type User = { id: string; email: string; username: string; role: string };
type CatalogItem = { id: string; kind?: string; title: string; text?: string; body?: string; arabic?: string; source?: string; author?: string; category?: string; isFavorite?: boolean; favorite?: boolean };
type Book = { id: string; title: string; author?: string | null; description?: string | null; palette?: string; coverColor?: string; filename?: string; fileName?: string; format?: string; fileType?: string; mimeType?: string; fileUrl?: string; url?: string; createdAt?: string };
type Note = { id: string; title: string; body?: string; content?: string; updatedAt?: string; createdAt?: string; favorite?: boolean; folderId?: string | null; trashedAt?: string | null };
type Collection = { id: string; name: string; description?: string | null; itemCount?: number; items?: { id: string; title?: string; kind?: string }[] };

const NAV: { id: View; label: string; icon: string; group: "explore" | "personal" }[] = [
  { id: "overview", label: "Overview", icon: "◫", group: "explore" },
  { id: "duas", label: "Duas", icon: "✦", group: "explore" },
  { id: "hadiths", label: "Hadiths", icon: "❝", group: "explore" },
  { id: "quotes", label: "Quotes", icon: "❞", group: "explore" },
  { id: "books", label: "Books", icon: "▥", group: "explore" },
  { id: "reader", label: "PDF Reader", icon: "▤", group: "personal" },
  { id: "notes", label: "Notes", icon: "✎", group: "personal" },
  { id: "collections", label: "Collections", icon: "▰", group: "personal" },
];

const descriptions: Record<View, string> = {
  overview: "A calmer place to read, collect, and remember.",
  duas: "Words to return to, whenever you need them.",
  hadiths: "Wisdom to read with context and carry into the day.",
  quotes: "Small lines that stay with you.",
  books: "Your own shelf, shaped by what you love to read.",
  reader: "Settle into your reading and keep a thought close by.",
  notes: "A home for the ideas that deserve another look.",
  collections: "Gather the things that mean something to you.",
};

function unpack<T>(value: unknown, keys: string[]): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of keys) if (Array.isArray(record[key])) return record[key] as T[];
    if (record.data) return unpack<T>(record.data, keys);
  }
  return [];
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", ...options });
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("Your session expired. Please sign in again.");
  }
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.error || json?.message || "Something went wrong. Please try again.");
  return json as T;
}

function formatDate(value?: string) {
  if (!value) return "Recently updated";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Recently updated" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function DashboardApp() {
  const [view, setView] = useState<View>("overview");
  const [navigationReady, setNavigationReady] = useState(false);
  const [customSections, setCustomSections] = useState<string[]>([]);
  useEffect(() => {
    const restore = () => { const value = decodeURIComponent(window.location.hash.slice(1)).split("/")[0]; if (NAV.some((item) => item.id === value) || value.startsWith("custom:")) setView(value as View); else setView("overview"); };
    restore(); setNavigationReady(true);
    window.addEventListener("hashchange", restore);
    void fetch("/api/preferences").then(async (r) => { if (r.ok) setCustomSections((await r.json()).sections); }).catch(() => {});
    return () => window.removeEventListener("hashchange", restore);
  }, []);
  useEffect(() => { if (navigationReady) window.history.replaceState(null, "", "#" + encodeURIComponent(view)); }, [view, navigationReady]);
  const [user, setUser] = useState<User | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [catalog, setCatalog] = useState<Record<string, CatalogItem[]>>({ duas: [], hadiths: [], quotes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All topics");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const reload = useCallback(async () => {
    const [meResult, booksResult, notesResult, collectionsResult, duasResult, hadithsResult, quotesResult] = await Promise.allSettled([
      request<{ user?: User } | User>("/api/me"),
      request<unknown>("/api/books"),
      request<unknown>("/api/notes"),
      request<unknown>("/api/collections"),
      request<unknown>("/api/catalog?kind=duas"),
      request<unknown>("/api/catalog?kind=hadiths"),
      request<unknown>("/api/catalog?kind=quotes"),
    ]);
    if (meResult.status === "fulfilled") {
      const data = meResult.value;
      setUser("user" in data ? data.user ?? null : data as User);
    }
    if (booksResult.status === "fulfilled") setBooks(unpack<Book>(booksResult.value, ["books", "items"]));
    if (notesResult.status === "fulfilled") setNotes(unpack<Note>(notesResult.value, ["notes", "items"]));
    if (collectionsResult.status === "fulfilled") setCollections(unpack<Collection>(collectionsResult.value, ["collections", "items"]));
    setCatalog({
      duas: duasResult.status === "fulfilled" ? unpack<CatalogItem>(duasResult.value, ["items", "entries", "catalog"]) : [],
      hadiths: hadithsResult.status === "fulfilled" ? unpack<CatalogItem>(hadithsResult.value, ["items", "entries", "catalog"]) : [],
      quotes: quotesResult.status === "fulfilled" ? unpack<CatalogItem>(quotesResult.value, ["items", "entries", "catalog"]) : [],
    });
    const failures = [meResult, booksResult, notesResult, collectionsResult, duasResult, hadithsResult, quotesResult].filter((r) => r.status === "rejected");
    if (failures.length && failures.length < 7) setError("Some library content could not load. Refresh to try again.");
    else if (failures.length === 7) setError("The library could not load. Please refresh the page.");
    else setError("");
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const saved = localStorage.getItem("elibrary-theme");
    if (saved === "light") setTheme("light");
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("elibrary-theme", theme); }, [theme]);
  useEffect(() => { setSearch(""); setCategory("All topics"); setMobileOpen(false); }, [view]);
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(""), 4500); return () => window.clearTimeout(id); }, [notice]);
  useEffect(() => {
    if (!accountMenuOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountMenuOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);

  useEffect(() => { if (!selectedBook && books.length) { const id = localStorage.getItem("elibrary-last-book"); setSelectedBook(books.find((book) => book.id === id) ?? null); } }, [books, selectedBook]);
  const entries = catalog[view] ?? [];
  const categories = useMemo(() => ["All topics", ...new Set(entries.map((item) => item.category).filter((x): x is string => Boolean(x)))], [entries]);
  const filteredEntries = entries.filter((item) =>
    (category === "All topics" || item.category === category) &&
    `${item.title} ${item.text ?? item.body ?? ""} ${item.source ?? ""} ${item.author ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredBooks = books.filter((book) => `${book.title} ${book.author ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const filteredNotes = notes.filter((note) => !note.trashedAt && `${note.title} ${note.body ?? note.content ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  async function logout() {
    try { await request("/api/auth/logout", { method: "POST" }); } catch { /* redirect anyway */ }
    window.location.assign("/login");
  }

  function openBook(book: Book) { setSelectedBook(book); localStorage.setItem("elibrary-last-book", book.id); setView("reader"); }
  function openNote(note: Note) { setSelectedNote(note); setView("notes"); }
  function showError(message: string) { setNotice(message); }

  return (
    <div className="app-shell">
      {mobileOpen && <button className="nav-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "sidebar--open" : ""}`} aria-label="Main navigation">
        <div className="sidebar-brand"><Image className="brand-logo" src="/e-library-logo.png" alt="" width={40} height={40} priority /><span><strong>E-library</strong><small>READ · REFLECT · REMEMBER</small></span></div>
        <div className="sidebar-section-label">EXPLORE</div>
        <nav>{NAV.filter((item) => item.group === "explore").map((item) => <button key={item.id} className={`nav-item ${view === item.id ? "nav-item--active" : ""}`} onClick={() => setView(item.id)} aria-current={view === item.id ? "page" : undefined}><span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
        <div className="sidebar-section-label">YOUR SPACE</div>
        <nav>{NAV.filter((item) => item.group === "personal").map((item) => <button key={item.id} className={`nav-item ${view === item.id ? "nav-item--active" : ""}`} onClick={() => setView(item.id)} aria-current={view === item.id ? "page" : undefined}><span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
        {customSections.length > 0 && <><div className="sidebar-section-label">PERSONAL SECTIONS</div><nav>{customSections.map((section) => <button key={section} className={`nav-item ${String(view) === `custom:${section}` ? "nav-item--active" : ""}`} onClick={() => setView(`custom:${section}` as View)}><span className="nav-icon" aria-hidden="true">◇</span>{section}</button>)}</nav></>}
        <div className="sidebar-bottom"><div className="sidebar-quote"><span>“</span><p>A little knowledge.<br />A lasting light.</p></div></div>
      </aside>
      <div className="app-main">
        <header className="topbar"><button className="topbar-menu" aria-label="Open menu" onClick={() => setMobileOpen(true)}>☰</button><Image className="topbar-logo" src="/e-library-logo.png" alt="E-library" width={28} height={28} /><div className="topbar-path"><span>YOUR LIBRARY</span><b>/</b><strong>{NAV.find((item) => item.id === view)?.label || String(view).replace("custom:", "")}</strong></div><div className="topbar-actions"><span className="sync-indicator"><i />Your space, in sync</span><div className="account-menu-wrap" ref={accountMenuRef}><button className="avatar-button" type="button" title={user ? `${user.username} · ${user.email}` : "Account"} aria-label="Open account menu" aria-expanded={accountMenuOpen} aria-controls="account-menu" onClick={() => setAccountMenuOpen((open) => !open)}>{user?.username?.slice(0, 2).toUpperCase() || "EL"}</button>{accountMenuOpen && <div className="account-menu" id="account-menu"><div className="account-menu__identity"><strong>{user?.username || "Reader"}</strong><small>{user?.email}</small></div><button type="button" onClick={() => { setTheme(theme === "dark" ? "light" : "dark"); setAccountMenuOpen(false); }}><span aria-hidden="true">◐</span>{theme === "dark" ? "Light appearance" : "Dark appearance"}</button><a href="/settings"><span aria-hidden="true">⚙</span>Settings</a>{user?.role?.split(",").includes("admin") && <a href="/admin"><span aria-hidden="true">⚙</span>Admin studio</a>}<button type="button" onClick={() => void logout()}><span aria-hidden="true">↪</span>Sign out</button></div>}</div></div></header>
        <main className="content-wrap">
          {error && <div className="status-banner status-banner--error" role="alert">{error}<button onClick={() => void reload()}>Retry</button></div>}
          {notice && <div className="status-banner" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
          {loading ? <div className="loading-state" role="status">Opening your library<span className="loading-dots">...</span></div> : <>
            {String(view).startsWith("custom:") && <CustomSection key={view} name={String(view).slice(7)} />}{view === "overview" && <Overview user={user} books={books} notes={notes} onNavigate={setView} onAddBook={() => setUploadOpen(true)} onOpenBook={openBook} onOpenNote={openNote} />}
            {(["duas", "hadiths", "quotes"] as View[]).includes(view) && <CatalogPage kind={view} items={filteredEntries} categories={categories} category={category} setCategory={setCategory} search={search} setSearch={setSearch} onReflect={(item) => { setSelectedNote({ id: "", title: `Reflection: ${item.title}`, body: `${item.title}\n${item.source || item.author || ""}\n\nMy reflection:\n` }); setView("notes"); }} onError={showError} onChanged={() => void reload()} collections={collections} />}
            {view === "books" && <BooksPage books={filteredBooks} search={search} setSearch={setSearch} onAdd={() => setUploadOpen(true)} onOpen={openBook} />}
            {view === "reader" && <ReaderPage book={selectedBook} books={books} onChooseBook={openBook} onBrowse={() => setView("books")} onMakeNote={(text) => { setSelectedNote({ id: "", title: `Reading: ${selectedBook?.title || "My book"}`, body: text }); setView("notes"); }} />}
            {view === "notes" && <NotesWorkspace notes={notes} selected={selectedNote} setSelected={setSelectedNote} onChanged={() => void reload()} onError={showError} />}
            {view === "collections" && <CollectionsPage collections={collections} onAdd={() => setCollectionOpen(true)} onChanged={() => void reload()} onError={showError} />}
          </>}
          <footer className="app-footer"><span>E-Library (by Omar Solanki) © {new Date().getFullYear()}. All Rights Reserved.</span></footer>
        </main>
      </div>
      {uploadOpen && <UploadBookDialog onClose={() => setUploadOpen(false)} onSuccess={() => { setUploadOpen(false); setNotice("Book added to your shelf."); void reload(); setView("books"); }} />}
      {collectionOpen && <CollectionDialog onClose={() => setCollectionOpen(false)} onSuccess={() => { setCollectionOpen(false); setNotice("Collection created."); void reload(); }} />}
    </div>
  );
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="page-header-action">{action}</div>}</div>;
}

function Overview({ user, books, notes, onNavigate, onAddBook, onOpenBook, onOpenNote }: { user: User | null; books: Book[]; notes: Note[]; onNavigate: (view: View) => void; onAddBook: () => void; onOpenBook: (book: Book) => void; onOpenNote: (note: Note) => void }) {
  return <>
    <div className="overview-hero"><div className="overview-hero__copy"><div className="eyebrow">WELCOME BACK{user?.username ? `, ${user.username.toUpperCase()}` : ""}</div><h1>Keep what moves you.<br /><em>Return when you need it.</em></h1><p>Books, words, and reflections gathered in one quiet corner that feels like yours.</p><div className="hero-actions"><button className="btn btn-primary" onClick={() => onNavigate("books")}>Explore your books <span aria-hidden="true">↗</span></button><button className="btn btn-ghost" onClick={onAddBook}>+ Add a book</button></div></div><div className="hero-art" aria-hidden="true"><div className="hero-orbit" /><div className="hero-art-book hero-art-book--back" /><div className="hero-art-book"><span>✦</span><strong>THE ART<br />OF READING</strong><small>E-LIBRARY</small></div></div></div>
    <div className="section-title"><div><div className="eyebrow">YOUR READING SPACE</div><h2>Where would you like to begin?</h2></div></div>
    <div className="feature-grid">{[
      ["duas", "✦", "Duas", "Words to return to."], ["hadiths", "❝", "Hadiths", "Wisdom with context."], ["quotes", "❞", "Quotes", "Lines worth keeping."], ["books", "▥", "Books", "Your personal shelf."], ["notes", "✎", "Notes", "Thoughts in your own words."],
    ].map(([id, icon, title, subtitle]) => <button key={id} className="feature-card" onClick={() => onNavigate(id as View)}><span className="feature-card__icon" aria-hidden="true">{icon}</span><strong>{title}</strong><small>{subtitle}</small><span className="feature-card__arrow" aria-hidden="true">↗</span></button>)}</div>
    <div className="section-title"><div><div className="eyebrow">PICK UP WHERE YOU LEFT OFF</div><h2>Close to hand</h2></div></div>
    <div className="recent-grid"><div className="recent-panel"><div className="recent-panel__heading"><h3>On your shelf</h3><button onClick={() => onNavigate("books")}>View all ↗</button></div>{books.length ? books.slice(0, 2).map((book) => <button key={book.id} className="recent-book" onClick={() => onOpenBook(book)}><BookCover title={book.title} author={book.author} palette={book.palette || book.coverColor} compact /><span><strong>{book.title}</strong><small>{book.author || "Your book"}</small><b>Open reader ↗</b></span></button>) : <div className="recent-empty"><p>Your shelf is ready for its first story.</p><button className="btn btn-secondary" onClick={onAddBook}>Add your first book</button></div>}</div><div className="recent-panel"><div className="recent-panel__heading"><h3>Your reflections</h3><button onClick={() => onNavigate("notes")}>View all ↗</button></div>{notes.filter((note) => !note.trashedAt).slice(0, 3).map((note) => <button className="recent-note" key={note.id} onClick={() => onOpenNote(note)}><span aria-hidden="true">✎</span><span><strong>{note.title}</strong><small>{formatDate(note.updatedAt || note.createdAt)}</small></span><b aria-hidden="true">↗</b></button>)}{!notes.length && <div className="recent-empty"><p>One thought can become a whole page.</p><button className="btn btn-secondary" onClick={() => onNavigate("notes")}>Write a note</button></div>}</div></div>
  </>;
}

function CatalogPage({ kind, items, categories, category, setCategory, search, setSearch, onReflect, onError, onChanged, collections }: { kind: View; items: CatalogItem[]; categories: string[]; category: string; setCategory: (value: string) => void; search: string; setSearch: (value: string) => void; onReflect: (item: CatalogItem) => void; onError: (value: string) => void; onChanged: () => void; collections: Collection[] }) {
  const title = kind === "duas" ? "Duas" : kind === "hadiths" ? "Hadiths" : "Quotes";
  const [collecting, setCollecting] = useState<CatalogItem | null>(null);
  async function favorite(item: CatalogItem) {
    try { await request("/api/favorites", { method: item.isFavorite || item.favorite ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, itemId: item.id }) }); onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : "Could not save this item."); }
  }
  return <>
    <PageHeader eyebrow="THE LIBRARY" title={title} description={descriptions[kind]} />
    <div className="toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${title.toLowerCase()}, topics, or sources`} aria-label={`Search ${title}`} /></label><span className="result-count">{items.length} {items.length === 1 ? "result" : "results"}</span></div>
    {categories.length > 1 && <div className="filter-row" aria-label="Filter topics">{categories.map((item) => <button className={`filter-chip ${category === item ? "filter-chip--active" : ""}`} key={item} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>)}</div>}
    {items.length ? <div className="catalog-grid">{items.map((item) => <article className="catalog-card" key={item.id}><div className="catalog-card__meta"><span>{item.category || title}</span><button className={`icon-action ${item.isFavorite || item.favorite ? "icon-action--active" : ""}`} aria-label={`${item.isFavorite || item.favorite ? "Remove" : "Add"} ${item.title} ${item.isFavorite || item.favorite ? "from" : "to"} favourites`} onClick={() => void favorite(item)}>{item.isFavorite || item.favorite ? "★" : "☆"}</button></div>{item.arabic && <p className="catalog-card__arabic" lang="ar" dir="rtl">{item.arabic}</p>}<h3>{item.title}</h3><p className="catalog-card__text">{item.text || item.body}</p><div className="catalog-card__footer"><small>{item.source || item.author || "E-library"}</small><button onClick={() => setCollecting(item)}>Collect</button><button onClick={() => onReflect(item)}>Reflect ↗</button></div></article>)}</div> : <EmptyState title="Nothing here yet" text={search ? "Try a different search or topic." : "This shelf is waiting for its first entry."} />}
    {collecting && <CollectDialog item={collecting} collections={collections} onClose={() => setCollecting(null)} onError={onError} onSuccess={() => { setCollecting(null); onChanged(); }} />}
  </>;
}

function BooksPage({ books, search, setSearch, onAdd, onOpen }: { books: Book[]; search: string; setSearch: (value: string) => void; onAdd: () => void; onOpen: (book: Book) => void }) {
  return <><PageHeader eyebrow="YOUR READING SPACE" title="Books" description={descriptions.books} action={<button className="btn btn-primary" onClick={onAdd}>+ Add a book</button>} /><div className="toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your books or authors" aria-label="Search books" /></label><span className="result-count">{books.length} {books.length === 1 ? "book" : "books"}</span></div>{books.length ? <div className="book-grid">{books.map((book) => <article className="book-card" key={book.id}><button className="book-card__cover" onClick={() => onOpen(book)} aria-label={`Read ${book.title}`}><BookCover title={book.title} author={book.author} palette={book.palette || book.coverColor} /></button><div className="book-card__details"><span className="eyebrow">{(book.fileType || book.mimeType || book.fileName || "PDF").toLowerCase().includes("word") || book.fileName?.toLowerCase().endsWith(".docx") ? "WORD DOCUMENT" : "YOUR BOOK"}</span><h3>{book.title}</h3><p>{book.author || "Personal library"}</p><button className="book-card__read" onClick={() => onOpen(book)}>Open book <span aria-hidden="true">↗</span></button></div></article>)}</div> : <EmptyState title={search ? "No books match your search" : "Your shelf starts here"} text={search ? "Try another title or author." : "Upload a PDF or Word document and choose a cover that feels like yours."} action={!search && <button className="btn btn-primary" onClick={onAdd}>Add your first book</button>} />}</>;
}

function ReaderPage({ book, books, onChooseBook, onBrowse, onMakeNote }: { book: Book | null; books: Book[]; onChooseBook: (book: Book) => void; onBrowse: () => void; onMakeNote: (text: string) => void }) {
  const [reflection, setReflection] = useState("");
  const url = book?.fileUrl || book?.url || (book ? `/api/books/${encodeURIComponent(book.id)}/file` : "");
  const isWord = Boolean(book && (book.format === "docx" || book.filename?.toLowerCase().endsWith(".docx")));
  return <><PageHeader eyebrow="THE READING ROOM" title="Read without distraction." description={descriptions.reader} action={book && <button className="btn btn-secondary" onClick={onBrowse}>← All books</button>} />{!book ? <div className="reader-empty"><div className="reader-empty__art">▤</div><h2>Your reading room is ready.</h2><p>Choose a book from your shelf to begin.</p>{books.length ? <div className="reader-choices">{books.slice(0, 4).map((item) => <button key={item.id} onClick={() => onChooseBook(item)}><BookCover title={item.title} author={item.author} palette={item.palette || item.coverColor} compact /><strong>{item.title}</strong></button>)}</div> : <button className="btn btn-primary" onClick={onBrowse}>Browse books</button>}</div> : <div className="reader-shell"><div className="reader-main"><div className="reader-toolbar"><span className="reader-toolbar__title">{book.title}</span><span className="reader-toolbar__spacer" /><a href={url} target="_blank" rel="noopener noreferrer">Open in new tab ↗</a><a href={url} download={book.fileName || book.title}>Download ↓</a></div>{isWord ? <div className="word-preview"><BookCover title={book.title} author={book.author} palette={book.palette || book.coverColor} compact /><h2>{book.title}</h2><p>Word documents can be opened or downloaded from here.</p><a className="btn btn-primary" href={url} target="_blank" rel="noopener noreferrer">Open document ↗</a></div> : <PdfReader key={book.id} url={url} />}</div><aside className="reader-reflection"><div className="eyebrow">A SPACE TO PAUSE</div><h2>What stayed<br />with you?</h2><p>Keep a small thought from this reading. Turn it into a note when you&apos;re ready.</p><label htmlFor="reader-reflection-input">Your reflection</label><textarea id="reader-reflection-input" value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="A thought worth keeping..." rows={9} /><button className="btn btn-primary" onClick={() => { if (reflection.trim()) { onMakeNote(reflection.trim()); setReflection(""); } }} disabled={!reflection.trim()}>Turn into a note ↗</button></aside></div>}</>;
}

function NotesPage({ notes, selected, setSelected, search, setSearch, onChanged, onError }: { notes: Note[]; selected: Note | null; setSelected: (value: Note | null) => void; search: string; setSearch: (value: string) => void; onChanged: () => void; onError: (value: string) => void }) {
  const [draft, setDraft] = useState<Note | null>(selected);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(selected); }, [selected]);
  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const body = { title: draft.title.trim() || "Untitled note", body: draft.body ?? draft.content ?? "" };
      await request(`/api/notes${draft.id ? `/${encodeURIComponent(draft.id)}` : ""}`, { method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      onChanged(); setSelected(null); setDraft(null);
    } catch (error) { onError(error instanceof Error ? error.message : "Could not save note."); }
    finally { setSaving(false); }
  }
  if (draft) return <><PageHeader eyebrow="YOUR NOTEBOOK" title={draft.id ? "Edit note" : "New note"} description="Keep a thought in your own words." action={<button className="btn btn-secondary" onClick={() => { setSelected(null); setDraft(null); }}>← All notes</button>} /><div className="note-editor"><div className="note-editor__bar"><span>✎ &nbsp; Your notebook</span><span className="note-editor__bar-spacer" /><span>{draft.body?.trim().split(/\s+/).filter(Boolean).length || 0} words</span></div><div className="note-paper"><input aria-label="Note title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Give this note a title" maxLength={200} /><textarea aria-label="Note content" value={draft.body ?? draft.content ?? ""} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="A thought worth keeping..." rows={18} /></div><div className="note-editor__footer"><span>Private to your account</span><button className="btn btn-primary" onClick={() => void save()} disabled={saving}>{saving ? "Saving..." : "Save note"}</button></div></div></>;
  return <><PageHeader eyebrow="YOUR NOTEBOOK" title="Notes" description={descriptions.notes} action={<button className="btn btn-primary" onClick={() => setDraft({ id: "", title: "", body: "" })}>+ New note</button>} /><div className="toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your notes" aria-label="Search notes" /></label><span className="result-count">{notes.length} {notes.length === 1 ? "note" : "notes"}</span></div>{notes.length ? <div className="notes-grid">{notes.map((note, index) => <button className="note-card" key={note.id} onClick={() => setDraft(note)}><span className={`note-card__paper note-card__paper--${index % 3}`}><strong>{note.title}</strong><span>{(note.body || note.content || "").replace(/<[^>]+>/g, " ").slice(0, 180)}</span></span><span className="note-card__meta"><strong>{note.title}</strong><small>{formatDate(note.updatedAt || note.createdAt)}</small></span></button>)}</div> : <EmptyState title={search ? "No notes match your search" : "A blank page, full of possibility"} text={search ? "Try another word." : "Your reflections will be here when you need them."} action={!search && <button className="btn btn-primary" onClick={() => setDraft({ id: "", title: "", body: "" })}>Write your first note</button>} />}</>;
}

function CollectionsPage({ collections, onAdd, onChanged, onError }: { collections: Collection[]; onAdd: () => void; onChanged: () => void; onError: (value: string) => void }) {
  const [active, setActive] = useState<Collection | null>(null);
  async function remove(collection: Collection) {
    if (!window.confirm(`Delete “${collection.name}”? Items in your library will stay.`)) return;
    try { await request(`/api/collections/${encodeURIComponent(collection.id)}`, { method: "DELETE" }); setActive(null); onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : "Could not delete collection."); }
  }
  return <><PageHeader eyebrow="MAKE IT YOURS" title="Collections" description={descriptions.collections} action={<button className="btn btn-primary" onClick={onAdd}>+ New collection</button>} />{collections.length ? <><div className="collections-grid">{collections.map((collection) => <button className={`collection-card ${active?.id === collection.id ? "collection-card--active" : ""}`} key={collection.id} onClick={() => setActive(collection)}><span className="collection-card__icon" aria-hidden="true">▰</span><strong>{collection.name}</strong><small>{collection.itemCount ?? collection.items?.length ?? 0} saved items</small><span className="collection-card__arrow" aria-hidden="true">↗</span></button>)}</div>{active && <div className="collection-detail"><div><div className="eyebrow">YOUR COLLECTION</div><h2>{active.name}</h2><p>{active.description || "A space for the things you want to keep together."}</p></div><button className="btn btn-secondary" onClick={() => void remove(active)}>Delete collection</button><div className="collection-detail__items">{active.items?.length ? active.items.map((item) => <div key={item.id}>{item.title || item.id}<small>{item.kind || "Saved item"}</small></div>) : <p>Save a dua, hadith, or quote into this collection to see it here.</p>}</div></div>}</> : <EmptyState title="Make space for what matters" text="Create a collection for your favourite words and reading." action={<button className="btn btn-primary" onClick={onAdd}>Create a collection</button>} />}</>;
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) { return <div className="empty-state"><span className="empty-state__icon" aria-hidden="true">✦</span><h2>{title}</h2><p>{text}</p>{action}</div>; }

function UploadBookDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [palette, setPalette] = useState<string>(BOOK_PALETTES[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function chooseFile(selected?: File) {
    if (!selected) return;
    const valid = /\.pdf$|\.docx$/i.test(selected.name) && ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ""].includes(selected.type);
    if (!valid) { setError("Choose a PDF or Word (.docx) document."); return; }
    setError(""); setFile(selected); if (!title) setTitle(selected.name.replace(/\.(pdf|docx)$/i, "").replace(/[-_]+/g, " "));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) { setError("Choose a PDF or Word document first."); return; }
    if (!title.trim()) { setError("Give your book a title."); return; }
    setBusy(true); setError("");
      try {
        const mimeType = file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        const created = await request<{ book: { id: string }; uploadPath: string }>("/api/books", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), author: author.trim(), description: description.trim(), palette, filename: file.name, mimeType, byteSize: file.size }) });
        await upload(created.uploadPath, file, { access: "private", handleUploadUrl: "/api/books/upload", clientPayload: created.book.id, contentType: mimeType });
        let ready = false;
        for (let attempt = 0; attempt < 12; attempt++) {
          const status = await request<{ book: { status: string } }>(`/api/books/${created.book.id}`);
          if (status.book.status === "ready") { ready = true; break; }
          if (status.book.status === "rejected") throw new Error("The document was rejected. Check that it is a valid PDF or DOCX file.");
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        if (!ready) throw new Error("Upload is still processing. Refresh your shelf shortly.");
        onSuccess();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="upload-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal__header"><div><div className="eyebrow">YOUR PERSONAL SHELF</div><h2 id="upload-title">Add a book</h2></div><button className="modal__close" onClick={onClose} aria-label="Close">×</button></div><p className="modal__intro">Bring a PDF or Word document into your library, then give it a cover of its own.</p><form onSubmit={(event) => void submit(event)}><div className="upload-layout"><div className="upload-fields"><label className="upload-zone"><input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => chooseFile(event.target.files?.[0])} /><span aria-hidden="true">↑</span><strong>{file ? file.name : "Choose a document"}</strong><small>PDF or Word (.docx)</small></label><label className="field">Book title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder="A title for your shelf" /></label><label className="field">Author <span>(optional)</span><input value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={120} placeholder="Who wrote it?" /></label><label className="field">Description <span>(optional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={3} placeholder="A little note about this book" /></label></div><div className="upload-preview"><div className="eyebrow">COVER PREVIEW</div><BookCover title={title || "Your book title"} author={author} palette={palette} /><fieldset className="palette-picker"><legend>Choose a cover colour</legend><div>{BOOK_PALETTES.map((item) => <label key={item.id} title={item.label}><input type="radio" name="palette" value={item.id} checked={palette === item.id} onChange={() => setPalette(item.id)} /><span className="palette-swatch" style={{ background: `linear-gradient(135deg, ${item.base}, ${item.light})` }} /><span className="sr-only">{item.label}</span></label>)}</div><small>{BOOK_PALETTES.find((item) => item.id === palette)?.label}</small></fieldset></div></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal__actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Adding book..." : "Add to my shelf"}</button></div></form></div></div>;
}

function CollectionDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { await request("/api/collections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), description: description.trim() }) }); onSuccess(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create collection."); } finally { setBusy(false); } }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="collection-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal__header"><div><div className="eyebrow">MAKE IT YOURS</div><h2 id="collection-title">New collection</h2></div><button className="modal__close" onClick={onClose} aria-label="Close">×</button></div><p className="modal__intro">Give your favourite words and readings a place together.</p><form onSubmit={(event) => void submit(event)}><label className="field">Collection name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} placeholder="e.g. Morning reflections" autoFocus /></label><label className="field">Description <span>(optional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} rows={3} placeholder="What belongs here?" /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal__actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? "Creating..." : "Create collection"}</button></div></form></div></div>;
}

function CollectDialog({ item, collections, onClose, onSuccess, onError }: { item: CatalogItem; collections: Collection[]; onClose: () => void; onSuccess: () => void; onError: (value: string) => void }) {
  const [selected, setSelected] = useState(""); const [busy, setBusy] = useState(false);
    async function submit(event: FormEvent) { event.preventDefault(); if (!selected) return; setBusy(true); try { await request(`/api/collections/${encodeURIComponent(selected)}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id, kind: item.kind }) }); onSuccess(); } catch (cause) { onError(cause instanceof Error ? cause.message : "Could not add to collection."); } finally { setBusy(false); } }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="collect-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal__header"><div><div className="eyebrow">SAVE FOR LATER</div><h2 id="collect-title">Add to collection</h2></div><button className="modal__close" onClick={onClose} aria-label="Close">×</button></div><p className="modal__intro">{item.title}</p>{collections.length ? <form onSubmit={(event) => void submit(event)}><label className="field">Choose a collection<select value={selected} onChange={(event) => setSelected(event.target.value)} required><option value="">Select collection</option>{collections.map((collection) => <option value={collection.id} key={collection.id}>{collection.name}</option>)}</select></label><div className="modal__actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!selected || busy}>{busy ? "Saving..." : "Add item"}</button></div></form> : <p className="modal__intro">Create a collection first to save this item.</p>}</div></div>;
}
