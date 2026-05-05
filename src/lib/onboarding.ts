export type OnboardingRole = "student" | "teacher";

const ONBOARDING_VERSION = "v1";

export const ONBOARDING_OPEN_EVENT = "open-onboarding";

export const getOnboardingStorageKey = (role: OnboardingRole) =>
  `boost_onboarding_seen_${role}_${ONBOARDING_VERSION}`;

export const hasSeenOnboarding = (role: OnboardingRole) => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(getOnboardingStorageKey(role)) === "true";
};

export const markOnboardingSeen = (role: OnboardingRole) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getOnboardingStorageKey(role), "true");
};
