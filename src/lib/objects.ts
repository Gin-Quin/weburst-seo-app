export function deepEqual(a: unknown, b: unknown): boolean {
  // Handle primitives and null
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return typeof a === typeof b;
  }

  // Treat arrays as special objects
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((_, i) => deepEqual(a[i], b[i]));
  }
  if (Array.isArray(a) || Array.isArray(b)) return false;

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) return false;

  const bSet = new Set(bKeys);
  for (const key of aKeys) {
    if (!bSet.has(key)) return false;
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
}
