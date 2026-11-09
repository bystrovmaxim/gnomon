// packages/maxitor/maxitor-core/web/components/SignInMethods.tsx
// "Sign-in methods" (mockup 5.1–5.5): the account's ways in, linking an email or a provider the region allows,
// unlinking any but the last.
"use client";

import { useEffect, useState } from "react";

import { linkEmail, listSignIns, unlinkSignIn, type SignIn } from "@/app/actions";
import { Alert, CodeField, Field, PasswordField, ruleText } from "@/components/fields";
import { EVERYWHERE, Icon, WAYS, WayMark } from "@/components/marks";
import type { Me, Refusal } from "@/lib/core";

const NOTICES: Record<string, string> = {
  linked: "The way in is linked.",
  taken: "This way in already signs in another account. Two accounts are never joined.",
  provider: "The service did not confirm. Nothing was linked.",
  state: "The answer did not match this browser. Nothing was linked.",
};

function added(s: SignIn): string {
  const day = new Date(s.added_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  let country = s.added_country;
  try {
    country = country ? new Intl.DisplayNames(["en"], { type: "region" }).of(country) ?? country : null;
  } catch {
    // An unknown code is shown as it is.
  }
  return [s.email, `added ${day}${country ? ` from ${country}` : ""}`].filter(Boolean).join(" · ");
}

export function SignInMethods({ account, back, notice, onClose }: { account: Me; back: string; notice: string | null; onClose: () => void }) {
  const [list, setList] = useState<{ sign_ins: SignIn[]; offer: string[] } | null>(null);
  const [mode, setMode] = useState<"list" | "email">("list");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const answer = await listSignIns();
    if ("refused" in answer) setRefusal(answer.refused);
    else setList(answer);
  }
  useEffect(() => {
    void load();
  }, []);

  async function unlink(id: string) {
    setBusy(true);
    const answer = await unlinkSignIn(id);
    setBusy(false);
    if ("refused" in answer) setRefusal(answer.refused);
    else await load();
  }

  async function submitEmail() {
    setBusy(true);
    const answer = await linkEmail(email, password, sent ? code : null);
    setBusy(false);
    if ("refused" in answer) return setRefusal(answer.refused);
    setRefusal(null);
    if (answer.sent) return setSent(true);
    setMode("list");
    setSent(false);
    setCode("");
    await load();
  }

  const mine = list?.sign_ins ?? [];
  const ru = !list?.offer.some((p) => !EVERYWHERE.has(p));
  const hasEmail = mine.some((s) => s.provider === "email");
  const offer = (list?.offer ?? []).filter((p) => !mine.some((s) => s.provider === p));

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="dlg" role="dialog" aria-label="Sign-in methods">
        <h3>{mode === "email" ? "Link an email and password" : "Sign-in methods"}</h3>
        <div className="sub">{account.name} · one account, several ways in. They belong to you, not to an organization.</div>
        {notice && NOTICES[notice] && mode === "list" ? <Alert kind={notice === "linked" ? "ok" : "bad"}>{NOTICES[notice]}</Alert> : null}
        {refusal?.error === "taken" ? <Alert kind="bad"><b>This email already signs in another account.</b> Two accounts are never joined by email. Sign in with it and link from there, or choose another address.</Alert> : null}
        {refusal?.error === "last" ? <Alert kind="bad">The last way in cannot be unlinked.</Alert> : null}
        {refusal?.error === "wrong" ? <Alert kind="bad"><b>The code is wrong.</b> {String(refusal.tries_left)} tries are left.</Alert> : null}
        {mode === "list" ? (
          <>
            <div className="dsec">How you sign in</div>
            {mine.map((s) => (
              <div className="srow" key={s.id}>
                <WayMark way={s.provider} />
                <div className="sn"><b>{WAYS[s.provider]?.name ?? s.provider}</b><div>{added(s)}</div></div>
                <button type="button" className="btn2 danger" disabled={busy || mine.length < 2} title={mine.length < 2 ? "The last way in cannot be unlinked" : undefined} onClick={() => void unlink(s.id)}>Unlink</button>
              </div>
            ))}
            <div className="dsec">Add a way in</div>
            {hasEmail ? null : (
              <div className="srow add" role="button" tabIndex={0} onClick={() => { setRefusal(null); setMode("email"); }}>
                <WayMark way="email" />
                <div className="sn"><b>Link Email and password</b><div>works in every country</div></div>
              </div>
            )}
            {offer.map((p) => (
              <a className="srow add" key={p} href={`/api/v1/sign-in/${p}/start?mode=link&next=${encodeURIComponent(back)}`} style={{ textDecoration: "none" }}>
                <WayMark way={p} />
                <div className="sn"><b>Link {WAYS[p]?.name ?? p}</b></div>
              </a>
            ))}
            <div className="alert info" style={{ marginTop: 12 }}>
              <Icon.globe />
              <div>{ru ? "Google, GitHub and Facebook do not work in Russia and cannot be linked from here." : "Google, GitHub and Facebook do not work in Russia. Going there? Link an email, Yandex ID or Mail.ru ID — they work everywhere."}</div>
            </div>
            <div className="ft"><button type="button" className="btn2 pri" onClick={onClose}>Done</button></div>
          </>
        ) : (
          <>
            <Field label="Email — your login" type="email" value={email} onChange={setEmail} autoComplete="username" autoFocus />
            <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" bad={refusal?.error === "password_rule"} />
            <div className={`hintl${refusal?.error === "password_rule" ? " bad" : ""}`}>{refusal?.error === "password_rule" ? ruleText(refusal.rule) : "At least 10 characters. Not your email, not a common password."}</div>
            {sent ? (
              <>
                <div className="lab">Code we sent to the email</div>
                <CodeField value={code} onChange={setCode} />
              </>
            ) : null}
            <div className="ft">
              <button type="button" className="btn2" onClick={() => { setMode("list"); setSent(false); setRefusal(null); }}>Back</button>
              <button type="button" className="btn2 pri" disabled={busy || !email || password.length < 10 || (sent && code.length !== 6)} onClick={() => void submitEmail()}>{sent ? "Link" : "Send a code"}</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
