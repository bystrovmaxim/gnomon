"use client";
import { MaxitorCanvas } from "@maxitor/panel";
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";

/** Start at readable 100%; content changes never silently refit the camera or resize text. */
export function AdminCanvas({ children, filters, fullWidth = false, minWidth = 280 }: { children: ReactNode; filters: boolean; fullWidth?: boolean; minWidth?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(0);
  const [height, setHeight] = useState(700);
  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    const measure = () => setViewport(element.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(host.current); measure();
    return () => observer.disconnect();
  }, []);
  const phone = viewport <= 520;
  useEffect(() => {
    if (!scene.current) return;
    const element = scene.current;
    const measure = () => setHeight(element.scrollHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(scene.current); measure();
    return () => observer.disconnect();
  }, [Boolean(viewport), filters, phone]);
  const left = filters && !phone ? 184 : 24;
  const top = filters && phone ? 72 : 24;
  const width = Math.max(minWidth, Math.min(fullWidth ? Infinity : 1100, viewport - left - 24));
  return <div ref={host} className="admin-canvas-host">{viewport ? <MaxitorCanvas key={`${filters}:${phone}`} label="Administration canvas" bounds={{x:0,y:0,width,height}} initialCamera={{x:left,y:top,zoom:1}}><div ref={scene} className="admin-scene" style={{width, "--admin-visible-width": `${Math.max(280,viewport-left-24)}px`} as CSSProperties}>{children}</div></MaxitorCanvas> : null}</div>;
}
