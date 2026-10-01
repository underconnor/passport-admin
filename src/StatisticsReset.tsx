import { useEffect, useEffectEvent, useState } from "react";
import { api, ApiError, errorMessage } from "./api";
import { Dialog } from "./Dialog";
import { number, playTime } from "./statistics";
import type { PlayCounters } from "./statistics";

export type ResetScope = { scope: "all" } | { scope: "server"; serverId: string } | { scope: "subject"; subjectId: string };
interface Preview { affectedSubjects: number; rows: number; totals: PlayCounters; expectedRevision: string; confirmation: "통계 초기화" }
export function StatisticsReset({ scope, targetLabel, csrfToken, onClose, onSaved, onError }: { scope: ResetScope; targetLabel: string; csrfToken: string; onClose: () => void; onSaved: () => void; onError?: (error: unknown) => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const failed = useEffectEvent((failure: unknown) => { setError(errorMessage(failure)); onError?.(failure); });
  const scopeKey = JSON.stringify(scope);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setPreview(null); setConfirmed(false); setConfirmation("");
    void api<Preview>("/admin/stats/reset/preview", { method: "POST", body: JSON.parse(scopeKey), csrfToken, signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setPreview(result);
    }).catch(failure => { if (!controller.signal.aborted) failed(failure); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [scopeKey, csrfToken, refresh]);
  async function reset() {
    if (!preview || busy || loading || !confirmed || confirmation !== preview.confirmation || preview.rows <= 0) return;
    setBusy(true); setError("");
    try {
      await api("/admin/stats/reset", { method: "POST", csrfToken, body: { ...scope, expectedRevision: preview.expectedRevision, confirmation } });
      onSaved();
    } catch (failure) {
      setConfirmed(false); setConfirmation("");
      if (failure instanceof ApiError && failure.status === 409) setPreview(null);
      if (failure instanceof ApiError && failure.code === "confirmation_mismatch") setError("‘통계 초기화’를 정확히 입력해 주세요.");
      else { setError(errorMessage(failure)); onError?.(failure); }
    } finally { setBusy(false); }
  }
  return <Dialog title="플레이 통계 초기화" busy={busy} onClose={onClose}>
    <div className="stats-reset-target"><span>초기화 범위</span><strong>{targetLabel}</strong><small>{scope.scope === "subject" ? "이 회원의 모든 서버 기록" : scope.scope === "server" ? "이 서버의 모든 회원 기록" : "모든 회원의 모든 서버 기록"}</small></div>
    <p className="helper">수집이 꺼진 서버의 보관 기록도 범위에 포함됩니다. 실행 시점까지 쌓인 기록을 초기화하며 화면에서 되돌릴 수 없습니다.</p>
    <p className="helper warning stats-reset-warning">다른 서버에서 전송 대기 중인 기록도 제외될 수 있습니다. 이미 저장된 다른 서버 기록은 유지됩니다.</p>
    {loading ? <p className="helper" role="status">초기화 영향을 확인하고 있습니다.</p> : preview ? <>
      <dl className="stats-reset-summary"><div><dt>영향받는 회원</dt><dd>{number(preview.affectedSubjects)}명</dd></div><div><dt>저장된 서버별 기록</dt><dd>{number(preview.rows)}건</dd></div><div><dt>현재 누적 시간</dt><dd>{playTime(preview.totals.playSeconds)}</dd></div></dl>
      {preview.rows <= 0 ? <p className="helper">초기화할 저장 기록이 없습니다.</p> : <>
        <label className="field-label" htmlFor="statistics-reset-confirmation">확인을 위해 ‘통계 초기화’ 입력</label>
        <input id="statistics-reset-confirmation" autoComplete="off" value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} />
        <label className="check-row"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>초기화 범위와 삭제할 기록을 확인했습니다.</span></label>
      </>}
    </> : null}
    {error ? <p className="notice notice-error" role="alert">{error}</p> : null}
    <div className="dialog-actions"><button disabled={busy} onClick={onClose}>취소</button>{!loading && !preview ? <button disabled={busy} onClick={() => setRefresh(value => value + 1)}>영향 다시 확인</button> : <button className="primary destructive" disabled={busy || loading || !preview || preview.rows <= 0 || !confirmed || confirmation !== preview.confirmation} onClick={() => void reset()}>{busy ? "초기화 중…" : "기록 초기화"}</button>}</div>
  </Dialog>;
}
