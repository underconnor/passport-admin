import { useState } from "react";
import { api, ApiError, errorMessage } from "./api";
import { dateTime, riskLabel } from "./types";
import type { Overview, ReportError, RosterPreview, SyncResult } from "./types";

export function RosterView({
  overview,
  canWrite,
  csrfToken,
  now,
  refresh,
  onError,
}: {
  overview: Overview;
  canWrite: boolean;
  csrfToken: string;
  now: number;
  refresh: () => Promise<void>;
  onError: ReportError;
}) {
  const [preview, setPreview] = useState<RosterPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SyncResult | null>(null);
  async function inspect() {
    if (!canWrite) return;
    setBusy("preview");
    setError("");
    setPreview(null);
    setConfirmed(false);
    setResult(null);
    try {
      setPreview(
        await api<RosterPreview>("/admin/roster/preview", {
          method: "POST",
          body: {},
          csrfToken,
        }),
      );
    } catch (failure) {
      setError(errorMessage(failure));
      onError(failure);
    } finally {
      setBusy("");
    }
  }
  async function apply() {
    if (
      !canWrite || !preview ||
      (preview.risks.length && !confirmed) ||
      new Date(preview.expiresAt).getTime() <= Date.now()
    )
      return;
    setBusy("sync");
    setError("");
    try {
      const applied = await api<SyncResult>("/admin/roster/sync", {
        method: "POST",
        body: { expectedApprovalDigest: preview.digest },
        csrfToken,
      });
      setResult(applied);
      setPreview(null);
      setConfirmed(false);
      await refresh();
    } catch (failure) {
      setError(errorMessage(failure));
      setConfirmed(false);
      if (
        failure instanceof ApiError &&
        [
          "approval_mismatch",
          "approval_required",
          "stale_snapshot",
          "outdated_snapshot",
        ].includes(failure.code)
      )
        setPreview(null);
      onError(failure);
    } finally {
      setBusy("");
    }
  }
  const expired =
    preview !== null && new Date(preview.expiresAt).getTime() <= now;
  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-head">
          <h2>회원 명부 동기화</h2>
          <span className="status-label">
            {overview.sync.running
              ? "동기화 중"
              : overview.sync.enabled
                ? "자동 동기화 켜짐"
                : "자동 동기화 꺼짐"}
          </span>
        </div>
        <dl className="detail-list">
          <div>
            <dt>현재 명부</dt>
            <dd>
              {overview.snapshot
                ? `${overview.snapshot.entryCount}명`
                : "반영된 명부 없음"}
            </dd>
          </div>
          <div>
            <dt>최근 명부 조회</dt>
            <dd>{dateTime(overview.snapshot?.fetchedAt ?? null)}</dd>
          </div>
          <div>
            <dt>명부 만료</dt>
            <dd>{dateTime(overview.snapshot?.expiresAt ?? null)}</dd>
          </div>
          <div>
            <dt>최근 동기화 성공</dt>
            <dd>{dateTime(overview.sync.lastSuccessAt)}</dd>
          </div>
        </dl>
        {overview.sync.lastError ? (
          <p className="error-text">
            최근 동기화 오류:{" "}
            {errorMessage(new ApiError(503, overview.sync.lastError))}
          </p>
        ) : null}
        <p className="helper">
          구글시트는 읽기만 수행합니다. 먼저 현재 명부를 확인한 뒤 해당 결과를
          반영합니다.
        </p>
        {canWrite ? <div className="form-actions">
          <button
            className="primary"
            disabled={Boolean(busy) || overview.sync.running}
            onClick={() => void inspect()}
          >
            {busy === "preview" ? "명부 확인 중…" : "새 명부 미리보기"}
          </button>
        </div> : null}
      </section>
      {error ? (
        <div role="alert" className="notice notice-error">
          {error}
        </div>
      ) : null}
      {result ? (
        <div role="status" className="notice notice-success">
          <div>
            <strong>명부 반영이 완료되었습니다.</strong>
            <p>
              전체 {result.total}명 · 활성 {result.active}명 · 회원 갱신{" "}
              {result.updatedSubjects}명 · 정책 변경 {result.changedPolicies}건
            </p>
          </div>
        </div>
      ) : null}
      {canWrite && preview ? (
        <section className="panel">
          <div className="panel-head">
            <h2>반영 전 확인</h2>
            <span className="status-label">아직 반영되지 않음</span>
          </div>
          <div className="stats-grid">
            <div>
              <span>이전 명부</span>
              <strong>{preview.previousTotal}</strong>
            </div>
            <div>
              <span>새 명부</span>
              <strong>{preview.total}</strong>
            </div>
            <div>
              <span>활성 회원</span>
              <strong>{preview.active}</strong>
            </div>
          </div>
          {preview.risks.length ? (
            <div className="roster-risks">
              <h3>주의가 필요한 변경</h3>
              <ul>
                {preview.risks.map((risk) => (
                  <li key={risk}>{riskLabel(risk)}</li>
                ))}
              </ul>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  disabled={Boolean(busy) || expired}
                />
                <span>
                  명부와 접근 권한의 변경 영향을 확인했으며 이 결과를
                  반영하겠습니다.
                </span>
              </label>
            </div>
          ) : (
            <p className="helper">
              대량 권한 회수나 원본 변경은 감지되지 않았습니다.
            </p>
          )}
          <p className="helper card-footnote">
            {expired
              ? "이 결과가 만료되었습니다. 새 명부를 다시 확인해 주세요."
              : `${dateTime(preview.expiresAt)}까지 확인 가능합니다. 명부 내용이 달라지면 다시 확인해야 합니다.`}
          </p>
          <div className="form-actions">
            <button
              className="primary"
              disabled={
                Boolean(busy) ||
                expired ||
                (preview.risks.length > 0 && !confirmed)
              }
              onClick={() => void apply()}
            >
              {busy === "sync" ? "반영 중…" : "확인한 명부 반영"}
            </button>
            <button
              disabled={Boolean(busy)}
              onClick={() => {
                setPreview(null);
                setConfirmed(false);
              }}
            >
              취소
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
