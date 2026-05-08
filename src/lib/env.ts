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

const readOptionalUrl = (key: string, fallback: string): string => {
  const rawValue = import.meta.env[key];
  const value = typeof rawValue === "string" && rawValue.trim().length > 0 ? rawValue.trim() : fallback;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error();
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid ${key}: expected an HTTPS URL`);
  }
};

const readSupabaseUrl = (): string => {
  const value = readEnv("VITE_SUPABASE_URL");
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid VITE_SUPABASE_URL: expected a valid URL");
  }

  const isLocalDevHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(import.meta.env.DEV && isLocalDevHost)) {
    throw new Error("Invalid VITE_SUPABASE_URL: HTTPS is required outside local development");
  }

  return url.toString().replace(/\/$/, "");
};

export const env = {
  supabaseUrl: readSupabaseUrl(),
  supabasePublishableKey: readEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
  publicAppUrl: readOptionalUrl("VITE_PUBLIC_APP_URL", "https://www.boostschule.at"),
};
