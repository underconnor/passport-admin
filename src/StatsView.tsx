import { useEffect, useEffectEvent, useRef, useState } from "react";
import { api, errorMessage } from "./api";

import { number, statisticsMetrics } from "./statistics";
import type { PlayStatistics } from "./statistics";
import { StatisticsReset } from "./StatisticsReset";
import type { ResetScope } from "./StatisticsReset";
import { MetricIcon } from "./MetricIcon";
import { PeriodFilter, StatisticsHistory } from "./StatisticsHistory";
import type { StatisticsPeriod } from "./StatisticsHistory";
export type { PlayStatistics } from "./statistics";
export { playTime, travelDistance } from "./statistics";

export function StatsView({ endpoint, title = "누적 플레이 기록", onError, csrfToken, canWrite = false, subjectId, subjectLabel }: { endpoint: string; title?: string; onError?: (error: unknown) => void; csrfToken?: string; canWrite?: boolean; subjectId?: string; subjectLabel?: string }) {
  const [resetTarget, setResetTarget] = useState<{ scope: ResetScope; label: string } | null>(null);
  const exportRequest = useRef<AbortController | null>(null);
  useEffect(() => () => { exportRequest.current?.abort(); }, []);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [data, setData] = useState<PlayStatistics | null>(null);
  const [serverId, setServerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<StatisticsPeriod | null>(null);
  const [refresh, setRefresh] = useState(0);
  const failed = useEffectEvent((failure: unknown) => { setError(errorMessage(failure)); onError?.(failure); });
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setData(null); setError("");
    void api<PlayStatistics>(`${endpoint}${period ? `?${new URLSearchParams(period as unknown as Record<string, string>)}` : ""}`, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { const visible = { ...result, servers: result.servers.filter(server => server.collectionEnabled !== false) }; setData(visible); setServerId(current => visible.servers.some(server => server.serverId === current) ? current : ""); }
    }).catch(failure => { if (!controller.signal.aborted) failed(failure); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, refresh, period]);
  const counters = data && (serverId ? data.servers.find(server => server.serverId === serverId) ?? data.totals : data.totals);
  const selectedServer = data?.servers.find(server => server.serverId === serverId);
  const metrics = counters ? statisticsMetrics(counters) : [];
  async function download() {
    if (!canWrite || !csrfToken || exporting) return;
    const controller = new AbortController(); exportRequest.current = controller;
    setExporting(true); setNotice(""); setError("");
    try {
      const file = await api<Blob>("/admin/stats/export", { method: "POST", csrfToken, responseType: "blob", signal: controller.signal, timeoutMs: 60_000, body: { ...(serverId ? { serverId } : {}), ...(subjectId ? { subjectId } : {}), ...(period ?? {}) } });
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(file);
      const link = document.createElement("a"); link.href = url; link.download = "passport-statistics.xlsx"; document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("엑셀 파일을 다운로드했습니다.");
    } catch (failure) { if (!controller.signal.aborted) { setError(errorMessage(failure)); onError?.(failure); } }
    finally { if (!controller.signal.aborted) setExporting(false); }
  }
  return <section className="stats-view" aria-label={title} aria-busy={loading}>
    <div className="stats-toolbar"><div><h2>{title}</h2>{data?.available && data.playerCount !== undefined ? <p>플레이어 {number(data.playerCount)}명 · 수집 대상 서버 합계</p> : <p>서버가 마지막으로 전송한 누적 기록입니다.</p>}</div><div className="stats-toolbar-actions">{canWrite && csrfToken ? <button onClick={() => void download()} disabled={loading || exporting || !data?.available}>{exporting ? "엑셀 준비 중…" : "엑셀 다운로드"}</button> : null}<button onClick={() => setRefresh(current => current + 1)} disabled={loading}>기록 새로고침</button></div></div>
    <PeriodFilter value={period} disabled={loading} onChange={setPeriod} />
    {notice ? <p className="notice notice-success" role="status">{notice}</p> : null}
    {error ? <div className="notice notice-error" role="alert">{error}</div>
      : loading ? <div className="panel empty-state" role="status"><h3>플레이 기록을 불러오고 있어요</h3></div>
      : !data?.available ? <div className="panel empty-state"><h3>플레이 기록 집계를 준비하고 있어요</h3><p>서버의 통계 연결이 완료되면 여기에 표시됩니다.</p></div>
      : <><div className="stats-scope"><label htmlFor={`stats-server-${endpoint.replace(/[^a-z0-9]/g, "-")}`}>서버 선택</label><select id={`stats-server-${endpoint.replace(/[^a-z0-9]/g, "-")}`} disabled={loading || !data.servers.length} value={serverId} onChange={event => setServerId(event.target.value)}><option value="">전체 서버</option>{data.servers.map(server => <option key={server.serverId} value={server.serverId}>{server.label}</option>)}</select></div>
        {data.presence ? <div className={`stats-presence ${data.presence.online ? "is-online" : ""}`} role="status"><span className="presence-dot" /><strong>{data.presence.online ? "접속 중" : "오프라인"}</strong>{data.presence.online && data.presence.serverLabel ? <span>{data.presence.serverLabel}</span> : data.presence.lastSeenAt ? <span>마지막 확인 {new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data.presence.lastSeenAt))}</span> : <span>아직 확인된 접속 기록이 없습니다.</span>}</div> : null}
        {data.onlinePlayerCount !== undefined ? <div className="stats-presence is-online" role="status"><span className="presence-dot" /><strong>현재 접속 {number(serverId ? data.servers.find(server => server.serverId === serverId)?.onlinePlayerCount ?? 0 : data.onlinePlayerCount)}명</strong><span>{serverId ? data.servers.find(server => server.serverId === serverId)?.label : "전체 서버"}</span></div> : null}
        {!serverId && Boolean(data.collection?.excludedServerIds.length) ? <p className="stats-scope-note">수집이 꺼진 서버는 전체 합계에서 제외됩니다. 기존 기록은 보관됩니다.</p> : null}
        <div className="stats-grid">{metrics.map(metric => <article className="panel stats-metric" key={metric.label}><span className="stats-metric-label"><MetricIcon name={metric.icon} />{metric.label}</span><strong>{metric.value}</strong><small>{metric.unit}</small></article>)}</div>
        <StatisticsHistory data={data} serverId={serverId} />
        {canWrite && csrfToken ? <div className="stats-reset-actions"><p>필요한 범위를 선택한 뒤 초기화 영향을 확인할 수 있습니다.</p><button className="text-button danger" disabled={loading} onClick={() => { setNotice(""); setResetTarget(subjectId ? { scope: { scope: "subject", subjectId }, label: subjectLabel ?? "선택한 회원" } : serverId ? { scope: { scope: "server", serverId }, label: selectedServer?.label ?? serverId } : { scope: { scope: "all" }, label: "전체 통계" }); }}>{subjectId ? "이 회원 전체 통계 초기화" : serverId ? "이 서버 통계 초기화" : "전체 통계 초기화"}</button></div> : null}
        {!data.servers.length ? <p className="helper stats-empty">아직 집계된 서버 기록이 없습니다. 연결한 계정으로 플레이하면 기록이 쌓입니다.</p> : null}
      </>}
    {canWrite && csrfToken && resetTarget ? <StatisticsReset scope={resetTarget.scope} targetLabel={resetTarget.label} csrfToken={csrfToken} onClose={() => setResetTarget(null)} onSaved={() => { setResetTarget(null); setNotice("선택한 범위의 통계를 초기화했습니다."); setRefresh(value => value + 1); }} onError={onError} /> : null}
  </section>;
}
