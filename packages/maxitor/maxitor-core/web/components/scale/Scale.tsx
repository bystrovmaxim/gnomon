// packages/maxitor/maxitor-core/web/components/scale/Scale.tsx
// The time scale on the right of the top row (spec 079, FR-001 – FR-005): the pill, and the card hanging from it while
// it is open. The moment is the address's, never this component's: a choice goes up as the address's new `at`, and
// the pill shows whatever the address holds. Opening the card shows the whole history; the presets and the zoom glide
// there. A click outside the card, a click into the page, or Escape closes it.
"use client";

import { PHONE_MEDIA } from "@maxitor/tokens";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import "./scale.css";
import { clampView, domainOf, glide, presetView, type View } from "@/components/scale/geometry";
import type { LegendGroup } from "@/components/scale/Legend";
import { Pill } from "@/components/scale/Pill";
import { ScaleCard, type Mode } from "@/components/scale/ScaleCard";
import { Track } from "@/components/scale/Track";
import { chosenMoment, momentText, msOf, spanText } from "@/lib/moment";

/** The width of the scale inside the 760 px card: the graph viewer's 718, less the card's padding on a phone. */
const TRACK_WIDTH = 720;

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

export function Scale({
  at,
  watermark,
  title,
  subtitle,
  first,
  legend = [],
  offered = [],
  canStep,
  onStep,
  onChoose,
}: {
  /** The address's moment; null is now. */
  at: string | null;
  /** The organization's watermark; null until it is first read. */
  watermark: string | null;
  /** What the scale is of: the open page. */
  title: string;
  subtitle: string;
  /** The page's first change, where the whole history starts; null when it has given none. */
  first: string | null;
  legend?: LegendGroup[];
  offered?: readonly Mode[];
  canStep: { older: boolean; newer: boolean };
  onStep: (delta: -1 | 1) => void;
  /** A moment was chosen; null is now. */
  onChoose: (at: string | null) => void;
}) {
  const phone = usePhone();
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(TRACK_WIDTH);

  const now = watermark ? msOf(watermark) : null;
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

  const changeView = useCallback((next: View, smooth: boolean) => {
    setTarget(next);
    if (!smooth) setView(next);
  }, []);

  const preset = (span: number | null) => {
    if (!domain || now === null) return;
    setTarget(presetView(span, at ? msOf(at) : null, now, domain));
  };

  const choose = (time: number) => {
    if (!watermark) return;
    onChoose(chosenMoment(time, watermark));
  };

  const label = at === null || now === null ? "Now" : momentText(msOf(at), now);
  const shownView = view ?? domain;
  return (
    <span className="mx-scale" ref={holder}>
      <Pill
        label={label}
        live={at === null}
        open={open}
        onOpen={() => setOpen(!open)}
        onStep={onStep}
        canStep={canStep}
        onNow={at === null ? null : () => onChoose(null)}
      />
      {open ? (
        <ScaleCard
          title={title}
          subtitle={subtitle}
          legend={legend}
          mode="one"
          offered={offered}
          onMode={null}
          span={
            shownView && now !== null
              ? { text: spanText(Math.min(shownView.to, now) - shownView.from), title: `${momentText(shownView.from, 0)} – ${momentText(Math.min(shownView.to, now), 0)}` }
              : { text: "", title: "" }
          }
          onPreset={preset}
          phone={phone}
          onClose={close}
        >
          <div className="mx-card-body" ref={body}>
            {shownView && domain && now !== null ? (
              <Track view={shownView} domain={domain} width={width} now={now} shown={at ? msOf(at) : now} phone={phone} onView={changeView} onChoose={choose} />
            ) : (
              <div className="mx-card-wait">Reading now…</div>
            )}
          </div>
        </ScaleCard>
      ) : null}
    </span>
  );
}
