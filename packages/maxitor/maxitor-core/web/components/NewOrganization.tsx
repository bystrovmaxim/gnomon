// packages/maxitor/maxitor-core/web/components/NewOrganization.tsx
// The organization's name, and its address code suggested from the name; the page says at once whether the code
// is free, taken or not allowed, and registering checks again in the database.
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { checkAddressCode, registerOrganization, type CodeCheck } from "@/app/actions";
import { Alert, Field } from "@/components/fields";
import { Icon, Logo } from "@/components/marks";
import type { Refusal } from "@/lib/core";

/** The code a name suggests, as the backend makes it: Latin letters, digits and hyphens. */
function fromName(name: string): string {
  const cyr: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
  const spelled = [...name.toLowerCase()].map((c) => cyr[c] ?? c).join("");
  return spelled.normalize("NFKD").replace(/[^\x00-\x7f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63).replace(/-+$/, "");
}

function quoted(chars: string[]): string {
  const q = chars.map((c) => `“${c === " " ? "space" : c}”`);
  return q.length > 1 ? `${q.slice(0, -1).join(", ")} and ${q[q.length - 1]}` : q[0];
}

export function NewOrganization({ email }: { email: string }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [check, setCheck] = useState<CodeCheck | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);
  const asked = useRef(0);

  useEffect(() => {
    if (!touched) setCode(fromName(name));
  }, [name, touched]);

  useEffect(() => {
    if (!code) return setCheck(null);
    const n = ++asked.current;
    const t = setTimeout(async () => {
      const answer = await checkAddressCode(code, name);
      if (n === asked.current && !("refused" in answer)) setCheck(answer);
    }, 250);
    return () => clearTimeout(t);
  }, [code, name]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const answer = await registerOrganization(name.trim(), code);
    setBusy(false);
    if (answer?.refused) {
      setRefusal(answer.refused);
      if (answer.refused.error === "taken") setCheck({ state: "taken", bad_chars: [], suggestions: (answer.refused.suggestions as string[]) ?? [] });
    }
  }

  const state = code ? check?.state : undefined;
  const status = state === "free" ? <span className="st ok"><Icon.check />free</span> : state === "taken" ? <span className="st bad"><Icon.x />taken</span> : state === "not_allowed" ? <span className="st bad"><Icon.x />not allowed</span> : null;
  const pick = (s: string) => { setTouched(true); setCode(s); setRefusal(null); };
  let hint = <div className="hintl">Lower-case letters, digits and hyphens, 2–63 characters. It cannot be changed later.</div>;
  if (state === "taken") {
    const [a, b] = check?.suggestions ?? [];
    hint = <div className="hintl bad">Another organization has this address.{a ? <> Try <button type="button" className="lnk" onClick={() => pick(a)}>{a}</button>{b ? <> or <button type="button" className="lnk" onClick={() => pick(b)}>{b}</button></> : null}.</> : null}</div>;
  }
  if (state === "not_allowed") {
    const bad = check?.bad_chars ?? [];
    hint = <div className="hintl bad">{bad.length ? <>Only lower-case letters, digits and hyphens: {quoted(bad)} {bad.length > 1 ? "are" : "is"} not allowed.</> : "2–63 characters, starting and ending with a letter or a digit, and not one of Maxitor’s own words."}</div>;
  }

  return (
    <div className="auth">
      <form className="card wide" onSubmit={submit} noValidate>
        <Logo />
        <h2>Register your organization</h2>
        <div className="sub">You are signed in as <b>{email}</b>. An organization is where your people and your work live; you will be its administrator.</div>
        {refusal?.error === "taken" && refusal.moment ? <Alert kind="bad"><b>Someone took “{code}” a moment ago.</b> Nothing was created. Choose another address.</Alert> : null}
        {refusal?.error === "limit" ? <Alert kind="warn"><b>You have registered {String(refusal.limit)} organizations,</b> the most one account may. Nothing was created.</Alert> : null}
        {refusal && !["taken", "limit", "not_allowed"].includes(refusal.error) ? <Alert kind="bad">Maxitor cannot register it right now. Try again in a minute.</Alert> : null}
        <Field label="Organization’s name" value={name} onChange={(v) => { setName(v); setRefusal(null); }} autoComplete="organization" autoFocus />
        <Field label="Address" aside={<span className="opt">{touched ? "your choice" : "suggested from the name"}</span>} prefix="maxitor.aoa.run/w/" value={code} onChange={(v) => { setTouched(true); setCode(v); setRefusal(null); }} bad={state === "taken" || state === "not_allowed"} status={status} />
        {hint}
        <button className="btn" type="submit" disabled={busy || !name.trim() || state !== "free"}>Register and enter</button>
      </form>
    </div>
  );
}
