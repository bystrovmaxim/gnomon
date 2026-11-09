// packages/maxitor/maxitor-core/web/components/CookieBanner.tsx
// The cookie banner (mockup 1.12): until it is answered for the current policy, the sign-in cards wait.
"use client";

import { useEffect, useState } from "react";

const KEY = "maxitor_cookie_consent";

export function CookieBanner({ version }: { version: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const pending = window.localStorage.getItem(KEY) !== version;
    setOpen(pending);
    document.body.dataset.cookies = pending ? "pending" : "answered";
  }, [version]);
  if (!open) return null;
  const accept = () => {
    window.localStorage.setItem(KEY, version);
    document.body.dataset.cookies = "answered";
    setOpen(false);
  };
  return (
    <div className="cookie" role="dialog" aria-label="Cookies">
      <span className="ck" aria-hidden="true">🍪</span>
      <div>
        Maxitor uses <b>one cookie</b>, only to keep you signed in. No analytics, no advertising, nothing from other sites.{" "}
        <a href="/privacy#cookies">Cookies in the Privacy policy</a>
      </div>
      <button type="button" className="btn2 pri" onClick={accept}>Accept</button>
    </div>
  );
}
