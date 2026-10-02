export interface ManualSettings {
  title: string;
  notionUrl: string | null;
  embedUrl: string | null;
  configured: boolean;
  updatedAt: string | null;
  revision?: number;
}

const notionSiteHost = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)?notion\.site$/;
const notionWorkspaceHost = /^(?:www\.)?notion\.so$/;
const pageId = /(?:^|[-/])([a-f\d]{32})\/?$/i;

function notionUrl(value: string | null): URL | null {
  if (!value || value.length > 2048 || /[\u0000-\u0020\u007f\\]/u.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && (notionSiteHost.test(url.hostname) || notionWorkspaceHost.test(url.hostname)) ? url : null;
  } catch { return null; }
}

export function notionPage(value: string | null): string | null {
  const url = notionUrl(value);
  if (!url) return null;
  if (notionSiteHost.test(url.hostname)) {
    let path: string;
    try { path = decodeURIComponent(url.pathname); } catch { return null; }
    if (!/^\/(?:[\p{L}\p{N}][\p{L}\p{M}\p{N}_-]{0,255})?\/?$/u.test(path)) return null;
  } else if (!pageId.test(url.pathname)) return null;
  return url.href;
}

export function notionEmbed(value: string | null, page: string | null): string | null {
  const url = notionUrl(value);
  const validPage = notionPage(page);
  if (!url || !validPage || !notionSiteHost.test(url.hostname)) return null;
  // Notion supplies both /ebd/<id> and /ebd//<id>; preserve its exact URL.
  const embedId = url.pathname.match(/^\/ebd\/{1,2}([a-f\d]{32})\/?$/i)?.[1]?.toLowerCase();
  const pageUrl = new URL(validPage);
  const sourceId = pageUrl.pathname.match(pageId)?.[1]?.toLowerCase();
  return embedId && url.hostname === pageUrl.hostname && (!sourceId || sourceId === embedId) ? url.href : null;
}
