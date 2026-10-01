import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, errorMessage } from "./api";
import { StatsView } from "./StatsView";
import { Dialog } from "./Dialog";
import { dateTime, membershipLabel } from "./types";
import type {
  AccessInput,
  Member,
  MembersPage,
  ReportError,
  ServerDefinition,
} from "./types";

function currentMembership(member: Member) {
  if (member.accessSuspended) return { label: "접근 정지", tone: "member-kind-suspended" };
  if (member.membershipStatus === "suspended") return { label: "명부 정지", tone: "member-kind-suspended" };
  if (member.membershipStatus === "active") return new Date(member.verifiedUntil).getTime() > Date.now()
    ? { label: "소모임 회원", tone: "member-kind-active" }
    : { label: "회원 확인 만료", tone: "" };
  return { label: membershipLabel(member.membershipStatus), tone: "" };
}

const discordRoleLabels = {
  pending: "인증 역할 반영 대기",
  granted: "인증 역할 지급됨",
  revoked: "인증 역할 회수됨",
  failed: "역할 반영 실패 · 봇 설정 확인 필요",
};

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
    <div className="member-access-editor" aria-label={`${member.displayName} 접근 제한 수정`}>
      <p className="helper">
        서버별 접근 정책으로 허용된 범위 안에서 이 사용자의 접속을 제한합니다.
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
          <strong>사용자 접근 정지</strong>
          <small>게임 접근을 제한하고 Discord 인증 역할을 회수합니다.</small>
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
    </div>
  );
}

function UnlinkDialog({
  member,
  provider,
  csrfToken,
  onClose,
  onSaved,
  onError,
}: {
  member: Member;
  provider: "minecraft" | "discord";
  csrfToken: string;
  onClose: () => void;
  onSaved: (notice: string) => Promise<void>;
  onError: ReportError;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = provider === "minecraft" ? "Minecraft" : "Discord";
  const account = provider === "minecraft"
    ? member.minecraft?.name
    : member.discordConnection?.displayName || member.discordConnection?.username || member.discordId;
  async function unlink() {
    setBusy(true);
    setError("");
    try {
      await api(`/admin/members/${encodeURIComponent(member.id)}/${provider}`, {
        method: "DELETE",
        csrfToken,
      });
      await onSaved(`${member.displayName}님의 ${label} 연결을 해제했습니다.${provider === "discord" ? " 인증 역할 회수도 요청했습니다." : ""}`);
    } catch (failure) {
      setError(errorMessage(failure));
      onError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={`${label} 연결 해제`} busy={busy} onClose={onClose}>
      <p>
        <strong>{member.displayName}</strong>님과{" "}
        <strong>{account}</strong> 계정의 연결을 해제합니다.
      </p>
      <p className="helper dialog-description">
        {provider === "minecraft"
          ? "해당 Minecraft 계정의 접근 정책이 갱신되고 진행 중인 연결 요청이 취소됩니다. 다시 이용하려면 게임에서 새 인증 링크를 열어야 합니다."
          : "회원의 해제 요청과 대상 계정을 확인해 주세요. 진행 중인 Discord 연결 요청이 취소되고 봇에 인증 역할 회수가 요청됩니다. 다시 연결하려면 Discord의 연동하기 버튼을 이용해야 합니다."}
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

function DeleteMemberDialog({ member, csrfToken, onClose, onSaved, onError }: {
  member: Member; csrfToken: string; onClose: () => void;
  onSaved: (notice: string) => Promise<void>; onError: ReportError;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setBusy(true); setError("");
    try {
      await api(`/admin/members/${encodeURIComponent(member.id)}`, { method: "DELETE", csrfToken,
        body: { expectedRevision: member.revision, confirmation: member.displayName } });
      await onSaved(`${member.displayName}님의 회원 정보를 삭제하고 연결된 계정의 권한 회수를 요청했습니다.`);
    } catch (failure) {
      setError(errorMessage(failure)); onError(failure);
      if (failure instanceof ApiError && failure.code === "subject_changed") setStale(true);
    } finally { setBusy(false); }
  }
  return <Dialog title="회원 정보 삭제" busy={busy} onClose={onClose}>
    <p><strong>{member.displayName}</strong>님의 Passport 계정을 삭제합니다.</p>
    <dl className="delete-member-target">
      <div><dt>Minecraft</dt><dd>{member.minecraft?.name ?? "연결 없음"}</dd></div>
      <div><dt>Discord</dt><dd>{member.discordConnection ? `${member.discordConnection.username} · ${member.discordConnection.discordId}` : member.discordId ?? "연결 없음"}</dd></div>
    </dl>
    <p className="helper">학교 인증, 로그인 세션, 계정 연결과 플레이 기록이 삭제되고 게임 접근·Discord 역할이 회수됩니다. 다시 이용하려면 처음부터 인증해야 합니다. 구글시트의 회원 명단은 삭제하지 않습니다.</p>
    {member.administrator ? <p className="helper warning">이 계정의 관리자 권한도 함께 삭제됩니다.</p> : null}
    <label className="field-label" htmlFor="delete-member-name">확인을 위해 ‘{member.displayName}’ 입력</label>
    <input id="delete-member-name" autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy || stale} />
    <label className="check-row"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} disabled={busy || stale} /><span>위 계정과 삭제 범위를 확인했습니다.</span></label>
    {error ? <div role="alert" className="notice notice-error">{error}</div> : null}
    <div className="dialog-actions"><button onClick={onClose} disabled={busy}>{stale ? "닫고 목록 확인" : "취소"}</button><button className="primary destructive" onClick={() => void remove()} disabled={busy || stale || !acknowledged || confirmation !== member.displayName}>{busy ? "삭제 중…" : "회원 정보 삭제"}</button></div>
  </Dialog>;
}

export function MembersView({ csrfToken, servers, onError }: {
  csrfToken: string; servers: ServerDefinition[]; onError: ReportError;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [membership, setMembership] = useState("all");
  const [sort, setSort] = useState("name");
  const [pages, setPages] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statsMember, setStatsMember] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ member: Member; action: "delete" | "unlink" | "unlink-discord" } | null>(null);
  const requestSequence = useRef(0);
  const cursor = pages.at(-1);
  const load = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++requestSequence.current;
    setLoading(true); setError(""); setMembers([]); setNextCursor(null); setExpanded(null); setEditing(null); setStatsMember(null);
    const params = new URLSearchParams({ q: query, membership, sort, limit: "20" });
    if (cursor) params.set("cursor", cursor);
    try {
      const result = await api<MembersPage>(`/admin/members?${params}`, { signal });
      if (signal?.aborted || sequence !== requestSequence.current) return;
      setMembers(result.members); setNextCursor(result.nextCursor); setTotal(result.total);
    } catch (failure) {
      if (!signal?.aborted && sequence === requestSequence.current) { setError(errorMessage(failure)); onError(failure); }
    } finally { if (!signal?.aborted && sequence === requestSequence.current) setLoading(false); }
  }, [query, membership, sort, cursor, onError]);
  useEffect(() => {
    const controller = new AbortController(); void load(controller.signal);
    return () => { controller.abort(); requestSequence.current++; };
  }, [load]);
  async function saved(message: string) {
    setSelection(null); setEditing(null); setNotice(message); await load();
  }
  return <>
    <form className="member-search" onSubmit={event => { event.preventDefault(); if (query === queryInput.trim() && !pages.length) void load(); else { setQuery(queryInput.trim()); setPages([]); } }}>
      <label className="sr-only" htmlFor="member-search">회원 통합 검색</label>
      <input id="member-search" type="search" autoComplete="off" maxLength={128} value={queryInput} onChange={event => setQueryInput(event.target.value)} placeholder="실명, 학번 전체, Minecraft 이름, Discord" />
      <button className="primary" type="submit" disabled={loading}>검색</button>
    </form>
    <div className="member-filters">
      <div><label htmlFor="membership-filter">회원 구분</label><select id="membership-filter" value={membership} onChange={event => { setMembership(event.target.value); setPages([]); }}>
        <option value="all">전체 사용자</option><option value="active">소모임 회원만</option><option value="inactive">비회원·확인 대기</option><option value="suspended">정지 사용자</option>
      </select></div>
      <div><label htmlFor="member-sort">정렬</label><select id="member-sort" value={sort} onChange={event => { setSort(event.target.value); setPages([]); }}>
        <option value="name">이름순</option><option value="newest">최근 등록순</option><option value="oldest">오래된 등록순</option>
      </select></div>
      {query || queryInput ? <button type="button" className="text-button" onClick={() => { setQueryInput(""); setQuery(""); setPages([]); }}>검색 초기화</button> : null}
      <button type="button" className="text-button member-refresh" disabled={loading} onClick={() => void load()}>목록 새로고침</button>
    </div>
    <div className="member-list-meta"><span aria-live="polite">{loading ? "목록 확인 중…" : error ? "목록을 확인하지 못했습니다" : `총 ${total}명`}</span><span>행을 누르면 상세 정보와 수정 메뉴가 열립니다.</span></div>
    {notice ? <div role="status" className="notice notice-success">{notice}</div> : null}
    {error ? <div role="alert" className="notice notice-error">{error}</div> : null}
    <section className="panel members-panel compact-members" aria-label="회원 목록" aria-busy={loading}>
      <div className="member-list-labels" aria-hidden="true"><span>사용자</span><span>회원 구분</span><span>Minecraft</span><span>Discord</span><span /></div>
      {members.map(member => <article className="member-row" key={member.id}>
        <button className="member-summary" aria-expanded={expanded === member.id} aria-controls={`member-detail-${member.id}`} onClick={() => { setExpanded(expanded === member.id ? null : member.id); setEditing(null); setStatsMember(null); }}>
          <span className="member-summary-name"><strong>{member.displayName}</strong><small>{member.studentId || "학교 재인증 필요"} · {member.department || "학과 정보 없음"}{member.administrator ? " · 관리자" : ""}</small></span>
          <span className={`member-kind ${currentMembership(member).tone}`}>{currentMembership(member).label}</span>
          <span className="member-summary-minecraft">{member.minecraft?.name ?? "연결 없음"}{member.presence ? <span className={`member-presence ${member.presence.online ? "is-online" : ""}`}><span className="presence-dot" /><span>{member.presence.online ? `접속 중${member.presence.serverLabel ? ` · ${member.presence.serverLabel}` : ""}` : "오프라인"}</span></span> : null}</span>
          <span className="member-summary-discord">{member.discordConnection?.displayName || member.discordConnection?.username || (member.discordId ? member.discordId : "연결 없음")}</span>
          <span className="row-chevron" aria-hidden="true">{expanded === member.id ? "−" : "+"}</span>
        </button>
        {expanded === member.id ? <div className="member-expanded" id={`member-detail-${member.id}`}>
          <dl className="member-facts">
            <div><dt>학번</dt><dd>{member.studentId || "학교 재인증 필요"}</dd></div>
            <div><dt>Minecraft</dt><dd>{member.minecraft?.name ?? "연결 없음"}</dd></div>
            <div><dt>Discord</dt><dd>{member.discordConnection ? <>{member.discordConnection.username}<small>{member.discordConnection.discordId} · {discordRoleLabels[member.discordConnection.roleStatus]}</small></> : member.discordId ?? "연결 없음"}</dd></div>
            {member.presence ? <div><dt>현재 접속</dt><dd>{member.presence.online ? member.presence.serverLabel || "접속 중" : "오프라인"}<small>마지막 확인 {dateTime(member.presence.lastSeenAt)}</small></dd></div> : null}
            <div><dt>명부 확인 유효 시점</dt><dd>{dateTime(member.verifiedUntil)}</dd></div>
            <div><dt>접근 범위</dt><dd>{member.scopeRestricted ? member.scopeLimit.length ? member.scopeLimit.map(id => servers.find(server => server.id === id)?.label ?? id).join(", ") : "모든 서버 제한" : "서버 정책 적용"}</dd></div>
          </dl>
          {editing === member.id ? <MemberEditor member={member} servers={servers} csrfToken={csrfToken} onClose={() => setEditing(null)} onSaved={saved} onError={onError} /> : <div className="member-actions">
            <button onClick={() => setEditing(member.id)}>접근 제한 수정</button>
            <button onClick={() => setStatsMember(statsMember === member.id ? null : member.id)} aria-expanded={statsMember === member.id}>플레이 기록</button>
            <button className="text-button" disabled={!member.minecraft} onClick={() => setSelection({ member, action: "unlink" })}>Minecraft 연결 해제</button>
            <button className="text-button" disabled={!member.discordConnection && !member.discordId} onClick={() => setSelection({ member, action: "unlink-discord" })}>Discord 연결 해제</button>
            <button className="text-button danger member-delete" onClick={() => setSelection({ member, action: "delete" })}>회원 정보 삭제</button>
          </div>}
          {statsMember === member.id ? <div className="member-stats"><StatsView endpoint={`/admin/members/${encodeURIComponent(member.id)}/stats`} title={`${member.displayName}님의 플레이 기록`} onError={onError} /></div> : null}
        </div> : null}
      </article>)}
      {!members.length ? <div className="empty-state"><h3>{loading ? "회원 목록을 불러오고 있어요" : error ? "목록을 다시 불러와 주세요" : query || membership !== "all" ? "조건에 맞는 사용자가 없습니다" : "등록된 사용자가 없습니다"}</h3><p>{loading ? "잠시만 기다려 주세요." : error ? "목록 새로고침으로 다시 시도할 수 있습니다." : "학교 인증을 완료한 사용자가 이곳에 표시됩니다."}</p></div> : null}
    </section>
    <div className="pagination member-pagination"><button disabled={loading || !pages.length} onClick={() => setPages(current => current.slice(0, -1))}>이전</button><span>{pages.length + 1} 페이지</span><button disabled={loading || !nextCursor} onClick={() => { if (nextCursor) setPages(current => [...current, nextCursor]); }}>다음</button></div>
    {selection?.action === "delete" ? <DeleteMemberDialog member={selection.member} csrfToken={csrfToken} onClose={() => setSelection(null)} onSaved={saved} onError={onError} />
      : selection ? <UnlinkDialog member={selection.member} provider={selection.action === "unlink" ? "minecraft" : "discord"} csrfToken={csrfToken} onClose={() => setSelection(null)} onSaved={saved} onError={onError} /> : null}
  </>;
}
