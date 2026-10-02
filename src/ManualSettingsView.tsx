import { useEffect, useEffectEvent, useState } from "react";
import { api, ApiError, errorMessage } from "./api";
import { notionEmbed, notionPage } from "./manual";
import type { ManualSettings } from "./manual";
import type { ReportError } from "./types";

type FieldErrors = { title?: string; url?: string; embed?: string };

export function ManualSettingsView({ csrfToken, canWrite, onError }: { csrfToken: string; canWrite: boolean; onError: ReportError }) {
  const [settings, setSettings] = useState<ManualSettings | null>(null);
  const [title, setTitle] = useState("매뉴얼");
  const [url, setUrl] = useState("");
  const [embed, setEmbed] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const failed = useEffectEvent((failure: unknown) => { setError(errorMessage(failure)); onError(failure); });
  useEffect(() => {
    const controller = new AbortController(); setSettings(null); setError(""); setFieldErrors({}); setStale(false);
    void api<ManualSettings>("/admin/manual", { signal: controller.signal }).then(value => { if (!controller.signal.aborted) { setSettings(value); setTitle(value.title); setUrl(value.notionUrl ?? ""); setEmbed(value.embedUrl ?? ""); } }).catch(failure => { if (!controller.signal.aborted) failed(failure); });
    return () => controller.abort();
  }, [refresh]);
  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); if (!settings || !canWrite || busy || stale) return;
    setError(""); setNotice("");
    const nextErrors: FieldErrors = {};
    const pageUrl = url.trim();
    const embedUrl = embed.trim();
    if (!title.trim() || title.trim().length > 80 || /[\u0000-\u001f\u007f]/u.test(title)) nextErrors.title = "문서 제목을 1~80자로 입력해 주세요.";
    if (pageUrl && !notionPage(pageUrl)) nextErrors.url = "공개된 Notion 문서의 HTTPS 주소를 입력해 주세요. 임베드 주소는 아래 항목에 입력해 주세요.";
    if (pageUrl && embedUrl && !notionEmbed(embedUrl, pageUrl)) nextErrors.embed = /<\/?iframe\b/i.test(embedUrl)
      ? "iframe 코드 전체가 아닌 src 안의 HTTPS 주소만 입력해 주세요."
      : "위 문서와 같은 Notion 페이지의 임베드 주소를 입력해 주세요. /ebd/ 또는 /ebd// 뒤에 페이지 ID가 있어야 합니다.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    try { const updated = await api<ManualSettings>("/admin/manual", { method: "PUT", csrfToken, body: { title: title.trim(), notionUrl: pageUrl || null, embedUrl: pageUrl ? embedUrl || null : null, expectedRevision: settings.revision } }); setSettings(updated); setTitle(updated.title); setUrl(updated.notionUrl ?? ""); setEmbed(updated.embedUrl ?? ""); setNotice(updated.configured ? "매뉴얼을 저장했습니다." : "매뉴얼 등록을 해제했습니다."); }
    catch (failure) { if (failure instanceof ApiError && (failure.status === 409 || failure.code === "manual_settings_changed")) setStale(true); setError(errorMessage(failure)); onError(failure); }
    finally { setBusy(false); }
  }
  return <section className="panel manual-settings" aria-busy={!settings || busy}>
    <div className="panel-head"><h2>Notion 매뉴얼</h2><button disabled={busy} onClick={() => { setNotice(""); setRefresh(value => value + 1); }}>최신 설정 불러오기</button></div>
    {error ? <p className="notice notice-error" role="alert">{error}</p> : null}
    {notice ? <p className="notice notice-success" role="status">{notice}</p> : null}
    {settings ? <form noValidate onSubmit={event => void save(event)}>
      <label htmlFor="manual-title">문서 제목</label>
      <input id="manual-title" maxLength={80} required value={title} disabled={!canWrite || busy || stale} aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? "manual-title-error" : undefined} onChange={event => { setTitle(event.target.value); setFieldErrors(current => ({ ...current, title: undefined })); }} />
      {fieldErrors.title ? <p id="manual-title-error" className="error-text" role="alert">{fieldErrors.title}</p> : null}
      <label htmlFor="manual-url">공개된 Notion 문서 주소</label>
      <input id="manual-url" type="url" placeholder="https://example.notion.site/..." value={url} disabled={!canWrite || busy || stale} aria-invalid={Boolean(fieldErrors.url)} aria-describedby={`manual-url-help${fieldErrors.url ? " manual-url-error" : ""}`} onChange={event => { setUrl(event.target.value); setFieldErrors(current => ({ ...current, url: undefined, embed: undefined })); }} />
      <p id="manual-url-help" className="helper">Notion에서 웹에 게시한 문서의 주소를 입력해 주세요. 주소를 비우고 저장하면 등록을 해제합니다.</p>
      {fieldErrors.url ? <p id="manual-url-error" className="error-text" role="alert">{fieldErrors.url}</p> : null}
      <label htmlFor="manual-embed">페이지 안에 표시할 임베드 주소 <small>선택</small></label>
      <input id="manual-embed" type="url" placeholder="https://example.notion.site/ebd//..." value={embed} disabled={!canWrite || busy || stale} aria-invalid={Boolean(fieldErrors.embed)} aria-describedby={`manual-embed-help${fieldErrors.embed ? " manual-embed-error" : ""}`} onChange={event => { setEmbed(event.target.value); setFieldErrors(current => ({ ...current, embed: undefined })); }} />
      <p id="manual-embed-help" className="helper">Notion의 게시 → 이 페이지 임베드에서 복사한 코드 중 src의 주소만 입력해 주세요. 등록하지 않으면 문서로 이동하는 버튼을 표시합니다.</p>
      {fieldErrors.embed ? <p id="manual-embed-error" className="error-text" role="alert">{fieldErrors.embed}</p> : null}
      <div className="manual-settings-actions">
        {notionPage(settings.notionUrl) ? <a className="manual-open" href={notionPage(settings.notionUrl)!} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">등록된 문서 열기 ↗</a> : null}
        {canWrite ? <button className="primary" disabled={busy || stale || !title.trim()} type="submit">{busy ? "저장 중…" : "매뉴얼 저장"}</button> : <p className="helper">조회 전용 권한입니다.</p>}
      </div>
    </form> : !error ? <p role="status">설정을 불러오는 중입니다.</p> : null}
  </section>;
}
