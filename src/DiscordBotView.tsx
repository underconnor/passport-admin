import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, errorMessage } from "./api";
import { settingsDraft, validateDiscordDraft } from "./discord";
import type { DiscordDraft, DiscordOverview, DiscordSettings } from "./discord";
import type { ReportError } from "./types";

export function DiscordBotView({ csrfToken, onError }: { csrfToken: string; onError: ReportError }) {
  const [data, setData] = useState<DiscordOverview | null>(null);
  const [settings, setSettings] = useState<DiscordSettings | null>(null);
  const [draft, setDraft] = useState<DiscordDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const sequence = useRef(0);
  const initialized = useRef(false);
  const load = useCallback(async (replace: boolean, signal?: AbortSignal) => {
    const current = ++sequence.current;
    setLoading(true);
    try {
      const result = await api<DiscordOverview>("/admin/discord", { signal });
      if (signal?.aborted || current !== sequence.current) return;
      setData(result); setError("");
      if (replace || !initialized.current) { initialized.current = true; setSettings(result.settings); setDraft(result.settings ? settingsDraft(result.settings) : null); setDirty(false); setConflict(false); }
    } catch (failure) {
      if (!signal?.aborted && current === sequence.current) { setError(errorMessage(failure)); onError(failure); }
    } finally { if (!signal?.aborted && current === sequence.current) setLoading(false); }
  }, [onError]);
  useEffect(() => { const controller = new AbortController(); void load(true, controller.signal); return () => { controller.abort(); ++sequence.current; }; }, [load]);
  useEffect(() => {
    if (busy) return;
    const controller = new AbortController(); let running = false;
    const refresh = async () => { if (running || document.visibilityState !== "visible") return; running = true; await load(false, controller.signal); running = false; };
    const timer = window.setInterval(() => void refresh(), 15_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [load, busy]);
  const update = (patch: Partial<DiscordDraft>) => { setDraft(value => value ? { ...value, ...patch } : value); setDirty(true); setNotice(""); };
  const validation = draft && settings ? validateDiscordDraft(draft, settings) : "";
  const changed = conflict || Boolean(settings && data?.settings && settings.revision !== data.settings.revision);
  async function perform(action: "save" | "reconcile") {
    if (!settings || !draft || validation || changed) return;
    setBusy(action); setError(""); setNotice(""); setLoading(false); ++sequence.current;
    try {
      if (action === "save") {
        const result = await api<{ settings: DiscordSettings }>("/admin/discord", { method: "PUT", csrfToken, body: { ...draft, expectedRevision: settings.revision } });
        setSettings(result.settings); setDraft(settingsDraft(result.settings)); setData(current => current ? { ...current, settings: result.settings } : current); setDirty(false);
        setNotice("설정을 저장했습니다. 역할과 닉네임의 실제 반영 상태는 아래 처리 현황에서 확인해 주세요.");
      } else {
        await api("/admin/discord/reconcile", { method: "POST", csrfToken, body: { expectedRevision: settings.revision } });
        setNotice("재동기화를 요청했습니다. 요청 접수는 역할·닉네임 반영 완료를 의미하지 않습니다.");
      }
      await load(false);
    } catch (failure) { if (failure instanceof ApiError && failure.code === "discord_settings_changed") setConflict(true); setError(errorMessage(failure)); onError(failure); }
    finally { setBusy(""); }
  }
  const disabled = Boolean(busy);
  return <div className="discord-admin">
    <div className="section-toolbar"><p className="helper">설정 변경은 저장 후 반영됩니다.</p><button disabled={loading || disabled} onClick={() => void load(false)}>상태 새로고침</button></div>
    {notice ? <div className="notice notice-success" role="status">{notice}</div> : null}
    {error ? <div className="notice notice-error" role="alert">{error}</div> : null}
    {!data ? <section className="panel empty-state"><h2>{loading ? "봇 설정을 불러오고 있습니다" : "봇 설정을 확인하지 못했습니다"}</h2><p>상태 새로고침으로 다시 확인해 주세요.</p></section> : <>
      <section className="panel discord-operation-status" aria-labelledby="discord-status-heading">
        <div className="panel-head"><h2 id="discord-status-heading">처리 현황</h2><span className="status-label">{data.configured ? "연동 설정됨" : "연동 준비 필요"}</span></div>
        <div className="discord-stats">
          <div><span>연결된 계정</span><strong>{data.status.linked}</strong></div>
          <div><span>역할 처리 대기</span><strong>{data.status.roles.pending}</strong></div>
          <div><span>역할 처리 실패</span><strong className={data.status.roles.failed ? "warning" : ""}>{data.status.roles.failed}</strong></div>
          <div><span>닉네임 대기</span><strong>{data.status.nicknames.pending}</strong></div>
          <div><span>닉네임 실패</span><strong className={data.status.nicknames.failed ? "warning" : ""}>{data.status.nicknames.failed}</strong></div>
        </div>
        <p className="helper">실패가 계속되면 Discord의 봇 역할 위치와 역할·닉네임 관리 권한을 확인해 주세요. 서버 소유자 또는 봇과 같거나 높은 역할의 계정은 봇이 닉네임을 변경할 수 없습니다.</p>
        <div className="discord-reconcile"><p className="helper">설정 저장 후 전체 연결 계정의 역할과 닉네임을 다시 확인할 수 있습니다.</p><button disabled={disabled || loading || dirty || changed || !data.configured || !settings} onClick={() => void perform("reconcile")}>{busy === "reconcile" ? "요청 중…" : "전체 계정 재동기화"}</button></div>
      </section>
      {!settings || !draft ? <section className="panel empty-state"><h2>운영 환경의 봇 설정이 필요합니다</h2><p>운영 서버에 Discord 서버와 학교 인증 역할을 구성한 뒤 다시 확인해 주세요. 봇 토큰은 이 화면에서 입력하지 않습니다.</p></section> : <section className="panel discord-settings" aria-labelledby="discord-settings-heading">
        <div className="panel-head"><h2 id="discord-settings-heading">역할과 닉네임 설정</h2><small>{dirty ? "저장하지 않은 변경" : "저장된 설정"}</small></div>
        <dl className="detail-list"><div><dt>Discord 서버 ID</dt><dd>{settings.guildId}</dd></div><div><dt>학교 인증 역할 ID</dt><dd>{settings.verificationRoleId}</dd></div></dl>
        <p className="helper">서버와 학교 인증 역할은 운영 환경에서 관리합니다. 학교 인증 사용자는 소모임 회원이 아니어도 연결할 수 있습니다.</p>
        {changed ? <div className="notice notice-error" role="alert"><p>다른 운영자가 설정을 변경했습니다. 최신 설정을 확인한 뒤 다시 수정해 주세요.</p><button className="text-button" disabled={disabled} onClick={() => void load(true)}>입력 취소하고 최신 설정 불러오기</button></div> : null}
        <fieldset disabled={disabled} className="discord-fields">
          <label className="field-label" htmlFor="discord-member-role">현재 Overworld 회원 역할 ID</label><input id="discord-member-role" inputMode="numeric" value={draft.memberRoleId ?? ""} onChange={event => update({ memberRoleId: event.target.value.trim() || null })} maxLength={20} />
          <p className="helper field-help">활성 회원에게만 지급합니다. 비우면 현재 회원 역할을 사용하지 않습니다.</p>
          <label className="field-label" htmlFor="discord-semester">현재 학기</label><input id="discord-semester" placeholder="26-2" value={draft.currentSemester ?? ""} onChange={event => update({ currentSemester: event.target.value.trim() || null })} maxLength={4} />
          <p className="helper field-help">현재 학기 변경 전에 회원 명부를 해당 학기 기준으로 갱신해 주세요. 이전 학기 이력은 유지됩니다. 비우면 새 학기 기록을 시작하지 않습니다.</p>
          <div className="discord-term-heading"><h3>누적 학기 역할</h3><button type="button" disabled={draft.semesterRoles.length >= 40} onClick={() => update({ semesterRoles: [...draft.semesterRoles, { semester: "", roleId: "" }] })}>학기 추가</button></div>
          {draft.semesterRoles.map((row, index) => <div className="discord-term-row" key={index}>
            <label>학기<input aria-label={`학기 ${index + 1}`} value={row.semester} placeholder="26-2" maxLength={4} onChange={event => update({ semesterRoles: draft.semesterRoles.map((item, n) => n === index ? { ...item, semester: event.target.value.trim() } : item) })} /></label>
            <label>역할 ID<input aria-label={`학기 역할 ID ${index + 1}`} value={row.roleId} inputMode="numeric" maxLength={20} onChange={event => update({ semesterRoles: draft.semesterRoles.map((item, n) => n === index ? { ...item, roleId: event.target.value.trim() } : item) })} /></label>
            <button type="button" aria-label={`${row.semester || index + 1} 학기 설정 삭제`} onClick={() => update({ semesterRoles: draft.semesterRoles.filter((_, n) => n !== index) })}>삭제</button>
          </div>)}
          {!draft.semesterRoles.length ? <p className="helper">등록된 학기 역할이 없습니다.</p> : null}
          <p className="helper field-help">학기 기록은 현재 회원 역할과 별개입니다. 실제 역할 지급은 동의와 계정 상태를 확인한 뒤 처리합니다.</p>
          <label className="check-row"><input type="checkbox" checked={draft.nicknameEnabled} onChange={event => update({ nicknameEnabled: event.target.checked })} /><span><strong>서버 닉네임 동기화</strong><small>Minecraft 연결 시 실명 / 게임 이름, 미연결 시 실명으로 반영합니다. 사용자의 추가 동의가 필요합니다.</small></span></label>
        </fieldset>
        {validation ? <p className="helper warning" role="alert">{validation}</p> : null}
        <div className="discord-save"><button className="primary" disabled={disabled || loading || !dirty || Boolean(validation) || changed || !data.configured} onClick={() => void perform("save")}>{busy === "save" ? "저장 중…" : "봇 설정 저장"}</button></div>
      </section>}
    </>}
  </div>;
}
