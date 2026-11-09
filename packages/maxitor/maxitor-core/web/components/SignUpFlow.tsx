// packages/maxitor/maxitor-core/web/components/SignUpFlow.tsx
// The email and password, then the code from the letter, both on /sign-up. The password stays in this page's memory only, to send
// the code again; it never goes into a cookie or the address.
"use client";

import { useState, type FormEvent } from "react";

import { confirmEmail, startSignUp } from "@/app/actions";
import { Alert, CodeField, Field, PasswordField, minutes, ruleText, useCountdown } from "@/components/fields";
import { Icon, LegalLinks, Logo, clock } from "@/components/marks";
import type { Refusal } from "@/lib/core";

export function SignUpFlow() {
  const [step, setStep] = useState<"form" | "code">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, restart] = useCountdown(60);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    const answer = await startSignUp(email, password);
    setBusy(false);
    if ("refused" in answer) {
      setRefusal(answer.refused);
      return;
    }
    setRefusal(null);
    setCode("");
    restart();
    setStep("code");
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const answer = await confirmEmail(email, code);
    setBusy(false);
    if (answer?.refused) setRefusal(answer.refused);
  }

  if (step === "form") {
    const rule = refusal?.error === "password_rule";
    return (
      <div className="auth">
        <form className="card" onSubmit={send} noValidate>
          <Logo />
          <h2>Create an account</h2>
          <div className="sub">Your email is your login. We send a code to confirm it is yours.</div>
          {refusal?.error === "too_many_codes" ? (
            <Alert kind="warn"><b>Too many codes for this address.</b> A new one can be sent at <b>{clock(refusal.until)}</b>.</Alert>
          ) : null}
          {refusal?.error === "mail_not_sent" ? <Alert kind="bad"><b>The letter could not be sent.</b> Try again in a minute.</Alert> : null}
          {refusal?.error === "unavailable" ? <Alert kind="bad">Maxitor cannot answer right now. Try again in a minute.</Alert> : null}
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="username" autoFocus />
          <PasswordField label="Password" value={password} onChange={(v) => { setPassword(v); if (rule) setRefusal(null); }} autoComplete="new-password" bad={rule} />
          <div className={`hintl${rule ? " bad" : ""}`}>{rule ? ruleText(refusal?.rule) : "At least 10 characters. Not your email, not a common password."}</div>
          <button className="btn" type="submit" disabled={busy || !email || password.length < 10}><Icon.mail />Continue</button>
          <div className="switch-line">Already have an account? <a href="/">Sign in</a></div>
          <LegalLinks />
        </form>
      </div>
    );
  }

  const error = refusal?.error;
  const dead = error === "used_up" || error === "expired" || error === "too_many_codes";
  return (
    <div className="auth">
      <form className="card" onSubmit={dead ? (e) => { e.preventDefault(); void send(); } : confirm} noValidate>
        <button type="button" className="back" onClick={() => { setStep("form"); setRefusal(null); }}><Icon.left />Another email</button>
        <h2>Confirm your email</h2>
        <div className="sub">We sent a six-digit code to <b>{email}</b>. Enter it to confirm the address is yours. It works for ten minutes.</div>
        {error === "wrong" ? <Alert kind="bad"><b>The code is wrong.</b> {String(refusal?.tries_left)} {refusal?.tries_left === 1 ? "try is" : "tries are"} left for this code.</Alert> : null}
        {error === "used_up" ? <Alert kind="bad"><b>This code no longer works:</b> it was wrong five times. Ask for a new one — the old one is gone.</Alert> : null}
        {error === "expired" ? <Alert kind="warn"><b>The code has expired.</b> A code lives ten minutes. Ask for a new one.</Alert> : null}
        {error === "too_many_codes" ? <Alert kind="warn"><b>Too many codes for this address.</b> One address gets ten codes an hour. A new one can be sent at <b>{clock(refusal?.until)}</b>.</Alert> : null}
        <CodeField value={code} onChange={(v) => { setCode(v); if (error === "wrong") setRefusal(null); }} state={dead ? "dead" : error === "wrong" ? "bad" : undefined} />
        {dead ? (
          <button className="btn" type="submit" disabled={busy || error === "too_many_codes"}><Icon.mail />{error === "too_many_codes" ? `Send a new code at ${clock(refusal?.until)}` : "Send a new code"}</button>
        ) : (
          <button className="btn" type="submit" disabled={busy || code.length !== 6}>{error === "wrong" ? "Try again" : "Confirm"}</button>
        )}
        {dead ? null : (
          <div className="resend">
            <span>No letter? Check spam.</span>
            {left > 0 ? <span>Send again in <b>{minutes(left)}</b></span> : <a className="lnk" onClick={() => void send()}>Send again</a>}
          </div>
        )}
      </form>
    </div>
  );
}
