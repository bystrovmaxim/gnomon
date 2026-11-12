// packages/maxitor/maxitor-core/web/components/frame/SidePanels.tsx
// The page in the right panel by the screen's mode (spec 079, FR-018 – FR-024), as the graph viewer lays out its
// SideBySide: One and Diff draw one page; Side by side draws two, A on the left at A and B on the right at B, each
// with its head — A brown, B blue, its moment — and B's switch Track. With Track on, what the pointer is on in one
// panel is lit in the other, and what is chosen in one is brought into the other's view; a panel that cannot show it
// says why. On a phone one panel shows at a time, with an A / B switch, and switching brings the last choice.
"use client";

import type { CoreMessage, MomentContext, PageMessage } from "@maxitor/panel/protocol";
import { useCallback, useEffect, useRef, useState, type ComponentProps, type RefObject } from "react";

import { PageFrame } from "@/components/frame/PageFrame";
import { useScale } from "@/components/scale/bridge";
import { momentText, msOf } from "@/lib/moment";
import { noteOf, type Note } from "@/lib/notes";

type Side = "a" | "b";
type FrameProps = Omit<ComponentProps<typeof PageFrame>, "context" | "onMessage" | "connect">;

/** How long "Brought to the centre" stands. */
const BRIEF_MS = 2500;

/** The page by the screen's mode: one frame, or the two of Side by side. */
export function ComparedFrames(props: FrameProps) {
  const { moment, milestoneOn, counts, connectStepper } = useScale();
  const tells = useRef<Partial<Record<Side | "one", (message: CoreMessage) => void>>>({});
  const connect = useCallback((side: Side | "one") => (tell: (message: CoreMessage) => void) => {
    tells.current[side] = tell;
    return () => {
      if (tells.current[side] === tell) delete tells.current[side];
    };
  }, []);
  const connectOne = useCallback((tell: (message: CoreMessage) => void) => connect("one")(tell), [connect]);
  const connectA = useCallback((tell: (message: CoreMessage) => void) => connect("a")(tell), [connect]);
  const connectB = useCallback((tell: (message: CoreMessage) => void) => connect("b")(tell), [connect]);

  // Shift + ↑ ↓ step the comparison's changes in the page that draws them: Diff's one, Side by side's B.
  useEffect(() => connectStepper((delta) => (tells.current.one ?? tells.current.b)?.({ type: "panel.step", delta })), [connectStepper]);
  // The counts are a comparison's: back at one moment the pill shows none.
  useEffect(() => {
    if (moment.mode === "one") counts(null);
  }, [counts, moment.mode]);

  if (moment.mode !== "side_by_side" || !moment.from) {
    const context: MomentContext =
      moment.mode === "diff" && moment.from
        ? { at: moment.at, against: moment.from, side: null, milestone: milestoneOn(moment.at) }
        : { at: moment.at, against: null, side: null, milestone: milestoneOn(moment.at) };
    return <PageFrame {...props} context={context} connect={connectOne} onMessage={(message) => message.type === "panel.counts" && counts(message)} />;
  }
  return <Halves {...props} from={moment.from} at={moment.at} milestoneOn={milestoneOn} counts={counts} tells={tells} connectA={connectA} connectB={connectB} />;
}

function Halves({
  from,
  at,
  milestoneOn,
  counts,
  tells,
  connectA,
  connectB,
  ...props
}: FrameProps & {
  from: string;
  at: string | null;
  milestoneOn: (moment: string | null) => string | null;
  counts: (counts: { added: number; removed: number; changed: number } | null) => void;
  tells: RefObject<Partial<Record<Side | "one", (message: CoreMessage) => void>>>;
  connectA: (tell: (message: CoreMessage) => void) => () => void;
  connectB: (tell: (message: CoreMessage) => void) => () => void;
}) {
  const { watermark } = useScale();
  const [track, setTrack] = useState(true);
  const [phoneSide, setPhoneSide] = useState<Side>("b");
  const [notes, setNotes] = useState<Partial<Record<Side, Note>>>({});
  const chosen = useRef<string[] | null>(null);
  const timers = useRef<Partial<Record<Side, number>>>({});

  const other = (side: Side): Side => (side === "a" ? "b" : "a");
  const say = useCallback((side: Side, note: Note | null) => {
    window.clearTimeout(timers.current[side]);
    setNotes((was) => ({ ...was, [side]: note ?? undefined }));
    if (note?.brief) timers.current[side] = window.setTimeout(() => setNotes((was) => ({ ...was, [side]: undefined })), BRIEF_MS);
  }, []);
  useEffect(() => () => Object.values(timers.current).forEach((timer) => window.clearTimeout(timer)), []);

  // The relay between the panels: a pointer lights, a choice brings, and the answer becomes the panel's note.
  const receive = (side: Side) => (message: PageMessage) => {
    if (message.type === "panel.counts") {
      if (side === "b") counts(message);
      return;
    }
    if (!track) return;
    if (message.type === "panel.pointer") {
      tells.current[other(side)]?.({ type: "panel.mark", chain: message.chain });
      if (!message.chain) say(other(side), null);
    } else if (message.type === "panel.choose") {
      chosen.current = message.chain;
      tells.current[other(side)]?.({ type: "panel.bring", chain: message.chain });
    } else if (message.type === "panel.shown") say(side, noteOf(message, side === "a" ? "A" : "B"));
  };

  // On a phone, switching to a panel brings what was chosen in the other.
  const flip = (side: Side) => {
    setPhoneSide(side);
    if (track && chosen.current) tells.current[side]?.({ type: "panel.bring", chain: chosen.current });
  };

  const now = watermark ? msOf(watermark) : 0;
  const label = (moment: string | null) => (moment === null ? "Now" : momentText(msOf(moment), now));
  const half = (side: Side) => {
    const context: MomentContext =
      // A is compared with B; B at now is compared as the watermark, since null would mean no comparison at all.
      side === "a" ? { at: from, against: at ?? watermark, side: "a", milestone: milestoneOn(from) } : { at, against: from, side: "b", milestone: milestoneOn(at) };
    const note = notes[side];
    return (
      <div className={`mx-half${side === phoneSide ? " phone-shown" : ""}`} key={side}>
        <div className="mx-half-head">
          <span className="mx-flip" role="radiogroup" aria-label="Panel">
            {(["a", "b"] as const).map((each) => (
              <button key={each} type="button" role="radio" aria-checked={phoneSide === each} className={`${each}${phoneSide === each ? " on" : ""}`} onClick={() => flip(each)}>
                {each.toUpperCase()}
              </button>
            ))}
          </span>
          <span className={`mx-half-side ${side}`}>{side.toUpperCase()}</span>
          <b>{label(context.at)}</b>
          {side === "b" ? (
            <button type="button" role="switch" aria-checked={track} className={`mx-track-switch${track ? " on" : ""}`} onClick={() => setTrack(!track)} title="Follow one element through both panels">
              Track
            </button>
          ) : null}
        </div>
        <div className="mx-half-body">
          <PageFrame {...props} key={side} context={context} connect={side === "a" ? connectA : connectB} onMessage={receive(side)} />
          {note ? (
            <div className="mx-half-note" role="status">
              {note.name ? <code>{note.name}</code> : null} {note.text}
            </div>
          ) : null}
        </div>
      </div>
    );
  };
  return <div className="mx-halves">{[half("a"), half("b")]}</div>;
}
