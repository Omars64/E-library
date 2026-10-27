"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import styles from "./login.module.css";

type LoginResponse = { user?: { role: string }; error?: string; message?: string };

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const result = (await response.json().catch(() => ({}))) as LoginResponse;
      if (!response.ok) {
        setError(result.error || result.message || "We couldn't sign you in. Check your details and try again.");
        return;
      }
      window.location.assign(result.user?.role?.toLowerCase() === "admin" ? "/admin" : "/");
    } catch {
      setError("We couldn't reach E-library. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.glow} aria-hidden="true" />
      <section className={styles.intro} aria-label="About E-library">
        <div className={styles.wordmark}><Image className={styles.mark} src="/e-library-logo.png" alt="" width={40} height={40} priority /> E-library</div>
        <p className={styles.eyebrow}>A quiet place for everything worth keeping</p>
        <h1>Where reading<br /><em>becomes yours.</em></h1>
        <p className={styles.description}>Keep your books, favourite passages, notes, and reflections together. Your library follows you from desktop to phone.</p>
        <div className={styles.coverStack} aria-hidden="true">
          <div className={styles.coverBack} />
          <div className={styles.coverFront}><span>THE SPACE<br />BETWEEN<br />PAGES</span><small>E-LIBRARY</small></div>
        </div>
      </section>

      <section className={styles.loginPanel} aria-labelledby="login-title">
        <div className={styles.panelTop}><span className={styles.panelIcon} aria-hidden="true">✦</span><span>PRIVATE LIBRARY</span></div>
        <h2 id="login-title">Welcome back</h2>
        <p className={styles.panelDescription}>Sign in to pick up where you left off.</p>
        <form onSubmit={submit} noValidate>
          <label htmlFor="identifier">Email or username</label>
          <input id="identifier" name="identifier" type="text" autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required maxLength={254} placeholder="you@example.com" disabled={pending} />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Enter your password" disabled={pending} />
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.submit} type="submit" disabled={pending || !identifier.trim() || !password}>{pending ? "Signing in…" : "Enter my library"}<span aria-hidden="true">→</span></button>
        </form>
        <p className={styles.accessNote}>Access is by invitation. Contact your E-library administrator if you need an account.</p>
      </section>
    </main>
  );
}
