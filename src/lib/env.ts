const requiredEnvKeys = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
] as const;

type RequiredEnvKey = (typeof requiredEnvKeys)[number];

const readEnv = (key: RequiredEnvKey): string => {
  const value = import.meta.env[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value.trim();
};

const readBooleanEnv = (key: string, fallback = false): boolean => {
  const value = import.meta.env[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }

  return value.trim().toLowerCase() === "true";
};

export const env = {
  supabaseUrl: readEnv("VITE_SUPABASE_URL"),
  supabasePublishableKey: readEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
  enableIosHealthKit: readBooleanEnv("VITE_ENABLE_IOS_HEALTHKIT", false),
};
