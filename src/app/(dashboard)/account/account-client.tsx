"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { SidebarSettings } from "@/components/sidebar-settings";
import styles from "./account.module.css";

export default function AccountClient({ email, username }: { email: string; username: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setSuccess("");
    if (newPassword.length < 8 || newPassword.length > 128 || !/[^\p{L}\p{N}\s]/u.test(newPassword)) {
      setError("Use 8–128 characters and at least one special character."); return;
    }
    if (newPassword !== confirmPassword) { setError("New passwords do not match."); return; }
    if (currentPassword === newPassword) { setError("Choose a different new password."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.message || "Could not change your password. Check your current password and try again."); return; }
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setSuccess("Password updated. Your other sessions were signed out.");
    } catch { setError("Could not reach E-library. Try again."); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <div className={styles.wrap}>
      <a className={styles.brand} href="/"><Image src="/e-library-logo.png" alt="" width={38} height={38} /> E-library</a>
      <a className={styles.back} href="/">← Back to library</a>
      <p className={styles.eyebrow}>YOUR ACCOUNT</p>
      <h1>Settings</h1>
      <p className={styles.lead}>Keep your private reading space secure.</p>
      <SidebarSettings /><details className="settings-group"><summary>Account settings</summary><div className={styles.grid}>
        <section className={styles.panel} aria-labelledby="profile-title">
          <h2 id="profile-title">Your profile</h2>
          <dl><dt>Email</dt><dd>{email}</dd><dt>Username</dt><dd>@{username}</dd></dl>
          <p>Accounts are created by an E-library administrator.</p>
        </section>
        <section className={styles.panel} aria-labelledby="password-title">
          <h2 id="password-title">Change password</h2>
          <p>Use at least eight characters and one special character.</p>
          <form onSubmit={(event) => void submit(event)}>
            <label htmlFor="current-password">Current password</label>
            <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required disabled={busy} />
            <label htmlFor="new-password">New password</label>
            <input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required disabled={busy} />
            <label htmlFor="confirm-password">Confirm new password</label>
            <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required disabled={busy} />
            {error && <p className={styles.error} role="alert">{error}</p>}
            {success && <p className={styles.success} role="status">{success}</p>}
            <button type="submit" disabled={busy || !currentPassword || !newPassword || !confirmPassword}>{busy ? "Updating…" : "Update password"}</button>
          </form>
        </section>
      </div></details>
    </div>
  </main>;
}
