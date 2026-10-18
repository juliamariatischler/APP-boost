import { Capacitor } from "@capacitor/core";

export type PushAction = {
  action_type?: "none" | "store" | "internal" | "web" | string;
  action_value?: string;
  cta_url?: string;
};

const STORE_LINKS = {
  ios: "https://apps.apple.com/at/app/boostschule-fit-fun/id6765766658",
  android: "https://play.google.com/store/apps/details?id=at.boostschule",
} as const;

export function resolvePushAction(data?: Record<string, unknown>): PushAction {
  const type = typeof data?.action_type === "string" ? data.action_type : "none";
  const value = typeof data?.action_value === "string" ? data.action_value : "";
  const legacy = typeof data?.cta_url === "string" ? data.cta_url.trim() : "";
  if (type !== "none") return { action_type: type, action_value: value, cta_url: legacy };
  if (legacy.toLowerCase() === "store") return { action_type: "store" };
  if (legacy.startsWith("/")) return { action_type: "internal", action_value: legacy };
  if (/^https:\/\//i.test(legacy)) return { action_type: "web", action_value: legacy };
  return { action_type: "none" };
}

export function pushActionUrl(action: PushAction): string | null {
  if (action.action_type === "store") {
    return Capacitor.getPlatform() === "ios" ? STORE_LINKS.ios : STORE_LINKS.android;
  }
  if (action.action_type === "internal" && /^\/[A-Za-z0-9_/?=&.-]*$/.test(action.action_value ?? "")) {
    return action.action_value!;
  }
  if (action.action_type === "web" && /^https:\/\/\S+$/i.test(action.action_value ?? "")) {
    return action.action_value!;
  }
  return null;
}

export function isExternalPushAction(action: PushAction): boolean {
  return action.action_type === "store" || action.action_type === "web";
}
