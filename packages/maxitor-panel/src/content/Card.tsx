// @maxitor/panel — a card of the panel's content: a head of short facts and a body, drawn with the tokens.
import type { HTMLAttributes, ReactNode } from "react";

export function Card({ head, children, ...rest }: { head?: ReactNode; children: ReactNode } & HTMLAttributes<HTMLElement>) {
  return (
    <article className="mx-card" {...rest}>
      {head ? <div className="mx-card-head">{head}</div> : null}
      <div>{children}</div>
    </article>
  );
}
