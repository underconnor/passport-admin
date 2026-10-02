import { useEffect, useEffectEvent, useRef, useState } from "react";
import { api, errorMessage } from "./api";
import { Dialog } from "./Dialog";
import { dateTime } from "./types";
import type { ReportError, ServerDefinition } from "./types";
interface Credential { id: string; serviceId: string; audience: "minecraft" | "discord"; scopes: string[]; serverIds: string[]; expiresAt: string; revokedAt: string | null; createdAt: string }
interface Credentials { credentials: Credential[]; legacyEnabled: boolean }
const presets = { velocity: ["game:policy", "game:events", "game:link", "game:registry", "game:heartbeat", "game:stats:read", "game:players"], paper: ["game:policy", "game:events", "game:heartbeat", "game:presence", "game:stats:write"], discord: ["discord:link", "discord:config", "discord:roles", "discord:nicknames"] };
type Preset = keyof typeof presets;
const scopeLabels: Record<string, string> = { "game:policy": "접근 정책 조회", "game:events": "정책 변경 조회", "game:link": "게임 계정 연결", "game:registry": "서버 목록 조회", "game:heartbeat": "서버 상태 전송", "game:presence": "플레이어 접속 전송", "game:stats:write": "통계 전송", "game:stats:read": "통계 조회", "game:players": "플레이어 조회", "discord:link": "Discord 계정 연결", "discord:config": "봇 설정 조회", "discord:roles": "역할 동기화", "discord:nicknames": "닉네임 동기화" };
export function ServiceCredentialsView({ csrfToken, servers, onError }: { csrfToken: string; servers: ServerDefinition[]; onError: ReportError }) {
  const [data, setData] = useState<Credentials | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [preset, setPreset] = useState<Preset>("paper");
  const [scopes, setScopes] = useState<string[]>([...presets.paper]);
  const [serverId, setServerId] = useState("");
  const [days, setDays] = useState(90);
  const [token, setToken] = useState("");
  const [revoke, setRevoke] = useState<Credential | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);
  const failed = useEffectEvent((failure: unknown) => { setError(errorMessage(failure)); onError(failure); });
  useEffect(() => { const controller = new AbortController(); setError(""); void api<Credentials>("/admin/service-credentials", { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setData(value); }).catch(failure => { if (!controller.signal.aborted) failed(failure); }); return () => controller.abort(); }, [refresh]);
  async function issue(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !scopes.length || (preset === "paper" && !serverId)) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError(""); setNotice(""); setToken("");
    try { const result = await api<{ credential: Credential; token: string }>("/admin/service-credentials", { method: "POST", csrfToken, signal: controller.signal, body: { serviceId, audience: preset === "discord" ? "discord" : "minecraft", scopes, serverIds: preset === "discord" ? [] : preset === "velocity" ? ["*"] : [serverId], expiresAt: new Date(Date.now() + days * 86400000).toISOString() } }); if (controller.signal.aborted) return; setToken(result.token); setExpanded(false); setServiceId(""); setRefresh(value => value + 1); }
    catch (failure) { if (!controller.signal.aborted) { setError(errorMessage(failure)); onError(failure); } }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function revokeKey() {
    if (!revoke || !confirmed || busy) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError("");
    try { await api(`/admin/service-credentials/${revoke.id}`, { method: "DELETE", csrfToken, signal: controller.signal }); if (controller.signal.aborted) return; setRevoke(null); setNotice("연결 키를 회수했습니다. 이후 요청부터 사용할 수 없습니다."); setRefresh(value => value + 1); }
    catch (failure) { if (!controller.signal.aborted) { setError(errorMessage(failure)); onError(failure); } }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section className="service-credentials"><div className="stats-toolbar"><div><h2>서비스 연결 키</h2><p>플러그인과 Discord 봇이 중앙 API에 접속할 때 사용하는 키입니다.</p></div><div className="stats-toolbar-actions"><button disabled={busy} onClick={() => setRefresh(value => value + 1)}>목록 새로고침</button><button className="primary" disabled={busy} onClick={() => { setToken(""); setExpanded(value => !value); }}>새 키 발급</button></div></div>{error ? <p className="notice notice-error" role="alert">{error}</p> : null}{notice ? <p className="notice notice-success" role="status">{notice}</p> : null}{data?.legacyEnabled ? <p className="helper credential-legacy">기존 공용 키 인증도 사용 중입니다. 새 키를 배포한 뒤 서버 설정에서 기존 인증을 종료할 수 있습니다.</p> : null}
    {token ? <section className="panel credential-secret" aria-label="발급된 연결 키"><h3>연결 키가 발급되었습니다.</h3><p>이 화면에서 한 번만 확인할 수 있습니다. 서비스 설정에 보관해 주세요.</p><label className="sr-only" htmlFor="issued-service-key">발급된 연결 키</label><input id="issued-service-key" type="password" value={token} readOnly autoComplete="off" /><div><button onClick={() => void navigator.clipboard.writeText(token).then(() => setNotice("연결 키를 복사했습니다.")).catch(() => setError("복사하지 못했습니다. 연결 키를 선택해 직접 복사해 주세요."))}>연결 키 복사</button><button onClick={() => setToken("")}>확인하고 닫기</button></div></section> : null}
    {expanded ? <form className="panel credential-form" onSubmit={event => void issue(event)}><h3>새 연결 키</h3><label htmlFor="credential-service">서비스 ID</label><input id="credential-service" value={serviceId} onChange={event => setServiceId(event.target.value)} pattern="[a-z][a-z0-9_-]{2,63}" placeholder="paper-survival" required maxLength={64} /><div className="credential-selects"><div><label htmlFor="credential-kind">연결 대상</label><select id="credential-kind" value={preset} onChange={event => { const next = event.target.value as Preset; setPreset(next); setScopes([...presets[next]]); }}><option value="paper">Paper 서버</option><option value="velocity">Velocity 프록시</option><option value="discord">Discord 봇</option></select></div><div><label htmlFor="credential-expiry">유효기간</label><select id="credential-expiry" value={days} onChange={event => setDays(Number(event.target.value))}><option value={30}>30일</option><option value={90}>90일</option><option value={180}>180일</option><option value={365}>365일</option></select></div></div>{preset === "paper" ? <><label htmlFor="credential-server">쓰기 대상 서버</label><select id="credential-server" value={serverId} required onChange={event => setServerId(event.target.value)}><option value="">서버 선택</option>{servers.map(server => <option key={server.id} value={server.id}>{server.label} ({server.id})</option>)}</select><p className="helper">통계·접속·상태 전송을 선택한 서버로 제한합니다. 정책과 변경 내역 조회는 네트워크 전체에 적용됩니다.</p></> : preset === "velocity" ? <p className="helper">프록시는 전체 서버 범위로 발급합니다.</p> : null}<fieldset><legend>허용할 기능</legend>{presets[preset].map(scope => <label key={scope}><input type="checkbox" checked={scopes.includes(scope)} onChange={event => setScopes(current => event.target.checked ? [...current, scope] : current.filter(value => value !== scope))} />{scopeLabels[scope]}</label>)}</fieldset><div className="credential-form-actions"><button type="button" disabled={busy} onClick={() => setExpanded(false)}>취소</button><button className="primary" disabled={busy || !scopes.length}>{busy ? "발급 중…" : "연결 키 발급"}</button></div></form> : null}
    {!data ? <p role="status">연결 키를 불러오는 중입니다.</p> : !data.credentials.length ? <section className="panel empty-state"><h3>등록된 연결 키가 없습니다.</h3></section> : <div className="credential-list">{data.credentials.map(item => { const active = !item.revokedAt && new Date(item.expiresAt).getTime() > Date.now(); return <details className="panel credential-item" key={item.id}><summary><div><strong>{item.serviceId}</strong><span>{item.audience === "minecraft" ? "Minecraft" : "Discord"} · {item.revokedAt ? "회수됨" : active ? "사용 중" : "만료됨"}</span></div><span>⌄</span></summary><dl className="detail-list"><div><dt>유효기간</dt><dd>{dateTime(item.expiresAt)}</dd></div><div><dt>쓰기 대상 서버</dt><dd>{item.serverIds.includes("*") ? "전체 서버" : item.serverIds.join(", ") || "해당 없음"}</dd></div><div><dt>허용 기능</dt><dd>{item.scopes.map(scope => scopeLabels[scope] ?? scope).join(", ")}</dd></div></dl>{active ? <button className="text-button danger" disabled={busy} onClick={() => { setToken(""); setConfirmed(false); setRevoke(item); }}>연결 키 회수</button> : null}</details>; })}</div>}
    {revoke ? <Dialog title="연결 키 회수" busy={busy} onClose={() => setRevoke(null)}><p><strong>{revoke.serviceId}</strong>의 연결 키를 회수합니다. 이 키를 사용하는 서비스의 다음 API 요청부터 거절됩니다.</p><label className="credential-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />대상 서비스와 연결 중단 영향을 확인했습니다.</label><div className="dialog-actions"><button disabled={busy} onClick={() => setRevoke(null)}>취소</button><button className="primary" disabled={busy || !confirmed} onClick={() => void revokeKey()}>회수 확인</button></div></Dialog> : null}
  </section>;
}
