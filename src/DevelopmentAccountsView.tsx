import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { api, ApiError, errorMessage } from "./api";
import { Dialog } from "./Dialog";
import { DEVELOPMENT_PAGE_SIZE, filterDevelopmentAccounts, validMinecraftName } from "./development-accounts";
import type { DevelopmentAccount } from "./development-accounts";
import { dateTime } from "./types";
import type { ReportError, ServerDefinition } from "./types";

interface Scenario { member: boolean; discordLinked: boolean }
function ScenarioFields({ value, onChange, disabled }: { value: Scenario; onChange: (value: Scenario) => void; disabled: boolean }) {
  const id = useId();
  return <div className="development-scenario">
    <div><label htmlFor={`${id}-member`}>회원 자격</label><select id={`${id}-member`} value={String(value.member)} disabled={disabled} onChange={event => onChange({ ...value, member: event.target.value === "true" })}><option value="false">비회원</option><option value="true">소모임 회원</option></select></div>
    <div><label htmlFor={`${id}-discord`}>Discord 연동 가정</label><select id={`${id}-discord`} value={String(value.discordLinked)} disabled={disabled} onChange={event => onChange({ ...value, discordLinked: event.target.value === "true" })}><option value="false">미연동</option><option value="true">연동됨</option></select></div>
  </div>;
}

function AccountEditor({ account, busy, onSave, onDelete }: { account: DevelopmentAccount; busy: boolean; onSave: (value: Scenario & { enabled: boolean }) => void; onDelete: () => void }) {
  const [scenario, setScenario] = useState<Scenario>({ member: account.member, discordLinked: account.discordLinked });
  const [enabled, setEnabled] = useState(account.enabled);
  const dirty = scenario.member !== account.member || scenario.discordLinked !== account.discordLinked || enabled !== account.enabled;
  return <form className="development-editor" aria-label={`${account.minecraft.name} 테스트 설정`} onSubmit={event => { event.preventDefault(); if (dirty && !busy) onSave({ ...scenario, enabled }); }}>
    <ScenarioFields value={scenario} onChange={setScenario} disabled={busy} />
    <label className="check-row"><input type="checkbox" checked={enabled} disabled={busy} onChange={event => setEnabled(event.target.checked)} /><span><strong>개발 계정 활성화</strong><small>끄면 이 계정의 테스트 접속 권한을 회수합니다.</small></span></label>
    <div className="development-actions"><button className="primary" disabled={busy || !dirty}>{busy ? "처리 중…" : "설정 저장"}</button><button type="button" className="text-button danger" disabled={busy} onClick={onDelete}>개발 계정 삭제</button></div>
  </form>;
}

export function DevelopmentAccountsView({ csrfToken, canWrite, servers, onError }: { csrfToken: string; canWrite: boolean; servers: ServerDefinition[]; onError: ReportError }) {
  const [accounts, setAccounts] = useState<DevelopmentAccount[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [minecraftName, setMinecraftName] = useState("");
  const [scenario, setScenario] = useState<Scenario>({ member: false, discordLinked: false });
  const [deleting, setDeleting] = useState<DevelopmentAccount | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const request = useRef<AbortController | null>(null);
  const mutating = useRef(false);
  useEffect(() => () => { request.current?.abort(); }, []);
  const failed = useEffectEvent((failure: unknown) => { setError(errorMessage(failure)); onError(failure); });
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    void api<{ accounts: DevelopmentAccount[] }>("/admin/development-accounts", { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setAccounts(value.accounts); })
      .catch(failure => { if (!controller.signal.aborted) { setAccounts(null); failed(failure); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  function reload() { setExpanded(null); setDeleting(null); setMutationError(""); setRefresh(value => value + 1); }
  async function mutate(path: string, method: string, body: unknown, success: string) {
    if (!canWrite || mutating.current || loading) return;
    mutating.current = true;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(""); setMutationError(""); setNotice("");
    try {
      await api(path, { method, body, csrfToken, signal: controller.signal });
      if (controller.signal.aborted) return;
      setNotice(success); setCreateOpen(false); setMinecraftName(""); setScenario({ member: false, discordLinked: false }); reload();
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (failure instanceof ApiError && ["development_account_changed", "development_account_not_found"].includes(failure.code)) {
        reload(); setError(errorMessage(failure));
      } else if (deleting) setMutationError(errorMessage(failure));
      else setError(errorMessage(failure));
      onError(failure);
    } finally { mutating.current = false; if (!controller.signal.aborted) setBusy(false); }
  }
  const filtered = filterDevelopmentAccounts(accounts ?? [], query);
  const pages = Math.max(1, Math.ceil(filtered.length / DEVELOPMENT_PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const rows = filtered.slice(currentPage * DEVELOPMENT_PAGE_SIZE, (currentPage + 1) * DEVELOPMENT_PAGE_SIZE);
  const locked = busy || loading;
  return <section className="development-accounts">
    <div className="stats-toolbar"><div><h2>Minecraft 개발 계정</h2><p>학교 계정 없이 회원·Discord 조건별 서버 접속을 테스트합니다.</p></div><div className="stats-toolbar-actions"><button disabled={locked} onClick={() => { setError(""); reload(); }}>목록 새로고침</button>{canWrite ? <button className="primary" disabled={locked || accounts === null || accounts.length >= 100} onClick={() => { setCreateOpen(value => !value); setExpanded(null); setError(""); setNotice(""); }}>{createOpen ? "등록 닫기" : "개발 계정 등록"}</button> : null}</div></div>
    <p className="helper development-explanation">표시 이름은 ‘개발용 계정’입니다. Discord 상태는 접속 권한에만 적용하며 실제 계정을 연결하거나 역할을 지급하지 않습니다. 개발 계정의 누적 플레이 통계는 집계하지 않습니다.</p>
    {error ? <p role="alert" className="notice notice-error">{error}</p> : null}
    {notice ? <p role="status" className="notice notice-success">{notice}</p> : null}
    {createOpen && canWrite ? <form className="panel development-create" onSubmit={event => { event.preventDefault(); if (validMinecraftName(minecraftName)) void mutate("/admin/development-accounts", "POST", { minecraftName: minecraftName.trim(), ...scenario }, "개발 계정을 등록했습니다."); }}>
      <h3>개발 계정 등록</h3><label htmlFor="development-minecraft-name">Minecraft 닉네임 (IGN)</label><input id="development-minecraft-name" autoComplete="off" spellCheck={false} required pattern="[a-zA-Z0-9_]{1,16}" maxLength={16} placeholder="게임 닉네임 입력" value={minecraftName} disabled={locked} onChange={event => setMinecraftName(event.target.value)} aria-describedby="development-minecraft-help" /><p className="helper" id="development-minecraft-help">Mojang에서 실제 프로필과 UUID를 확인합니다. 이미 연결된 계정은 등록할 수 없습니다.</p>
      <ScenarioFields value={scenario} onChange={setScenario} disabled={locked} />
      <div className="development-actions"><button type="button" disabled={busy} onClick={() => setCreateOpen(false)}>취소</button><button className="primary" disabled={locked || !validMinecraftName(minecraftName)}>{busy ? "프로필 확인 중…" : "프로필 확인 후 등록"}</button></div>
    </form> : null}
    <div className="development-list-tools"><label className="sr-only" htmlFor="development-account-search">개발 계정 검색</label><input type="search" id="development-account-search" placeholder="게임 닉네임 또는 UUID 검색" value={query} disabled={busy} onChange={event => { setQuery(event.target.value); setPage(0); setExpanded(null); }} /><span>{filtered.length}개 계정</span></div>
    {loading ? <p role="status">개발 계정을 불러오고 있습니다.</p> : null}
    {accounts === null ? !loading && <section className="panel empty-state"><p>목록을 불러오지 못했습니다. 새로고침해 주세요.</p></section> : !rows.length ? <section className="panel empty-state"><h3>{query.trim() ? "검색 결과가 없습니다." : "등록된 개발 계정이 없습니다."}</h3></section> : <div className="panel development-list" aria-busy={loading}>
      {rows.map(account => <article className="development-row" key={account.id}>
        <button className="development-summary" aria-expanded={expanded === account.id} aria-controls={`development-detail-${account.id}`} disabled={locked} onClick={() => { setExpanded(value => value === account.id ? null : account.id); setCreateOpen(false); setError(""); }}>
          <span className="development-identity"><strong>{account.minecraft.name}<span className="development-badge">개발</span></strong><small>{account.presence.online ? `접속 중 · ${account.presence.serverLabel ?? "서버 확인 중"}` : "오프라인"}</small></span>
          <span className={`member-kind ${account.member ? "member-kind-active" : ""}`}>{account.member ? "소모임 회원" : "비회원"}</span><span className="development-discord">Discord {account.discordLinked ? "연동 가정" : "미연동 가정"}</span><span className={`connection-badge ${account.enabled ? "online" : ""}`}>{account.enabled ? "활성" : "비활성"}</span><span className="row-chevron" aria-hidden="true">{expanded === account.id ? "⌃" : "⌄"}</span>
        </button>
        {expanded === account.id ? <div className="development-expanded" id={`development-detail-${account.id}`}>
          <dl className="detail-list"><div><dt>표시 이름</dt><dd>{account.displayName}</dd></div><div><dt>Minecraft UUID</dt><dd className="development-uuid">{account.minecraft.uuid}</dd></div><div><dt>접속 가능 서버</dt><dd>{account.allowedServerIds.map(id => servers.find(server => server.id === id)?.label ?? id).join(", ") || "접속 가능한 서버가 없습니다."}</dd></div><div><dt>마지막 변경</dt><dd>{dateTime(account.updatedAt)}</dd></div></dl>
          {canWrite ? <AccountEditor key={`${account.id}:${account.revision}`} account={account} busy={locked} onSave={value => void mutate(`/admin/development-accounts/${encodeURIComponent(account.id)}`, "PUT", { ...value, expectedRevision: account.revision }, "테스트 설정을 저장했습니다.")} onDelete={() => { setDeleting(account); setConfirmed(false); setMutationError(""); }} /> : <p className="helper">조회 전용입니다. 변경은 총괄 운영자 또는 운영자에게 요청해 주세요.</p>}
        </div> : null}
      </article>)}
    </div>}
    {pages > 1 ? <div className="development-pagination"><button disabled={locked || currentPage === 0} onClick={() => { setPage(currentPage - 1); setExpanded(null); }}>이전</button><span>{currentPage + 1} / {pages}</span><button disabled={locked || currentPage >= pages - 1} onClick={() => { setPage(currentPage + 1); setExpanded(null); }}>다음</button></div> : null}
    {deleting && canWrite ? <Dialog title="개발 계정 삭제" busy={busy} onClose={() => setDeleting(null)}><p><strong>{deleting.minecraft.name}</strong>의 개발 등록을 삭제하고 테스트 접속 권한을 회수합니다.</p><p className="helper development-uuid">{deleting.minecraft.uuid}</p><label className="check-row"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>삭제할 개발 계정을 확인했습니다.</span></label>{mutationError ? <p role="alert" className="notice notice-error">{mutationError}</p> : null}<div className="dialog-actions"><button disabled={busy} onClick={() => setDeleting(null)}>취소</button><button className="primary" disabled={busy || !confirmed} onClick={() => void mutate(`/admin/development-accounts/${encodeURIComponent(deleting.id)}`, "DELETE", { expectedRevision: deleting.revision }, "개발 계정을 삭제했습니다.")}>{busy ? "삭제 중…" : "삭제 확인"}</button></div></Dialog> : null}
  </section>;
}
