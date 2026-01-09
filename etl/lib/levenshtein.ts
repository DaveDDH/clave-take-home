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
export function levenshtein(
  a: string,
  b: string,
  opts?: {
    maxDistance?: number;
    caseSensitive?: boolean;
    normalizeDiacritics?: boolean;
  }
): number {
  const maxDistance = opts?.maxDistance;
  const caseSensitive = opts?.caseSensitive ?? false;
  const normalizeDiacritics = opts?.normalizeDiacritics ?? false;

  if (!caseSensitive) {
    a = a.toLowerCase();
    b = b.toLowerCase();
  }
  if (normalizeDiacritics) {
    const strip = (s: string) => s.normalize('NFD').replaceAll(/[\u0300-\u036f]/g, '');
    a = strip(a);
    b = strip(b);
  }

  // Trivial cases
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure 'a' is the shorter string to minimize memory
  if (a.length > b.length) {
    const tmp = a;
    a = b;
    b = tmp;
  }

  const m = a.length;
  const n = b.length;

  // If a cap is provided, prune impossible cases quickly
  if (maxDistance !== undefined && Math.abs(n - m) > maxDistance) {
    return maxDistance + 1; // guaranteed to exceed
  }

  // Initialize DP rows
  const prev = new Array<number>(m + 1);
  const curr = new Array<number>(m + 1);

  for (let i = 0; i <= m; i++) prev[i] = i;

  // Main DP loop (iterate over b as the outer loop for cache-friendliness)
  for (let j = 1; j <= n; j++) {
    curr[0] = j;

    // Track minimum value in this row for early-abandon
    let rowMin = curr[0];

    const bj = b.codePointAt(j - 1);

    for (let i = 1; i <= m; i++) {
      const cost = a.codePointAt(i - 1) === bj ? 0 : 1;

      // classic recurrence: min of delete, insert, substitute
      const del = prev[i] + 1; // delete a[i-1]
      const ins = curr[i - 1] + 1; // insert b[j-1]
      const sub = prev[i - 1] + cost;

      const v = Math.min(del, ins, sub);
      curr[i] = v;

      if (v < rowMin) rowMin = v;
    }

    // Early-abandon if entire row is already above maxDistance
    if (maxDistance !== undefined && rowMin > maxDistance) {
      return maxDistance + 1;
    }

    // Swap rows
    for (let i = 0; i <= m; i++) prev[i] = curr[i];
  }

  return prev[m];
}
