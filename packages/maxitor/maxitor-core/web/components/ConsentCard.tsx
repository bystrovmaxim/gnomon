// packages/maxitor/maxitor-core/web/components/ConsentCard.tsx
// "I have read the Privacy policy and consent": the button works only once the box is ticked.
"use client";

import { useState, type FormEvent } from "react";

import { acceptPolicy, createAccount } from "@/app/actions";
import { Alert, Field } from "@/components/fields";
import { Icon, Logo, WAYS } from "@/components/marks";
import type { Refusal } from "@/lib/core";

export function ConsentCard({ again, email, name: given, provider, next }: { again: boolean; email: string; name: string; provider: string | null; next: string | null }) {
  const [name, setName] = useState(given);
  const [ticked, setTicked] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const answer = again ? await acceptPolicy(next) : await createAccount(name.trim(), ticked, next);
    setBusy(false);
    if (answer?.refused) setRefusal(answer.refused);
  }

  return (
    <div className="auth">
      <form className="card" onSubmit={submit} noValidate>
        <Logo />
        <h2>{again ? "The privacy policy has changed" : "Create your account"}</h2>
        <div className="sub">
          {again ? <>Read the new <a className="lnk" href="/privacy">Privacy policy</a> and accept it to go on as <b>{email}</b>.</> : <><b>{email}</b> is new to Maxitor. One step before your account is created.</>}
        </div>
        {refusal?.error === "expired" ? <Alert kind="warn"><b>This step took too long.</b> <a className="lnk" href="/">Sign in again</a> to start over.</Alert> : null}
        {refusal?.error === "taken" ? <Alert kind="bad"><b>This way in already has an account.</b> <a className="lnk" href="/">Sign in</a> with it.</Alert> : null}
        {refusal && !["expired", "taken"].includes(refusal.error) ? <Alert kind="bad">Maxitor cannot create the account right now. Try again in a minute.</Alert> : null}
        {again ? null : (
          <Field label="Your name" aside={<span className="opt">{provider ? `from your ${WAYS[provider]?.name ?? provider}, you can change it` : "how others will see you"}</span>} value={name} onChange={setName} autoComplete="name" autoFocus />
        )}
        <label className={`check${ticked ? " on" : ""}`}>
          <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} aria-label="I have read the Privacy policy and consent to the processing of my personal data" />
          <span className="box">{ticked ? <Icon.check /> : null}</span>
          <span>I have read the <a href="/privacy" target="_blank">Privacy policy</a> and consent to the processing of my personal data.</span>
        </label>
        <button className="btn" type="submit" disabled={busy || !ticked || (!again && !name.trim())}>{again ? "Accept and go on" : "Create account"}</button>
        <div className="fine">{again ? null : "Until you press the button, Maxitor keeps nothing about you. "}<a href="/">Cancel</a></div>
      </form>
    </div>
  );
}
