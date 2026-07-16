export function exactUrlHostname(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname
      .replace(/^\[|\]$/gu, "")
      .toLowerCase()
      .replace(/\.$/u, "");
  } catch {
    return null;
  }
}
