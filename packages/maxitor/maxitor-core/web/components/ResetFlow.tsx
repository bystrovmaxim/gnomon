// packages/maxitor/maxitor-core/web/components/ResetFlow.tsx
// The email, then the code with a new password, then the sign-in with it. The answer to the email is the same
// whether it has an account or not.
"use client";

import { useState, type FormEvent } from "react";

import { requestPasswordReset, resetPassword } from "@/app/actions";
import { Alert, CodeField, Field, PasswordField, minutes, ruleText, useCountdown } from "@/components/fields";
import { Icon, Logo, clock } from "@/components/marks";
import type { Refusal } from "@/lib/core";

export function ResetFlow({ initialEmail }: { initialEmail: string }) {
  const [step, setStep] = useState<"request" | "code" | "done">("request");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, restart] = useCountdown(60);

  async function request(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    const answer = await requestPasswordReset(email);
    setBusy(false);
    if ("refused" in answer) return setRefusal(answer.refused);
    setRefusal(null);
    setCode("");
    restart();
    setStep("code");
  }

  async function change(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const answer = await resetPassword(email, code, password);
    setBusy(false);
    if ("refused" in answer) return setRefusal(answer.refused);
    setStep("done");
  }

  if (step === "request") {
    return (
      <div className="auth">
        <form className="card" onSubmit={request} noValidate>
          <a className="back" href="/"><Icon.left />Back to sign in</a>
          <h2>Reset your password</h2>
          <div className="sub">Enter your email. If it has an account, we send a code to set a new password.</div>
          {refusal?.error === "too_many_codes" ? <Alert kind="warn"><b>Too many codes for this address.</b> A new one can be sent at <b>{clock(refusal.until)}</b>.</Alert> : null}
          {refusal && refusal.error !== "too_many_codes" ? <Alert kind="bad">The letter could not be sent. Try again in a minute.</Alert> : null}
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="username" autoFocus />
          <button className="btn" type="submit" disabled={busy || !email}><Icon.mail />Send me a code</button>
        </form>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="auth">
        <div className="card">
          <Logo />
          <Alert kind="ok"><b>Your password is changed.</b> A letter says so to {email}.</Alert>
          <h2>Sign in with the new password</h2>
          <div className="sub">The old password no longer works.</div>
          <a className="btn" href="/" style={{ textDecoration: "none" }}>Sign in</a>
        </div>
      </div>
    );
  }

  const error = refusal?.error;
  const rule = error === "password_rule";
  return (
    <div className="auth">
      <form className="card" onSubmit={change} noValidate>
        <button type="button" className="back" onClick={() => { setStep("request"); setRefusal(null); }}><Icon.left />Another email</button>
        <h2>Set a new password</h2>
        <div className="sub">If <b>{email}</b> has an account, a six-digit code is on its way. It works for ten minutes.</div>
        {error === "wrong" ? <Alert kind="bad"><b>The code is wrong.</b> {String(refusal?.tries_left)} {refusal?.tries_left === 1 ? "try is" : "tries are"} left for this code.</Alert> : null}
        {error === "used_up" ? <Alert kind="bad"><b>This code no longer works:</b> it was wrong five times. Ask for a new one.</Alert> : null}
        {error === "expired" ? <Alert kind="warn"><b>The code has expired.</b> Ask for a new one.</Alert> : null}
        <div className="lab">Code from the letter</div>
        <CodeField value={code} onChange={(v) => { setCode(v); if (error === "wrong") setRefusal(null); }} state={error === "wrong" ? "bad" : error === "used_up" || error === "expired" ? "dead" : undefined} />
        <PasswordField label="New password" value={password} onChange={(v) => { setPassword(v); if (rule) setRefusal(null); }} autoComplete="new-password" bad={rule} />
        <div className={`hintl${rule ? " bad" : ""}`}>{rule ? ruleText(refusal?.rule) : "At least 10 characters. Not your email, not a common password."}</div>
        <button className="btn" type="submit" disabled={busy || code.length !== 6 || password.length < 10}>Set new password</button>
        <div className="resend">
          <span>No letter? Check spam.</span>
          {left > 0 ? <span>Send again in <b>{minutes(left)}</b></span> : <a className="lnk" onClick={() => void request()}>Send again</a>}
        </div>
      </form>
    </div>
  );
}
