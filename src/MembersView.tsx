import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "./api";
import { Dialog } from "./Dialog";
import { dateTime, membershipLabel } from "./types";
import type {
  AccessInput,
  Member,
  MembersPage,
  ReportError,
  ServerDefinition,
} from "./types";

function MemberEditor({
  member,
  servers,
  csrfToken,
  onClose,
  onSaved,
  onError,
}: {
  member: Member;
  servers: ServerDefinition[];
  csrfToken: string;
  onClose: () => void;
  onSaved: (notice: string) => Promise<void>;
  onError: ReportError;
}) {
  const [suspended, setSuspended] = useState(member.accessSuspended);
  const [restricted, setRestricted] = useState(member.scopeRestricted);
  const [serverIds, setServerIds] = useState(
    member.scopeRestricted
      ? member.scopeLimit.filter((id) =>
          servers.some((server) => server.id === id),
        )
      : (member.eligibleServerIds ?? member.allowedServerIds).filter((id) =>
          servers.some((server) => server.id === id),
        ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    const body: AccessInput = {
      suspended,
      restricted,
      serverIds: restricted ? serverIds : [],
    };
    try {
      await api(`/admin/members/${encodeURIComponent(member.id)}/access`, {
        method: "PUT",
        body,
        csrfToken,
      });
      await onSaved(`${member.displayName}님의 접근 제한을 저장했습니다.`);
    } catch (failure) {
      setError(errorMessage(failure));
      onError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={`${member.displayName} · 접근 제한`}
      busy={busy}
      onClose={onClose}
    >
      <p className="helper">
        서버별 접근 정책으로 허용된 범위 안에서 이 회원의 접속을 제한합니다.
        서버 전체의 허용 대상은 서버 관리에서 변경할 수 있습니다.
      </p>
      <label className="check-row">
        <input
          type="checkbox"
          checked={suspended}
          onChange={(event) => setSuspended(event.target.checked)}
          disabled={busy}
        />
        <span>
          <strong>모든 서버 접근 정지</strong>
          <small>명부 상태와 별개로 게임 접근을 제한합니다.</small>
        </span>
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={restricted}
          onChange={(event) => setRestricted(event.target.checked)}
          disabled={busy}
        />
        <span>
          <strong>접속 가능한 서버 제한</strong>
          <small>
            선택한 서버 중 서버별 접근 정책으로 허용된 곳만 접속할 수 있습니다.
          </small>
        </span>
      </label>
      <fieldset disabled={busy || !restricted} className="server-scope">
        <legend>제한 범위</legend>
        {servers.length ? (
          servers.map((server) => (
            <label key={server.id} className="check-row">
              <input
                type="checkbox"
                checked={serverIds.includes(server.id)}
                onChange={(event) =>
                  setServerIds((current) =>
                    event.target.checked
                      ? [...current, server.id]
                      : current.filter((id) => id !== server.id),
                  )
                }
                disabled={!(member.eligibleServerIds ?? member.allowedServerIds).includes(server.id)}
              />
              <span>
                {server.label}
                <small>
                  {(member.eligibleServerIds ?? member.allowedServerIds).includes(server.id)
                    ? "서버 정책에서 허용됨"
                    : "서버 정책 권한 없음"}
                </small>
              </span>
            </label>
          ))
        ) : (
          <p className="helper">등록된 서버가 없습니다.</p>
        )}
      </fieldset>
      {restricted && !serverIds.length ? (
        <p className="helper warning">
          선택한 서버가 없어 모든 서버 접근이 제한됩니다.
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="notice notice-error">
          {error}
        </div>
      ) : null}
      <div className="dialog-actions">
        <button onClick={onClose} disabled={busy}>
          취소
        </button>
        <button className="primary" onClick={() => void save()} disabled={busy}>
          {busy ? "저장 중…" : "접근 제한 저장"}
        </button>
      </div>
    </Dialog>
  );
}

function UnlinkDialog({
  member,
  csrfToken,
  onClose,
  onSaved,
  onError,
}: {
  member: Member;
  csrfToken: string;
  onClose: () => void;
  onSaved: (notice: string) => Promise<void>;
  onError: ReportError;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function unlink() {
    setBusy(true);
    setError("");
    try {
      await api(`/admin/members/${encodeURIComponent(member.id)}/minecraft`, {
        method: "DELETE",
        csrfToken,
      });
      await onSaved(`${member.displayName}님의 Minecraft 연결을 해제했습니다.`);
    } catch (failure) {
      setError(errorMessage(failure));
      onError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Minecraft 연결 해제" busy={busy} onClose={onClose}>
      <p>
        <strong>{member.displayName}</strong>님과{" "}
        <strong>{member.minecraft?.name}</strong> 계정의 연결을 해제합니다.
      </p>
      <p className="helper dialog-description">
        해당 Minecraft 계정의 접근 정책이 갱신되고 진행 중인 연결 요청이
        취소됩니다. 다시 이용하려면 웹과 게임에서 새로 연결해야 합니다.
      </p>
      <label className="check-row">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          disabled={busy}
        />
        <span>대상 계정과 연결 해제 영향을 확인했습니다.</span>
      </label>
      {error ? (
        <div role="alert" className="notice notice-error">
          {error}
        </div>
      ) : null}
      <div className="dialog-actions">
        <button onClick={onClose} disabled={busy}>
          취소
        </button>
        <button
          className="primary destructive"
          onClick={() => void unlink()}
          disabled={busy || !confirmed}
        >
          {busy ? "연결 해제 중…" : "연결 해제"}
        </button>
      </div>
    </Dialog>
  );
}

export function MembersView({
  csrfToken,
  servers,
  onError,
}: {
  csrfToken: string;
  servers: ServerDefinition[];
  onError: ReportError;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selection, setSelection] = useState<{
    member: Member;
    action: "access" | "unlink";
  } | null>(null);
  const load = useCallback(
    async (nextCursor?: string, signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const result = await api<MembersPage>(
          `/admin/members${nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}` : ""}`,
          { signal },
        );
        if (signal?.aborted) return;
        setMembers((current) =>
          nextCursor
            ? [
                ...current,
                ...result.members.filter(
                  (member) =>
                    !current.some((existing) => existing.id === member.id),
                ),
              ]
            : result.members,
        );
        setCursor(result.nextCursor);
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
    void load(undefined, controller.signal);
    return () => controller.abort();
  }, [load]);
  async function saved(message: string) {
    setSelection(null);
    setNotice(message);
    await load();
  }
  return (
    <>
      <div className="section-toolbar">
        <p className="helper">
          학교 인증을 완료한 회원 {members.length}명 조회됨
          {cursor ? " · 다음 목록 있음" : ""}
        </p>
        <button disabled={loading} onClick={() => void load()}>
          목록 새로고침
        </button>
      </div>
      {notice ? (
        <div role="status" className="notice notice-success">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="notice notice-error">
          {error}
        </div>
      ) : null}
      <section className="panel members-panel" aria-busy={loading}>
        {members.length ? (
          <div className="member-list">
            {members.map((member) => (
              <article className="member-record" key={member.id}>
                <div className="member-record-head">
                  <div>
                    <h2>{member.displayName}</h2>
                    <p>
                      {member.department || "학과 정보 없음"} ·{" "}
                      {member.roleLabel || "역할 없음"}
                    </p>
                  </div>
                  <span
                    className={`member-status ${member.accessSuspended ? "danger-text" : ""}`}
                  >
                    {member.accessSuspended
                      ? "관리자 정지"
                      : membershipLabel(member.membershipStatus)}
                  </span>
                </div>
                <dl className="member-facts">
                  <div>
                    <dt>Minecraft</dt>
                    <dd>{member.minecraft?.name ?? "연결 없음"}</dd>
                  </div>
                  <div>
                    <dt>Discord ID</dt>
                    <dd>
                      {member.discordId ? (
                        <>
                          {member.discordId}
                          <small>직접 입력 · 소유권 미확인</small>
                        </>
                      ) : (
                        "입력 없음"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>명부 확인 유효 시점</dt>
                    <dd>{dateTime(member.verifiedUntil)}</dd>
                  </div>
                  <div>
                    <dt>접근 범위</dt>
                    <dd>
                      {member.scopeRestricted
                        ? member.scopeLimit.length
                          ? member.scopeLimit
                              .map(
                                (id) =>
                                  servers.find((server) => server.id === id)
                                    ?.label ?? id,
                              )
                              .join(", ")
                          : "모든 서버 제한"
                        : "서버 정책 적용"}
                    </dd>
                  </div>
                </dl>
                <div className="member-actions">
                  <button
                    onClick={() => setSelection({ member, action: "access" })}
                  >
                    접근 제한 관리
                  </button>
                  <button
                    className="text-button danger"
                    disabled={!member.minecraft}
                    onClick={() => setSelection({ member, action: "unlink" })}
                  >
                    Minecraft 연결 해제
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>
              {loading
                ? "회원 목록을 불러오고 있어요"
                : "조회된 회원이 없습니다."}
            </h3>
            <p>
              {loading
                ? "잠시만 기다려 주세요."
                : "학교 인증을 완료한 계정이 이곳에 표시됩니다."}
            </p>
          </div>
        )}
      </section>
      {cursor ? (
        <div className="pagination">
          <button disabled={loading} onClick={() => void load(cursor)}>
            {loading ? "불러오는 중…" : "회원 더 보기"}
          </button>
        </div>
      ) : null}
      {selection?.action === "access" ? (
        <MemberEditor
          key={selection.member.id}
          member={selection.member}
          servers={servers}
          csrfToken={csrfToken}
          onClose={() => setSelection(null)}
          onSaved={saved}
          onError={onError}
        />
      ) : selection?.action === "unlink" ? (
        <UnlinkDialog
          member={selection.member}
          csrfToken={csrfToken}
          onClose={() => setSelection(null)}
          onSaved={saved}
          onError={onError}
        />
      ) : null}
    </>
  );
}
