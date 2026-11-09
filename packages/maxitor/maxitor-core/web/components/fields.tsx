// packages/maxitor/maxitor-core/web/components/fields.tsx
// The fields of the cards: a text field, a password with "Show", the six cells of a code, an alert.
"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Icon } from "@/components/marks";

export function Field({ label, aside, value, onChange, type = "text", autoComplete, bad, autoFocus, prefix, status }: {
  label: ReactNode;
  aside?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  bad?: boolean;
  autoFocus?: boolean;
  prefix?: string;
  status?: ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <div className="lab">
        <span>{label}</span>
        {aside}
      </div>
      <div className={`inp${bad ? " bad" : ""}`}>
        {prefix ? <span className="pre">{prefix}</span> : null}
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} autoFocus={autoFocus} spellCheck={false} aria-label={typeof label === "string" ? label : undefined} />
        {status}
      </div>
    </label>
  );
}

export function PasswordField({ label, aside, value, onChange, autoComplete, bad, autoFocus }: {
  label: ReactNode;
  aside?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  bad?: boolean;
  autoFocus?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <div className="lab">
        <label htmlFor={`pw-${autoComplete}`}>{label}</label>
        {aside}
      </div>
      <div className={`inp pw${bad ? " bad" : ""}`}>
        <input id={`pw-${autoComplete}`} type={shown ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} autoFocus={autoFocus} />
        <button type="button" className="eye" onClick={() => setShown(!shown)}>{shown ? "Hide" : "Show"}</button>
      </div>
    </div>
  );
}

/** Six cells, three and three; one real input under them takes the typing and the pasted code. */
export function CodeField({ value, onChange, state, label = "Six-digit code" }: {
  value: string;
  onChange: (v: string) => void;
  state?: "bad" | "dead";
  label?: string;
}) {
  const digits = value.padEnd(6, " ").slice(0, 6).split("");
  const [focused, setFocused] = useState(false);
  return (
    <div className={`otp${state ? ` ${state}` : ""}`}>
      {digits.map((d, i) => (
        <span key={i} style={{ display: "contents" }}>
          {i === 3 ? <span className="gap" /> : null}
          <span className={focused && !state && i === value.length ? "cur" : ""}>{d.trim()}</span>
        </span>
      ))}
      <input
        aria-label={label}
        inputMode="numeric"
        autoComplete="one-time-code"
        value={value}
        disabled={state === "dead"}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        autoFocus
      />
    </div>
  );
}

export function Alert({ kind, children }: { kind: "bad" | "warn" | "info" | "ok"; children: ReactNode }) {
  const icon = kind === "ok" ? <Icon.check /> : kind === "info" ? <Icon.info /> : <Icon.alert />;
  return (
    <div className={`alert ${kind}`} role={kind === "bad" || kind === "warn" ? "alert" : "status"}>
      {icon}
      <div>{children}</div>
    </div>
  );
}

/** "Send again in 0:42": a minute between letters to one address. */
export function useCountdown(seconds: number): [number, () => void] {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, () => setLeft(seconds)];
}

export function minutes(left: number): string {
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

/** The password rule the backend named: it names it as a sentence. */
export function ruleText(rule: unknown): string {
  return typeof rule === "string" && rule ? rule : "At least 10 characters. Not your email, not a common password.";
}
