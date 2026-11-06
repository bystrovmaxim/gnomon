// src/lib/erdResourceSettings.ts
/**
 * The ERD's settings for resources (spec 061) and data sources (spec 063): the resources switched off, the data sources
 * switched off, Boundary, and the contours drawn folded (spec 065). All are page settings, so a room shares them and the
 * address carries them (``off_resources``, ``off_data_sources``, ``boundary``, ``folded``); the paint by resource or by
 * data source is the ``paint`` / ``paint_diff`` setting every section of the gear shift shares.
 */
import { useMemo } from "react";
import { usePageSetting } from "@/lib/pageSettings";

export type ErdResourceSettings = {
  /** The resources whose tables are hidden; a resource the graph gains later starts on. */
  disabledResources: ReadonlySet<string>;
  /** Switch one resource on or off: the whole new list is sent, never a toggle. */
  toggleResource(resource: string): void;
  /** One contour per resource; on until someone turns it off, as the use-case diagram's Boundary. */
  boundary: boolean;
  setBoundary(on: boolean): void;
  /** The data sources whose tables are hidden; ``NO_DATA_SOURCE`` stands for the resources that name none. */
  disabledDataSources: ReadonlySet<string>;
  /** Switch one data source on or off: the whole new list is sent, never a toggle. */
  toggleDataSource(source: string): void;
  /** The contours drawn folded (spec 065), by contour id: ``rc:<resource>``, ``dc:<data source>``. */
  foldedContours: ReadonlySet<string>;
  /** Fold or unfold one contour: the whole new list is sent. */
  toggleFold(contour: string): void;
  /** Unfold every contour of ``contours`` that is folded. */
  unfold(contours: readonly string[]): void;
};

export function useErdResourceSettings(): ErdResourceSettings {
  const [disabledList, setDisabledList] = usePageSetting<string[]>("disabled_resources", []);
  const [boundary, setBoundary] = usePageSetting("boundary", true);
  const disabledResources = useMemo(() => new Set(disabledList), [disabledList]);
  const [disabledSourceList, setDisabledSourceList] = usePageSetting<string[]>("disabled_data_sources", []);
  const disabledDataSources = useMemo(() => new Set(disabledSourceList), [disabledSourceList]);
  const toggleDataSource = (source: string) => {
    const next = new Set(disabledDataSources);
    if (next.has(source)) next.delete(source);
    else next.add(source);
    setDisabledSourceList([...next].sort());
  };
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
  return { disabledResources, toggleResource, boundary, setBoundary, disabledDataSources, toggleDataSource, foldedContours, toggleFold, unfold };
}
