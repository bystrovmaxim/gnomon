// src/lib/erdResourceSettings.ts
/**
 * The ERD's settings for resources (spec 061) and data sources (spec 063): the resources switched off, the data sources
 * switched off, and Boundary. All are page settings, so a room shares them and the address carries them
 * (``off_resources``, ``off_data_sources``, ``boundary``); the paint by resource or by data source is the ``paint`` /
 * ``paint_diff`` setting every section of the gear shift shares.
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
  return { disabledResources, toggleResource, boundary, setBoundary, disabledDataSources, toggleDataSource };
}
