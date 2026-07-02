export function hashInkText(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function buildInkBlockKey(text: string, occurrence: number) {
  return `${hashInkText(text.replace(/\s+/g, " ").trim())}-${occurrence}`;
}
