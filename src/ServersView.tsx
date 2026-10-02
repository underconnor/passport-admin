import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, errorMessage } from "./api";
import { Dialog } from "./Dialog";
import { dateTime } from "./types";
import type { ManagedServer, Member, MembersPage, ReportError } from "./types";
import { normalizeServerCommandName, serverCommandNameError } from "./server-settings";

const accessLabels = { roster: "명부 권한", members: "소모임 회원 전체", selected: "선택한 소모임 회원", university: "학교 인증 사용자 전체" };

function ServerEditor({ server, servers, csrfToken, onClose, onSaved, onError }: {
  server: ManagedServer; servers: ManagedServer[]; csrfToken: string; onClose: () => void;
  onSaved: () => Promise<void>; onError: ReportError;
}) {
  const [label, setLabel] = useState(server.label);
  // A rollback may omit the new field even after this UI has been deployed.
  const supportsCommandName = typeof server.commandName === "string";
  const [commandName, setCommandName] = useState(server.commandName ?? server.id);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(server.enabled);
  const [statisticsEnabled, setStatisticsEnabled] = useState(server.statisticsEnabled);
  const [sensitive, setSensitive] = useState(Boolean(server.sensitive));
  const [accessMode, setAccessMode] = useState(server.accessMode);
  // Preserve selected members outside the loaded page when changing a setting.
  const [selected, setSelected] = useState(server.allowedSubjectIds);
  const [members, setMembers] = useState<Member[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const loadMembers = useCallback(async (next?: string, signal?: AbortSignal) => {
    setLoading(true);
    try {
      const result = await api<MembersPage>(`/admin/members${next ? `?cursor=${encodeURIComponent(next)}` : ""}`, { signal });
      if (signal?.aborted) return;
      setMembers(current => next ? [...current, ...result.members.filter(m => !current.some(old => old.id === m.id))] : result.members);
      setCursor(result.nextCursor);
    } catch (failure) {
      if (!signal?.aborted) { setError(errorMessage(failure)); onError(failure); }
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [onError]);
  useEffect(() => {
    const controller = new AbortController();
    void loadMembers(undefined, controller.signal);
    return () => controller.abort();
  }, [loadMembers]);
  async function save() {
    if (busy) return;
    const invalidCommand = supportsCommandName ? serverCommandNameError(commandName, server.id, servers) : null;
    setCommandError(invalidCommand);
    if (invalidCommand) { document.getElementById("server-command-name")?.focus(); return; }
    setBusy(true); setError("");
    try {
      await api(`/admin/servers/${encodeURIComponent(server.id)}`, {
        method: "PUT", csrfToken,
        body: { label: label.trim(), ...(supportsCommandName ? { commandName: normalizeServerCommandName(commandName) } : {}), enabled, sensitive, accessMode,
          ...(statisticsEnabled === undefined ? {} : { statisticsEnabled }),
          allowedSubjectIds: accessMode === "selected" ? selected : [], expectedUpdatedAt: server.updatedAt },
      });
      await onSaved();
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === "server_command_conflict") setCommandError(errorMessage(failure));
      else setError(errorMessage(failure));
      onError(failure);
    }
    finally { setBusy(false); }
  }
  return <Dialog title={`${server.label} · 서버 설정`} busy={busy} onClose={onClose}>
    <label className="field-label" htmlFor="server-label">표시 이름</label>
    <input id="server-label" value={label} onChange={e => setLabel(e.target.value)} maxLength={80} disabled={busy} />
    <label className="field-label" htmlFor="server-command-name">이동 명령어 이름</label>
    <input id="server-command-name" value={commandName} onChange={event => { setCommandName(event.target.value); setCommandError(null); }}
      disabled={busy || !supportsCommandName} autoCapitalize="none" autoCorrect="off" spellCheck={false}
      aria-invalid={Boolean(commandError)} aria-describedby={`server-command-help${commandError ? " server-command-error" : ""}`} />
    <p id="server-command-help" className="helper field-help">{supportsCommandName ? "한글·영문·숫자·밑줄(_)·하이픈(-), 1~64자. 공백은 사용할 수 없고 영문은 소문자로 저장합니다." : "이동 명령어 이름 설정을 준비 중입니다. 다른 서버 설정은 저장할 수 있습니다."}</p>
    {commandError ? <p id="server-command-error" className="error-text" role="alert">{commandError}</p> : null}
    <p className="server-command-preview">게임에서 이동 <code>{normalizeServerCommandName(commandName) ? `/서버 ${normalizeServerCommandName(commandName)}` : "/서버 이름"}</code></p>
    <p className="helper field-help">내부 ID: <code>{server.id}</code> · 플러그인 연결에 쓰는 고정 값입니다.</p>
    <label className="check-row">
      <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} disabled={busy} />
      <span><strong>이 서버 접속 허용</strong><small>끄면 현재 접속 중인 사용자에게도 접근 제한이 적용됩니다.</small></span>
    </label>
    <label className="field-label" htmlFor="server-access">접속 대상</label>
    <select id="server-access" value={accessMode} onChange={e => setAccessMode(e.target.value as ManagedServer["accessMode"])} disabled={busy}>
      <option value="roster">명부에 이 서버 권한이 있는 회원</option>
      <option value="members">소모임 회원 전체</option>
      <option value="selected">선택한 소모임 회원만</option>
      <option value="university">학교 인증 사용자 전체 · 비회원 포함</option>
    </select>
    <p className="helper field-help">유효한 학교 인증과 개인별 접근 제한은 모든 방식에 적용됩니다. 소모임 회원 대상 서버는 유효한 회원 명부도 확인합니다.</p>
    {accessMode === "members" ? <p className="helper warning">이 서버를 활성화하면 명부에 별도 서버 권한이 없어도 활성 회원이 접속할 수 있습니다.</p> : null}
    {accessMode === "university" ? <p className="helper warning">학교 인증을 완료한 사용자는 소모임 회원이 아니어도 접속할 수 있습니다. 이용 정지와 개인별 서버 제한은 계속 적용됩니다.</p> : null}
    {accessMode === "selected" ? <fieldset className="server-scope" disabled={busy}>
      <legend>허용할 회원 · {selected.length}명 선택</legend>
      {members.map(member => <label className="check-row" key={member.id}>
        <input type="checkbox" checked={selected.includes(member.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, member.id] : ids.filter(id => id !== member.id))} />
        <span>{member.displayName}<small>{member.department || "학과 정보 없음"} · {member.minecraft?.name || "게임 연결 전"}</small></span>
      </label>)}
      {loading ? <p className="helper">회원 목록을 불러오는 중…</p> : !members.length ? <p className="helper">학교 로그인한 회원이 없습니다.</p> : null}
      {cursor ? <button type="button" disabled={loading} onClick={() => void loadMembers(cursor)}>회원 더 보기</button> : null}
      {!selected.length ? <p className="helper warning">선택한 회원이 없어 모든 회원의 접속이 제한됩니다.</p> : null}
    </fieldset> : null}
    {statisticsEnabled !== undefined ? <label className="check-row server-statistics-setting">
      <input type="checkbox" checked={statisticsEnabled} onChange={event => setStatisticsEnabled(event.target.checked)} disabled={busy} />
      <span><strong>이 서버 통계 수집</strong><small>끄면 새 기록 수집과 전체 합계 표시를 중지합니다. 기존 기록은 보관하며 유효한 개인정보 동의를 받은 사용자의 기록만 수집합니다.</small></span>
    </label> : null}
    {statisticsEnabled !== server.statisticsEnabled ? <p className="helper warning">변경 시 다른 서버에서 전송 대기 중인 기록도 제외될 수 있습니다. 이미 저장된 기록은 유지됩니다.</p> : null}
    <label className="check-row">
      <input type="checkbox" checked={sensitive} onChange={e => setSensitive(e.target.checked)} disabled={busy} />
      <span><strong>민감 서버로 표시</strong><small>접근 관리에서 별도로 구분합니다. 서버 이동 시에는 항상 최신 권한을 확인합니다.</small></span>
    </label>
    {error ? <div role="alert" className="notice notice-error">{error}</div> : null}
    <div className="dialog-actions"><button onClick={onClose} disabled={busy}>취소</button>
      <button className="primary" disabled={busy || !label.trim()} onClick={() => void save()}>{busy ? "저장 중…" : "설정 저장"}</button></div>
  </Dialog>;
}

export function ServersView({ csrfToken, onError, onChanged, canWrite }: {
  csrfToken: string; onError: ReportError; onChanged: () => Promise<void>; canWrite: boolean;
}) {
  const [servers, setServers] = useState<ManagedServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selection, setSelection] = useState<ManagedServer | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++requestSequence.current;
    setLoading(true); setError("");
    try {
      const result = await api<{ servers: ManagedServer[] }>("/admin/servers", { signal });
      if (!signal?.aborted && sequence === requestSequence.current) setServers(result.servers);
    } catch (failure) { if (!signal?.aborted && sequence === requestSequence.current) { setError(errorMessage(failure)); onError(failure); } }
    finally { if (sequence === requestSequence.current) setLoading(false); }
  }, [onError]);
  useEffect(() => {
    const controller = new AbortController(); void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    if (selection) return;
    const controller = new AbortController();
    const refresh = () => { if (document.visibilityState === "visible") void load(controller.signal); };
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [load, selection]);
  return <>
    <div className="section-toolbar"><p className="helper">등록된 서버 {servers.length}개 · 플러그인이 연결되면 자동으로 표시됩니다.</p>
      <button disabled={loading} onClick={() => void load()}>상태 새로고침</button></div>
    <div className="notice server-discovery-note">새 서버는 접속이 꺼진 상태로 등록됩니다. 서버 설정에서 접속 여부와 접속 대상을 선택해 주세요.</div>
    {notice ? <div role="status" className="notice notice-success">{notice}</div> : null}
    {error ? <div role="alert" className="notice notice-error">{error}</div> : null}
    <section className="panel compact-server-list" aria-label="서버 목록" aria-busy={loading}>
      <div className="server-list-labels" aria-hidden="true"><span>서버</span><span>접속 대상</span><span>연결 상태</span><span /></div>
      {servers.map(server => <article className="compact-server-record" key={server.id}>
        <button className="server-summary" aria-expanded={expanded === server.id} aria-controls={`server-detail-${server.id}`} onClick={() => setExpanded(expanded === server.id ? null : server.id)}>
          <span className="server-summary-name"><strong>{server.label}</strong><small className="server-command">/서버 {server.commandName ?? server.id}</small></span>
          <span className="server-summary-policy">{server.enabled ? accessLabels[server.accessMode] : "접속 비활성"}</span>
          <span className={`connection-badge ${server.online ? "online" : "offline"}`}>{server.online ? "응답 중" : server.paperSeenAt ? "응답 없음" : "연결 대기"}</span>
          <span className="row-chevron" aria-hidden="true">{expanded === server.id ? "−" : "+"}</span>
        </button>
        {expanded === server.id ? <div className="server-expanded" id={`server-detail-${server.id}`}>
          <dl className="member-facts">
            <div><dt>이동 명령어</dt><dd><code>/서버 {server.commandName ?? server.id}</code></dd></div>
            <div><dt>내부 ID · 고정</dt><dd>{server.id}</dd></div>
            <div><dt>프록시 등록</dt><dd>{server.proxyAvailable ? "확인됨" : "확인되지 않음"}</dd></div>
            <div><dt>플러그인 최근 응답</dt><dd>{dateTime(server.paperSeenAt)}</dd></div>
            <div><dt>통계 수집</dt><dd>{server.statisticsEnabled === true ? "켜짐" : server.statisticsEnabled === false ? "꺼짐 · 합계 제외" : "확인 필요"}</dd></div>
            <div><dt>서버 구분</dt><dd>{server.sensitive ? "민감 서버" : "일반 서버"}</dd></div>
          </dl>
          {canWrite ? <div className="member-actions"><button onClick={() => setSelection(server)}>접근 및 설정</button></div> : null}
        </div> : null}
      </article>)}
    </section>
    {!loading && !servers.length ? <section className="panel empty-state"><h2>아직 등록된 서버가 없습니다</h2><p>플러그인의 API 주소와 서비스 인증을 설정하면 여기에 표시됩니다.</p></section> : null}
    <p className="helper field-help">응답 상태는 최근 90초 이내 Paper 플러그인의 보고를 기준으로 합니다. 실제 게임 접속 가능 여부와는 다를 수 있습니다.</p>
    {canWrite && selection ? <ServerEditor key={selection.id} server={selection} servers={servers} csrfToken={csrfToken} onClose={() => setSelection(null)} onError={onError} onSaved={async () => {
      setSelection(null); setNotice("서버 설정을 저장했습니다. 접속 중인 사용자의 권한도 갱신합니다."); await load(); await onChanged();
    }} /> : null}
  </>;
}
