// @maxitor/panel — one canvas for every plugin (the plugin concept, 7.7): moving and zooming by drag, the wheel, a
// two-finger swipe, a pinch, Ctrl/⌘ with the wheel and keys, within limits; fit; the field of dots moving with the
// picture; the camera. Its zoom stands first in the shell's bottom bar (spec 078, FR-006), and a fit keeps the scene
// clear of the shell's controls. A page puts only its content in canvas coordinates; it cannot change the
// gestures. The viewport is never written into the address: everyone has their own screen.
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import "./canvas.css";
import { useShell } from "../shell/ShellContext";
import { centreOn, fitInside, key, pinch, toCanvas, toScreen, wheel, zoomAround, ZOOM_STEP, type Bounds, type Camera, type Point } from "./camera";

/** Finds where an anchor lies on the canvas, or null when it is not one of its own. */
export type Locator = (anchor: string) => Bounds | null;

type CanvasApi = {
  camera: Camera;
  /** The canvas's size on the screen, in screen pixels. */
  viewport: { width: number; height: number };
  /** Let the content say where its anchors lie, every one of them, drawn or not (spec 081, FR-002); answers a remover. */
  register: (locator: Locator) => () => void;
  /** Where an anchor lies on the canvas, or null when no content knows it. */
  locate: (anchor: string) => Bounds | null;
  /** Show ``bounds`` whole, or the whole scene. */
  fit: (bounds?: Bounds) => void;
  /** Bring a canvas point to the middle. */
  show: (point: Point) => void;
  toCanvas: (screen: Point) => Point;
  toScreen: (point: Point) => Point;
};

const CanvasContext = createContext<CanvasApi | null>(null);

/** The canvas the page's content lies on: its camera and what a page may ask of it. */
export function useCanvas(): CanvasApi {
  const canvas = useContext(CanvasContext);
  if (!canvas) throw new Error("@maxitor/panel: useCanvas is called inside MaxitorCanvas");
  return canvas;
}

/** The canvas around, or null when the content is not laid on one. */
export function useCanvasOrNull(): CanvasApi | null {
  return useContext(CanvasContext);
}

export function MaxitorCanvas({ bounds, children, label = "Canvas" }: { bounds: Bounds; children: ReactNode; label?: string }) {
  const field = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const fitted = useRef(false);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ camera: Camera; from: Point[] } | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const locators = useRef(new Set<Locator>());

  useEffect(() => {
    const element = field.current;
    if (!element) return;
    const measure = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const size = useCallback(() => {
    const box = field.current?.getBoundingClientRect();
    return { width: box?.width ?? 0, height: box?.height ?? 0, left: box?.left ?? 0, top: box?.top ?? 0 };
  }, []);

  const shell = useShell();
  const fitTo = useCallback(
    (target?: Bounds) => {
      const { width, height, left, top } = size();
      const reserve = shell?.reserve() ?? { left: 0, top: 0, bottom: 0 };
      // The shell measures in the window; the canvas fits in its own box.
      const insets = { left: Math.max(0, reserve.left - left), top: Math.max(0, reserve.top - top), bottom: reserve.bottom };
      if (width && height) setCamera(fitInside(target ?? bounds, width, height, insets));
    },
    [bounds, shell, size],
  );

  // The scene opens fitted, once; later the person's camera is theirs. The shell draws its bottom bar only once the
  // canvas gave it the zoom, so the first fit waits a frame and keeps the scene clear of the bar, as Fit later does.
  const latestFit = useRef(fitTo);
  latestFit.current = fitTo;
  // A panel still hidden has no size yet: the first fit waits until the field has one.
  useEffect(() => {
    if (fitted.current || !viewport.width || !viewport.height) return;
    fitted.current = true;
    // After this commit, once the shell has drawn its controls; a timer runs in a panel still hidden, a frame does not.
    window.setTimeout(() => latestFit.current(), 0);
  }, [fitTo, viewport.width, viewport.height]);

  // The wheel is listened to directly: React's listener is passive and could not keep the page from scrolling.
  useEffect(() => {
    const element = field.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { left, top, height } = size();
      setCamera((was) => wheel(was, event, { x: event.clientX - left, y: event.clientY - top }, height));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [size]);

  const local = (event: { clientX: number; clientY: number }): Point => {
    const { left, top } = size();
    return { x: event.clientX - left, y: event.clientY - top };
  };

  const begin = () => {
    gesture.current = { camera, from: [...pointers.current.values()] };
  };

  const api = useMemo<CanvasApi>(
    () => ({
      camera,
      viewport,
      register: (locator) => {
        locators.current.add(locator);
        return () => locators.current.delete(locator);
      },
      locate: (anchor) => {
        for (const locator of locators.current) {
          const found = locator(anchor);
          if (found) return found;
        }
        return null;
      },
      fit: fitTo,
      show: (point) => {
        const { width, height } = size();
        setCamera((was) => centreOn(was, point, width, height));
      },
      toCanvas: (screen) => toCanvas(camera, screen),
      toScreen: (point) => toScreen(camera, point),
    }),
    [camera, fitTo, size, viewport],
  );

  const middle = useCallback(() => {
    const { width, height } = size();
    return { x: width / 2, y: height / 2 };
  }, [size]);

  // The shell draws the zoom first in its bottom bar; the canvas only tells it the zoom and what its buttons do.
  useEffect(() => {
    shell?.setZoom({
      zoom: camera.zoom,
      zoomIn: () => setCamera((was) => zoomAround(was, middle(), ZOOM_STEP)),
      zoomOut: () => setCamera((was) => zoomAround(was, middle(), 1 / ZOOM_STEP)),
      fit: () => fitTo(),
    });
  }, [camera.zoom, fitTo, middle, shell]);
  useEffect(() => () => shell?.setZoom(null), [shell]);

  return (
    <CanvasContext.Provider value={api}>
      <div
        ref={field}
        className="mx-canvas"
        role="application"
        aria-label={label}
        tabIndex={0}
        data-zoom={camera.zoom.toFixed(3)}
        style={{
          backgroundPosition: `${camera.x}px ${camera.y}px`,
          backgroundSize: `calc(var(--mx-dot-step) * ${camera.zoom}) calc(var(--mx-dot-step) * ${camera.zoom})`,
        }}
        onKeyDown={(event) => {
          const { width, height } = size();
          const next = key(camera, event.key, middle(), bounds, width, height);
          if (next) {
            event.preventDefault();
            setCamera(next);
          }
        }}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button, a, input, textarea, select")) return;
          field.current?.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, local(event));
          begin();
        }}
        onPointerMove={(event) => {
          if (!pointers.current.has(event.pointerId) || !gesture.current) return;
          pointers.current.set(event.pointerId, local(event));
          const now = [...pointers.current.values()];
          const { camera: was, from } = gesture.current;
          if (now.length >= 2 && from.length >= 2) setCamera(pinch(was, [from[0], from[1]], [now[0], now[1]]));
          else if (now.length === 1 && from.length === 1) setCamera({ ...was, x: was.x + now[0].x - from[0].x, y: was.y + now[0].y - from[0].y });
        }}
        onPointerUp={(event) => {
          pointers.current.delete(event.pointerId);
          begin();
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          begin();
        }}
      >
        <div className="mx-canvas-scene" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
          {children}
        </div>
      </div>
    </CanvasContext.Provider>
  );
}
