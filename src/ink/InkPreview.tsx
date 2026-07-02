import { useMemo } from "react";
import { decodeInkGeometry, inkPointsToPath } from "./geometry";
import {
  INK_COLOR_HEX,
  INK_COORDINATE_MAX,
  INK_WIDTH_PX,
  type InkStroke,
} from "./types";

export function InkPreview({ strokes }: { strokes: InkStroke[] }) {
  const groups = useMemo(() => {
    const visible = strokes.slice(-24);
    const ordinals = [...new Set(visible.map((stroke) => stroke.anchor.blockOrdinal))];
    const ordinalMap = new Map(ordinals.map((ordinal, index) => [ordinal, index]));
    const bandHeight = 80 / Math.max(1, ordinals.length);
    const paths = new Map<string, string>();

    for (const stroke of visible) {
      const band = ordinalMap.get(stroke.anchor.blockOrdinal) || 0;
      const points = decodeInkGeometry(stroke.geometry).map((point) => ({
        x: 10 + (point.x / INK_COORDINATE_MAX) * 300,
        y: 8 + band * bandHeight + (point.y / INK_COORDINATE_MAX) * bandHeight,
      }));
      const d = inkPointsToPath(points);
      if (!d) continue;
      const key = `${stroke.color}:${stroke.width}`;
      paths.set(key, `${paths.get(key) || ""} ${d}`);
    }
    return [...paths.entries()];
  }, [strokes]);

  return (
    <svg
      viewBox="0 0 320 96"
      className="h-20 w-full rounded-xl bg-[#fbfcff]"
      role="img"
      aria-label="Ink preview"
      preserveAspectRatio="none"
    >
      {[24, 48, 72].map((y) => (
        <line
          key={y}
          x1="8"
          x2="312"
          y1={y}
          y2={y}
          stroke="#e2e8f0"
          strokeWidth="1"
        />
      ))}
      {groups.map(([key, d]) => {
        const [color, width] = key.split(":") as [
          keyof typeof INK_COLOR_HEX,
          keyof typeof INK_WIDTH_PX,
        ];
        return (
          <path
            key={key}
            d={d}
            fill="none"
            stroke={INK_COLOR_HEX[color]}
            strokeWidth={INK_WIDTH_PX[width]}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
