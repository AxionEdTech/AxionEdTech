import { safeUrl } from "./links.js";

// The brand's social profiles. Each key is a row in Admin -> Settings & Social;
// leave one empty and it simply doesn't show anywhere on the site.
export const SOCIALS = [
  { key: "instagram_url", label: "Instagram", icon: "instagram" },
  { key: "youtube_url", label: "YouTube", icon: "youtube" },
  { key: "telegram_url", label: "Telegram", icon: "telegram" },
  { key: "whatsapp_url", label: "WhatsApp", icon: "whatsapp" },
  { key: "x_url", label: "X (Twitter)", icon: "xtwitter" },
  { key: "linkedin_url", label: "LinkedIn", icon: "linkedin" },
  { key: "facebook_url", label: "Facebook", icon: "facebook" },
];

// [{ key, label, icon, href }] for every profile that has a valid link.
export function socialLinks(settings) {
  return SOCIALS
    .map((s) => ({ ...s, href: safeUrl(settings?.[s.key]) }))
    .filter((s) => s.href);
}

// Downloads are grouped by a free-text category. These come first, in this
// order; any category an admin types that is not listed follows alphabetically.
export const DOWNLOAD_CATEGORIES = [
  "Previous Year Papers", "Sample Notes", "Sample Mock Tests", "Mock Tests", "Cheat Sheets", "Other",
];

export function orderCategories(categories) {
  const rank = (c) => { const i = DOWNLOAD_CATEGORIES.indexOf(c); return i === -1 ? 999 : i; };
  return [...new Set(categories)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
