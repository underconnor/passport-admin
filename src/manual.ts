export interface ManualSettings {
  title: string;
  notionUrl: string | null;
  embedUrl: string | null;
  configured: boolean;
  updatedAt: string | null;
  revision?: number;
}
export function notionPage(value: string | null): string | null {
  if (!value) return null;
  try { const url = new URL(value); const host = url.hostname; return url.protocol === "https:" && !url.username && !url.password && !url.port && (host === "notion.so" || host.endsWith(".notion.so") || host === "notion.site" || host.endsWith(".notion.site")) ? url.href : null; } catch { return null; }
}
export function notionEmbed(value: string | null, page: string | null): string | null {
  const valid = notionPage(value); const validPage = notionPage(page);
  if (!valid || !validPage) return null;
  const url = new URL(valid); const pageUrl = new URL(validPage);
  return (url.hostname === "notion.site" || url.hostname.endsWith(".notion.site")) && url.hostname === pageUrl.hostname && /^\/ebd\/[a-f0-9-]{32,36}(?:\/|$)/i.test(url.pathname) ? valid : null;
}
