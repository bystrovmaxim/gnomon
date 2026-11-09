// src/lib/erdResourceSettings.ts
/**
 * The ERD's settings for its two views (spec 070): the view drawn, the resources switched off, and the resource frames
 * drawn folded (spec 065). All are page settings, so a room shares them and the address carries them (``model``,
 * ``off_resources``, ``folded``); the paint by resource is the ``paint`` / ``paint_diff`` setting every section of the
 * gear shift shares.
 */
import { useMemo } from "react";
import { usePageSetting } from "@/lib/pageSettings";
import type { ErdModelView } from "@/lib/erdViews";

export type ErdResourceSettings = {
  /** The view drawn; logical until someone chooses the physical one. */
  model: ErdModelView;
  setModel(model: ErdModelView): void;
  /** The resources whose frames are hidden in the physical view; a resource the graph gains later starts on. */
  disabledResources: ReadonlySet<string>;
  /** Switch one resource on or off: the whole new list is sent, never a toggle. */
  toggleResource(resource: string): void;
  /** The resource frames drawn folded (spec 065), by frame id: ``rc:<resource>``. */
  foldedContours: ReadonlySet<string>;
  /** Fold or unfold one frame: the whole new list is sent. */
  toggleFold(contour: string): void;
  /** Unfold every frame of ``contours`` that is folded. */
  unfold(contours: readonly string[]): void;
  /** Fold every frame this drawing shows (spec 071): the boundaries' own switch, apart from the tables'. */
  foldAll(contours: readonly string[]): void;
  /** Unfold every frame. */
  unfoldAll(): void;
};

export function useErdResourceSettings(): ErdResourceSettings {
  const [chosenModel, setModel] = usePageSetting<ErdModelView>("model", "logical");
  // An address or a room may carry anything: what is not the physical view is the logical one.
  const model: ErdModelView = chosenModel === "physical" ? "physical" : "logical";
  const [disabledList, setDisabledList] = usePageSetting<string[]>("disabled_resources", []);
  const disabledResources = useMemo(() => new Set(disabledList), [disabledList]);
  const toggleResource = (resource: string) => {
    const next = new Set(disabledResources);
    if (next.has(resource)) next.delete(resource);
    else next.add(resource);
    setDisabledList([...next].sort());
  };
  const [foldedList, setFoldedList] = usePageSetting<string[]>("folded_contours", []);
  const foldedContours = useMemo(() => new Set(foldedList), [foldedList]);
  const toggleFold = (contour: string) => {
    const next = new Set(foldedContours);
    if (next.has(contour)) next.delete(contour);
    else next.add(contour);
    setFoldedList([...next].sort());
  };
  const unfold = (contours: readonly string[]) => {
    if (!contours.some((contour) => foldedContours.has(contour))) return;
    setFoldedList([...foldedContours].filter((contour) => !contours.includes(contour)).sort());
  };
  const foldAll = (contours: readonly string[]) => setFoldedList([...new Set(contours)].sort());
  const unfoldAll = () => setFoldedList([]);
  return { model, setModel, disabledResources, toggleResource, foldedContours, toggleFold, unfold, foldAll, unfoldAll };
}
