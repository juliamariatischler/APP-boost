import { describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { pushActionUrl, resolvePushAction } from "./pushActions";

describe("pushActions", () => {
  it("maps legacy store actions", () => {
    expect(resolvePushAction({ cta_url: "store" })).toEqual({ action_type: "store" });
  });

  it("accepts safe internal routes and rejects unsafe ones", () => {
    expect(pushActionUrl({ action_type: "internal", action_value: "/quests?tab=weekly" })).toBe("/quests?tab=weekly");
    expect(pushActionUrl({ action_type: "internal", action_value: "javascript:alert(1)" })).toBeNull();
  });

  it("only accepts HTTPS web actions", () => {
    expect(pushActionUrl({ action_type: "web", action_value: "https://boostschule.at/update" })).toBe("https://boostschule.at/update");
    expect(pushActionUrl({ action_type: "web", action_value: "http://boostschule.at" })).toBeNull();
  });

  it("selects the Apple App Store on iOS", () => {
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("ios");
    expect(pushActionUrl({ action_type: "store" })).toContain("apps.apple.com");
  });
});
