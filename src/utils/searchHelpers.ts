export function tokenizeSearch(input: string, maxTerms = 10) {
  return input
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxTerms);
}
