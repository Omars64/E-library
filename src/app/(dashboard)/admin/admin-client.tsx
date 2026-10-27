"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import styles from "./admin.module.css";

type User = { id: string; email: string; username: string; name?: string | null; role: string; createdAt: string };
type UserResult = { users?: User[]; user?: User; error?: string; message?: string };

const hasSpecialCharacter = (value: string) => /[^A-Za-z0-9\s]/.test(value);

export default function AdminClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUsers = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/admin/users", { credentials: "same-origin", cache: "no-store", signal });
      if (response.status === 401) { window.location.assign("/login"); return; }
      if (response.status === 403) { setLoadError("Only an administrator can manage accounts."); return; }
      const result = (await response.json().catch(() => ({}))) as UserResult;
      if (!response.ok) throw new Error(result.error || result.message || "Could not load accounts.");
      setUsers(result.users || []);
    } catch (error) {
      if (signal?.aborted) return;
      setLoadError(error instanceof Error ? error.message : "Could not load accounts. Please try again.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadUsers(controller.signal);
    return () => controller.abort();
  }, [loadUsers]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError("");
    setSuccess("");

    const nextEmail = email.trim().toLowerCase();
    const nextUsername = username.trim();
    if (!nextEmail || !nextUsername || !password) { setFormError("Email, username, and password are required."); return; }
    if (password.length < 8 || !hasSpecialCharacter(password)) { setFormError("Use at least 8 characters and one special character in the password."); return; }
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: nextEmail, username: nextUsername, name: name.trim() || nextUsername, password }),
      });
      if (response.status === 401) { window.location.assign("/login"); return; }
      const result = (await response.json().catch(() => ({}))) as UserResult;
      if (!response.ok || !result.user) throw new Error(result.error || result.message || "Could not create this account.");
      setUsers((current) => [result.user!, ...current]);
      setEmail(""); setUsername(""); setName(""); setPassword("");
      setSuccess(`Account created for ${result.user.email}. Share their login details privately.`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not create this account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>E-LIBRARY / ADMINISTRATION</p><h1>People & access</h1><p className={styles.lead}>Invite readers to their own private library. New accounts can only be created here.</p></div>
        <a className={styles.back} href="/">← Back to library</a>
      </header>
      <div className={styles.grid}>
        <section className={styles.panel} aria-labelledby="add-user-title">
          <div className={styles.panelHeading}><span className={styles.icon} aria-hidden="true">＋</span><div><h2 id="add-user-title">Add a reader</h2><p>Create an account with an initial password.</p></div></div>
          <form onSubmit={createUser} noValidate>
            <label htmlFor="new-email">Email address <span>*</span></label>
            <input id="new-email" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} placeholder="reader@example.com" disabled={submitting} />
            <label htmlFor="new-username">Username <span>*</span></label>
            <input id="new-username" type="text" autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={32} pattern="[A-Za-z0-9_.-]+" placeholder="reader_name" disabled={submitting} />
            <label htmlFor="new-name">Display name</label>
            <input id="new-name" type="text" autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Reader's name" disabled={submitting} />
            <label htmlFor="new-password">Initial password <span>*</span></label>
            <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} placeholder="8+ characters, one special character" disabled={submitting} />
            <p className={styles.hint}>The password is sent only when the account is created and is never shown in the user list.</p>
            {formError && <p className={styles.error} role="alert">{formError}</p>}
            {success && <p className={styles.success} role="status">{success}</p>}
            <button className={styles.submit} type="submit" disabled={submitting}>{submitting ? "Creating account…" : "Create reader account"}<span aria-hidden="true">→</span></button>
          </form>
        </section>

        <section className={styles.panel} aria-labelledby="users-title">
          <div className={styles.listHeading}><div><p className={styles.eyebrow}>YOUR COMMUNITY</p><h2 id="users-title">Reader accounts <span>{users.length}</span></h2></div><button type="button" onClick={() => void loadUsers()} disabled={loading} className={styles.refresh}>Refresh</button></div>
          {loading && <p className={styles.state} role="status">Loading accounts…</p>}
          {loadError && <div className={styles.error} role="alert">{loadError}<button type="button" onClick={() => void loadUsers()}>Try again</button></div>}
          {!loading && !loadError && users.length === 0 && <p className={styles.state}>No reader accounts yet. Create the first one using the form.</p>}
          {!loading && !loadError && users.length > 0 && <ul className={styles.userList}>{users.map((user) => <li key={user.id} className={styles.userRow}><span className={styles.avatar} aria-hidden="true">{(user.name || user.username || user.email).slice(0, 1).toUpperCase()}</span><span className={styles.userInfo}><strong>{user.name || user.username}</strong><small>{user.email} · @{user.username}</small></span><span className={styles.role}>{user.role.toLowerCase() === "admin" ? "Admin" : "Reader"}</span></li>)}</ul>}
        </section>
      </div>
    </main>
  );
}
