export const INK_SCHEMA_VERSION = 1;
export const INK_COORDINATE_MAX = 4095;

export type InkColor = "blue" | "black" | "red" | "green" | "orange";
export type InkWidth = "thin" | "medium" | "thick";

export interface InkAnchor {
  blockKey: string;
  blockOrdinal: number;
  sourceWidth: number;
  sourceHeight: number;
}

export interface InkStroke {
  id: string;
  at: number;
  color: InkColor;
  width: InkWidth;
  geometry: string;
  anchor: InkAnchor;
  contentRevision: string;
}

export interface InkPostDocument {
  schemaVersion: number;
  createdAt: number;
  lastAnnotatedAt: number;
  strokes: InkStroke[];
}

export const INK_COLOR_HEX: Record<InkColor, string> = {
  blue: "#2563eb",
  black: "#0f172a",
  red: "#dc2626",
  green: "#15803d",
  orange: "#ea580c",
};

export const INK_WIDTH_PX: Record<InkWidth, number> = {
  thin: 1.6,
  medium: 2.6,
  thick: 4.2,
};

export const INK_COLORS = Object.keys(INK_COLOR_HEX) as InkColor[];
export const INK_WIDTHS = Object.keys(INK_WIDTH_PX) as InkWidth[];

export function isInkColor(value: unknown): value is InkColor {
  return typeof value === "string" && INK_COLORS.includes(value as InkColor);
}

export function isInkWidth(value: unknown): value is InkWidth {
  return typeof value === "string" && INK_WIDTHS.includes(value as InkWidth);
}

export function isInkStroke(value: unknown): value is InkStroke {
  if (!value || typeof value !== "object") return false;
  const stroke = value as Partial<InkStroke>;
  return (
    typeof stroke.id === "string" &&
    stroke.id.length > 0 &&
    stroke.id.length <= 128 &&
    typeof stroke.at === "number" &&
    Number.isFinite(stroke.at) &&
    stroke.at >= 0 &&
    isInkColor(stroke.color) &&
    isInkWidth(stroke.width) &&
    typeof stroke.geometry === "string" &&
    stroke.geometry.length > 0 &&
    stroke.geometry.length <= 16_384 &&
    typeof stroke.contentRevision === "string" &&
    stroke.contentRevision.length > 0 &&
    stroke.contentRevision.length <= 128 &&
    Boolean(stroke.anchor) &&
    typeof stroke.anchor?.blockKey === "string" &&
    stroke.anchor.blockKey.length > 0 &&
    stroke.anchor.blockKey.length <= 128 &&
    typeof stroke.anchor?.blockOrdinal === "number" &&
    Number.isInteger(stroke.anchor.blockOrdinal) &&
    stroke.anchor.blockOrdinal >= 0 &&
    stroke.anchor.blockOrdinal <= 10_000 &&
    typeof stroke.anchor?.sourceWidth === "number" &&
    Number.isFinite(stroke.anchor.sourceWidth) &&
    stroke.anchor.sourceWidth > 0 &&
    stroke.anchor.sourceWidth <= 100_000 &&
    typeof stroke.anchor?.sourceHeight === "number" &&
    Number.isFinite(stroke.anchor.sourceHeight) &&
    stroke.anchor.sourceHeight > 0 &&
    stroke.anchor.sourceHeight <= 100_000
  );
}
