// src/components/diagrams/ElementCard/ElementCard.tsx
import { useHalf } from "@/lib/half";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getActiveBase } from "@/api/client";
import { fetchElementCard, type ElementCardRead } from "@/api/elementCard";
import { DiffBody, StatusIcon } from "@/components/history/DiffCard";
import { cardFieldsOpen, rememberCardFieldsOpen } from "@/lib/cardFieldsOpen";
import { placeCard, type CardAround } from "@/lib/cardPlace";
import { MARK_LOOK, type CardTarget } from "@/lib/erdDiffCard";
import { wordPieces } from "@/lib/relationGlyphs";
import { isFollowing, reportPanels, useShownPanel, type CardPanel, type ElementRef } from "@/rooms/focusStore";
import { LifecycleMiniature } from "./LifecycleMiniature";

export type CardProjection = { toDiagram: (point: Point) => Point; toStage: (point: Point) => Point };

/** One row of a table's card. */
export type CardField = {
  name: string;
  type?: string;
  key?: "PK" | "FK";
  description?: string | null;
  /** What happened to it in Diff, when something did. */
  status?: keyof typeof MARK_LOOK;
  /** Its type in A, when it differs. */
  previousType?: string;
  /** The lifecycle it is, when it is one. */
  lifecycleId?: string | null;
  /** The node it is, when it is one of its own — a frame's table: its description is read when it is pointed at. */
  nodeId?: string;
};

/** One end of a relation as its card shows it: the table, the field on it, and how many of it the end stands for. */
export type CardRelationEnd = { table: string; field?: string | null; count: string; icon: string };

/**
 * A relation as its card shows it (spec 071), built as a table's card is: its name — the field that holds it — with the
 * mark of its kind, a grey line saying what it is (``Association · many to one``), and under a rule its two ends, each
 * labelled, with the line's own mark for it.
 */
export type CardRelation = { name: string; kind: string; shape: string; kindIcon: string; from: CardRelationEnd; to: CardRelationEnd };

/** One row that leads on to another page. */
export type CardLink = { group: string; label: string; onOpen: () => void };

/** What a card is about and what the diagram already knows of it. */
export type CardSubject = {
  key: string;
  ref: ElementRef;
  title: string;
  /** Its type or what it is, as the diagram holds it. */
  detail: string;
  /** A description the diagram already holds; else it is read. */
  description?: string | null;
  /** The node the server is asked about; a line's card asks nothing. */
  nodeId: string | null;
  /** What the comparison says of it, in Diff, when it changed. */
  change: CardTarget | null;
  /** The lifecycles it is or holds, each drawn small. */
  lifecycleIds?: readonly string[];
  fields?: readonly CardField[];
  /** What one of ``fields`` is called: ``field`` for a table, ``relation`` for a bundle (spec 065). */
  fieldNoun?: string;
  /** Rows that lead on to another page, under their group's title, in order. */
  links?: readonly CardLink[];
  /** The icon of its kind, as the full graph draws it, beside the title (a ``data:`` URL). */
  icon?: string;
  /** A relation's kind and ends, drawn in place of its title line (spec 071). */
  relation?: CardRelation;
  /** A name to copy; a phone has no click on it. */
  copy?: string;
  at: { x: number; y: number };
  /** What it stands beside, to place it round: without it, it stays at ``at``, lifted to fit. */
  around?: CardAround;
  /** Between the stage and the diagram: a card's place is said on the diagram, so a follower sets it on the same spot. */
  project?: CardProjection;
};

export type ElementCardProps = {
  subject: CardSubject;
  /** The newer version's name: what an element was added or removed in. */
  newer: string;
  onEnter: () => void;
  onLeave: () => void;
  onClose: () => void;
};

const UNCHANGED_COLOUR = "#94a3b8";
/** The field under the pointer: its type and description stand below. */
const POINTED_COLOUR = "#1d4ed8";

/** A touch screen has no pointer to rest or click with. */
function onTouchScreen(): boolean {
  return globalThis.matchMedia?.("(pointer: coarse)").matches ?? false;
}

function CopyName({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <ButtonBase
      data-testid="card-copy"
      onClick={() => void navigator.clipboard?.writeText(name).then(() => setCopied(true))}
      sx={{ mt: "6px", height: 26, px: 1, borderRadius: "6px", fontSize: 12, fontWeight: 600, color: "#0f172a", bgcolor: "rgba(15, 23, 42, 0.05)" }}
    >
      {copied ? "Copied" : "Copy name"}
    </ButtonBase>
  );
}

/** The longest a card stays unseen waiting for what it reads; then it shows what it has. */
const CARD_WAIT_MS = 500;
type Point = { x: number; y: number };

/** The narrowest drawn width that fills a card: a short lifecycle is not blown up past it. */
const MINIATURE_FULL_WIDTH = 420;
/** The gap a card keeps from the stage's edge. */
const CARD_EDGE_PX = 8;
/** How much of a followed card must show on a follower's screen, across and down, in CSS px. */
const FOLLOWED_CARD_SHOWN_PX = 120;

/**
 * A table's fields by name, what a table is made of; the type and description of the one under the pointer or finger stand
 * at the card's foot, a changed type with what it was, so the list stays quiet and nothing above it moves (spec 043, FR-006).
 */
function FieldList({ fields, open, pointed, onOpen, onPoint, noun = "field" }: { fields: readonly CardField[]; open: boolean; pointed: number | null; onOpen: () => void; onPoint: (row: number | null) => void; noun?: string }) {
  const rows = open ? fields.map((field, row) => ({ field, row })) : [];
  // Hidden, the list still says what changed in it: that is what a card from afar is for. Where every row changed, as in a
  // table that came or went whole, the card itself has said so.
  const counts = (["added", "removed", "changed"] as const).flatMap((status) => {
    const count = fields.filter((field) => field.status === status).length;
    return count > 0 && count < fields.length ? [{ status, count }] : [];
  });
  const shown = pointed === null ? undefined : fields[pointed];
  // A row that is a node of its own — a frame's table — has its description read when it is pointed at.
  const [read, setRead] = useState<{ id: string; description: string | null } | null>(null);
  useEffect(() => {
    const id = shown?.nodeId;
    if (!id || shown.description) return;
    let live = true;
    fetchElementCard(id)
      .then((answer) => live && setRead({ id, description: answer?.description ?? null }))
      .catch(() => live && setRead({ id, description: null }));
    return () => {
      live = false;
    };
  }, [shown?.nodeId, shown?.description]);
  const description = shown?.description ?? (shown?.nodeId && read?.id === shown.nodeId ? read.description : null);
  return (
    <Box sx={{ mt: "6px", borderTop: "1px solid rgba(15, 23, 42, 0.06)", pt: "4px" }}>
      <ButtonBase
        data-testid="card-fields-toggle"
        aria-expanded={open}
        onClick={onOpen}
        sx={{ display: "flex", alignItems: "center", gap: "4px", width: "100%", justifyContent: "flex-start", fontSize: 12, fontWeight: 600, color: "#475569", py: "1px" }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden style={{ transform: open ? "rotate(180deg)" : "none" }}>
          <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {fields.length} {noun}{fields.length === 1 ? "" : "s"}
        {counts.map(({ status, count }) => (
          <span key={status} data-testid="card-fields-count" style={{ color: MARK_LOOK[status].colour }}>
            {MARK_LOOK[status].sign}
            {count}
          </span>
        ))}
      </ButtonBase>
      {/* Leaving the list keeps the last row's foot: a foot that grows over the pointer must not take the row away and
          give it back, the list shaking under the pointer (#89). */}
      <Box data-testid="card-fields">
        {rows.map(({ field, row }) => (
          <Box key={row} data-testid="card-field" onMouseEnter={() => onPoint(row)} onClick={() => onPoint(row)} sx={{ display: "grid", gridTemplateColumns: "20px minmax(0, 1fr)", gap: "6px" }}>
            <Box sx={{ color: "#94a3b8", fontSize: 10, fontWeight: 700, lineHeight: "17px" }}>{field.key}</Box>
            <Box data-testid="card-field-name" sx={{ overflowWrap: "break-word", ...(pointed === row && { fontWeight: 600, color: POINTED_COLOUR }) }}>
              {field.status && <span style={{ color: MARK_LOOK[field.status].colour }}>{MARK_LOOK[field.status].sign} </span>}
              <Breakable text={field.name} />
            </Box>
          </Box>
        ))}
      </Box>
      {rows.length > 0 && (
        // The foot stays at the card's bottom while the list scrolls, as tall as what it says (#89).
        <Box
          data-testid="card-field-hint"
          sx={{ position: "sticky", bottom: "-10px", mx: "-12px", px: "12px", pb: "10px", mb: "-10px", mt: "4px", pt: "4px", bgcolor: "#fff", borderTop: "1px solid rgba(15, 23, 42, 0.06)", color: "#64748b", wordBreak: "break-word" }}
        >
          {shown ? (
            <Box data-testid="card-field-shown">
              <Box sx={{ color: "#0f172a" }}>
                {shown.previousType !== undefined && (
                  <>
                    <s>{shown.previousType}</s> →{" "}
                  </>
                )}
                {shown.type}
              </Box>
              <Box data-testid="card-field-description">{description}</Box>
            </Box>
          ) : (
            <Box data-testid="card-field-shown" sx={{ color: UNCHANGED_COLOUR }}>
              {onTouchScreen() ? `Tap a ${noun}` : `Hover a ${noun}`}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

/** ``text`` with a place to break between its words — a long CamelCase name wraps between them, not inside one. */
function Breakable({ text }: { text: string }) {
  const pieces = wordPieces(text);
  return (
    <>
      {pieces.map((piece, at) => (
        <span key={at}>
          {at > 0 && <wbr />}
          {piece}
        </span>
      ))}
    </>
  );
}

/** A relation's two ends, one per row: the line's own mark for the end, the table, then the field and how many. */
function RelationEnds({ relation }: { relation: CardRelation }) {
  return (
    <Box data-testid="card-relation" sx={{ mt: "6px", pt: "6px", borderTop: "1px solid rgba(15, 23, 42, 0.06)", display: "grid", gridTemplateColumns: "34px 26px minmax(0, 1fr)", columnGap: "6px", rowGap: "6px", alignItems: "start" }}>
      {([["From", relation.from], ["To", relation.to]] as const).map(([side, end]) => (
        <Box key={side} data-testid="card-relation-end" sx={{ display: "contents" }}>
          <Box sx={{ color: "#94a3b8", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", lineHeight: "18px" }}>{side}</Box>
          <img src={end.icon} alt={end.count} width={26} height={14} style={{ marginTop: 2 }} />
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ fontWeight: 600, color: "#0f172a", overflowWrap: "break-word" }}>
              <Breakable text={end.table} />
            </Box>
            <Box sx={{ color: "#64748b", overflowWrap: "break-word" }}>
              {end.field && (
                <>
                  <Box component="span" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, color: "#334155" }}>
                    <Breakable text={end.field} />
                  </Box>
                  {" · "}
                </>
              )}
              {end.count}
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/** The rows that lead on, under their groups. */
function LinkList({ links }: { links: readonly CardLink[] }) {
  const groups = [...new Set(links.map((link) => link.group))];
  return (
    <>
      {groups.map((group) => (
        <Box key={group} data-testid="card-links" sx={{ mt: "6px", borderTop: "1px solid rgba(15, 23, 42, 0.06)", pt: "4px" }}>
          <Box sx={{ fontWeight: 600, color: "#475569" }}>{group}</Box>
          {links
            .filter((link) => link.group === group)
            .map((link) => (
              <ButtonBase key={link.label} data-testid="card-link" onClick={link.onOpen} sx={{ display: "block", width: "100%", textAlign: "left", fontSize: 12, lineHeight: 1.45, color: POINTED_COLOUR, overflowWrap: "anywhere" }}>
                {link.label}
              </ButtonBase>
            ))}
        </Box>
      ))}
    </>
  );
}

/**
 * The one card of Maxitor (spec 043, FR-001): what an element is, its description, what changed in it in Diff, a table's
 * fields and a lifecycle's picture. The diagram's own knowledge shows at once; a read that fails takes nothing away.
 */
export function ElementCard({ subject, newer, onEnter, onLeave, onClose }: ElementCardProps) {
  const [read, setRead] = useState<ElementCardRead | null>(null);
  const [failed, setFailed] = useState(false);
  const [answered, setAnswered] = useState(subject.nodeId === null);
  const [drawn, setDrawn] = useState<Readonly<Record<string, number>>>({});
  const [waited, setWaited] = useState(false);
  const side = useHalf()?.side ?? null;
  const [ownInside, setOwnInside] = useState<CardPanel>(() => ({ ref: subject.ref, fields: cardFieldsOpen(), field: null, scroll: 0, at: null }));
  // A follower sees inside the card too: the list, the field pointed at and the scroll (FR-010).
  const inside = useShownPanel<CardPanel>(ownInside, setOwnInside, (panels) => panels.card ?? ownInside, (value) => ({ card: value, cardHalf: side }));
  useEffect(() => () => reportPanels({ card: null, cardHalf: null }), []);
  const cardRef = useRef<HTMLDivElement>(null);
  const { nodeId, change, title, detail, fields, copy, at, around, project } = subject;
  // In a comparison every card wears a status: an unchanged element says so where a changed one says what happened.
  const unchanged = change === null && getActiveBase() !== null;
  const lifecycleIds = subject.lifecycleIds?.length ? subject.lifecycleIds : read?.lifecycle_id ? [read.lifecycle_id] : [];

  useEffect(() => {
    let live = true;
    setRead(null);
    setFailed(false);
    setAnswered(nodeId === null);
    if (nodeId)
      fetchElementCard(nodeId)
        .then(
          (answer) => live && setRead(answer),
          () => live && setFailed(true),
        )
        .finally(() => live && setAnswered(true));
    return () => {
      live = false;
    };
  }, [nodeId]);

  const fullWidth = Math.max(MINIATURE_FULL_WIDTH, ...Object.values(drawn));
  /** The lifecycle whose field is pointed at: its picture stays bright, the others dim. */
  const litLifecycle = (inside.field === null ? null : fields?.[inside.field]?.lifecycleId) ?? null;

  useEffect(() => {
    if (isFollowing() && cardRef.current) cardRef.current.scrollTop = inside.scroll;
  }, [inside.scroll]);

  // Unseen until what it reads has come, so it opens once, whole, where it will stay.
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), CARD_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  const said = isFollowing() ? inside.at : null;
  const ready = waited || (answered && lifecycleIds.every((id) => id in drawn) && (!isFollowing() || said !== null));

  // Placed before the frame is painted, knowing its size; what grows later scrolls inside it.
  useLayoutEffect(() => {
    const card = cardRef.current;
    const stage = card?.offsetParent;
    if (!card || !stage || !ready) return;
    const size = { width: card.offsetWidth, height: card.offsetHeight };
    const onStage = (point: Point) => ({
      x: Math.max(CARD_EDGE_PX, Math.min(point.x, stage.clientWidth - size.width - CARD_EDGE_PX)),
      y: Math.max(CARD_EDGE_PX, Math.min(point.y, stage.clientHeight - size.height - CARD_EDGE_PX)),
    });
    // A follower's card stands on the leader's spot of the diagram: on a smaller screen it may run past the right or the
    // foot edge, as the leader's picture does, so long as enough of it shows to be read; only the left and top keep in.
    const following = (point: Point) => ({
      x: Math.max(CARD_EDGE_PX, Math.min(point.x, stage.clientWidth - Math.min(size.width, FOLLOWED_CARD_SHOWN_PX))),
      y: Math.max(CARD_EDGE_PX, Math.min(point.y, stage.clientHeight - Math.min(size.height, FOLLOWED_CARD_SHOWN_PX))),
    });
    const place = said && project ? following(project.toStage(said)) : around ? placeCard(stage.getBoundingClientRect(), size, around) : onStage(at);
    card.style.left = `${place.x}px`;
    card.style.top = `${place.y}px`;
    card.style.maxHeight = `${stage.clientHeight - place.y - CARD_EDGE_PX}px`;
    if (isFollowing() || !project) return;
    const onDiagram = project.toDiagram(place);
    const spot = { x: Math.round(onDiagram.x * 1000) / 1000, y: Math.round(onDiagram.y * 1000) / 1000 };
    setOwnInside((now) => (now.at?.x === spot.x && now.at?.y === spot.y ? now : { ...now, at: spot }));
  }, [around, at, project, ready, said, subject]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Paper
      role="dialog"
      aria-label={`About ${title}`}
      elevation={0}
      data-testid="element-card"
      ref={cardRef}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onScroll={(event) => {
        const scroll = Math.round(event.currentTarget.scrollTop);
        setOwnInside((now) => (now.scroll === scroll ? now : { ...now, scroll }));
      }}
      sx={{
        position: "absolute",
        visibility: ready ? "visible" : "hidden",
        // A follower's card is the followed person's: their own pointer must not hold it open.
        pointerEvents: isFollowing() ? "none" : "auto",
        left: at.x,
        top: at.y,
        zIndex: 60,
        width: 300,
        maxHeight: `calc(100% - ${at.y + 8}px)`,
        boxSizing: "border-box",
        overflowY: "auto",
        p: "10px 12px",
        fontSize: 12,
        lineHeight: 1.45,
        bgcolor: "#fff",
        border: "1px solid rgba(15, 23, 42, 0.1)",
        borderRadius: "8px",
        boxShadow: "0 8px 30px rgba(15, 23, 42, 0.14), 0 1px 2px rgba(15, 23, 42, 0.06)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, fontWeight: 600, color: "#0f172a" }}>
        <Box component="span" sx={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
          {(subject.relation?.kindIcon ?? subject.icon) && <img data-testid="card-icon" src={subject.relation?.kindIcon ?? subject.icon} alt="" width={18} height={18} style={{ flexShrink: 0 }} />}
          <span style={{ minWidth: 0, overflowWrap: "break-word" }}><Breakable text={subject.relation ? subject.relation.name : title} /></span>
        </Box>
        {change && <StatusIcon status={change.status} />}
        {unchanged && <StatusIcon status="unchanged" />}
      </Box>
      {subject.relation && (
        <Box data-testid="card-detail" sx={{ color: "#64748b" }}>
          {subject.relation.kind} · {subject.relation.shape}
        </Box>
      )}
      {detail && (
        <Box data-testid="card-detail" sx={{ color: "#64748b", whiteSpace: "pre-line", wordBreak: "break-word" }}>
          {detail}
        </Box>
      )}
      {(subject.description ?? read?.description) && (
        <Box data-testid="card-description" sx={{ mt: "4px", color: "#0f172a" }}>
          {subject.description ?? read?.description}
        </Box>
      )}
      {subject.relation && <RelationEnds relation={subject.relation} />}
      {typeof read?.vocabulary === "boolean" && (
        <Box data-testid="card-vocabulary" sx={{ mt: "4px", color: "#64748b" }}>
          {read.vocabulary ? "Vocabulary" : "No vocabulary"}
        </Box>
      )}
      {failed && (
        <Box data-testid="card-unread" sx={{ mt: "4px", color: "#64748b" }}>
          The rest could not be read.
        </Box>
      )}
      {change && <DiffBody target={change} newer={newer} />}
      {lifecycleIds.map((id) => (
        <LifecycleMiniature
          key={id}
          lifecycleId={id}
          fullWidth={fullWidth}
          dimmed={litLifecycle !== null && litLifecycle !== id}
          onSettled={(width) => setDrawn((known) => ({ ...known, [id]: width }))}
        />
      ))}
      {fields && (
        <FieldList
          noun={subject.fieldNoun}
          fields={fields}
          open={inside.fields}
          pointed={inside.field}
          onOpen={() => {
            rememberCardFieldsOpen(!inside.fields);
            setOwnInside((now) => ({ ...now, fields: !now.fields }));
          }}
          onPoint={(row) => setOwnInside((now) => ({ ...now, field: row }))}
        />
      )}
      {subject.links && <LinkList links={subject.links} />}
      {copy && onTouchScreen() && <CopyName name={copy} />}
    </Paper>
  );
}
