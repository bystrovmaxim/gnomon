// @maxitor/panel — the canvas's camera: where the canvas's origin stands on the screen and how far it is zoomed. Pure
// functions, so every plugin moves and zooms the same way (spec 077, FR-030 – FR-032). Made from the graph viewer's
// gestures: a wheel or a two-finger swipe moves, Ctrl/⌘ with the wheel or a pinch zooms around the pointer.

export type Point = { x: number; y: number };
export type Bounds = { x: number; y: number; width: number; height: number };
/** The screen position of the canvas's origin and the zoom: screen = canvas * zoom + (x, y). */
export type Camera = { x: number; y: number; zoom: number };

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
/** How much one wheel pixel zooms, as on every diagram of Maxitor. */
export const WHEEL_ZOOM = 0.0045;
/** One step of the zoom buttons and keys. */
export const ZOOM_STEP = 1.2;
/** How far an arrow key moves, in screen pixels. */
export const KEY_STEP = 48;
/** The free margin around a fitted scene, in screen pixels. */
export const FIT_MARGIN = 32;
/** Pixels per line when a browser counts the wheel in lines. */
const LINE = 16;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function toCanvas(camera: Camera, screen: Point): Point {
  return { x: (screen.x - camera.x) / camera.zoom, y: (screen.y - camera.y) / camera.zoom };
}

export function toScreen(camera: Camera, point: Point): Point {
  return { x: point.x * camera.zoom + camera.x, y: point.y * camera.zoom + camera.y };
}

/** Zoom by ``factor`` keeping the canvas point under ``around`` where it is on the screen. */
export function zoomAround(camera: Camera, around: Point, factor: number): Camera {
  const zoom = clampZoom(camera.zoom * factor);
  const anchor = toCanvas(camera, around);
  return { zoom, x: around.x - anchor.x * zoom, y: around.y - anchor.y * zoom };
}

export function moveBy(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy };
}

/** The camera that shows ``bounds`` whole in a viewport of ``width`` × ``height``, centred, within the zoom limits. */
export function fit(bounds: Bounds, width: number, height: number, margin = FIT_MARGIN): Camera {
  const room = { width: Math.max(1, width - 2 * margin), height: Math.max(1, height - 2 * margin) };
  const zoom = clampZoom(Math.min(room.width / Math.max(1, bounds.width), room.height / Math.max(1, bounds.height)));
  return {
    zoom,
    x: width / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: height / 2 - (bounds.y + bounds.height / 2) * zoom,
  };
}

/** The room a fit keeps clear at the panel's edges: the shell's filters, pills and bottom bar. */
export type Insets = { left: number; top: number; bottom: number };

/** The camera that shows ``bounds`` whole inside the part of the viewport the insets leave free. */
export function fitInside(bounds: Bounds, width: number, height: number, insets: Insets, margin = FIT_MARGIN): Camera {
  const free = { width: Math.max(1, width - insets.left), height: Math.max(1, height - insets.top - insets.bottom) };
  const camera = fit(bounds, free.width, free.height, margin);
  return { ...camera, x: camera.x + insets.left, y: camera.y + insets.top };
}

/** The camera that brings a canvas point to the middle of the viewport, at the same zoom. */
export function centreOn(camera: Camera, point: Point, width: number, height: number): Camera {
  return { ...camera, x: width / 2 - point.x * camera.zoom, y: height / 2 - point.y * camera.zoom };
}

/** What a wheel event does: zoom around the pointer with Ctrl/⌘ (a trackpad pinch), move otherwise. */
export function wheel(
  camera: Camera,
  event: { deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
  pointer: Point,
  page: number,
): Camera {
  const unit = event.deltaMode === 1 ? LINE : event.deltaMode === 2 ? page : 1;
  const dx = event.deltaX * unit;
  const dy = event.deltaY * unit;
  if (event.ctrlKey || event.metaKey) return zoomAround(camera, pointer, Math.exp(-dy * WHEEL_ZOOM));
  return event.shiftKey && dx === 0 ? moveBy(camera, -dy, 0) : moveBy(camera, -dx, -dy);
}

/** What a key does; null for a key the canvas leaves alone. */
export function key(camera: Camera, name: string, middle: Point, bounds: Bounds | null, width: number, height: number): Camera | null {
  switch (name) {
    case "+":
    case "=":
      return zoomAround(camera, middle, ZOOM_STEP);
    case "-":
    case "_":
      return zoomAround(camera, middle, 1 / ZOOM_STEP);
    case "0":
      return bounds ? fit(bounds, width, height) : null;
    case "ArrowLeft":
      return moveBy(camera, KEY_STEP, 0);
    case "ArrowRight":
      return moveBy(camera, -KEY_STEP, 0);
    case "ArrowUp":
      return moveBy(camera, 0, KEY_STEP);
    case "ArrowDown":
      return moveBy(camera, 0, -KEY_STEP);
    default:
      return null;
  }
}

/** A pinch: the camera that keeps the two fingers on the same canvas points as they move. */
export function pinch(start: Camera, from: [Point, Point], to: [Point, Point]): Camera {
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) || 1;
  const middle = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const zoomed = zoomAround(start, middle(...from), distance(...to) / distance(...from));
  const was = middle(...from);
  const now = middle(...to);
  return moveBy(zoomed, now.x - was.x, now.y - was.y);
}
