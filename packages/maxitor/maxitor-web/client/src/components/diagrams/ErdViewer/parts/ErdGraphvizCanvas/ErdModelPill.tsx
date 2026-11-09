// src/components/diagrams/ErdViewer/parts/ErdGraphvizCanvas/ErdModelPill.tsx
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Tooltip from "@mui/material/Tooltip";
import type { ErdModelView } from "@/lib/erdViews";
import { useReserveTopCentre } from "@/lib/topCentre";

const VIEWS: { value: ErdModelView; label: string; counted: string }[] = [
  { value: "logical", label: "Logical", counted: "domains" },
  { value: "physical", label: "Physical", counted: "resources" },
];

/** Where the pill stands and how tall it is, as the events page's pill. */
const PILL_TOP = 14;
const PILL_HEIGHT = 32;

/**
 * The light pill at the top of the ERD (spec 070): the logical view and the physical one, each with what it frames —
 * the domains drawn, the resources drawn. The physical half is disabled, and says why, when the graph does not tell
 * where entities lie, or when no resource keeps a table of the base (spec 071).
 */
export function ErdModelPill({
  model,
  counts,
  physicalKnown,
  physicalAvailable,
  onModel,
}: {
  model: ErdModelView;
  counts: Record<ErdModelView, number>;
  physicalKnown: boolean;
  physicalAvailable: boolean;
  onModel: (model: ErdModelView) => void;
}) {
  useReserveTopCentre(PILL_TOP + PILL_HEIGHT + PILL_TOP - 12);
  const unavailableReason = (value: ErdModelView) =>
    value !== "physical" || physicalAvailable ? null : physicalKnown ? "No resource keeps these tables" : "This graph does not say where entities lie: it is older than protocol 1.6";
  return (
    <Box role="radiogroup" aria-label="View" sx={{ position: "absolute", top: PILL_TOP, left: "50%", transform: "translateX(-50%)", zIndex: 45, display: "flex", p: "2px", gap: "1px", bgcolor: "rgba(241,245,249,0.88)", backdropFilter: "blur(8px)", borderRadius: 999, border: "1px solid rgba(15,23,42,0.07)" }}>
      {VIEWS.map(({ value, label, counted }) => {
        const on = value === model;
        const disabled = value === "physical" && !physicalAvailable;
        const pill = (
          <ButtonBase
            key={value}
            role="radio"
            aria-checked={on}
            aria-disabled={disabled}
            disabled={disabled}
            data-testid={`erd-model-${value}`}
            onClick={() => onModel(value)}
            sx={{ display: "flex", alignItems: "center", gap: "6px", px: "12px", height: 26, borderRadius: 999, fontSize: 12, fontWeight: 500, color: on ? "#0f172a" : disabled ? "#cbd5e1" : "#64748b", bgcolor: on ? "#ffffff" : "transparent", boxShadow: on ? "0 1px 2px rgba(15,23,42,0.10), 0 0 0 0.5px rgba(15,23,42,0.06)" : "none", transition: "background-color 180ms, color 180ms, box-shadow 180ms", "&:hover": { color: disabled ? "#cbd5e1" : "#0f172a" } }}
          >
            {label}
            <Box component="span" aria-label={`${counts[value]} ${counted}`} sx={{ fontSize: 10.5, fontWeight: 400, color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>
              {disabled ? "—" : counts[value]}
            </Box>
          </ButtonBase>
        );
        const reason = unavailableReason(value);
        return reason !== null ? (
          <Tooltip key={value} title={reason} placement="bottom">
            <span>{pill}</span>
          </Tooltip>
        ) : (
          pill
        );
      })}
    </Box>
  );
}
