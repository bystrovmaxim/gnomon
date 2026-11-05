// src/lib/erdResourceSettings.ts
/**
 * The ERD's settings for resources (spec 061): the resources switched off and Boundary. Both are page settings, so a
 * room shares them and the address carries them (``off_resources``, ``boundary``); the paint by resource is the
 * ``paint`` / ``paint_diff`` setting every section of the gear shift shares.
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
};

export function useErdResourceSettings(): ErdResourceSettings {
  const [disabledList, setDisabledList] = usePageSetting<string[]>("disabled_resources", []);
  const [boundary, setBoundary] = usePageSetting("boundary", true);
  const disabledResources = useMemo(() => new Set(disabledList), [disabledList]);
  const toggleResource = (resource: string) => {
    const next = new Set(disabledResources);
    if (next.has(resource)) next.delete(resource);
    else next.add(resource);
    setDisabledList([...next].sort());
  };
  return { disabledResources, toggleResource, boundary, setBoundary };
}
