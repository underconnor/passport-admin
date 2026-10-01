import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "./api";
import { dateTime } from "./types";
import type { AuditEvent, ReportError } from "./types";
const actionLabels: Record<string, string> = {
  "admin.roster_sync": "운영자 명부 동기화",
  "admin.enrollment_started": "운영자 등록 시작",
  "admin.enrolled": "운영자 등록 완료",
  "admin.mfa_verified": "운영자 추가 인증",
  "admin.access_changed": "회원 접근 제한 변경",
  "admin.minecraft_unlinked": "Minecraft 연결 해제",
  "roster.snapshot_applied": "명부 반영",
  "roster.snapshot_approved": "명부 변경 승인",
  "membership.snapshot_changed": "회원 명부 정책 변경",
  "university.login": "학교 로그인",
  "discord_reference.set": "Discord ID 저장",
  "discord_reference.deleted": "Discord ID 삭제",
  "discord.linked": "Discord 학교 계정 연결",
  "admin.discord_unlinked": "운영자 Discord 연결 해제",
};
export function AuditView({ onError }: { onError: ReportError }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const result = await api<{ events: AuditEvent[] }>("/admin/audit", {
          signal,
        });
        if (!signal?.aborted) setEvents(result.events);
      } catch (failure) {
        if (!signal?.aborted) {
          setError(errorMessage(failure));
          onError(failure);
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [onError],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  return (
    <>
      <div className="section-toolbar">
        <p className="helper">최근 운영 기록 최대 100건</p>
        <button disabled={loading} onClick={() => void load()}>
          기록 새로고침
        </button>
      </div>
      {error ? (
        <div role="alert" className="notice notice-error">
          {error}
        </div>
      ) : null}
      <section className="panel" aria-busy={loading}>
        {events.length ? (
          <ol className="audit-list">
            {events.map((event) => (
              <li key={event.id}>
                <div className="audit-heading">
                  <h2>{actionLabels[event.action] ?? event.action}</h2>
                  <time dateTime={event.createdAt}>
                    {dateTime(event.createdAt)}
                  </time>
                </div>
                <dl>
                  <div>
                    <dt>행위자</dt>
                    <dd>{event.actorSubjectId ?? "시스템 또는 본인 작업"}</dd>
                  </div>
                  <div>
                    <dt>대상 회원</dt>
                    <dd>{event.subjectId ?? "전체 명부"}</dd>
                  </div>
                  {event.objectId ? (
                    <div>
                      <dt>대상 식별자</dt>
                      <dd>{event.objectId}</dd>
                    </div>
                  ) : null}
                </dl>
                {event.details !== null && event.details !== undefined ? (
                  <details>
                    <summary>변경 내용 보기</summary>
                    <pre>{JSON.stringify(event.details, null, 2)}</pre>
                  </details>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-state">
            <h3>
              {loading
                ? "운영 기록을 불러오고 있어요"
                : "표시할 운영 기록이 없습니다."}
            </h3>
          </div>
        )}
      </section>
    </>
  );
}
