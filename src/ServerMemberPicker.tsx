import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { api, errorMessage } from "./api";
import type { Member, MembersPage, ReportError } from "./types";

const PAGE_SIZE = 10;
type PickerTab = "search" | "selected";
type Result = MembersPage & { key: string; error: string | null };

export function ServerMemberPicker({ selected, onToggle, disabled, onError }: {
  selected: string[]; onToggle: (id: string, checked: boolean) => void;
  disabled: boolean; onError: ReportError;
}) {
  const id = useId();
  const [tab, setTab] = useState<PickerTab>("search");
  const [search, setSearch] = useState({ value: "", cursors: [null] as (string | null)[], page: 0 });
  const [selectedPage, setSelectedPage] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [retry, setRetry] = useState(0);
  const sequence = useRef(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const query = search.value.trim();
  const page = Math.min(selectedPage, Math.max(0, Math.ceil(selected.length / PAGE_SIZE) - 1));
  const pageIds = selected.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (tab === "selected") params.set("ids", pageIds.join(","));
  else {
    params.set("q", query);
    const cursor = search.cursors[search.page];
    if (cursor) params.set("cursor", cursor);
  }
  const url = (tab === "selected" ? pageIds.length > 0 : Boolean(query)) ? `/admin/members?${params}` : null;
  const key = `${tab}:${url ?? ""}`;
  const current = result?.key === key ? result : null;
  const loading = Boolean(url && !current);

  useEffect(() => {
    const request = ++sequence.current;
    const controller = new AbortController();
    if (!url) return () => controller.abort();
    setResult(null);
    const timer = window.setTimeout(() => {
      void api<MembersPage>(url, { signal: controller.signal }).then(response => {
        if (!controller.signal.aborted && request === sequence.current) setResult({ ...response, key, error: null });
      }).catch(failure => {
        if (!controller.signal.aborted && request === sequence.current) {
          setResult({ key, members: [], total: 0, nextCursor: null, error: errorMessage(failure) });
          onError(failure);
        }
      });
    }, tab === "search" ? 250 : 0);
    return () => { controller.abort(); window.clearTimeout(timer); ++sequence.current; };
  }, [url, key, tab, retry, onError]);

  function changeTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
    setTab(next ? "selected" : "search"); tabRefs.current[next]?.focus();
  }
  const resolved = new Map(current?.members.map(member => [member.id, member]));
  const rows: { id: string; member?: Member }[] = tab === "selected"
    ? pageIds.map(memberId => ({ id: memberId, member: resolved.get(memberId) }))
    : (current?.members ?? []).map(member => ({ id: member.id, member }));
  return <fieldset className="server-scope server-member-picker" disabled={disabled}>
    <legend>허용할 회원</legend>
    <div className="server-picker-tabs" role="tablist" aria-label="회원 선택 목록">
      {(["search", "selected"] as const).map((value, index) => <button type="button" key={value}
        id={`${id}-${value}-tab`} role="tab" aria-selected={tab === value} aria-controls={`${id}-${value}-panel`}
        tabIndex={tab === value ? 0 : -1} ref={element => { tabRefs.current[index] = element; }}
        onClick={() => setTab(value)} onKeyDown={event => changeTab(event, index)}>
        {value === "search" ? "회원 검색" : `선택됨 ${selected.length}명`}
      </button>)}
    </div>
    <div id={`${id}-${tab}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}-tab`}>
      {tab === "search" ? <>
        <label className="field-label" htmlFor={`${id}-query`}>회원 찾기</label>
        <input id={`${id}-query`} type="search" value={search.value} maxLength={100} autoComplete="off"
          placeholder="실명, 전체 학번, 게임 이름, Discord"
          aria-describedby={`${id}-search-help`} onChange={event => setSearch({ value: event.target.value, cursors: [null], page: 0 })} />
        <p id={`${id}-search-help`} className="helper field-help">검색 결과는 10명씩 표시합니다. 선택한 회원은 검색을 바꿔도 유지됩니다.</p>
      </> : <p className="helper field-help">선택을 해제한 뒤 설정을 저장하면 해당 회원이 이 목록에서 제외됩니다.</p>}
      <div className="server-picker-status" role="status" aria-live="polite">
        {loading ? "회원 정보를 불러오는 중…" : tab === "search" ? query ? current?.error ? "검색 결과를 불러오지 못했습니다." : `검색 결과 ${current?.total ?? 0}명` : "검색어를 입력해 회원을 찾아 주세요." : `${selected.length}명 선택 · ${selected.length ? `${page + 1} / ${Math.ceil(selected.length / PAGE_SIZE)}페이지` : "선택한 회원이 없습니다."}`}
      </div>
      {current?.error ? <div className="server-picker-error" role="alert"><p>{tab === "selected" ? "회원 정보를 확인하지 못했습니다. 기존 선택은 유지됩니다." : current.error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>다시 불러오기</button></div> : null}
      <div className="server-picker-results" aria-busy={loading}>
        {rows.map(row => <label className="check-row" key={row.id}>
          <input type="checkbox" value={row.id} checked={selected.includes(row.id)} onChange={event => onToggle(row.id, event.target.checked)} />
          <span><strong>{row.member?.displayName ?? (loading ? "회원 정보 확인 중…" : "회원 정보를 확인할 수 없습니다")}{row.member?.identityProvider === "managed-development" ? <span className="development-badge">개발</span> : null}</strong>
            {row.member ? <><small>{row.member.identityProvider === "managed-development" ? "학교 계정 없음 · 테스트 설정 적용" : <>{row.member.studentId || "학번 정보 없음"} · {row.member.department || "학과 정보 없음"}</>}</small>
              <small>{row.member.minecraft?.name || "게임 연결 전"} · {row.member.identityProvider === "managed-development" ? row.member.developmentAccount?.discordLinked ? "Discord 연동 가정" : "Discord 미연동 가정" : row.member.discordConnection?.displayName || row.member.discordConnection?.username || "Discord 연결 전"}</small></>
              : <small className="server-picker-unresolved">{row.id} · 선택 유지</small>}
          </span>
        </label>)}
        {!loading && !current?.error && query && tab === "search" && !rows.length ? <p className="helper">일치하는 회원이 없습니다. 검색어를 확인해 주세요.</p> : null}
      </div>
      {tab === "search" && query && Boolean(current?.total || search.page > 0) ? <nav className="server-picker-pagination" aria-label="검색 결과 페이지">
        <button type="button" disabled={loading || search.page === 0} onClick={() => setSearch(value => ({ ...value, page: value.page - 1 }))}>검색 이전</button>
        <span>{search.page + 1}페이지</span>
        <button type="button" disabled={loading || !current?.nextCursor} onClick={() => { const cursor = current?.nextCursor; if (cursor) setSearch(value => ({ ...value, page: value.page + 1, cursors: [...value.cursors.slice(0, value.page + 1), cursor] })); }}>검색 다음</button>
      </nav> : null}
      {tab === "selected" && selected.length > PAGE_SIZE ? <nav className="server-picker-pagination" aria-label="선택한 회원 페이지">
        <button type="button" disabled={page === 0} onClick={() => setSelectedPage(page - 1)}>선택 이전</button>
        <span>{page + 1} / {Math.ceil(selected.length / PAGE_SIZE)}</span>
        <button type="button" disabled={(page + 1) * PAGE_SIZE >= selected.length} onClick={() => setSelectedPage(page + 1)}>선택 다음</button>
      </nav> : null}
    </div>
    {!selected.length ? <p className="helper warning">선택한 회원이 없어 모든 회원의 접속이 제한됩니다.</p> : null}
  </fieldset>;
}
