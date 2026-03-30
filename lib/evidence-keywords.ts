/** Shared keyword extraction for workplan ↔ evidence / email matching. */

export const KEYWORD_STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "have", "been", "will", "into", "over",
  "our", "their", "your", "its", "was", "are", "has", "but", "not", "they", "all", "one", "can",
  "it", "is", "in", "of", "to", "a", "an", "at", "be", "by", "or", "as", "on", "up", "do", "if",
  "so", "no", "we", "he", "she", "his", "her",
]);

export function extractKeywords(text: string): string[] {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !KEYWORD_STOPWORDS.has(t));
}

export function keywordMatch(itemWords: string[], evWords: string[]): boolean {
  if (itemWords.length === 0 || evWords.length === 0) return false;
  const itemSet = new Set(itemWords);
  return evWords.some((w) => [...itemSet].some((k) => k.includes(w) || w.includes(k)));
}

/** Stronger tokens for matching email subject/body (reduces noise). */
export function extractEmailMatchKeywords(text: string, max = 15): string[] {
  return extractKeywords(text)
    .filter((w) => w.length > 3)
    .slice(0, max);
}
