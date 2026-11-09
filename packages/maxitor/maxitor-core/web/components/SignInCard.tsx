// packages/maxitor/maxitor-core/web/components/SignInCard.tsx
// The sign-in card: one message for a wrong email or password, the lock after ten tries, the row of providers.
"use client";

import { useState, type FormEvent } from "react";

import { signInWithPassword } from "@/app/actions";
import { Alert, Field, PasswordField } from "@/components/fields";
import { LegalLinks, Logo, ProviderRow, WAYS, clock } from "@/components/marks";
import type { Options, Refusal } from "@/lib/core";

const PROVIDER_ERRORS: Record<string, string> = {
  state: "The sign-in did not finish: the answer did not match this browser. Try again.",
  provider: "The service did not confirm the sign-in. Try again.",
  no_email: "The service gave no email, so a new account cannot be created with it. Sign in another way.",
  not_configured: "This service is not set up on Maxitor yet. Sign in another way.",
  unauthorized: "Sign in first to link a way in.",
  taken: "This way in already signs in another account.",
  expired: "The sign-in took too long. Start again.",
};

export function SignInCard({ options, next, error }: { options: Options; next: string | null; error: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);
  const ru = options.region === "russia";
  const names = options.providers.map((p) => WAYS[p]?.name ?? p);
  const listed = names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}` : names[0];
  const locked = refusal?.error === "too_many_passwords";
  const resetHref = email ? `/reset-password?email=${encodeURIComponent(email)}` : "/reset-password";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const answer = await signInWithPassword(email, password, next);
    setBusy(false);
    if (answer?.refused) setRefusal(answer.refused);
  }

  return (
    <div className="auth">
      <form className="card" onSubmit={submit} noValidate>
        <Logo />
        {next ? (
          <Alert kind="info">
            Sign in to open <b>{next}</b>. You will land there right after.
          </Alert>
        ) : null}
        <h2>Sign in</h2>
        <div className="sub">With your email and password, or with {listed}.</div>
        {error && PROVIDER_ERRORS[error] ? <Alert kind="bad">{PROVIDER_ERRORS[error]}</Alert> : null}
        {refusal?.error === "wrong" ? (
          <Alert kind="bad">
            <b>Wrong email or password.</b> Check both, or <a className="lnk" href={resetHref}>reset the password</a>.
          </Alert>
        ) : null}
        {locked ? (
          <Alert kind="warn">
            <b>Too many tries for this email.</b> You can try again at <b>{clock(refusal?.until)}</b>, or <a className="lnk" href={resetHref}>reset the password</a> now.
          </Alert>
        ) : null}
        {refusal && !["wrong", "too_many_passwords"].includes(refusal.error) ? <Alert kind="bad">Maxitor cannot sign you in right now. Try again in a minute.</Alert> : null}
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="username" bad={!!refusal} autoFocus />
        <PasswordField label="Password" aside={<a href={resetHref}>Forgot password?</a>} value={password} onChange={setPassword} autoComplete="current-password" bad={!!refusal} />
        <div style={{ height: 12 }} />
        <button className="btn" type="submit" disabled={busy || locked || !email || !password}>Sign in</button>
        <div className="switch-line">No account? <a href="/sign-up">Create one</a></div>
        <div className="or">or continue with</div>
        <ProviderRow providers={options.providers} next={next} />
        {ru ? (
          <div className="fine">In Russia Maxitor signs in by email and password, Yandex ID or Mail.ru ID, as Russian law requires.</div>
        ) : (
          <div className="fine">Going to Russia? Google, GitHub and Facebook do not work there. Link your email, Yandex ID or Mail.ru ID in “Sign-in methods” beforehand.</div>
        )}
        <LegalLinks />
      </form>
    </div>
  );
}
