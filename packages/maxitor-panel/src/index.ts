// @maxitor/panel — everything a Maxitor plugin's page draws with in the core's right panel.
export { PanelDocument } from "./PanelDocument";
export { PanelPage } from "./PanelPage";
export { momentFrom, useOpenPanel, usePanelPath, usePanelQuery, usePanelRouter, useWatermark } from "./hooks";
export { MaxitorCanvas, useCanvas } from "./canvas/MaxitorCanvas";
export type { Bounds, Camera, Point } from "./canvas/camera";
export { Card } from "./content/Card";
export { DataTable, type Column } from "./content/DataTable";
export { coreMessage, pageMessage, trusted, type CoreMessage, type PageMessage, type Query } from "./protocol";
