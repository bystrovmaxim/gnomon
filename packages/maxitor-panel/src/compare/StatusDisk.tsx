// One production SVG for filters, change cards and plugin state counts, shared with the graph viewer.
import { statusDiskSvg } from "@maxitor/tokens/status-disks";

export function StatusDisk({ fill, sign, className = "mx-disk", label, size = 14 }: { fill: string; sign: string; className?: string; label?: string; size?: number }) {
  return (
    <span
      className={`mx-status-disk ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={label}
      dangerouslySetInnerHTML={{ __html: statusDiskSvg(fill, sign, size) }}
    />
  );
}
