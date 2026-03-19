export const DEMO_FIXED_POINTS = 40;

const DEMO_EMAILS = new Set([
  "demo@boost-challenge.de",
  "demo-lehrkraft@boost-challenge.de",
]);

export function isDemoEmail(email?: string | null): boolean {
  return DEMO_EMAILS.has(String(email || "").toLowerCase());
}

export function getDemoAwarePoints(points: number | null | undefined, email?: string | null): number {
  return isDemoEmail(email) ? DEMO_FIXED_POINTS : Number(points || 0);
}
