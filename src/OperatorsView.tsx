import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api, errorMessage } from "./api";
import { Dialog } from "./Dialog";
import { dateTime } from "./types";
import type { AdminRole, Member, MembersPage, ReportError } from "./types";
import { invitationLabel, invitationStatus, roleDescription, roleLabel } from "./operators";
import type { Operator, OperatorInvitation, OperatorsPage } from "./operators";

function RoleSelect({ value, onChange, disabled = false }: { value: AdminRole; onChange: (role: AdminRole) => void; disabled?: boolean }) {
  return <><label htmlFor="operator-role">부여할 역할</label><select id="operator-role" value={value} disabled={disabled} onChange={event => onChange(event.target.value as AdminRole)}>
    <option value="viewer">조회 전용</option><option value="operator">운영자</option><option value="owner">총괄 운영자</option>
  </select><p className="helper field-help">{roleDescription(value)}</p></>;
}

type Selection = { kind: "invite"; member: Member } | { kind: "role" | "revoke"; operator: Operator } | { kind: "cancel"; invitation: OperatorInvitation };
function OperatorAction({ selection, csrfToken, onClose, onSaved, onError }: { selection: Selection; csrfToken: string; onClose: () => void; onSaved: (message: string) => Promise<void>; onError: ReportError }) {
  const [role, setRole] = useState<AdminRole>(selection.kind === "role" ? selection.operator.role : "viewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const target = "member" in selection ? selection.member : "operator" in selection ? selection.operator : selection.invitation;
  const title = ({ invite: "운영자 초대", role: "운영자 역할 변경", revoke: "운영자 권한 회수", cancel: "초대 취소" })[selection.kind];
  async function save() {
    if (busy || !confirmed) return;
    setBusy(true); setError("");
    try {
      if (selection.kind === "invite") await api("/admin/operator-invitations", { method: "POST", csrfToken, body: { subjectId: selection.member.id, role } });
      else if (selection.kind === "cancel") await api(`/admin/operator-invitations/${encodeURIComponent(selection.invitation.id)}`, { method: "DELETE", csrfToken });
      else await api(`/admin/operators/${encodeURIComponent(selection.operator.subjectId)}`, { method: selection.kind === "role" ? "PUT" : "DELETE", csrfToken, ...(selection.kind === "role" ? { body: { role } } : {}) });
      await onSaved(selection.kind === "invite" ? "초대했습니다. 대상자가 관리자 페이지에서 학교 로그인 후 직접 수락하면 권한이 부여됩니다." : selection.kind === "cancel" ? "초대를 취소했습니다." : selection.kind === "role" ? "역할을 변경했습니다. 대상자는 다시 로그인해야 합니다." : "운영자 권한을 회수했습니다. 대상자의 관리자 세션도 종료됩니다.");
    } catch (failure) { setError(errorMessage(failure)); onError(failure); }
    finally { setBusy(false); }
  }
  return <Dialog title={title} busy={busy} onClose={onClose}>
    <div className="operator-target"><strong>{target.displayName}</strong>{"studentId" in target ? <span>{target.studentId ?? "학번 미보관"}</span> : null}</div>
    {selection.kind === "invite" || selection.kind === "role" ? <RoleSelect value={role} onChange={value => { setRole(value); setConfirmed(false); }} disabled={busy} /> : null}
    <p className="helper operator-impact">{selection.kind === "invite" ? "초대는 이 계정만 수락할 수 있으며, 발급 후 24시간 동안 한 번 사용할 수 있습니다." : selection.kind === "role" ? `현재 ${roleLabel(selection.operator.role)}에서 ${roleLabel(role)}으로 변경합니다. 대상자의 관리자 세션이 종료됩니다.` : selection.kind === "revoke" ? "관리자 페이지 접근 권한과 관리자 세션을 회수합니다. 학교·게임·Discord 연결은 유지됩니다." : "이 초대를 더 이상 수락할 수 없게 됩니다. 필요하면 다시 초대할 수 있습니다."}</p>
    <label className="check-row"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} /><span>대상 계정과 변경할 권한을 확인했습니다.</span></label>
    {error ? <p className="notice notice-error" role="alert">{error}</p> : null}
    <div className="dialog-actions"><button disabled={busy} onClick={onClose}>닫기</button><button className={`primary${selection.kind === "revoke" || selection.kind === "cancel" ? " destructive" : ""}`} disabled={busy || !confirmed || (selection.kind === "role" && role === selection.operator.role)} onClick={() => void save()}>{busy ? "처리 중…" : title}</button></div>
  </Dialog>;
}

export function OperatorsView({ csrfToken, subjectId, now, onError }: { csrfToken: string; subjectId: string | null; now: number; onError: ReportError }) {
  const [data, setData] = useState<OperatorsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [total, setTotal] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const sequence = useRef(0);
  const searchController = useRef<AbortController | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    const request = ++sequence.current; setLoading(true);
    try { const result = await api<OperatorsPage>("/admin/operators", { signal }); if (!signal?.aborted && request === sequence.current) { setData(result); setError(""); } }
    catch (failure) { if (!signal?.aborted && request === sequence.current) { setError(errorMessage(failure)); onError(failure); } }
    finally { if (!signal?.aborted && request === sequence.current) setLoading(false); }
  }, [onError]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => { controller.abort(); searchController.current?.abort(); ++sequence.current; }; }, [load]);
  async function search(event: FormEvent) {
    event.preventDefault(); searchController.current?.abort();
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    const controller = new AbortController(); searchController.current = controller;
    setSearching(true); setSearched(false); setResults([]); setError("");
    try { const result = await api<MembersPage>(`/admin/members?${new URLSearchParams({ q: query.trim(), membership: "all", sort: "name", limit: "20" })}`, { signal: controller.signal }); if (!controller.signal.aborted) { setResults(result.members); setTotal(result.total); setSearched(true); } }
    catch (failure) { if (!controller.signal.aborted) { setError(errorMessage(failure)); onError(failure); } }
    finally { if (!controller.signal.aborted) setSearching(false); }
  }
  const enabledOwners = data?.operators.filter(operator => operator.enabled && operator.role === "owner").length ?? 0;
  return <div className="stack operators-view">
    <div className="section-toolbar"><p className="helper">총괄 운영자만 운영자를 초대하거나 권한을 변경할 수 있습니다.</p><button disabled={loading} onClick={() => void load()}>목록 새로고침</button></div>
    {error ? <p role="alert" className="notice notice-error">{error}</p> : null}
    {notice ? <p role="status" className="notice notice-success">{notice}</p> : null}
    <section className="panel" aria-labelledby="operator-invite-heading"><div className="panel-head"><h2 id="operator-invite-heading">운영자 초대</h2><span className="status-label">학교 인증 계정</span></div>
      <p className="helper">이름·학번·Minecraft·Discord로 계정을 찾고 초대할 역할을 선택해 주세요.</p>
      <form className="member-search operator-search" onSubmit={search}><label className="sr-only" htmlFor="operator-search">초대할 계정 검색</label><input id="operator-search" value={query} onChange={event => { searchController.current?.abort(); setSearching(false); setQuery(event.target.value); setResults([]); setSearched(false); }} placeholder="이름, 학번, Minecraft, Discord" maxLength={100} /><button className="primary" disabled={searching || !query.trim()}>검색</button></form>
      {searching ? <p className="helper" role="status">계정을 찾고 있습니다.</p> : null}
      {searched && !results.length ? <p className="helper">검색 결과가 없습니다. 대상자가 사용자 페이지에서 학교 인증을 완료했는지 확인해 주세요.</p> : null}
      {searched && total > results.length ? <p className="helper">{total}명 중 {results.length}명을 표시합니다. 검색어를 더 구체적으로 입력해 주세요.</p> : null}
      <div className="operator-search-results">{results.map(member => {
        const registered = member.administrator || data?.operators.some(operator => operator.subjectId === member.id && operator.enabled);
        const pending = data?.invitations.some(invite => invite.subjectId === member.id && invitationStatus(invite, now) === "pending");
        const development = member.identityProvider === "managed-development";
        const expired = !member.universityVerifiedUntil || new Date(member.universityVerifiedUntil).getTime() <= now;
        return <div className="operator-row" key={member.id}><div className="operator-identity"><strong>{member.displayName}</strong><small>{development ? "개발 계정 · 학교 계정 없음" : member.studentId ?? "학번 미보관"} · {member.minecraft?.name ?? "Minecraft 미연결"}</small></div><button disabled={loading || !data || registered || pending || expired || development} onClick={() => setSelection({ kind: "invite", member })}>{development ? "초대 불가" : registered ? "등록된 운영자" : pending ? "수락 대기" : expired ? "학교 재인증 필요" : "초대"}</button></div>;
      })}</div>
    </section>
    <section className="panel" aria-labelledby="operator-list-heading"><div className="panel-head"><h2 id="operator-list-heading">운영자 목록</h2><span className="status-label">{data?.operators.filter(operator => operator.enabled).length ?? 0}명 활성</span></div>
      {!data ? <p className="helper">{loading ? "운영자 목록을 불러오고 있습니다." : "목록을 새로고침해 주세요."}</p> : <div className="operator-list">{data.operators.map(operator => {
        const self = operator.subjectId === subjectId;
        const protectedOwner = operator.enabled && operator.role === "owner" && enabledOwners <= 1;
        return <div className="operator-row" key={operator.subjectId}><div className="operator-identity"><strong>{operator.displayName}{self ? <span className="operator-self">내 계정</span> : null}</strong><small>{operator.studentId ?? "학번 미보관"} · {operator.enabled ? roleDescription(operator.role) : "회수된 권한"}</small></div><span className="status-label">{operator.enabled ? roleLabel(operator.role) : "권한 회수됨"}</span><div className="operator-actions">{operator.enabled ? <><button disabled={loading || self || protectedOwner} onClick={() => setSelection({ kind: "role", operator })}>역할 변경</button><button className="text-button danger" disabled={loading || self || protectedOwner} onClick={() => setSelection({ kind: "revoke", operator })}>권한 회수</button></> : null}</div>{self || protectedOwner ? <small className="operator-protection">{self ? "본인 권한은 다른 총괄 운영자가 변경할 수 있습니다." : "마지막 총괄 운영자는 회수할 수 없습니다."}</small> : null}</div>;
      })}</div>}
    </section>
    <section className="panel" aria-labelledby="operator-invitations-heading"><div className="panel-head"><h2 id="operator-invitations-heading">초대 내역</h2><small>유효기간 24시간</small></div>
      {!data?.invitations.length ? <p className="helper">발급한 초대가 없습니다.</p> : <div className="operator-list">{data.invitations.map(invitation => { const status = invitationStatus(invitation, now); return <div className="operator-row" key={invitation.id}><div className="operator-identity"><strong>{invitation.displayName}</strong><small>{roleLabel(invitation.role)} · 만료 {dateTime(invitation.expiresAt)}</small></div><span className="status-label">{invitationLabel(status)}</span>{status === "pending" ? <button disabled={loading} className="text-button danger" onClick={() => setSelection({ kind: "cancel", invitation })}>초대 취소</button> : null}</div>; })}</div>}
    </section>
    {selection ? <OperatorAction selection={selection} csrfToken={csrfToken} onClose={() => setSelection(null)} onSaved={async message => { setSelection(null); setResults([]); setSearched(false); setNotice(message); await load(); }} onError={onError} /> : null}
  </div>;
}
