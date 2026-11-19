"use client";
import { createContext, useContext, useEffect, type Dispatch, type SetStateAction } from "react";
import type { Layers } from "@maxitor/panel";

export const AdministrationLayers = createContext<Dispatch<SetStateAction<Layers | undefined>>>(() => {});

/** Publish choices to PanelPage.layers; the content renders no navigation of its own. */
export function useAdministrationLayers(layers: Layers) {
  const setLayers = useContext(AdministrationLayers);
  const key = JSON.stringify(layers);
  useEffect(() => {
    setLayers(layers);
    return () => setLayers(undefined);
  }, [setLayers, key]);
}
