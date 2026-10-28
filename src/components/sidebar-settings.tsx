"use client";
import { useEffect, useState } from "react";
export function SidebarSettings() {
  const [sections, setSections] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => { void fetch("/api/preferences").then(async (r) => { if (!r.ok) throw new Error("Could not load your sections."); setSections((await r.json()).sections); }).catch((e) => setError(e.message)).finally(() => setBusy(false)); }, []);
  async function save(next: string[]) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sections: next }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save sections.");
      setSections(result.sections); setName("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save sections."); }
    finally { setBusy(false); }
  }
  return <details className="settings-group"><summary>Sidebar sections</summary><p>Add personal spaces such as Recipes, Travel, or Ideas. Each space keeps its own entries and syncs across your devices.</p><form onSubmit={(e) => { e.preventDefault(); if (name.trim()) void save([...sections, name.trim()]); }}><label>Section name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required placeholder="e.g. Recipes" /></label><button className="btn btn-primary" disabled={busy || !name.trim() || sections.length >= 20}>Add section</button></form>{error && <p role="alert">{error}</p>}<ul>{sections.map((section) => <li key={section}>{section} <button className="btn btn-secondary" disabled={busy} onClick={() => void save(sections.filter((s) => s !== section))}>Hide from sidebar</button></li>)}</ul><p>Hiding a section keeps its entries. Add the same name again to restore access.</p></details>;
}
