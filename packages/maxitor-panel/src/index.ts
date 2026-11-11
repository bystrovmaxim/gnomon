// @maxitor/panel — everything a Maxitor plugin's page draws with in the core's right panel.
export { PanelDocument } from "./PanelDocument";
export { PanelPage } from "./PanelPage";
export { Icon, hasIcon, type IconName } from "./shell/icons";
export { LAYER, PAINT, isReserved } from "./shell/address";
export type { BarSection, ButtonSection, ChoiceSection, FilterRow, FilterSection, LayerOption, Layers, PageAction, SwitchSection } from "./shell/types";
export { useOpenPanel, usePanelPath, usePanelQuery, usePanelRouter, useWatermark } from "./hooks";
export { momentFrom } from "./moment";
export { MaxitorCanvas, useCanvas } from "./canvas/MaxitorCanvas";
export type { Bounds, Camera, Insets, Point } from "./canvas/camera";
export { Card } from "./content/Card";
export { EmptyState } from "./content/EmptyState";
export { DataTable, type Column } from "./content/DataTable";
export { coreMessage, pageMessage, trusted, type CoreMessage, type PageMessage, type Query } from "./protocol";
