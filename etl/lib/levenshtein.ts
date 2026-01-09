interface LevenshteinOptions {
  maxDistance?: number;
  caseSensitive?: boolean;
  normalizeDiacritics?: boolean;
}

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replaceAll(/[\u0300-\u036f]/g, '');
}

function normalizeStrings(
  a: string,
  b: string,
  caseSensitive: boolean,
  normalizeDiacritics: boolean
): { a: string; b: string } {
  let normA = caseSensitive ? a : a.toLowerCase();
  let normB = caseSensitive ? b : b.toLowerCase();

  if (normalizeDiacritics) {
    normA = stripDiacritics(normA);
    normB = stripDiacritics(normB);
  }

  return { a: normA, b: normB };
}

function orderByLength(a: string, b: string): { shorter: string; longer: string } {
  return a.length <= b.length
    ? { shorter: a, longer: b }
    : { shorter: b, longer: a };
}

function computeEditDistance(shorter: string, longer: string, maxDistance?: number): number {
  const m = shorter.length;
  const n = longer.length;

  const prev = new Array<number>(m + 1);
  const curr = new Array<number>(m + 1);

  for (let i = 0; i <= m; i++) prev[i] = i;

  for (let j = 1; j <= n; j++) {
    curr[0] = j;
    let rowMin = curr[0];
    const charB = longer.codePointAt(j - 1);

    for (let i = 1; i <= m; i++) {
      const cost = shorter.codePointAt(i - 1) === charB ? 0 : 1;
      const del = prev[i] + 1;
      const ins = curr[i - 1] + 1;
      const sub = prev[i - 1] + cost;

      const v = Math.min(del, ins, sub);
      curr[i] = v;
      if (v < rowMin) rowMin = v;
    }

    if (maxDistance !== undefined && rowMin > maxDistance) {
      return maxDistance + 1;
    }

    for (let i = 0; i <= m; i++) prev[i] = curr[i];
  }

  return prev[m];
}

/**
 * Compute the Levenshtein (edit) distance between two strings.
 * - Time:  O(m * n)
 * - Space: O(min(m, n))  (two-row DP)
 *
 * Options:
 *  - maxDistance: if provided, the function will early-abandon and return maxDistance + 1
 *                 once it can prove the true distance exceeds this cap.
 *  - caseSensitive: default false (folds to lower-case when false)
 *  - normalizeDiacritics: default false (when true, strips accents: "Bogotá" → "Bogota")
 */
export function levenshtein(a: string, b: string, opts?: LevenshteinOptions): number {
  const maxDistance = opts?.maxDistance;
  const caseSensitive = opts?.caseSensitive ?? false;
  const normalizeDiacritics = opts?.normalizeDiacritics ?? false;

  const normalized = normalizeStrings(a, b, caseSensitive, normalizeDiacritics);

  // Trivial cases
  if (normalized.a === normalized.b) return 0;
  if (normalized.a.length === 0) return normalized.b.length;
  if (normalized.b.length === 0) return normalized.a.length;

  const { shorter, longer } = orderByLength(normalized.a, normalized.b);

  // If a cap is provided, prune impossible cases quickly
  if (maxDistance !== undefined && longer.length - shorter.length > maxDistance) {
    return maxDistance + 1;
  }

  return computeEditDistance(shorter, longer, maxDistance);
}
