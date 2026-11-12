// packages/maxitor/maxitor-core/web/components/scale/Scale.tsx
// The time scale on the right of the top row (spec 079, FR-001 – FR-017): the pill, and the card hanging from it while
// it is open, set up by the open page's history. The moment is the address's, never this component's: a choice goes
// up as the address's new `at`. The milestones are read once for the whole history and checked against the page's
// setup, what it did not promise named in the console; the bars are read in chunks of the width in view and kept in
// the page's memory below the watermark. A click outside the card, a click into the page, or Escape closes it.
"use client";

import type { Bar, CardBlock, Milestone } from "@maxitor/panel/history";
import { acceptMilestones, inForce } from "@maxitor/panel/history";
import type { PageHistory } from "@maxitor/panel/protocol";
import { PHONE_MEDIA } from "@maxitor/tokens";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import "./scale.css";
import { BarCache, chunksOf } from "@/components/scale/cache";
import { barStep, clampView, domainOf, glide, presetView, type View } from "@/components/scale/geometry";
import { legendOf } from "@/components/scale/legendRows";
import { Pill } from "@/components/scale/Pill";
import { ScaleCard } from "@/components/scale/ScaleCard";
import type { Mode } from "@/components/scale/bridge";
import type { HistorySource } from "@/components/scale/source";
import { Track, type Handle } from "@/components/scale/Track";
import { chosenMoment, momentOf, momentText, msOf, spanText } from "@/lib/moment";

/** The width of the scale inside the 760 px card. */
const TRACK_WIDTH = 720;
/** Where the milestones are read from: before any plugin's first change. */
const EPOCH = "2000-01-01T00:00:00.000000Z";
/** The widest bar a page answers: thirty days, the coarse bars that find where the history starts. */
const COARSE = 30 * 24 * 3600;
const FINE = 3600;
const SMALL_KEY = "maxitor.scale.hide-small";

/** Whether the screen is a phone's, as @maxitor/tokens draws the line. */
function usePhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(PHONE_MEDIA);
    const update = () => setPhone(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return phone;
}

/** A refusal of the page's history, named in the console: an error in development, a warning in production. */
function name(page: string, reason: string) {
  const text = `Maxitor: the page ${page}: its history ${reason}; the rest of the scale is drawn`;
  if (process.env.NODE_ENV === "production") console.warn(text);
  else console.error(text);
}

export function Scale({
  at,
  watermark,
  title,
  page,
  history,
  source,
  mode,
  from,
  counts,
  canStep,
  onStep,
  onChoose,
  onRange,
  onMode,
  onMilestone,
  onChanges,
  onMilestones,
}: {
  /** The address's moment; null is now. */
  at: string | null;
  /** The organization's watermark; null until it is first read. */
  watermark: string | null;
  /** What the scale is of: the open page's title. */
  title: string;
  /** The open page's path, as the console names it. */
  page: string;
  /** The page's history as the core kept it; null when the page gave none. */
  history: PageHistory | null;
  source: HistorySource | null;
  /** One moment, or two compared; A is `from` in a comparison. */
  mode: Mode;
  from: string | null;
  /** What the page counts in a comparison; null at one moment or until it counts. */
  counts: { added: number; removed: number; changed: number } | null;
  canStep: { older: boolean; newer: boolean };
  onStep: (delta: -1 | 1) => void;
  /** A moment was chosen; null is now. */
  onChoose: (at: string | null) => void;
  /** A or B of a comparison was moved: A is `from`, B `at`, null is now. */
  onRange: (range: { from: string; at: string | null }) => void;
  /** The mode switch; null when the page offers no comparison. */
  onMode: ((mode: Mode) => void) | null;
  /** A milestone was chosen: its moment, or the page it opens. */
  onMilestone: (milestone: Milestone) => void;
  /** The moments of the page's changes the arrows step through. */
  onChanges: (changes: string[]) => void;
  /** The page's milestones as the core kept them: which one a moment stands on. */
  onMilestones: (milestones: Milestone[]) => void;
}) {
  const phone = usePhone();
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(TRACK_WIDTH);
  const setup = useMemo<PageHistory>(() => history ?? { compare: [] }, [history]);
  const [hideSmall, setHideSmall] = useState(false);
  useEffect(() => setHideSmall(window.localStorage.getItem(SMALL_KEY) === "1"), []);

  // The milestones of the whole history, read again when "now" moves; and where the history starts.
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [firstBar, setFirstBar] = useState<string | null>(null);
  useEffect(() => {
    setMilestones(null);
    if (!source?.milestones || !watermark) return;
    let live = true;
    source
      .milestones(EPOCH, watermark)
      .then((answer) => {
        if (!live) return;
        const { kept, refused } = acceptMilestones(answer, setup);
        refused.forEach((reason) => name(page, reason));
        const shown = kept.filter((milestone) => milestone.at <= watermark);
        setMilestones(shown);
        onMilestones(shown);
      })
      .catch((error: unknown) => live && name(page, `milestones could not be read: ${String(error)}`));
    return () => {
      live = false;
    };
  }, [onMilestones, page, setup, source, watermark]);
  useEffect(() => {
    setFirstBar(null);
    if (!source?.bars || !watermark) return;
    let live = true;
    const now = msOf(watermark);
    // A coarse bar of thirty days finds the month the history starts in; hour bars inside it find the hour.
    const ask = source.bars;
    void (async () => {
      const coarse = (await ask(momentOf(now - 3 * 365 * 24 * 3600_000), watermark, COARSE))?.[0];
      if (!coarse || !live) return;
      const start = msOf(coarse.start);
      const fine = (await ask(coarse.start, momentOf(Math.min(start + COARSE * 1000, now)), FINE))?.[0];
      if (live) setFirstBar(fine?.start ?? coarse.start);
    })().catch(() => undefined);
    return () => {
      live = false;
    };
  }, [source, watermark]);

  const now = watermark ? msOf(watermark) : null;
  const first = [milestones?.[0]?.at, firstBar].filter((each): each is string => Boolean(each)).sort()[0] ?? null;
  const domain = useMemo(() => (now === null ? null : domainOf(first ? msOf(first) : null, now)), [first, now]);
  // The stretch in view and where it glides to; both start at the whole history when the card first opens.
  const [view, setView] = useState<View | null>(null);
  const [target, setTarget] = useState<View | null>(null);

  const close = useCallback(() => setOpen(false), []);

  // The card closes on a click outside it and the pill, and when the focus goes into the page's frame.
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (holder.current && event.target instanceof Node && !holder.current.contains(event.target)) setOpen(false);
    };
    const blur = () => {
      if (document.activeElement instanceof HTMLIFrameElement) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("blur", blur);
    };
  }, [open]);

  // The scale is as wide as the card's body: 720 on a desktop, the screen less its padding on a phone.
  useLayoutEffect(() => {
    const element = body.current;
    if (!open || !element) return;
    const measure = () => setWidth(Math.max(240, element.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open]);

  // Opening the card for the first time shows the whole history; later it shows what it showed, kept inside the history.
  useEffect(() => {
    if (!open || !domain) return;
    setView((was) => (was ? clampView(was, domain) : domain));
    setTarget((was) => (was ? clampView(was, domain) : domain));
  }, [domain, open]);

  // The glide towards the target, one step a frame.
  useEffect(() => {
    if (!view || !target || (view.from === target.from && view.to === target.to)) return;
    const frame = requestAnimationFrame(() => setView(glide(view, target).view));
    return () => cancelAnimationFrame(frame);
  }, [target, view]);

  // The bars of the stretch in view, asked chunk by chunk at the width of a bar in view; a chunk below the watermark is
  // kept, the one holding now is asked again.
  const cache = useRef(new BarCache());
  const asking = useRef(new Set<string>());
  const [, setRead] = useState(0);
  const shownView = view ?? domain;
  const step = shownView ? barStep(target ? target.to - target.from : shownView.to - shownView.from, width) : 60_000;
  const chunks = useMemo(() => (shownView && now !== null ? chunksOf(shownView.from, shownView.to, now, step) : []), [now, shownView, step]);
  useEffect(() => {
    if (!open || !source?.bars || now === null) return;
    const ask = source.bars;
    for (const chunk of chunks) {
      const slot = `${source.key}|${step}|${chunk.index}|${now}`;
      if (!cache.current.missing(source.key, step, chunk) || asking.current.has(slot)) continue;
      asking.current.add(slot);
      void ask(momentOf(chunk.from), momentOf(Math.min(chunk.to, now)), step / 1000)
        .then((bars) => {
          if (bars) cache.current.put(source.key, step, chunk, bars, now);
          setRead((n) => n + 1);
        })
        .catch(() => undefined);
    }
  }, [chunks, now, open, source, step]);
  const bars: Bar[] | null = source?.bars ? cache.current.bars(source.key, step, chunks) : null;

  // The arrows step through the milestones, or through the bars' ends when the page has bars.
  const changes = milestones && milestones.length
    ? milestones.filter((milestone) => !milestone.opens).map((milestone) => milestone.at)
    : (bars ?? []).map((bar) => momentOf(msOf(bar.start) + step));
  const changesKey = changes.join(",");
  useEffect(() => onChanges(changesKey ? changesKey.split(",") : []), [changesKey, onChanges]);

  // The cards, read once each when their point is first hovered.
  const [cards, setCards] = useState<Record<string, CardBlock[] | null>>({});
  useEffect(() => setCards({}), [source]);
  const cardOf = (milestone: Milestone): CardBlock[] | null | undefined => {
    if (!source?.card) return undefined;
    if (milestone.id in cards) return cards[milestone.id];
    const ask = source.card;
    queueMicrotask(() => {
      setCards((was) => (milestone.id in was ? was : { ...was, [milestone.id]: null }));
      void ask(milestone.id, null)
        .then((blocks) => setCards((was) => ({ ...was, [milestone.id]: blocks })))
        .catch(() => setCards((was) => ({ ...was, [milestone.id]: [{ warn: "The card could not be read." }] })));
    });
    return null;
  };

  // Every stretch asked for — a preset, a drag across, the wheel, a pinch — stays inside the history and is never
  // narrower than 20 minutes, so a bar never grows past the scale.
  const changeView = useCallback(
    (next: View, smooth: boolean) => {
      if (!domain) return;
      const kept = clampView(next, domain);
      setTarget(kept);
      if (!smooth) setView(kept);
    },
    [domain],
  );

  const preset = (span: number | null) => {
    if (!domain || now === null) return;
    setTarget(presetView(span, at ? msOf(at) : null, now, domain));
  };

  // A handle moved: the one moment, or A or B, never past now; A and B swap when A passes B.
  const comparing = mode !== "one" && from !== null;
  const choose = (time: number, handle: Handle) => {
    if (!watermark || now === null) return;
    if (!comparing || handle === "one") return onChoose(chosenMoment(time, watermark));
    let a = handle === "a" ? time : msOf(from as string);
    let b = handle === "b" ? time : at ? msOf(at) : now;
    if (a > b) [a, b] = [b, a];
    onRange({ from: momentOf(Math.min(a, now)), at: chosenMoment(b, watermark) });
  };
  const pick = (milestone: Milestone, handle: Handle) => {
    if (milestone.opens || milestone.link || !comparing || handle === "one") return onMilestone(milestone);
    const time = msOf(milestone.at);
    const a = handle === "a" ? milestone.at : (from as string);
    const b = handle === "b" ? milestone.at : at;
    if (msOf(a) > (b ? msOf(b) : (now ?? time))) onRange({ from: b ?? milestone.at, at: a });
    else onRange({ from: a, at: b });
  };

  const hasSmall = Boolean(setup.small) && (milestones ?? []).some((milestone) => milestone.small);
  // Drawn are the points of the kinds of the setup in force: while a page gives its history anew, none of the old.
  const kinds = setup.kinds ?? {};
  const drawn = milestones === null || !source?.milestones ? (source?.milestones ? [] : null) : milestones.filter((milestone) => milestone.kind in kinds && !(hideSmall && milestone.small));
  const say = (moment: string | null) => (moment === null || now === null ? "Now" : momentText(msOf(moment), now));
  const label = comparing ? (
    <>
      <span className="mx-pill-ab">A</span>
      {say(from)}
      <span className="mx-pill-to">→</span>
      <span className="mx-pill-ab">B</span>
      {say(at)}
      <span className="mx-pill-mode"> · {mode === "diff" ? "diff" : "side by side"}</span>
    </>
  ) : (
    say(at)
  );
  const offered = (setup.compare ?? []) as Mode[];
  const sections = legendOf(setup, comparing);
  const subtitle = milestones && milestones.length
    ? `${milestones.length} ${milestones.length === 1 ? "milestone" : "milestones"} since ${momentText(msOf(milestones[0].at), 0)}`
    : source?.bars
      ? "Every change of the page, in bars"
      : "Read the page at any moment up to now";
  const shownMoment = at ?? watermark;
  const current = milestones && shownMoment ? inForce(milestones, shownMoment) : null;
  const atA = milestones && comparing ? inForce(milestones, from as string) : null;
  const between = milestones && comparing && shownMoment ? milestones.filter((milestone) => !milestone.opens && milestone.at > (from as string) && milestone.at <= shownMoment && milestone !== current) : [];
  const message = (milestone: Milestone | null, tag: "A" | "B" | null) => (
    <div className="mx-message" key={tag ?? "one"}>
      <b>
        {tag ? <span className={tag === "A" ? "mx-chip-a" : "mx-chip-b"}>{tag}</span> : null}
        {milestone ? `${milestone.ref} · ${milestone.title}` : "Nothing yet"}
      </b>
      {milestone?.comment ? <div className="mx-message-body">{milestone.comment}</div> : null}
    </div>
  );

  return (
    <span className="mx-scale" ref={holder}>
      <Pill
        label={label}
        live={at === null}
        open={open}
        onOpen={() => setOpen(!open)}
        onStep={onStep}
        canStep={canStep}
        onNow={at === null || comparing ? null : () => onChoose(null)}
        counts={
          comparing && counts ? (
            counts.added + counts.removed + counts.changed === 0 ? (
              <span className="mx-pill-none">no changes</span>
            ) : (
              <span className="mx-pill-counts">
                <span className="mx-count-added">+{counts.added}</span>
                <span className="mx-count-removed">−{counts.removed}</span>
                <span className="mx-count-changed">~{counts.changed}</span>
              </span>
            )
          ) : null
        }
      />
      {open ? (
        <ScaleCard
          title={title}
          subtitle={subtitle}
          tools={
            hasSmall ? (
              <button
                type="button"
                className={`mx-card-tool mx-card-small${hideSmall ? "" : " on"}`}
                aria-pressed={!hideSmall}
                aria-label="The smaller points"
                title={hideSmall ? "Show the smaller points" : "Hide the smaller points"}
                onClick={() => {
                  window.localStorage.setItem(SMALL_KEY, hideSmall ? "0" : "1");
                  setHideSmall(!hideSmall);
                }}
              >
                <svg className="mx-card-icon" viewBox="0 0 24 24" aria-hidden>
                  <path d="M4 12h16" className="mx-three-line" />
                  <circle cx={5} cy={12} r={3} fill="currentColor" />
                  <circle cx={12} cy={12} r={1.9} fill="currentColor" />
                  <circle cx={19} cy={12} r={3} fill="currentColor" />
                </svg>
              </button>
            ) : null
          }
          legend={sections}
          mode={comparing ? mode : "one"}
          offered={offered}
          onMode={onMode}
          span={
            shownView && now !== null
              ? { text: `${spanText(Math.min(shownView.to, now) - shownView.from)}${source?.bars ? ` · bar ${spanText(step)}` : ""}`, title: `${momentText(shownView.from, 0)} – ${momentText(Math.min(shownView.to, now), 0)}` }
              : { text: "", title: "" }
          }
          onPreset={preset}
          phone={phone}
          onClose={close}
          under={
            milestones && milestones.length ? (
              <>
                <div className={`mx-messages${comparing ? " two" : ""}`}>{comparing ? [message(atA, "A"), message(current, "B")] : message(current, null)}</div>
                {between.length ? (
                  <div className="mx-between">
                    <b>Between A and B</b>
                    {between.map((milestone) => (
                      <div key={milestone.id}>
                        {milestone.ref} · {milestone.title}
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null
          }
        >
          <div className="mx-card-body" ref={body}>
            {shownView && domain && now !== null ? (
              <Track
                view={shownView}
                domain={domain}
                width={width}
                now={now}
                shown={at ? msOf(at) : now}
                against={comparing ? msOf(from as string) : null}
                phone={phone}
                bars={bars}
                step={step}
                milestones={drawn}
                kinds={kinds}
                cardOf={cardOf}
                onView={changeView}
                onChoose={choose}
                onMilestone={pick}
              />
            ) : (
              <div className="mx-card-wait">Reading now…</div>
            )}
          </div>
        </ScaleCard>
      ) : null}
    </span>
  );
}
