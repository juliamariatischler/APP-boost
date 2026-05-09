export const formatDisplayName = (name?: string | null) => {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "";

  return trimmed
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};
