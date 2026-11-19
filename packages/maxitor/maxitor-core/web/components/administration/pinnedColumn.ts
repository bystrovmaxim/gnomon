/** Counter only horizontal canvas movement, in canvas units, without leaving the table. */
export function pinnedColumnOffset(left: number, width: number, columnWidth: number, zoom: number, inset = 0): number {
  if (zoom <= 0) return 0;
  return Math.max(0, Math.min((inset - left) / zoom, (width - columnWidth) / zoom));
}
