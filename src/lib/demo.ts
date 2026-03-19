export const DEMO_MIN_POINTS = 40;

const DEMO_EMAILS = new Set([
  "demo@boost-challenge.de",
  "demo-lehrkraft@boost-challenge.de",
]);

export function isDemoEmail(email?: string | null): boolean {
  return DEMO_EMAILS.has(String(email || "").toLowerCase());
}

export function getDemoAwarePoints(points: number | null | undefined, email?: string | null): number {
  const resolvedPoints = Number(points || 0);
  return isDemoEmail(email) ? Math.max(DEMO_MIN_POINTS, resolvedPoints) : resolvedPoints;
}
