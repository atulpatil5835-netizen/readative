import { INK_COORDINATE_MAX, type InkStroke } from "./types";
export { buildInkBlockKey, hashInkText } from "./blockKey";

export interface InkPoint {
  x: number;
  y: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function pointToSegmentDistance(
  point: InkPoint,
  start: InkPoint,
  end: InkPoint,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) /
      (dx * dx + dy * dy),
    0,
    1,
  );
  return Math.hypot(
    point.x - (start.x + t * dx),
    point.y - (start.y + t * dy),
  );
}

export function simplifyInkPoints(points: InkPoint[], tolerance = 1.2) {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let splitIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = pointToSegmentDistance(points[index], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = index;
    }
  }

  if (maxDistance <= tolerance) return [start, end];

  const left = simplifyInkPoints(points.slice(0, splitIndex + 1), tolerance);
  const right = simplifyInkPoints(points.slice(splitIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

function encodeSigned(value: number) {
  return value < 0 ? `-${Math.abs(value).toString(36)}` : value.toString(36);
}

function decodeSigned(value: string) {
  if (!value) return Number.NaN;
  return value.startsWith("-")
    ? -Number.parseInt(value.slice(1), 36)
    : Number.parseInt(value, 36);
}

export function encodeInkGeometry(
  points: InkPoint[],
  width: number,
  height: number,
) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  return points
    .slice(0, 256)
    .map((point) => {
      const x = Math.round((point.x / safeWidth) * INK_COORDINATE_MAX);
      const y = Math.round((point.y / safeHeight) * INK_COORDINATE_MAX);
      return `${encodeSigned(x)},${encodeSigned(y)}`;
    })
    .join(";");
}

export function decodeInkGeometry(geometry: string) {
  if (!geometry || geometry.length > 16_384) return [];
  const points: InkPoint[] = [];
  for (const encodedPoint of geometry.split(";").slice(0, 256)) {
    const [encodedX, encodedY] = encodedPoint.split(",");
    const x = decodeSigned(encodedX);
    const y = decodeSigned(encodedY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    points.push({ x, y });
  }
  return points;
}

export function inkPointsToPath(points: InkPoint[]) {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} l 0.1 0`;
  }
  return points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");
}

export function projectInkStroke(
  stroke: InkStroke,
  width: number,
  height: number,
) {
  return decodeInkGeometry(stroke.geometry).map((point) => ({
    x: (point.x / INK_COORDINATE_MAX) * Math.max(1, width),
    y: (point.y / INK_COORDINATE_MAX) * Math.max(1, height),
  }));
}

export function createInkStrokeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ink-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
