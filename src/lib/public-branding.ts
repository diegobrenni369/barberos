export const MAX_PUBLIC_IMAGE_BYTES = 3 * 1024 * 1024;
export const PUBLIC_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export type ImageTarget = "logo" | "cover" | "barber" | "service";

export function instagramLink(value: string) {
  if (!value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !["instagram.com", "www.instagram.com"].includes(url.hostname) || url.username || url.password || url.port) return null;
    url.search = ""; url.hash = "";
    return url.toString();
  } catch { return null; }
}
