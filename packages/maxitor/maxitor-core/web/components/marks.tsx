// packages/maxitor/maxitor-core/web/components/marks.tsx
// The icons of the mockup and the marks of the ways in.
import type { ReactNode } from "react";

function Line({ d, small }: { d: ReactNode; small?: boolean }) {
  return (
    <svg className={small ? "ico sm" : "ico"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}

export const Icon = {
  down: () => <Line small d={<path d="M6 9l6 6 6-6" />} />,
  left: () => <Line small d={<path d="M15 6l-6 6 6 6" />} />,
  mail: () => <Line d={<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>} />,
  alert: () => <Line d={<><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></>} />,
  info: () => <Line d={<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></>} />,
  check: () => <Line small d={<path d="M5 12l5 5 9-10" />} />,
  x: () => <Line small d={<path d="M6 6l12 12M18 6L6 18" />} />,
  plus: () => <Line small d={<path d="M12 5v14M5 12h14" />} />,
  out: () => <Line small d={<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />} />,
  key: () => <Line small d={<><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3" /></>} />,
  globe: () => <Line small d={<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>} />,
  chevron: () => <Line d={<path d="M6 9l6 6 6-6" />} />,
  page: () => <Line small d={<><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9h6M9 13h6M9 17h3" /></>} />,
  puzzle: () => <Line small d={<path d="M9 4h3a2 2 0 114 0h0v4a2 2 0 110 4v4h-4a2 2 0 10-4 0H4v-4a2 2 0 100-4V4h5z" />} />,
  gear: () => (
    <Line
      small
      d={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></>}
    />
  ),
  search: () => <Line d={<><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>} />,
  menu: () => <Line d={<path d="M4 7h16M4 12h16M4 17h16" />} />,
  lock: () => <Line small d={<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>} />,
};

/** Each way in: its mark's class and letter, and its name as people know it. */
export const WAYS: Record<string, { mark: string; letter: string; name: string }> = {
  google: { mark: "go", letter: "G", name: "Google" },
  github: { mark: "gh", letter: "", name: "GitHub" },
  facebook: { mark: "fb", letter: "f", name: "Facebook" },
  yandex: { mark: "ya", letter: "Я", name: "Yandex ID" },
  mailru: { mark: "mr", letter: "@", name: "Mail.ru ID" },
  email: { mark: "em", letter: "✉", name: "Email and password" },
};

/** The ways in that work in Russia too. */
export const EVERYWHERE = new Set(["email", "yandex", "mailru"]);

export function WayMark({ way }: { way: string }) {
  const w = WAYS[way] ?? { mark: "em", letter: "?", name: way };
  return (
    <span className={`pv ${w.mark}`} aria-hidden="true">
      {way === "github" ? (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="#fff">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 014 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
      ) : (
        w.letter
      )}
    </span>
  );
}

/** The row of compact provider buttons: each starts signing in, or linking, with its provider. */
export function ProviderRow({ providers, next, link }: { providers: string[]; next?: string | null; link?: boolean }) {
  return (
    <div className="icons">
      {providers.map((p) => {
        const query = new URLSearchParams();
        if (next) query.set("next", next);
        if (link) query.set("mode", "link");
        const q = query.toString();
        return (
          <a key={p} href={`/api/v1/sign-in/${p}/start${q ? `?${q}` : ""}`} data-name={WAYS[p]?.name ?? p} aria-label={`Continue with ${WAYS[p]?.name ?? p}`} title={`Continue with ${WAYS[p]?.name ?? p}`} className="pbtn">
            <WayMark way={p} />
          </a>
        );
      })}
    </div>
  );
}

export function Logo() {
  return (
    <div className="lg">
      <span className="mk">M</span>Maxitor
    </div>
  );
}

export function LegalLinks() {
  return (
    <div className="legal-links">
      <a href="/privacy">Privacy</a>
      <a href="/data-deletion">Delete my data</a>
    </div>
  );
}

/** A time the backend named, as the person's clock shows it: 14:52. */
export function clock(iso: unknown): string {
  const d = new Date(String(iso));
  return Number.isNaN(d.getTime()) ? "later" : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
