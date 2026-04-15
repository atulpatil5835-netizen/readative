const GUEST_ID_KEY = "readativeGuestId";
const GUEST_NAME_KEY = "readativeGuestName";

export function getGuestId(): string {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = `guest_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

export function getGuestName(): string | null {
  const savedName = localStorage.getItem(GUEST_NAME_KEY)?.trim();
  return savedName || null;
}

export function saveGuestName(name: string): string {
  const trimmedName = name.trim();
  localStorage.setItem(GUEST_NAME_KEY, trimmedName);
  return trimmedName;
}

export function clearGuestName() {
  localStorage.removeItem(GUEST_NAME_KEY);
}
